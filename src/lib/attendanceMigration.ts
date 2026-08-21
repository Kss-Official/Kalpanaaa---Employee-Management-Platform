import { collection, getDocs, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getEmployeeWorkDate, getAttendanceDocId, getCanonicalEmployeeUid, formatTimestampToISO, isFabricatedCheckoutOnly, isFabricatedShiftPair } from './attendanceEngine';
import { AttendanceRecord, Employee } from '../types';

export interface MigrationResult {
  totalScanned: number;
  migratedCount: number;
  skippedExisting: number;
  alreadyCanonical: number;
  repairedCount: number;
  errors: string[];
}

/**
 * Resolve the TRUE canonical uid for an attendance doc by looking up the actual
 * employee record (Firebase Auth uid preferred). Deriving the uid purely from the
 * doc's own fields (id/code) produces a DIFFERENT canonical id than the one
 * recordCheckIn writes ({authUid}_{date}) — which is exactly how duplicate
 * same-day documents (and the stale Check-In UI vs "Already checked in" backend
 * mismatch) were created in the first place.
 */
function resolveTrueEmpUid(
  data: any,
  legacyId: string,
  employeesByCode: Map<string, Employee>,
  employeesById: Map<string, Employee>,
  employeesByName: Map<string, Employee>
): string {
  const direct = getCanonicalEmployeeUid({
    uid: data.uid || data.employeeUid,
    id: data.employeeId,
    employeeId: data.employeeCode || data.employeeId
  });

  const candidates = [data.employeeCode, data.employeeId, direct].filter(Boolean).map(String);
  for (const c of candidates) {
    const emp = employeesByCode.get(c.toLowerCase()) || employeesById.get(c.toLowerCase());
    if (emp) return getCanonicalEmployeeUid(emp);
  }

  const name = String(data.employeeName || '').trim().toLowerCase();
  if (name) {
    const emp = employeesByName.get(name);
    if (emp) return getCanonicalEmployeeUid(emp);
  }

  // Legacy doc-id formats: {code}_{date} / {id}_{date}
  if (legacyId.includes('_')) {
    const prefix = legacyId.split('_')[0].toLowerCase();
    const emp = employeesByCode.get(prefix) || employeesById.get(prefix);
    if (emp) return getCanonicalEmployeeUid(emp);
  }

  return direct;
}

/**
 * P0 REPAIR ("Shift Complete everywhere" incident):
 *
 * An earlier version of this migration FABRICATED attendance facts — inventing
 * checkInAt 09:45 / checkOutAt 19:30 IST (+05:30 literal strings), fake breaks
 * and 564 working minutes — for any legacy document whose canonical target was
 * missing. Every portal derives shift completion from `!!checkOutAt`, so one
 * fabricated checkout instantly showed "Shift Complete" for that employee on
 * ALL portals, and the corruption persisted in Firestore.
 *
 * Genuine timestamps can never match these signatures:
 *   - real check-ins/check-outs are Firestore server Timestamps (objects)
 *   - genuine system auto-checkouts store UTC "Z" ISO strings (.toISOString())
 * Only the fabricated literals carry the `+05:30` suffix at exactly 09:45/19:30.
 *
 * Repair rules (conservative, idempotent):
 *   - Fabricated PAIR (09:45 + 19:30, no SYSTEM auto-checkout note): reset the
 *     record to an open state (null timestamps, zeroed minutes, no breaks).
 *   - Fabricated checkout ONLY (real check-in preserved): null just checkOutAt.
 * Returns a merge patch, or null when nothing needs repairing.
 */
function buildFabricationRepairPatch(data: any): any | null {
  const hasAutoNote = typeof data.notes === 'string' && data.notes.includes('SYSTEM: Auto-checked out');
  if (hasAutoNote) return null;

  const fabricatedPair = isFabricatedShiftPair(data.checkInAt, data.checkOutAt);
  const fabricatedCheckout = isFabricatedCheckoutOnly(data.checkOutAt);
  if (!fabricatedCheckout) return null;

  const patch: any = {
    updatedAt: new Date().toISOString()
  };

  if (fabricatedPair && Number(data.workingMinutes) === 564) {
    // Entire shift is invented — reopen the day.
    patch.checkInAt = null;
    patch.checkOutAt = null;
    patch.workingMinutes = 0;
    patch.totalBreakMinutes = 0;
    patch.breaks = [];
    patch.notes = ((typeof data.notes === 'string' ? data.notes + ' | ' : '') +
      'MIGRATION REPAIR: removed fabricated shift timestamps').trim();
  } else {
    // Real check-in survived — only the checkout was invented.
    patch.checkOutAt = null;
    patch.notes = ((typeof data.notes === 'string' ? data.notes + ' | ' : '') +
      'MIGRATION REPAIR: removed fabricated check-out timestamp').trim();
  }

  return patch;
}

/**
 * One-time migration function that copies legacy attendance documents
 * into the deterministic `attendance/{uid}_{YYYY-MM-DD}` schema,
 * preserving original timestamps, breaks, and employee identifiers.
 * IDEMPOTENT.
 *
 * P0 CONTRACT: this migration NEVER invents attendance data. A record without
 * a real check-out must stay open — SHIFT_COMPLETE may only ever be derived
 * from a checkout that actually exists.
 */
export async function runAttendanceMigration(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalScanned: 0,
    migratedCount: 0,
    skippedExisting: 0,
    alreadyCanonical: 0,
    repairedCount: 0,
    errors: []
  };

  try {
    const snap = await getDocs(collection(db, 'attendance'));
    result.totalScanned = snap.size;

    // Index real employees once so legacy docs resolve to the SAME canonical uid
    // that recordCheckIn/recordCheckOut derive from the full employee object.
    const employeesByCode = new Map<string, Employee>();
    const employeesById = new Map<string, Employee>();
    const employeesByName = new Map<string, Employee>();
    try {
      const empSnap = await getDocs(collection(db, 'employees'));
      empSnap.forEach(d => {
        const e = d.data() as Employee;
        if (e.employeeId) employeesByCode.set(String(e.employeeId).toLowerCase(), e);
        if (e.id) employeesById.set(String(e.id).toLowerCase(), e);
        if (e.fullName) employeesByName.set(e.fullName.trim().toLowerCase(), e);
      });
    } catch { /* identity resolution degrades gracefully to doc-field derivation */ }

    for (const docSnap of snap.docs) {
      const legacyId = docSnap.id;
      let data: any = { ...docSnap.data() };

      const canonicalUid = resolveTrueEmpUid(data, legacyId, employeesByCode, employeesById, employeesByName);

      const dateStr = getEmployeeWorkDate(data.date || formatTimestampToISO(data.createdAt) || formatTimestampToISO(data.checkInAt) || (legacyId.includes('_') ? legacyId.split('_')[1] : new Date()));
      const targetCanonicalId = getAttendanceDocId(canonicalUid, dateStr);

      // ── P0 repair pass: undo previously fabricated shifts (any doc, incl. canonical)
      const repairPatch = buildFabricationRepairPatch(data);
      if (repairPatch) {
        try {
          await setDoc(doc(db, 'attendance', legacyId), repairPatch, { merge: true });
          data = { ...data, ...repairPatch };
          result.repairedCount++;
        } catch (err: any) {
          result.errors.push(`Failed repairing ${legacyId}: ${err.message}`);
        }
      }

      if (legacyId === targetCanonicalId) {
        // Normalize in-place if date is not string
        if (typeof data.date !== 'string' || data.date !== dateStr) {
          await setDoc(doc(db, 'attendance', targetCanonicalId), { date: dateStr, updatedAt: formatTimestampToISO(data.updatedAt) || new Date().toISOString() }, { merge: true });
        }
        result.alreadyCanonical++;
        continue;
      }

      try {
        const targetDocRef = doc(db, 'attendance', targetCanonicalId);
        const targetDocSnap = await getDoc(targetDocRef);

        if (targetDocSnap.exists()) {
          // Merge anything the legacy dup knows that the canonical doc lacks,
          // then remove the duplicate so frontend & backend resolve ONE record.
          // ONLY real data is copied — never defaults.
          const target = targetDocSnap.data();
          const patch: any = {};
          if (!target.checkInAt && data.checkInAt) patch.checkInAt = data.checkInAt;
          if (!target.checkOutAt && data.checkOutAt) patch.checkOutAt = data.checkOutAt;
          if ((!Array.isArray(target.breaks) || target.breaks.length === 0) && Array.isArray(data.breaks) && data.breaks.length > 0) patch.breaks = data.breaks;
          if (!target.status && data.status) patch.status = data.status;
          if ((!target.workingMinutes || target.workingMinutes <= 0) && data.workingMinutes > 0) patch.workingMinutes = data.workingMinutes;
          if ((!target.totalBreakMinutes || target.totalBreakMinutes <= 0) && data.totalBreakMinutes > 0) patch.totalBreakMinutes = data.totalBreakMinutes;
          if (Object.keys(patch).length > 0) {
            patch.updatedAt = formatTimestampToISO(data.updatedAt) || new Date().toISOString();
            await setDoc(targetDocRef, patch, { merge: true });
          }
          result.skippedExisting++;
          await deleteDoc(doc(db, 'attendance', legacyId)).catch(() => {});
          continue;
        }

        // Migrate the legacy doc as-is. Missing timestamps stay missing — an
        // open shift must NEVER be converted into a completed one.
        const checkInISO = formatTimestampToISO(data.checkInAt);
        const checkOutISO = formatTimestampToISO(data.checkOutAt);
        const createdISO = formatTimestampToISO(data.createdAt) || checkInISO || new Date().toISOString();
        const updatedISO = formatTimestampToISO(data.updatedAt) || checkOutISO || createdISO;

        const migratedRecord: Record<string, any> = {
          ...data,
          id: targetCanonicalId,
          uid: canonicalUid,
          employeeUid: canonicalUid,
          employeeId: data.employeeId || canonicalUid,
          employeeCode: data.employeeCode || data.employeeId || canonicalUid,
          employeeName: data.employeeName || '',
          date: dateStr,
          checkInAt: checkInISO,
          checkOutAt: checkOutISO,
          createdAt: createdISO,
          updatedAt: updatedISO,
          workingMinutes: Number(data.workingMinutes) > 0 ? Number(data.workingMinutes) : 0,
          totalBreakMinutes: Number(data.totalBreakMinutes) > 0 ? Number(data.totalBreakMinutes) : 0,
          breaks: Array.isArray(data.breaks) && data.breaks.length > 0 ? data.breaks : [],
          status: data.status || 'Present',
          attendanceMethod: data.attendanceMethod || 'Self Portal',
          locationVerified: !!data.locationVerified
        };
        delete migratedRecord.endTime; // legacy alias, superseded by endAt

        await setDoc(targetDocRef, migratedRecord, { merge: true });

        // Remove the legacy doc so exactly ONE document exists per employee + day.
        await deleteDoc(doc(db, 'attendance', legacyId)).catch(() => {});

        result.migratedCount++;
      } catch (err: any) {
        result.errors.push(`Failed migrating ${legacyId} -> ${targetCanonicalId}: ${err.message}`);
      }
    }

    // NOTE: the previous "past week backfill" block (which force-created
    // completed 09:45→19:30 records for every employee) was removed entirely.
    // Fabricating attendance history violates the SHIFT_COMPLETE contract and
    // poisoned live production data during the P0 incident.
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, 'attendance');
    result.errors.push(`Migration query failed: ${err.message}`);
  }

  return result;
}
