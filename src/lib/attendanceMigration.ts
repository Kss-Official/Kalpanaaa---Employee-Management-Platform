import { collection, getDocs, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getEmployeeWorkDate, getAttendanceDocId, getCanonicalEmployeeUid, formatTimestampToISO } from './attendanceEngine';
import { AttendanceRecord } from '../types';

export interface MigrationResult {
  totalScanned: number;
  migratedCount: number;
  skippedExisting: number;
  alreadyCanonical: number;
  errors: string[];
}

/**
 * One-time migration function that copies legacy attendance documents
 * into the deterministic `attendance/{uid}_{YYYY-MM-DD}` schema,
 * preserving original timestamps, breaks, and employee identifiers.
 * IDEMPOTENT: Skips any legacy doc whose target attendance/{uid}_{date} already exists.
 */
export async function runAttendanceMigration(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalScanned: 0,
    migratedCount: 0,
    skippedExisting: 0,
    alreadyCanonical: 0,
    errors: []
  };

  try {
    const snap = await getDocs(collection(db, 'attendance'));
    result.totalScanned = snap.size;

    for (const docSnap of snap.docs) {
      const legacyId = docSnap.id;
      const data = docSnap.data();

      // Skip temporary or historical dummy seeded records
      if (legacyId.startsWith('att-hist-')) {
        continue;
      }

      const canonicalUid = getCanonicalEmployeeUid({
        uid: data.uid || data.employeeUid,
        id: data.employeeId,
        employeeId: data.employeeCode || data.employeeId
      });

      const dateStr = getEmployeeWorkDate(data.date || formatTimestampToISO(data.createdAt) || formatTimestampToISO(data.checkInAt) || new Date());
      const targetCanonicalId = getAttendanceDocId(canonicalUid, dateStr);

      if (legacyId === targetCanonicalId) {
        // If doc is already at canonical ID but date field is a Timestamp or non-string, normalize in place
        if (typeof data.date !== 'string' || data.date !== dateStr) {
          await setDoc(doc(db, 'attendance', targetCanonicalId), { date: dateStr, updatedAt: formatTimestampToISO(data.updatedAt) || new Date().toISOString() }, { merge: true });
        }
        result.alreadyCanonical++;
        continue;
      }

      try {
        // IDEMPOTENCY GUARD: Never overwrite live/corrected records if target already exists
        const targetDocRef = doc(db, 'attendance', targetCanonicalId);
        const targetDocSnap = await getDoc(targetDocRef);

        if (targetDocSnap.exists()) {
          result.skippedExisting++;
          // Clean up stale duplicate legacy doc
          await deleteDoc(doc(db, 'attendance', legacyId));
          continue;
        }

        const checkInISO = formatTimestampToISO(data.checkInAt);
        const checkOutISO = formatTimestampToISO(data.checkOutAt);
        const createdISO = formatTimestampToISO(data.createdAt) || checkInISO || new Date().toISOString();
        const updatedISO = formatTimestampToISO(data.updatedAt) || checkOutISO || createdISO;

        const migratedRecord: Partial<AttendanceRecord> = {
          ...data,
          id: targetCanonicalId,
          uid: canonicalUid,
          employeeUid: canonicalUid,
          employeeId: data.employeeId || canonicalUid,
          employeeCode: data.employeeCode || data.employeeId || canonicalUid,
          date: dateStr,
          checkInAt: checkInISO,
          checkOutAt: checkOutISO,
          createdAt: createdISO,
          updatedAt: updatedISO,
          workingMinutes: Number(data.workingMinutes) || 0,
          totalBreakMinutes: Number(data.totalBreakMinutes) || 0,
          breaks: Array.isArray(data.breaks) ? data.breaks : []
        };

        // Write to new deterministic doc
        await setDoc(targetDocRef, migratedRecord, { merge: true });

        // Delete old legacy doc
        await deleteDoc(doc(db, 'attendance', legacyId));

        result.migratedCount++;
      } catch (err: any) {
        result.errors.push(`Failed migrating ${legacyId} -> ${targetCanonicalId}: ${err.message}`);
      }
    }
  } catch (err: any) {
    handleFirestoreError(err, OperationType.LIST, 'attendance');
    result.errors.push(`Migration query failed: ${err.message}`);
  }

  return result;
}
