// Resume storage — kept OFF the employees/{id} document.
//
// WHY THIS EXISTS
// ---------------
// `resumeUrl` used to live inline on employees/{id} as an *uncompressed* base64
// data URL (EmployeeFormModal only compresses the photo branch, not the resume).
// Every client attaches a collection-wide listener to /employees, so each one
// streamed every employee's entire resume on first sync — the single largest
// egress item in the project by a wide margin, and it scaled with headcount.
//
// Resumes are also write-only in this app: there is no screen that reads, links,
// previews, downloads or exports one. So moving the bytes to a subcollection that
// nobody listens to removes the egress without removing a feature.
//
// SAFETY: rules do not cascade to subcollections
// ----------------------------------------------
// A subcollection is denied by default until firestore.rules is deployed (see the
// /employees/{employeeId}/private/{docId} block, added alongside this file but NOT
// yet deployed). Because the create form hard-requires a resume, a naive version
// of this change would break employee creation on any project running the old
// rules. Every write here therefore reports success/failure instead of throwing,
// and callers fall back to the legacy inline field when it fails. The app behaves
// identically whether or not the rules have been deployed.

import { doc, getDoc, setDoc, getDocs, collection, deleteField } from 'firebase/firestore';
import { db } from './firebase';
import type { Employee } from '../types';

export interface EmployeeResumeDoc {
  dataUrl: string;
  fileName: string;
  contentType: string;
  uploadedAt: string;
}

const resumeRef = (employeeId: string) => doc(db, 'employees', employeeId, 'private', 'resume');

/** Pull the mime type back out of a `data:<type>;base64,…` URL. */
function inferContentType(dataUrl: string): string {
  const match = /^data:([^;,]+)[;,]/.exec(dataUrl);
  return match ? match[1] : 'application/octet-stream';
}

/**
 * Store a resume at employees/{id}/private/resume.
 *
 * Returns `true` when the blob is safely in the subcollection and the caller may
 * omit it from the parent document, `false` when the write was rejected — in
 * which case the caller MUST keep writing it inline so nothing is lost.
 */
export async function writeEmployeeResume(
  employeeId: string,
  dataUrl: string,
  fileName = ''
): Promise<boolean> {
  if (!employeeId || !dataUrl) return false;
  try {
    await setDoc(resumeRef(employeeId), {
      dataUrl,
      fileName,
      contentType: inferContentType(dataUrl),
      uploadedAt: new Date().toISOString(),
    } satisfies EmployeeResumeDoc);
    return true;
  } catch (err) {
    // Expected while the subcollection rule is undeployed. Not an error state:
    // the caller falls back to the pre-existing inline field.
    console.warn(
      `[Resume] Could not write employees/${employeeId}/private/resume — keeping the resume inline instead. This is expected until firestore.rules is deployed.`,
      err
    );
    return false;
  }
}

/**
 * Fetch an employee's resume: subcollection first, then the legacy inline field,
 * so records are readable at every stage of the migration. One targeted read of a
 * single document — never a collection scan.
 */
export async function readEmployeeResume(employee: Pick<Employee, 'id' | 'resumeUrl'>): Promise<string | null> {
  try {
    const snap = await getDoc(resumeRef(employee.id));
    if (snap.exists()) {
      const dataUrl = String(snap.data()?.dataUrl || '');
      if (dataUrl) return dataUrl;
    }
  } catch {
    /* fall through to the inline field */
  }
  return employee.resumeUrl || null;
}

export interface ResumeBackfillReport {
  scanned: number;
  migrated: number;
  alreadyMigrated: number;
  noResume: number;
  failed: number;
  failures: string[];
  dryRun: boolean;
}

/**
 * ONE-TIME migration: move every inline resume into its subcollection and clear
 * the field from the parent document. Egress does not actually drop until this has
 * run — new writes stop adding blobs, but existing rows keep theirs.
 *
 * Must be run by a signed-in HR/admin account (the subcollection is admin-write
 * only) and AFTER firestore.rules has been deployed; without the rule every write
 * is denied and the report comes back all-failed, having changed nothing.
 *
 * Safe to re-run: already-migrated records are skipped, and the parent field is
 * cleared only after the subcollection write for that record has succeeded — so an
 * interrupted run never loses a resume. Defaults to a DRY RUN.
 */
export async function backfillEmployeeResumes(options: { dryRun?: boolean } = {}): Promise<ResumeBackfillReport> {
  const dryRun = options.dryRun !== false;
  const report: ResumeBackfillReport = {
    scanned: 0, migrated: 0, alreadyMigrated: 0, noResume: 0, failed: 0, failures: [], dryRun,
  };

  const snap = await getDocs(collection(db, 'employees'));
  report.scanned = snap.size;

  for (const empDoc of snap.docs) {
    const data = empDoc.data() as Partial<Employee>;
    const inline = typeof data.resumeUrl === 'string' ? data.resumeUrl : '';

    if (!inline) {
      if (data.hasResume) report.alreadyMigrated++;
      else report.noResume++;
      continue;
    }

    if (dryRun) { report.migrated++; continue; }

    // Order is deliberate: write the copy, confirm it landed, and only then drop
    // the original. Reversing these would risk destroying the only copy.
    const stored = await writeEmployeeResume(empDoc.id, inline, `${data.employeeId || empDoc.id}-resume`);
    if (!stored) {
      report.failed++;
      report.failures.push(empDoc.id);
      continue;
    }

    try {
      await setDoc(doc(db, 'employees', empDoc.id), { hasResume: true, resumeUrl: deleteField() }, { merge: true });
      report.migrated++;
    } catch (err) {
      // The copy exists but the parent still holds the blob. Harmless and
      // idempotent — the next run retries the clear.
      report.failed++;
      report.failures.push(`${empDoc.id} (copied, parent not cleared)`);
      console.error(`[Resume] Copied ${empDoc.id} but could not clear the inline field.`, err);
    }
  }

  console.info('[Resume] Backfill report', report);
  return report;
}
