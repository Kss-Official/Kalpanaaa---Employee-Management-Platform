import { PerformanceFeedback, UserRole, Employee } from '../types';
import { db, cleanFirestorePayload, subscribeWithRecovery } from './firebase';
import { collection, setDoc, doc, getDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { tierOf, canViewTier, isSamePerson, isAuthorizedTechLead, TIER_EMPLOYEE, TIER_PM } from './hierarchy';

/**
 * There is deliberately no seeded feedback list.
 *
 * This module previously shipped three fully-written appraisals -- named
 * employees, star ratings, "high potential candidate" leadership notes, dated
 * acknowledgements -- and `getStoredFeedbacks()` returned them whenever
 * localStorage was empty. Every employee therefore opened a brand-new install
 * and found an invented performance review of themselves, signed by the CEO.
 * Appraisal records must originate from a real reviewer submission and nowhere
 * else.
 */

const LOCAL_STORAGE_KEY = 'kss_performance_feedbacks';

/**
 * Narrow a feedback list to what this viewer is entitled to see.
 *
 * This is the DISPLAY filter. The enforceable boundary is `firestore.rules`
 * plus the scoped queries in `subscribeToFeedbacks` -- this function exists so
 * the UI never renders a row the server would have refused, and so a widened
 * query can't quietly widen visibility.
 *
 * Tier policy (src/lib/hierarchy.ts):
 *   CTO ⇄ CEO (5), HR (3), and Authorized Tech Leads hold the appraisal record.
 *   PM (2) sees tier-1 employees, reviews it authored, and reviews about itself.
 *   Employee (1) sees only reviews about itself.
 */
export function filterFeedbacksByRole(
  feedbacks: PerformanceFeedback[],
  activeEmployee: Employee | null,
  role: UserRole | string
): PerformanceFeedback[] {
  if (!activeEmployee) return [];

  // Tech leads have authorized cross-employee feedback access
  if (isAuthorizedTechLead(activeEmployee)) {
    return feedbacks;
  }

  // `role` is the session's effective role and wins when the directory record
  // has not loaded a role yet; tierOf reads the employee record itself.
  const viewerTier = Math.max(
    tierOf(activeEmployee),
    tierOf({ role: activeEmployee.role || role })
  );

  const isMine = (fb: PerformanceFeedback) =>
    isSamePerson(activeEmployee, { id: fb.targetEmployeeId, employeeId: fb.targetEmployeeCode });
  const isAuthoredByMe = (fb: PerformanceFeedback) =>
    isSamePerson(activeEmployee, { id: fb.reviewerId });

  return feedbacks.filter(fb => {
    // A review about you is always yours to read, whatever tier you are on.
    if (isMine(fb)) return true;
    // So is one you wrote -- a PM must be able to see its own review of an
    // employee who has since been promoted past tier 1.
    if (isAuthoredByMe(fb)) return true;
    // Legacy rows written before subjectTier existed fail CLOSED: an unknown
    // subject tier must not be treated as the most permissive one.
    const subjectTier = typeof fb.subjectTier === 'number' ? fb.subjectTier : Number.MAX_SAFE_INTEGER;
    return canViewTier(viewerTier, subjectTier, activeEmployee);
  });
}

/**
 * The leadership note that goes with a review, stored OUT of the review document.
 *
 * P0 FIX: `privateLeadershipNotes` used to be a field on the feedback document
 * itself, hidden behind `{isExecutive && ...}` in the UI. Firestore has no
 * field-level read security, so the subject of the review -- who is entitled to
 * read that document, and must be, in order to acknowledge it -- could open
 * devtools and read the note about themselves. "Only visible to Executive
 * Admins" was true of the markup and false of the data.
 *
 * It now lives at /performanceFeedbacks/{id}/confidential/notes, which rules
 * restrict to isConfigAdmin() -- exactly the HR-and-board tier that writes it.
 */
const confidentialNoteRef = (feedbackId: string) =>
  doc(db, 'performanceFeedbacks', feedbackId, 'confidential', 'notes');

export async function saveConfidentialNote(feedbackId: string, text: string): Promise<boolean> {
  try {
    await setDoc(confidentialNoteRef(feedbackId), {
      text,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error saving confidential note:', error);
    return false;
  }
}

/**
 * Read a leadership note on demand.
 *
 * Deliberately not part of the list subscription: it is one extra billed read per
 * note, and a confidential note should be revealed on purpose rather than sit on
 * screen through every scroll and screenshare.
 *
 * Returns null when there is no note or the caller is not entitled to it -- the
 * caller cannot distinguish the two, which is the point.
 */
export async function fetchConfidentialNote(feedbackId: string): Promise<string | null> {
  try {
    const snap = await getDoc(confidentialNoteRef(feedbackId));
    if (!snap.exists()) return null;
    const text = String(snap.data()?.text || '').trim();
    return text.length > 0 ? text : null;
  } catch (error) {
    console.error('Error reading confidential note:', error);
    return null;
  }
}

/**
 * Save new or updated performance feedback to Firestore and LocalStorage
 */
export async function savePerformanceFeedback(feedback: PerformanceFeedback): Promise<{ success: boolean; message: string }> {
  try {
    const payload = cleanFirestorePayload({
      ...feedback,
      updatedAt: new Date().toISOString()
    });

    await setDoc(doc(db, 'performanceFeedbacks', feedback.id), payload, { merge: true });

    // Update local cache
    const existing = getStoredFeedbacks();
    const updated = [payload as PerformanceFeedback, ...existing.filter(f => f.id !== feedback.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    return { success: true, message: 'Performance feedback successfully recorded & sent!' };
  } catch (error: any) {
    console.error('Error saving performance feedback:', error);

    // A rejected write is NOT an offline write. Reporting success for
    // permission-denied told the reviewer their appraisal had been delivered
    // while the server had refused it outright, and it would never reach the
    // employee. Only queue genuinely transient failures.
    const code = String(error?.code || '');
    if (code === 'permission-denied' || code === 'invalid-argument' || code === 'failed-precondition') {
      return {
        success: false,
        message: code === 'permission-denied'
          ? 'Not permitted: you can only file a review under your own account, and not about yourself.'
          : 'Rejected by the server. Check the rating (1-5) and that a valid employee is selected.'
      };
    }

    const existing = getStoredFeedbacks();
    const updated = [feedback, ...existing.filter(f => f.id !== feedback.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return { success: false, message: 'Offline — feedback queued locally and not yet delivered.' };
  }
}

/**
 * Acknowledge feedback by the target employee
 */
export async function acknowledgePerformanceFeedback(feedbackId: string): Promise<boolean> {
  const ackDate = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'performanceFeedbacks', feedbackId), {
      isAcknowledged: true,
      acknowledgedAt: ackDate,
      updatedAt: ackDate
    });

    const existing = getStoredFeedbacks();
    const updated = existing.map(f => f.id === feedbackId ? { ...f, isAcknowledged: true, acknowledgedAt: ackDate, updatedAt: ackDate } : f);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err: any) {
    console.error('Error acknowledging feedback:', err);
    try {
      await setDoc(doc(db, 'performanceFeedbacks', feedbackId), {
        isAcknowledged: true,
        acknowledgedAt: ackDate,
        updatedAt: ackDate
      }, { merge: true });
      const existing = getStoredFeedbacks();
      const updated = existing.map(f => f.id === feedbackId ? { ...f, isAcknowledged: true, acknowledgedAt: ackDate, updatedAt: ackDate } : f);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return true;
    } catch (fallbackErr) {
      console.error('Fallback setDoc acknowledge error:', fallbackErr);
    }
    return false;
  }
}

/**
 * Delete feedback (Only Author or Super Admin)
 */
export async function deletePerformanceFeedback(feedbackId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'performanceFeedbacks', feedbackId));
    const existing = getStoredFeedbacks();
    const updated = existing.filter(f => f.id !== feedbackId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Error deleting feedback:', err);
    return false;
  }
}

/** Last-known feedback, used only to paint the first frame before Firestore answers. */
export function getStoredFeedbacks(): PerformanceFeedback[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

/**
 * Every query this viewer is provably allowed to run, as a list.
 *
 * P0 FIX: both views listened to the whole `performanceFeedbacks` COLLECTION.
 * Firestore rejects a query outright when its rules cannot be satisfied for
 * every document the query could return, so the employee-facing listener was
 * permission-denied in production and the view silently fell back to whatever
 * localStorage happened to hold.
 *
 * A single query cannot OR across different fields, and a PM's entitlement spans
 * three of them (tier-1 subjects, reviews it authored, reviews about itself), so
 * this returns one query per disjunct of the read rule and the caller merges
 * them. Each is a bare equality filter with client-side sorting, so none of them
 * needs a composite index.
 */
export function feedbackQueriesFor(activeEmployee: Employee | null, role: UserRole | string) {
  const base = collection(db, 'performanceFeedbacks');
  if (!activeEmployee) return [];

  // Authorized Tech Leads hold full cross-workforce review access
  if (isAuthorizedTechLead(activeEmployee)) {
    return [base];
  }

  const viewerTier = Math.max(
    tierOf(activeEmployee),
    tierOf({ role: activeEmployee.role || role })
  );

  // Executive board and HR have a blanket read, so one collection-wide listen is
  // both permitted and cheapest.
  if (viewerTier > TIER_PM) return [base];

  const code = activeEmployee.employeeId;
  const selfId = activeEmployee.id;
  const qs = [];

  if (viewerTier === TIER_PM) {
    // Satisfies `isProjectManager() && subjectTier == TIER_EMPLOYEE`.
    qs.push(query(base, where('subjectTier', '==', TIER_EMPLOYEE)));
    // Satisfies `isAuthor()`.
    if (selfId) qs.push(query(base, where('reviewerId', '==', selfId)));
  }

  // Satisfies `isSubject()` via the bare employee code, which is the key
  // firestore.rules resolves through getEmployeeId().
  if (code) qs.push(query(base, where('targetEmployeeCode', '==', code)));

  return qs;
}

/**
 * Live subscription to this viewer's feedback, merged across every query their
 * tier entitles them to run.
 *
 * Results are keyed by document id per query so a row that two queries both
 * return -- a PM's own review of a tier-1 employee, for instance -- appears
 * once, and so a document leaving one query's result set does not delete it from
 * another's.
 */
export function subscribeToFeedbacks(
  activeEmployee: Employee | null,
  role: UserRole | string,
  onData: (rows: PerformanceFeedback[]) => void,
  onError?: (err: any) => void
): () => void {
  const queries = feedbackQueriesFor(activeEmployee, role);
  if (queries.length === 0) {
    // No provably-readable subset: listening would only produce a
    // permission-denied loop. Report empty rather than leaving stale rows up.
    onData([]);
    return () => {};
  }

  const buckets: PerformanceFeedback[][] = queries.map(() => []);

  const emit = () => {
    const byId = new Map<string, PerformanceFeedback>();
    for (const bucket of buckets) {
      for (const fb of bucket) if (fb?.id) byId.set(fb.id, fb);
    }
    const merged = Array.from(byId.values());
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    onData(merged);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
    } catch (e) { /* quota or private mode -- the live list is still correct */ }
  };

  const unsubs = queries.map((q, i) =>
    subscribeWithRecovery(
      q,
      (snapshot: any) => {
        // No `if (!snapshot.empty)` guard: an empty result is a real answer.
        // Skipping it left deleted reviews on screen indefinitely, because state
        // stayed at whatever the previous snapshot or the local cache had put there.
        const rows: PerformanceFeedback[] = [];
        snapshot.forEach((d: any) => rows.push(d.data() as PerformanceFeedback));
        buckets[i] = rows;
        emit();
      },
      onError
    )
  );

  return () => unsubs.forEach(u => u && u());
}
