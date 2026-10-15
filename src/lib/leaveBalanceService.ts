/**
 * Leave Balance & Monthly WFH Management Service
 * 
 * Manages:
 * - EL (Earned Leave) and SL (Sick Leave) balances stored on /employees/{id}
 * - Monthly WFH allowances stored in /wfhAllowances/{employeeId}/months/{YYYY-MM}
 * - Audit trail stored in /auditLogs
 * - Monthly auto-credit of +1 EL on the 1st of every month
 * - Monthly auto-debit of 1 WFH for female employees on the 1st of every month
 */

import { db, cleanFirestorePayload } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { Employee } from '../types';

// ─── Monthly WFH Allowance ────────────────────────────────────────────────────

export interface MonthlyWfhRecord {
  employeeId: string;       // Firestore doc ID
  employeeCode: string;     // e.g. KSS2407005
  employeeName: string;
  monthKey: string;         // YYYY-MM e.g. "2026-10"
  allowance: number;        // total monthly WFH days allowed
  usedApproved: number;     // count of approved WFH leave requests for this month
  remaining: number;        // allowance - usedApproved
  updatedAt: string;
  updatedBy?: string;
  updatedByName?: string;
}

/**
 * Saves a monthly WFH allowance record for one employee.
 * Stored at /wfhAllowances/{employeeId}/months/{YYYY-MM}
 */
export async function saveMonthlyWfhAllowance(
  record: MonthlyWfhRecord
): Promise<{ success: boolean; message: string }> {
  if (record.allowance < 0) {
    return { success: false, message: 'Allowance cannot be negative.' };
  }
  const remaining = Math.max(0, record.allowance - record.usedApproved);
  const payload = cleanFirestorePayload({ ...record, remaining, updatedAt: new Date().toISOString() });

  try {
    await setDoc(
      doc(db, 'wfhAllowances', record.employeeId, 'months', record.monthKey),
      payload,
      { merge: true }
    );
    return { success: true, message: 'WFH allowance saved.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to save WFH allowance.' };
  }
}

/**
 * Fetches a single month's WFH record for one employee.
 */
export async function fetchMonthlyWfhRecord(
  employeeId: string,
  monthKey: string
): Promise<MonthlyWfhRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'wfhAllowances', employeeId, 'months', monthKey));
    return snap.exists() ? (snap.data() as MonthlyWfhRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Subscribes to real-time updates for all WFH months for a specific employee.
 */
export function subscribeToEmployeeWfhMonths(
  employeeId: string,
  onData: (records: MonthlyWfhRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!employeeId) {
    onData([]);
    return () => {};
  }
  return onSnapshot(
    collection(db, 'wfhAllowances', employeeId, 'months'),
    (snap) => {
      const records: MonthlyWfhRecord[] = [];
      snap.forEach((d) => records.push(d.data() as MonthlyWfhRecord));
      records.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      onData(records);
    },
    (err) => {
      console.warn('[LeaveBalanceService] WFH months listener error:', err);
      onError?.(err);
    }
  );
}

// ─── Leave Balance Adjustment ─────────────────────────────────────────────────

export interface LeaveBalanceAdjustment {
  employeeId: string;         // Firestore document ID
  employeeCode: string;
  employeeName: string;
  field: 'earnLeaveBalance' | 'sickLeaveBalance' | 'casualLeaveBalance';
  previousValue: number;
  newValue: number;
  reason?: string;
  adjustedBy: string;         // UID
  adjustedByName: string;
  adjustedAt: string;         // ISO timestamp
  effectiveDate?: string;     // optional effective date
}

/**
 * Updates an employee's EL, SL, or CL balance directly.
 * Validates the new value, writes to Firestore, and writes an audit log.
 */
export async function adjustLeaveBalance(
  adjustment: LeaveBalanceAdjustment,
  allowNegative: boolean = false
): Promise<{ success: boolean; message: string }> {
  if (!allowNegative && adjustment.newValue < 0) {
    return { success: false, message: 'Balance cannot be set to a negative value.' };
  }
  if (!Number.isInteger(adjustment.newValue) && adjustment.newValue % 0.5 !== 0) {
    return { success: false, message: 'Balance must be a whole or half number.' };
  }

  const fieldLabel = adjustment.field === 'earnLeaveBalance' 
    ? 'Earned Leave' 
    : adjustment.field === 'sickLeaveBalance' 
      ? 'Sick Leave' 
      : 'Casual Leave';

  try {
    // 1. Update the employee document
    await setDoc(
      doc(db, 'employees', adjustment.employeeId),
      cleanFirestorePayload({
        [adjustment.field]: adjustment.newValue,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );

    // 2. Write an audit log entry
    const logId = `adj_${adjustment.employeeId}_${adjustment.field}_${Date.now()}`;
    const auditPayload = {
      id: logId,
      actorId: adjustment.adjustedBy,
      actorName: adjustment.adjustedByName,
      actorRole: 'PROJECT_MANAGER',
      action: 'LEAVE_BALANCE_ADJUSTED',
      target: `${adjustment.employeeCode} (${adjustment.employeeName})`,
      details: `${fieldLabel} adjusted from ${adjustment.previousValue} to ${adjustment.newValue}${adjustment.reason ? ` | Reason: ${adjustment.reason}` : ''}`,
      timestamp: adjustment.adjustedAt,
      performedBy: adjustment.adjustedByName,
      performedByUid: adjustment.adjustedBy,
      targetEmployee: adjustment.employeeName,
      targetEmployeeUid: adjustment.employeeId,
      role: 'PROJECT_MANAGER',
    };
    await setDoc(
      doc(db, 'auditLogs', logId),
      cleanFirestorePayload(auditPayload),
      { merge: true }
    );

    return { success: true, message: `${fieldLabel} balance updated to ${adjustment.newValue}.` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to update leave balance.' };
  }
}

/**
 * Updates an employee's monthly WFH allowance.
 * Also writes an audit log.
 */
export async function adjustWfhAllowance(
  record: MonthlyWfhRecord & { adjustedBy: string; adjustedByName: string; previousAllowance: number; reason?: string }
): Promise<{ success: boolean; message: string }> {
  if (record.allowance < 0) {
    return { success: false, message: 'Allowance cannot be negative.' };
  }

  const saveResult = await saveMonthlyWfhAllowance({
    ...record,
    updatedBy: record.adjustedBy,
    updatedByName: record.adjustedByName,
  });
  if (!saveResult.success) return saveResult;

  // Audit log
  const logId = `wfhadj_${record.employeeId}_${record.monthKey}_${Date.now()}`;
  const auditPayload = {
    id: logId,
    actorId: record.adjustedBy,
    actorName: record.adjustedByName,
    actorRole: 'PROJECT_MANAGER',
    action: 'WFH_ALLOWANCE_ADJUSTED',
    target: `${record.employeeCode} (${record.employeeName})`,
    details: `Monthly WFH allowance for ${record.monthKey} adjusted from ${record.previousAllowance} to ${record.allowance}${record.reason ? ` | Reason: ${record.reason}` : ''}`,
    timestamp: new Date().toISOString(),
    performedBy: record.adjustedByName,
    performedByUid: record.adjustedBy,
    targetEmployee: record.employeeName,
    targetEmployeeUid: record.employeeId,
    role: 'PROJECT_MANAGER',
  };
  try {
    await setDoc(doc(db, 'auditLogs', logId), cleanFirestorePayload(auditPayload), { merge: true });
  } catch { /* audit failure is non-fatal */ }

  return { success: true, message: `WFH allowance for ${record.monthKey} updated to ${record.allowance}.` };
}

// ─── Monthly Auto-Credit / Auto-Debit ────────────────────────────────────────

/**
 * Returns the YYYY-MM key for a given date.
 */
export function getMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Returns the YYYY-MM-DD for the first day of the given month key.
 */
export function firstDayOfMonth(monthKey: string): string {
  return `${monthKey}-01`;
}

/**
 * Checks if today is the 1st of the month and whether the auto-credit
 * latch for this month has already been set.
 * Returns true if the auto-credit should run.
 */
export function shouldRunMonthlyAutoCredit(monthKey: string): boolean {
  const today = new Date();
  const todayDay = today.getDate();
  if (todayDay !== 1) return false;

  const latchKey = `kss_monthly_credit_v1:${monthKey}`;
  return localStorage.getItem(latchKey) !== 'done';
}

/**
 * Sets the monthly auto-credit latch in localStorage so it doesn't run again
 * this month.
 */
export function setMonthlyCreditLatch(monthKey: string): void {
  localStorage.setItem(`kss_monthly_credit_v1:${monthKey}`, 'done');
}

/**
 * Runs monthly EL auto-credit (+1) for all active employees.
 * Also auto-initialises monthly WFH allowance for female employees (1 WFH/month).
 *
 * Race-condition fix: uses Firestore transactions per employee (read-current-then-increment)
 * instead of reading stale in-memory balance and doing a raw batch write.
 * Idempotency: a deterministic auditLog doc ID (`autocredit_el_{empId}_{monthKey}`) is
 * written with merge:true; if it already exists the balance was already incremented.
 *
 * Called only on the 1st of the month, once per browser session,
 * gated by a localStorage latch.
 */
export async function runMonthlyAutoCredit(
  employees: Employee[],
  monthKey: string,
  performedByUid: string,
  performedByName: string
): Promise<{ credited: string[]; wfhInitialized: string[]; errors: string[] }> {
  const credited: string[] = [];
  const wfhInitialized: string[] = [];
  const errors: string[] = [];

  const { runTransaction, doc: firestoreDoc } = await import('firebase/firestore');

  const activeEmps = employees.filter(
    (e) =>
      e.status === 'Active' &&
      e.role !== 'SUPER_ADMIN' &&
      e.employeeId !== 'KSS2407003' // D. Koushik has EL=0 by policy
  );

  const nowIso = new Date().toISOString();

  for (const emp of activeEmps) {
    // ── Idempotency guard: check if audit log already exists for this month ──
    const elLogId = `autocredit_el_${emp.id}_${monthKey}`;
    try {
      const auditSnap = await getDoc(doc(db, 'auditLogs', elLogId));
      if (auditSnap.exists()) {
        // Already credited this month — skip entirely for this employee
        credited.push(emp.fullName); // count as done
        continue;
      }
    } catch { /* non-fatal: proceed */ }

    // ── Atomic EL increment via Firestore transaction ────────────────────────
    try {
      let newEL = 0;
      await runTransaction(db, async (txn) => {
        const empRef = doc(db, 'employees', emp.id);
        const empSnap = await txn.get(empRef);
        const currentEL = empSnap.exists()
          ? (typeof empSnap.data().earnLeaveBalance === 'number' ? empSnap.data().earnLeaveBalance : 0)
          : 0;
        newEL = currentEL + 1;

        txn.set(empRef, cleanFirestorePayload({
          earnLeaveBalance: newEL,
          updatedAt: nowIso
        }), { merge: true });

        // Write audit log inside transaction to serve as idempotency key
        txn.set(doc(db, 'auditLogs', elLogId), cleanFirestorePayload({
          id: elLogId,
          actorId: 'system',
          actorName: 'System Auto-Credit',
          actorRole: 'SUPER_ADMIN',
          action: 'EARN_LEAVE_AUTO_CREDITED',
          target: `${emp.employeeId} (${emp.fullName})`,
          details: `Monthly EL auto-credit for ${monthKey}: +1 day → ${newEL}`,
          timestamp: nowIso,
          performedBy: performedByName,
          performedByUid,
          targetEmployee: emp.fullName,
          targetEmployeeUid: emp.id,
          role: 'SUPER_ADMIN',
          monthKey,
        }), { merge: true });
      });

      // Write ledger entry (outside transaction — non-fatal)
      const ledgerTxnId = `credit_el_${emp.id}_${monthKey}`;
      setDoc(
        doc(db, 'employees', emp.id, 'leaveLedger', ledgerTxnId),
        cleanFirestorePayload({
          txnId: ledgerTxnId,
          employeeId: emp.id,
          employeeCode: emp.employeeId,
          leaveType: 'Earn Leave',
          txnType: 'CREDIT',
          days: 1,
          accrualMonth: monthKey,
          date: `${monthKey}-01`,
          timestamp: nowIso,
          reason: `Monthly EL auto-credit for ${monthKey}`,
          performedBy: 'System Auto-Credit',
          performedByUid: 'system',
          resultingBalance: newEL,
        })
      ).catch(e => console.warn('[LeaveBalanceService] Ledger write failed (non-fatal):', e));

      credited.push(emp.fullName);
    } catch (err: any) {
      errors.push(`EL credit failed for ${emp.fullName}: ${err?.message}`);
    }

    // ── Female employee WFH auto-init (1 WFH/month) ──────────────────────────
    if (emp.gender === 'Female') {
      const wfhDocRef = doc(db, 'wfhAllowances', emp.id, 'months', monthKey);
      try {
        const existing = await getDoc(wfhDocRef).catch(() => null);
        if (!existing?.exists()) {
          const wfhBatch = writeBatch(db);
          wfhBatch.set(wfhDocRef, cleanFirestorePayload({
            employeeId: emp.id,
            employeeCode: emp.employeeId,
            employeeName: emp.fullName,
            monthKey,
            allowance: 1,
            usedApproved: 0,
            remaining: 1,
            updatedAt: nowIso,
            updatedBy: 'system',
            updatedByName: 'System Auto-Init',
          }), { merge: true });

          const wfhLogId = `autocredit_wfh_${emp.id}_${monthKey}`;
          wfhBatch.set(doc(db, 'auditLogs', wfhLogId), cleanFirestorePayload({
            id: wfhLogId,
            actorId: 'system',
            actorName: 'System Auto-Init',
            actorRole: 'SUPER_ADMIN',
            action: 'WFH_ALLOWANCE_AUTO_INITIALIZED',
            target: `${emp.employeeId} (${emp.fullName})`,
            details: `Monthly WFH allowance auto-initialized to 1 for female employee for ${monthKey}`,
            timestamp: nowIso,
            performedBy: performedByName,
            performedByUid,
            targetEmployee: emp.fullName,
            targetEmployeeUid: emp.id,
            role: 'SUPER_ADMIN',
          }), { merge: true });

          await wfhBatch.commit();
          wfhInitialized.push(emp.fullName);
        }
      } catch (err: any) {
        errors.push(`WFH init failed for ${emp.fullName}: ${err?.message}`);
      }
    }
  }

  return { credited, wfhInitialized, errors };
}

/**
 * Calculates the approved WFH days used in a given month from leaveRequests.
 * Only counts requests with status === 'Approved' and type/leaveCategory === WFH.
 */
export function calcApprovedWfhUsed(
  leaveRequests: Array<{
    employeeId?: string;
    employeeUid?: string;
    type?: string;
    leaveCategory?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }>,
  employeeId: string,
  monthKey: string
): number {
  const wfhReqs = leaveRequests.filter((r) => {
    if (r.employeeId !== employeeId && r.employeeUid !== employeeId) return false;
    if (r.status !== 'Approved') return false;
    const isWfh =
      r.type === 'WFH' ||
      r.leaveCategory === 'WFH' ||
      (r.type || '').toLowerCase().includes('wfh') ||
      (r.leaveCategory || '').toLowerCase().includes('wfh');
    return isWfh;
  });

  let usedDays = 0;
  for (const req of wfhReqs) {
    const start = req.startDate || '';
    const end = req.endDate || start;
    if (!start) continue;

    // Count days within this month
    const startD = new Date(start + 'T12:00:00Z');
    const endD = new Date(end + 'T12:00:00Z');
    let cur = new Date(startD);
    while (cur <= endD) {
      const curMonthKey = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`;
      if (curMonthKey === monthKey) {
        usedDays++;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return usedDays;
}
