import { db, cleanFirestorePayload } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  runTransaction,
  writeBatch,
  getDoc,
  Unsubscribe
} from 'firebase/firestore';
import { LeaveRequest, LeaveLockEntry } from '../types';

// ─── Leave Ledger Entry ───────────────────────────────────────────────────────
// Stored at /employees/{employeeId}/leaveLedger/{txnId}

export interface LeaveLedgerEntry {
  txnId: string;
  employeeId: string;        // Firestore doc ID
  employeeCode: string;      // e.g. KSS2407004
  leaveType: 'Earn Leave' | 'Sick Leave';
  txnType: 'CREDIT' | 'DEBIT' | 'REVERSAL' | 'ADJUSTMENT';
  days: number;              // positive for CREDIT/REVERSAL, negative for DEBIT
  requestId?: string;        // associated leaveRequests doc ID
  accrualMonth?: string;     // YYYY-MM for monthly EL credits
  date: string;              // ISO date when transaction occurred
  timestamp: string;         // ISO timestamp
  reason: string;
  performedBy: string;       // name
  performedByUid: string;    // uid
  resultingBalance?: number; // balance after this transaction (for display)
}

/**
 * Writes a leave ledger entry under /employees/{employeeId}/leaveLedger/{txnId}.
 * Idempotent via setDoc (merge:false so repeated writes are exact overwrites,
 * not additive — the idempotencyKey is the txnId itself).
 */
export async function writeLeaveLedgerEntry(
  employeeId: string,
  entry: LeaveLedgerEntry
): Promise<void> {
  if (!employeeId || !entry.txnId) return;
  try {
    await setDoc(
      doc(db, 'employees', employeeId, 'leaveLedger', entry.txnId),
      cleanFirestorePayload(entry)
    );
  } catch (e) {
    console.warn('[LeaveService] Failed to write ledger entry:', e);
  }
}

/**
 * Subscribes to all ledger entries for an employee (real-time).
 */
export function subscribeLeaveLedger(
  employeeId: string,
  onData: (entries: LeaveLedgerEntry[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!employeeId) { onData([]); return () => {}; }
  return onSnapshot(
    collection(db, 'employees', employeeId, 'leaveLedger'),
    (snap) => {
      const entries: LeaveLedgerEntry[] = [];
      snap.forEach(d => entries.push(d.data() as LeaveLedgerEntry));
      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      onData(entries);
    },
    (err) => {
      console.warn('[LeaveService] Ledger listener error:', err);
      onError?.(err);
    }
  );
}

// ─── Leave Deduction (Atomic) ─────────────────────────────────────────────────

/**
 * Calculates the number of chargeable leave days for a request.
 * Counts calendar days inclusive (pending half-day support can be added here).
 */
export function calculateChargeDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000) + 1;
  return Math.max(1, diffDays);
}

/**
 * Returns true if the leave type should deduct from Earned Leave balance.
 */
function isEarnLeaveType(type: string | undefined): boolean {
  if (!type) return false;
  return type === 'Earn Leave' || type === 'Leave';
}

/**
 * Returns true if the leave type should deduct from Sick Leave balance.
 */
function isSickLeaveType(type: string | undefined): boolean {
  if (!type) return false;
  return type === 'Sick Leave';
}

/**
 * Atomically deducts leave balance on final approval.
 *
 * Safety guarantees:
 *  1. Reads the leaveRequest doc inside the transaction — if `_deductionApplied`
 *     is already true, skips with no writes (idempotent).
 *  2. Reads the employee doc to get current balance.
 *  3. Writes the employee doc with decremented balance.
 *  4. Marks the request doc with `_deductionApplied: true` and metadata.
 *  5. Writes a ledger entry (outside transaction — non-fatal if it fails).
 *
 * @param requestId  - Firestore doc ID of the leaveRequest
 * @param employeeDocId - Firestore doc ID of the employee (NOT employeeCode)
 * @param employeeCode  - Human-readable employee code (e.g. KSS2407004)
 * @param leaveType  - Type of leave (used to choose which balance to deduct from)
 * @param startDate  - YYYY-MM-DD
 * @param endDate    - YYYY-MM-DD
 * @param performedByName - Name of the approver
 * @param performedByUid  - UID of the approver
 */
export async function deductLeaveOnApproval(
  requestId: string,
  employeeDocId: string,
  employeeCode: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  performedByName: string,
  performedByUid: string
): Promise<{ success: boolean; message: string; daysDeducted: number }> {
  // WFH and unknown types do not deduct from EL or SL
  if (!isEarnLeaveType(leaveType) && !isSickLeaveType(leaveType)) {
    return { success: true, message: 'No balance deduction for WFH/other types.', daysDeducted: 0 };
  }

  if (!requestId || !employeeDocId) {
    return { success: false, message: 'Missing requestId or employeeDocId.', daysDeducted: 0 };
  }

  const chargeDays = calculateChargeDays(startDate, endDate);
  const balanceField = isEarnLeaveType(leaveType) ? 'earnLeaveBalance' : 'sickLeaveBalance';

  try {
    let finalBalance = 0;
    let skipped = false;

    await runTransaction(db, async (txn) => {
      const requestRef = doc(db, 'leaveRequests', requestId);
      const empRef = doc(db, 'employees', employeeDocId);

      const [reqSnap, empSnap] = await Promise.all([txn.get(requestRef), txn.get(empRef)]);

      if (!reqSnap.exists()) {
        throw new Error(`Leave request ${requestId} not found.`);
      }
      if (!empSnap.exists()) {
        throw new Error(`Employee doc ${employeeDocId} not found.`);
      }

      const reqData = reqSnap.data();

      // Idempotency guard: if deduction already applied, skip
      if (reqData._deductionApplied === true) {
        skipped = true;
        return;
      }

      const empData = empSnap.data();
      const currentBalance = typeof empData[balanceField] === 'number' ? empData[balanceField] : 0;
      finalBalance = Math.max(0, currentBalance - chargeDays);

      const nowIso = new Date().toISOString();

      // Update employee balance
      txn.set(empRef, cleanFirestorePayload({
        [balanceField]: finalBalance,
        updatedAt: nowIso
      }), { merge: true });

      // Mark request as deduction applied
      txn.set(requestRef, cleanFirestorePayload({
        _deductionApplied: true,
        _deductionAppliedAt: nowIso,
        _deductionDays: chargeDays,
        updatedAt: nowIso
      }), { merge: true });
    });

    if (skipped) {
      return { success: true, message: 'Deduction already applied (idempotent skip).', daysDeducted: 0 };
    }

    // Write ledger entry outside the transaction (non-fatal)
    const txnId = `debit_${employeeDocId}_${balanceField}_${requestId}`;
    const leaveTypeName = isEarnLeaveType(leaveType) ? 'Earn Leave' : 'Sick Leave';
    await writeLeaveLedgerEntry(employeeDocId, {
      txnId,
      employeeId: employeeDocId,
      employeeCode,
      leaveType: leaveTypeName,
      txnType: 'DEBIT',
      days: -chargeDays,
      requestId,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      reason: `Final approval deduction: ${chargeDays} day(s) ${leaveTypeName} (${startDate}–${endDate})`,
      performedBy: performedByName,
      performedByUid,
      resultingBalance: finalBalance
    }).catch(e => console.warn('[LeaveService] Ledger write failed (non-fatal):', e));

    return {
      success: true,
      message: `Deducted ${chargeDays} day(s) from ${leaveTypeName} balance.`,
      daysDeducted: chargeDays
    };
  } catch (err: any) {
    console.error('[LeaveService] deductLeaveOnApproval failed:', err);
    return { success: false, message: err?.message || 'Deduction failed.', daysDeducted: 0 };
  }
}

/**
 * Reverses a prior deduction when an approved leave is cancelled.
 * Idempotent: checks `_reversalApplied` flag before writing.
 */
export async function reverseLeaveDeduction(
  requestId: string,
  employeeDocId: string,
  employeeCode: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  performedByName: string,
  performedByUid: string
): Promise<{ success: boolean; message: string; daysReversed: number }> {
  if (!isEarnLeaveType(leaveType) && !isSickLeaveType(leaveType)) {
    return { success: true, message: 'No reversal needed for WFH/other types.', daysReversed: 0 };
  }

  if (!requestId || !employeeDocId) {
    return { success: false, message: 'Missing requestId or employeeDocId.', daysReversed: 0 };
  }

  const chargeDays = calculateChargeDays(startDate, endDate);
  const balanceField = isEarnLeaveType(leaveType) ? 'earnLeaveBalance' : 'sickLeaveBalance';

  try {
    let finalBalance = 0;
    let skipped = false;

    await runTransaction(db, async (txn) => {
      const requestRef = doc(db, 'leaveRequests', requestId);
      const empRef = doc(db, 'employees', employeeDocId);

      const [reqSnap, empSnap] = await Promise.all([txn.get(requestRef), txn.get(empRef)]);

      if (!reqSnap.exists()) throw new Error(`Leave request ${requestId} not found.`);
      if (!empSnap.exists()) throw new Error(`Employee doc ${employeeDocId} not found.`);

      const reqData = reqSnap.data();

      // Only reverse if deduction was actually applied
      if (!reqData._deductionApplied) {
        skipped = true;
        return;
      }

      // Idempotency: if reversal already applied, skip
      if (reqData._reversalApplied === true) {
        skipped = true;
        return;
      }

      const empData = empSnap.data();
      const currentBalance = typeof empData[balanceField] === 'number' ? empData[balanceField] : 0;
      const actualDeductedDays = typeof reqData._deductionDays === 'number' ? reqData._deductionDays : chargeDays;
      finalBalance = currentBalance + actualDeductedDays;

      const nowIso = new Date().toISOString();

      txn.set(empRef, cleanFirestorePayload({
        [balanceField]: finalBalance,
        updatedAt: nowIso
      }), { merge: true });

      txn.set(requestRef, cleanFirestorePayload({
        _reversalApplied: true,
        _reversalAppliedAt: nowIso,
        updatedAt: nowIso
      }), { merge: true });
    });

    if (skipped) {
      return { success: true, message: 'Reversal skipped (no prior deduction or already reversed).', daysReversed: 0 };
    }

    const txnId = `reversal_${employeeDocId}_${balanceField}_${requestId}`;
    const leaveTypeName = isEarnLeaveType(leaveType) ? 'Earn Leave' : 'Sick Leave';
    await writeLeaveLedgerEntry(employeeDocId, {
      txnId,
      employeeId: employeeDocId,
      employeeCode,
      leaveType: leaveTypeName,
      txnType: 'REVERSAL',
      days: chargeDays,
      requestId,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      reason: `Cancellation reversal: ${chargeDays} day(s) ${leaveTypeName} returned (${startDate}–${endDate})`,
      performedBy: performedByName,
      performedByUid,
      resultingBalance: finalBalance
    }).catch(e => console.warn('[LeaveService] Ledger write failed (non-fatal):', e));

    return {
      success: true,
      message: `Reversed ${chargeDays} day(s) back to ${leaveTypeName} balance.`,
      daysReversed: chargeDays
    };
  } catch (err: any) {
    console.error('[LeaveService] reverseLeaveDeduction failed:', err);
    return { success: false, message: err?.message || 'Reversal failed.', daysReversed: 0 };
  }
}

// ─── Leave Request Management ─────────────────────────────────────────────────

export class LeaveService {
  /**
   * Generates a date range array [YYYY-MM-DD] between start and end inclusive.
   */
  static getDateRangeArray(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    if (!startDate || !endDate) return dates;
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    if (!sy || !sm || !sd || !ey || !em || !ed) return dates;

    const current = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);

    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  /**
   * Subscribes to an individual employee's own requests (Scoped for zero data leakage).
   * Uses UID-scoped query to prevent fuzzy-name cross-employee data exposure.
   */
  static subscribeToOwnRequests(
    employeeUid: string,
    onUpdate: (requests: LeaveRequest[]) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    if (!employeeUid) {
      onUpdate([]);
      return () => {};
    }

    const q = query(
      collection(db, 'leaveRequests'),
      where('employeeUid', '==', employeeUid)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const seen = new Set<string>();
        const list: LeaveRequest[] = [];
        snapshot.forEach((d) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            list.push({ id: d.id, ...d.data() } as LeaveRequest);
          }
        });
        list.sort(
          (a, b) =>
            new Date(b.requestDate || b.startDate).getTime() -
            new Date(a.requestDate || a.startDate).getTime()
        );
        onUpdate(list);
      },
      (error) => {
        console.warn('[LeaveService] Own requests listener error:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Subscribes to a Project Manager's scoped team requests (Scoped by pmUid).
   */
  static subscribeToPmRequests(
    pmUid: string,
    onUpdate: (requests: LeaveRequest[]) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    if (!pmUid) {
      onUpdate([]);
      return () => {};
    }

    const q = query(
      collection(db, 'leaveRequests'),
      where('pmUid', '==', pmUid)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const seen = new Set<string>();
        const list: LeaveRequest[] = [];
        snapshot.forEach((d) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            list.push({ id: d.id, ...d.data() } as LeaveRequest);
          }
        });
        list.sort(
          (a, b) =>
            new Date(b.requestDate || b.startDate).getTime() -
            new Date(a.requestDate || a.startDate).getTime()
        );
        onUpdate(list);
      },
      (error) => {
        console.warn('[LeaveService] PM requests listener error:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Subscribes to all company leave requests (For HR_ADMIN and SUPER_ADMIN).
   */
  static subscribeToAllRequests(
    onUpdate: (requests: LeaveRequest[]) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    const q = collection(db, 'leaveRequests');

    return onSnapshot(
      q,
      (snapshot) => {
        const seen = new Set<string>();
        const list: LeaveRequest[] = [];
        snapshot.forEach((d) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            list.push({ id: d.id, ...d.data() } as LeaveRequest);
          }
        });
        list.sort(
          (a, b) =>
            new Date(b.requestDate || b.startDate).getTime() -
            new Date(a.requestDate || a.startDate).getTime()
        );
        onUpdate(list);
      },
      (error) => {
        console.warn('[LeaveService] All requests listener error:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Submits a new Leave or WFH request atomically with date locks and overlap checks.
   */
  static async submitLeaveRequest(
    data: Omit<LeaveRequest, 'id' | 'status' | 'requestDate' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; id: string; message: string }> {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (start > end) {
      throw new Error('Start date cannot be after end date');
    }

    const dateRange = this.getDateRangeArray(data.startDate, data.endDate);
    if (dateRange.length > 30) {
      throw new Error('Requests spanning more than 30 consecutive calendar days are restricted. Please split into monthly requests.');
    }

    const cleanEmpId = (data.employeeId || 'EMP').replace(/[^a-zA-Z0-9_-]/g, '');
    const deterministicId = `LR_${cleanEmpId}_${data.startDate}_${data.type}`;
    const nowIso = new Date().toISOString();

    const newRequest: LeaveRequest = {
      ...data,
      id: deterministicId,
      status: 'Pending',
      pmStatus: data.pmStatus || 'Pending',
      hrStatus: data.hrStatus || 'Waiting PM',
      ceoStatus: data.ceoStatus || 'Waiting HR',
      ctoStatus: data.ctoStatus || 'Waiting CEO',
      requestDate: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      _deductionApplied: false,
    };

    // Execute atomic transaction for overlapping date lock validation
    await runTransaction(db, async (txn) => {
      // Step 1: Read all date lock documents for the requested range
      for (const dStr of dateRange) {
        const lockRef = doc(db, 'employees', data.employeeId, 'leaveLocks', dStr);
        const lockDoc = await txn.get(lockRef);
        if (lockDoc.exists()) {
          const lockData = lockDoc.data() as LeaveLockEntry;
          if (lockData.active && lockData.requestId !== deterministicId) {
            throw new Error(`Date Conflict: An active request (${lockData.requestId}) already covers ${dStr}.`);
          }
        }
      }

      // Step 2: Atomic Write Phase
      const requestRef = doc(db, 'leaveRequests', deterministicId);
      txn.set(requestRef, cleanFirestorePayload(newRequest));

      for (const dStr of dateRange) {
        const lockRef = doc(db, 'employees', data.employeeId, 'leaveLocks', dStr);
        const lockPayload: LeaveLockEntry = {
          id: dStr,
          requestId: deterministicId,
          employeeUid: data.employeeUid || '',
          employeeId: data.employeeId,
          type: data.type,
          active: true,
          reservedAt: nowIso,
        };
        txn.set(lockRef, cleanFirestorePayload(lockPayload));
      }
    });

    return {
      success: true,
      id: deterministicId,
      message: `${data.type} request submitted successfully.`,
    };
  }

  /**
   * Releases atomic date locks for a given employee and date range.
   */
  static async releaseDateLocks(employeeId: string, startDate: string, endDate: string): Promise<void> {
    if (!employeeId || !startDate || !endDate) return;
    try {
      const dates = this.getDateRangeArray(startDate, endDate);
      const batch = writeBatch(db);
      for (const dStr of dates) {
        const lockRef = doc(db, 'employees', employeeId, 'leaveLocks', dStr);
        batch.delete(lockRef);
      }
      await batch.commit();
    } catch (e) {
      console.warn('[LeaveService] Error releasing date locks:', e);
    }
  }

  /**
   * Cancels a pending request and releases its date locks atomically.
   * If the request was already approved and deducted, triggers a reversal.
   */
  static async cancelRequest(
    requestId: string,
    employeeId: string,
    startDate: string,
    endDate: string,
    performedByName?: string,
    performedByUid?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();

    // Read request to check if it was approved and deducted
    let wasApproved = false;
    let leaveType = '';
    let employeeDocId = '';
    let employeeCode = '';
    try {
      const reqSnap = await getDoc(doc(db, 'leaveRequests', requestId));
      if (reqSnap.exists()) {
        const reqData = reqSnap.data();
        wasApproved = reqData.status === 'Approved' && reqData._deductionApplied === true;
        leaveType = reqData.type || reqData.leaveCategory || '';
        // employeeId in the doc is either the code or the doc ID — resolve:
        employeeDocId = employeeId; // caller provides the doc ID
        employeeCode = reqData.employeeId || employeeId;
      }
    } catch (e) {
      console.warn('[LeaveService] cancelRequest: could not read request doc:', e);
    }

    await setDoc(
      doc(db, 'leaveRequests', requestId),
      { status: 'Cancelled', updatedAt: nowIso },
      { merge: true }
    );
    await this.releaseDateLocks(employeeId, startDate, endDate);

    // If it was approved and balance was deducted, reverse the deduction
    if (wasApproved && leaveType && employeeDocId && performedByName && performedByUid) {
      await reverseLeaveDeduction(
        requestId,
        employeeDocId,
        employeeCode,
        leaveType,
        startDate,
        endDate,
        performedByName,
        performedByUid
      ).catch(e => console.warn('[LeaveService] Reversal on cancel failed:', e));
    }
  }

  /**
   * Tier 1: Project Manager stage review.
   */
  static async reviewPmStage(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    const updates: Partial<LeaveRequest> = {
      pmStatus: decision,
      pmRecommendation: decision,
      pmReviewedBy: reviewerUid,
      pmReviewedAt: nowIso,
      pmNotes: notes || '',
      hrStatus: isApproved ? 'Pending' : 'Waiting PM',
      ceoStatus: 'Waiting HR',
      ctoStatus: 'Waiting CEO',
      status: isApproved ? 'Pending' : 'Rejected',
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'leaveRequests', requestId), cleanFirestorePayload(updates), { merge: true });

    if (!isApproved && employeeId && startDate && endDate) {
      await this.releaseDateLocks(employeeId, startDate, endDate).catch(e => console.warn('[LeaveService] Lock release warning:', e));
    }
  }

  /**
   * Tier 2: HR Admin stage review.
   */
  static async reviewHrStage(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    const updates: Partial<LeaveRequest> = {
      hrStatus: decision,
      hrReviewedBy: reviewerUid,
      hrReviewedAt: nowIso,
      hrNotes: notes || '',
      ceoStatus: isApproved ? 'Pending' : 'Waiting HR',
      status: isApproved ? 'Pending' : 'Rejected',
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'leaveRequests', requestId), cleanFirestorePayload(updates), { merge: true });

    if (!isApproved && employeeId && startDate && endDate) {
      await this.releaseDateLocks(employeeId, startDate, endDate).catch(e => console.warn('[LeaveService] Lock release warning:', e));
    }
  }

  /**
   * Tier 3: CEO stage review.
   */
  static async reviewCeoStage(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    const updates: Partial<LeaveRequest> = {
      ceoStatus: decision,
      ceoReviewedBy: reviewerUid,
      ceoReviewedAt: nowIso,
      ceoNotes: notes || '',
      ctoStatus: isApproved ? 'Pending' : 'Waiting CEO',
      status: isApproved ? 'Pending' : 'Rejected',
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'leaveRequests', requestId), cleanFirestorePayload(updates), { merge: true });

    if (!isApproved && employeeId && startDate && endDate) {
      await this.releaseDateLocks(employeeId, startDate, endDate).catch(e => console.warn('[LeaveService] Lock release warning:', e));
    }
  }

  /**
   * Tier 4: CTO final sanction.
   * On approval, atomically deducts leave balance and records a ledger entry.
   * This is the ONLY place where leave balance is decremented on approval.
   */
  static async reviewCtoStage(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string,
    employeeDocId?: string,
    leaveType?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    const updates: Partial<LeaveRequest> = {
      ctoStatus: decision,
      ctoReviewedBy: reviewerUid,
      ctoReviewedAt: nowIso,
      ctoNotes: notes || '',
      status: isApproved ? 'Approved' : 'Rejected',
      reviewedBy: reviewerName,
      reviewNotes: notes || (isApproved ? 'Final sanction granted by CTO' : 'Rejected at CTO stage'),
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'leaveRequests', requestId), cleanFirestorePayload(updates), { merge: true });

    // Release date locks if rejected
    if (!isApproved && employeeId && startDate && endDate) {
      await this.releaseDateLocks(employeeId, startDate, endDate).catch(e => console.warn('[LeaveService] Lock release warning:', e));
    }

    // Deduct leave balance if approved
    if (isApproved && employeeDocId && leaveType && startDate && endDate) {
      await deductLeaveOnApproval(
        requestId,
        employeeDocId,
        employeeId || employeeDocId,
        leaveType,
        startDate,
        endDate,
        reviewerName,
        reviewerUid
      ).catch(e => console.error('[LeaveService] CTO deduction failed:', e));
    }
  }

  /**
   * Executive-level final approval (CEO-bypasses CTO, or direct full approval).
   * Used by CEO or SUPER_ADMIN acting as final approver.
   * On approval, atomically deducts leave balance.
   */
  static async reviewExecutiveFinal(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    stage: 'CEO' | 'CTO',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string,
    employeeDocId?: string,
    leaveType?: string
  ): Promise<void> {
    if (stage === 'CTO') {
      return this.reviewCtoStage(
        requestId, decision, reviewerUid, reviewerName, notes,
        employeeId, startDate, endDate, employeeDocId, leaveType
      );
    }
    return this.reviewCeoStage(
      requestId, decision, reviewerUid, reviewerName, notes, employeeId, startDate, endDate
    );
  }
}
