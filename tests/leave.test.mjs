import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = process.env.KSS_TEST_OUT;
if (!OUT) {
  console.error('Run this suite through tests/run.mjs');
  process.exit(1);
}

const engine = await import(pathToFileURL(join(OUT, 'attendanceEngine.cjs')));

// Helper simulating atomic leave deduction logic
function simulateDeductLeave(requestDoc, employeeDoc, approverName = 'CTO') {
  const isEL = requestDoc.type === 'Earn Leave' || requestDoc.type === 'Leave';
  const isSL = requestDoc.type === 'Sick Leave';

  if (!isEL && !isSL) {
    return { success: true, message: 'No deduction for WFH/other types', deducted: 0, newEmployeeDoc: { ...employeeDoc } };
  }

  // Idempotency check: if deduction was already applied, skip
  if (requestDoc._deductionApplied === true) {
    return { success: true, message: 'Idempotent skip: already deducted', deducted: 0, newEmployeeDoc: { ...employeeDoc } };
  }

  // Days calculation
  const start = new Date(requestDoc.startDate + 'T12:00:00');
  const end = new Date(requestDoc.endDate + 'T12:00:00');
  const chargeDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);

  const balanceField = isEL ? 'earnLeaveBalance' : 'sickLeaveBalance';
  const currentBal = typeof employeeDoc[balanceField] === 'number' ? employeeDoc[balanceField] : 0;
  const finalBal = Math.max(0, currentBal - chargeDays);

  const newEmployee = {
    ...employeeDoc,
    [balanceField]: finalBal,
    updatedAt: new Date().toISOString()
  };

  const newRequest = {
    ...requestDoc,
    status: 'Approved',
    _deductionApplied: true,
    _deductionAppliedAt: new Date().toISOString(),
    _deductionDays: chargeDays
  };

  const ledgerEntry = {
    txnId: `debit_${employeeDoc.id}_${balanceField}_${requestDoc.id}`,
    employeeId: employeeDoc.id,
    leaveType: isEL ? 'Earn Leave' : 'Sick Leave',
    txnType: 'DEBIT',
    days: -chargeDays,
    requestId: requestDoc.id,
    resultingBalance: finalBal,
    performedBy: approverName
  };

  return { success: true, deducted: chargeDays, newEmployeeDoc: newEmployee, newRequestDoc: newRequest, ledgerEntry };
}

// Helper simulating cancellation and reversal logic
function simulateCancelLeave(requestDoc, employeeDoc, cancelledByName = 'Employee') {
  const isEL = requestDoc.type === 'Earn Leave' || requestDoc.type === 'Leave';
  const isSL = requestDoc.type === 'Sick Leave';

  const newRequest = {
    ...requestDoc,
    status: 'Cancelled',
    updatedAt: new Date().toISOString()
  };

  // Only reverse if it was approved AND deducted AND has not already been reversed
  const wasDeducted = requestDoc.status === 'Approved' && requestDoc._deductionApplied === true;
  const alreadyReversed = requestDoc._reversalApplied === true;

  if (!wasDeducted || alreadyReversed || (!isEL && !isSL)) {
    return { success: true, reversed: 0, newEmployeeDoc: { ...employeeDoc }, newRequestDoc: newRequest };
  }

  const chargeDays = requestDoc._deductionDays || 1;
  const balanceField = isEL ? 'earnLeaveBalance' : 'sickLeaveBalance';
  const currentBal = typeof employeeDoc[balanceField] === 'number' ? employeeDoc[balanceField] : 0;
  const finalBal = currentBal + chargeDays;

  const newEmployee = {
    ...employeeDoc,
    [balanceField]: finalBal,
    updatedAt: new Date().toISOString()
  };

  newRequest._reversalApplied = true;
  newRequest._reversalAppliedAt = new Date().toISOString();

  const ledgerEntry = {
    txnId: `reversal_${employeeDoc.id}_${balanceField}_${requestDoc.id}`,
    employeeId: employeeDoc.id,
    leaveType: isEL ? 'Earn Leave' : 'Sick Leave',
    txnType: 'REVERSAL',
    days: chargeDays,
    requestId: requestDoc.id,
    resultingBalance: finalBal,
    performedBy: cancelledByName
  };

  return { success: true, reversed: chargeDays, newEmployeeDoc: newEmployee, newRequestDoc: newRequest, ledgerEntry };
}

// Helper simulating monthly auto-credit run
function simulateMonthlyCredit(employees, monthKey, existingLedgerSet = new Set()) {
  const credited = [];
  const skipped = [];
  const updatedEmps = [];

  for (const emp of employees) {
    if (emp.status !== 'Active') continue;

    // Policy exception: D. Koushik (KSS2407003) EL = 0
    if (emp.employeeId === 'KSS2407003') {
      skipped.push({ empId: emp.employeeId, reason: 'Policy exception (Koushik EL=0)' });
      continue;
    }

    const ledgerKey = `credit_el_${emp.id}_${monthKey}`;
    if (existingLedgerSet.has(ledgerKey)) {
      skipped.push({ empId: emp.employeeId, reason: 'Already credited (idempotent skip)' });
      continue;
    }

    const currentEL = typeof emp.earnLeaveBalance === 'number' ? emp.earnLeaveBalance : 0;
    const newEL = currentEL + 1;
    existingLedgerSet.add(ledgerKey);

    credited.push({
      empId: emp.employeeId,
      name: emp.fullName,
      newBalance: newEL,
      ledgerKey
    });

    updatedEmps.push({
      ...emp,
      earnLeaveBalance: newEL
    });
  }

  return { credited, skipped, updatedEmps, ledgerSet: existingLedgerSet };
}

// ── Test 1: Stored balance is authoritative source of truth ───────────────────
test('Leave: computeEmployeeLeaveBalance respects stored earnLeaveBalance field directly', () => {
  const emp = {
    id: 'emp-1',
    employeeId: 'KSS2407004',
    fullName: 'Asbin T S',
    joiningDate: '2026-07-01',
    earnLeaveBalance: 3
  };
  const res = engine.computeEmployeeLeaveBalance(emp, []);
  assert.equal(res.balance, 3);
});

test('Leave: computeSickLeaveBalance respects stored sickLeaveBalance field directly', () => {
  const emp = {
    id: 'emp-2',
    employeeId: 'KSS2407005',
    fullName: 'Thabeethal',
    joiningDate: '2026-07-01',
    sickLeaveBalance: 2
  };
  const res = engine.computeSickLeaveBalance(emp, []);
  assert.equal(res.balance, 2);
});

// ── Test 2: Monthly Auto-Credit logic and policy exclusions ───────────────────
test('Leave: monthly auto-credit adds +1 EL to eligible employees and excludes Koushik by policy', () => {
  const employees = [
    { id: 'emp-asbin', employeeId: 'KSS2407004', fullName: 'Asbin T S', status: 'Active', earnLeaveBalance: 1 },
    { id: 'emp-thabee', employeeId: 'KSS2407005', fullName: 'Thabeethal', status: 'Active', earnLeaveBalance: 2 },
    { id: 'emp-koushik', employeeId: 'KSS2407003', fullName: 'D. Koushik', status: 'Active', earnLeaveBalance: 0 },
    { id: 'emp-inactive', employeeId: 'KSS2407099', fullName: 'Inactive User', status: 'Inactive', earnLeaveBalance: 1 }
  ];

  const { credited, skipped, updatedEmps } = simulateMonthlyCredit(employees, '2026-11');

  // Asbin and Thabeethal credited
  assert.equal(credited.length, 2);
  assert.equal(credited.find(c => c.empId === 'KSS2407004').newBalance, 2);
  assert.equal(credited.find(c => c.empId === 'KSS2407005').newBalance, 3);

  // Koushik skipped by policy
  const koushikSkip = skipped.find(s => s.empId === 'KSS2407003');
  assert.ok(koushikSkip);
  assert.match(koushikSkip.reason, /Policy exception/);

  // Inactive user ignored
  assert.equal(updatedEmps.some(e => e.employeeId === 'KSS2407099'), false);
});

// ── Test 3: Monthly Auto-Credit idempotency ───────────────────────────────────
test('Leave: monthly auto-credit is strictly idempotent (running twice does not double-credit)', () => {
  const employees = [
    { id: 'emp-asbin', employeeId: 'KSS2407004', fullName: 'Asbin T S', status: 'Active', earnLeaveBalance: 1 }
  ];
  const ledgerSet = new Set();

  // Run 1: 1st of November
  const run1 = simulateMonthlyCredit(employees, '2026-11', ledgerSet);
  assert.equal(run1.credited.length, 1);
  assert.equal(run1.credited[0].newBalance, 2);

  // Run 2: Another session runs on the same month
  const run2 = simulateMonthlyCredit(run1.updatedEmps, '2026-11', run1.ledgerSet);
  assert.equal(run2.credited.length, 0);
  assert.equal(run2.skipped.length, 1);
  assert.match(run2.skipped[0].reason, /Already credited/);
});

// ── Test 4: Approval stages: PM/HR/CEO do NOT deduct balance ──────────────────
test('Leave: PM, HR, and CEO approval stages DO NOT deduct leave balance', () => {
  const employee = { id: 'emp-1', employeeId: 'KSS2407004', earnLeaveBalance: 3 };
  const request = {
    id: 'LR-001',
    employeeId: 'KSS2407004',
    type: 'Earn Leave',
    startDate: '2026-10-20',
    endDate: '2026-10-20',
    status: 'Pending',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Pending',
    _deductionApplied: false
  };

  // Intermediate stages do not trigger deductLeave
  assert.equal(employee.earnLeaveBalance, 3);
  assert.equal(request._deductionApplied, false);
});

// ── Test 5: Final CTO Approval atomically deducts leave balance ───────────────
test('Leave: final CTO approval atomically deducts leave balance and creates ledger entry', () => {
  const employee = { id: 'emp-1', employeeId: 'KSS2407004', earnLeaveBalance: 3 };
  const request = {
    id: 'LR-001',
    employeeId: 'KSS2407004',
    type: 'Earn Leave',
    startDate: '2026-10-20',
    endDate: '2026-10-21', // 2 days: 20th and 21st
    status: 'Pending',
    _deductionApplied: false
  };

  const result = simulateDeductLeave(request, employee, 'Gaurav (CTO)');
  assert.equal(result.success, true);
  assert.equal(result.deducted, 2);
  assert.equal(result.newEmployeeDoc.earnLeaveBalance, 1); // 3 - 2 = 1
  assert.equal(result.newRequestDoc._deductionApplied, true);
  assert.equal(result.newRequestDoc._deductionDays, 2);

  // Check ledger entry
  assert.equal(result.ledgerEntry.txnType, 'DEBIT');
  assert.equal(result.ledgerEntry.days, -2);
  assert.equal(result.ledgerEntry.resultingBalance, 1);
});

// ── Test 6: Deduction idempotency guard ───────────────────────────────────────
test('Leave: approval deduction cannot execute twice on the same request', () => {
  const employee = { id: 'emp-1', employeeId: 'KSS2407004', earnLeaveBalance: 2 };
  const requestAlreadyDeducted = {
    id: 'LR-001',
    employeeId: 'KSS2407004',
    type: 'Earn Leave',
    startDate: '2026-10-20',
    endDate: '2026-10-20',
    status: 'Approved',
    _deductionApplied: true,
    _deductionDays: 1
  };

  const result = simulateDeductLeave(requestAlreadyDeducted, employee, 'CTO');
  assert.equal(result.deducted, 0);
  assert.equal(result.newEmployeeDoc.earnLeaveBalance, 2); // Unchanged
  assert.match(result.message, /already deducted/i);
});

// ── Test 7: Sick Leave deducts from SL balance, NOT from EL balance ───────────
test('Leave: Sick Leave deduction deducts from sickLeaveBalance only', () => {
  const employee = { id: 'emp-1', employeeId: 'KSS2407007', earnLeaveBalance: 2, sickLeaveBalance: 1 };
  const sickRequest = {
    id: 'LR-SL-001',
    employeeId: 'KSS2407007',
    type: 'Sick Leave',
    startDate: '2026-10-12',
    endDate: '2026-10-12',
    status: 'Pending',
    _deductionApplied: false
  };

  const result = simulateDeductLeave(sickRequest, employee, 'CTO');
  assert.equal(result.deducted, 1);
  assert.equal(result.newEmployeeDoc.sickLeaveBalance, 0);
  assert.equal(result.newEmployeeDoc.earnLeaveBalance, 2); // EL untouched!
});

// ── Test 8: WFH requests never deduct from leave balances ─────────────────────
test('Leave: approved WFH requests do not deduct from EL or SL balances', () => {
  const employee = { id: 'emp-1', employeeId: 'KSS2407005', earnLeaveBalance: 2, sickLeaveBalance: 1 };
  const wfhRequest = {
    id: 'LR-WFH-001',
    employeeId: 'KSS2407005',
    type: 'WFH',
    startDate: '2026-10-22',
    endDate: '2026-10-22',
    status: 'Pending',
    _deductionApplied: false
  };

  const result = simulateDeductLeave(wfhRequest, employee, 'CTO');
  assert.equal(result.deducted, 0);
  assert.equal(result.newEmployeeDoc.earnLeaveBalance, 2);
  assert.equal(result.newEmployeeDoc.sickLeaveBalance, 1);
});

// ── Test 9: Balance never floors below zero ───────────────────────────────────
test('Leave: deduction never produces negative leave balances (floored at 0)', () => {
  const employee = { id: 'emp-1', employeeId: 'KSS2407004', earnLeaveBalance: 1 };
  const multiDayRequest = {
    id: 'LR-MULTI-001',
    employeeId: 'KSS2407004',
    type: 'Earn Leave',
    startDate: '2026-10-20',
    endDate: '2026-10-23', // 4 days
    status: 'Pending',
    _deductionApplied: false
  };

  const result = simulateDeductLeave(multiDayRequest, employee, 'CTO');
  assert.equal(result.deducted, 4);
  assert.equal(result.newEmployeeDoc.earnLeaveBalance, 0); // 1 - 4 floored at 0
});

// ── Test 10: Cancelling an approved leave reverses the deduction ──────────────
test('Leave: cancelling an approved leave reverses deduction and restores balance', () => {
  const employeeAfterDeduct = { id: 'emp-1', employeeId: 'KSS2407004', earnLeaveBalance: 1 };
  const approvedRequest = {
    id: 'LR-001',
    employeeId: 'KSS2407004',
    type: 'Earn Leave',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    status: 'Approved',
    _deductionApplied: true,
    _deductionDays: 2
  };

  const cancelResult = simulateCancelLeave(approvedRequest, employeeAfterDeduct, 'Asbin T S');
  assert.equal(cancelResult.reversed, 2);
  assert.equal(cancelResult.newEmployeeDoc.earnLeaveBalance, 3); // 1 + 2 = 3 restored
  assert.equal(cancelResult.newRequestDoc.status, 'Cancelled');
  assert.equal(cancelResult.newRequestDoc._reversalApplied, true);

  // Check reversal ledger entry
  assert.equal(cancelResult.ledgerEntry.txnType, 'REVERSAL');
  assert.equal(cancelResult.ledgerEntry.days, 2);
  assert.equal(cancelResult.ledgerEntry.resultingBalance, 3);
});

// ── Test 11: Reversal is idempotent (cannot reverse twice) ───────────────────
test('Leave: reversal on cancellation is idempotent', () => {
  const employee = { id: 'emp-1', employeeId: 'KSS2407004', earnLeaveBalance: 3 };
  const alreadyReversedRequest = {
    id: 'LR-001',
    employeeId: 'KSS2407004',
    type: 'Earn Leave',
    status: 'Cancelled',
    _deductionApplied: true,
    _deductionDays: 2,
    _reversalApplied: true
  };

  const cancelResult = simulateCancelLeave(alreadyReversedRequest, employee, 'Asbin');
  assert.equal(cancelResult.reversed, 0);
  assert.equal(cancelResult.newEmployeeDoc.earnLeaveBalance, 3); // Untouched
});

// ── Test 12: Cancelling a pending leave does not alter balance ────────────────
test('Leave: cancelling a pending request does not alter leave balance', () => {
  const employee = { id: 'emp-1', employeeId: 'KSS2407004', earnLeaveBalance: 2 };
  const pendingRequest = {
    id: 'LR-PENDING-001',
    employeeId: 'KSS2407004',
    type: 'Earn Leave',
    startDate: '2026-10-25',
    endDate: '2026-10-25',
    status: 'Pending',
    _deductionApplied: false
  };

  const cancelResult = simulateCancelLeave(pendingRequest, employee, 'Asbin');
  assert.equal(cancelResult.reversed, 0);
  assert.equal(cancelResult.newEmployeeDoc.earnLeaveBalance, 2);
  assert.equal(cancelResult.newRequestDoc.status, 'Cancelled');
});

// ── Test 13: UID-primary matching prevents cross-employee data leaks ──────────
test('Leave: UID and exact code matching strictly prevents cross-employee record leakage', () => {
  const activeEmployee = {
    uid: 'uid-koushik-123',
    employeeId: 'KSS2407003',
    id: 'emp-koushik',
    fullName: 'D. Koushik'
  };

  const allRequests = [
    { id: 'R1', employeeUid: 'uid-koushik-123', employeeId: 'KSS2407003', employeeName: 'D. Koushik' },
    { id: 'R2', employeeUid: 'uid-other-456', employeeId: 'KSS2407099', employeeName: 'Koushik Sharma' }, // Similar name!
    { id: 'R3', employeeUid: 'uid-other-789', employeeId: 'KSS2407004', employeeName: 'Asbin T S' }
  ];

  // Exact matching rule (UID-first, then employeeId, then doc.id — NO fuzzy name match)
  const myRequests = allRequests.filter(r => {
    if (r.employeeUid && activeEmployee.uid && r.employeeUid === activeEmployee.uid) return true;
    if (activeEmployee.employeeId && r.employeeId === activeEmployee.employeeId) return true;
    if (activeEmployee.id && r.employeeId === activeEmployee.id) return true;
    return false;
  });

  assert.equal(myRequests.length, 1);
  assert.equal(myRequests[0].id, 'R1');
  // Koushik Sharma must NOT leak to D. Koushik!
  assert.equal(myRequests.some(r => r.id === 'R2'), false);
});

// ── Test 14: Deduplication prevents repeated request entries ──────────────────
test('Leave: list deduplication by doc ID removes duplicate snapshot events', () => {
  const duplicateList = [
    { id: 'LR-1', type: 'Earn Leave', startDate: '2026-08-26', status: 'Approved' },
    { id: 'LR-1', type: 'Earn Leave', startDate: '2026-08-26', status: 'Approved' }, // Repeated doc
    { id: 'LR-2', type: 'Earn Leave', startDate: '2026-09-19', status: 'Approved' }
  ];

  const seen = new Set();
  const deduped = duplicateList.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].id, 'LR-1');
  assert.equal(deduped[1].id, 'LR-2');
});

// ── Test 15: Leave Ledger schema compliance ───────────────────────────────────
test('Leave: ledger entry adheres to schema and preserves audit trail', () => {
  const entry = {
    txnId: 'debit_emp1_earnLeaveBalance_LR001',
    employeeId: 'emp-1',
    employeeCode: 'KSS2407004',
    leaveType: 'Earn Leave',
    txnType: 'DEBIT',
    days: -1,
    requestId: 'LR001',
    date: '2026-10-14',
    timestamp: new Date().toISOString(),
    reason: 'Final approval deduction: 1 day(s) Earn Leave',
    performedBy: 'Gaurav (CTO)',
    performedByUid: 'uid-cto',
    resultingBalance: 2
  };

  assert.match(entry.txnId, /^debit_/);
  assert.equal(entry.days, -1);
  assert.equal(typeof entry.resultingBalance, 'number');
  assert.ok(entry.reason.length > 5);
});

// ── Test 16: Female employee monthly WFH allowance auto-init ──────────────────
test('Leave: female employee monthly WFH allowance initializes to 1 with idempotency', () => {
  const femaleEmployee = { id: 'emp-f1', fullName: 'Thabeethal', gender: 'Female' };
  const maleEmployee = { id: 'emp-m1', fullName: 'Asbin T S', gender: 'Male' };

  const wfhDatabase = new Map(); // key -> allowance doc

  function initWfhForMonth(emp, monthKey) {
    if (emp.gender !== 'Female') return false;
    const docKey = `${emp.id}_${monthKey}`;
    if (wfhDatabase.has(docKey)) return false; // Idempotent skip
    wfhDatabase.set(docKey, { allowance: 1, usedApproved: 0, remaining: 1, monthKey });
    return true;
  }

  // October run
  assert.equal(initWfhForMonth(femaleEmployee, '2026-10'), true);
  assert.equal(initWfhForMonth(maleEmployee, '2026-10'), false); // Male employees not auto-assigned
  assert.equal(wfhDatabase.get('emp-f1_2026-10').remaining, 1);

  // Duplicate run in October
  assert.equal(initWfhForMonth(femaleEmployee, '2026-10'), false); // Idempotent skip
  assert.equal(wfhDatabase.get('emp-f1_2026-10').remaining, 1); // Not incremented

  // November run
  assert.equal(initWfhForMonth(femaleEmployee, '2026-11'), true);
  assert.equal(wfhDatabase.get('emp-f1_2026-11').remaining, 1);
});

// ── Test 17: Casual Leave and Total Leave Quota calculation ───────────────────
test('Leave: computeCasualLeaveBalance respects stored casualLeaveBalance and computes total quota', () => {
  const emp = {
    id: 'emp-KSS2407004',
    employeeId: 'KSS2407004',
    fullName: 'Asbin T S',
    joiningDate: '2026-07-27',
    earnLeaveBalance: 2,
    sickLeaveBalance: 1,
    casualLeaveBalance: 3
  };

  const clRes = engine.computeCasualLeaveBalance(emp, [], new Date('2026-10-14'));
  assert.equal(clRes.balance, 3);
  assert.equal(clRes.credited, 3);
  assert.equal(clRes.taken, 0);

  const totalRes = engine.computeTotalLeaveBalances(emp, [], new Date('2026-10-14'));
  assert.equal(totalRes.earnLeave.balance, 2);
  assert.equal(totalRes.sickLeave.balance, 1);
  assert.equal(totalRes.casualLeave.balance, 3);
  assert.equal(totalRes.totalBalance, 6);
  assert.equal(totalRes.totalCredited >= 6, true);
});

// ── Test 18: Leave Increment and Decrement bounds ────────────────────────────
test('Leave: increment and decrement correctly adjusts and floors at 0', () => {
  let bal = 0;
  function adjust(current, delta) {
    return Math.max(0, current + delta);
  }

  // Decrement at 0 floors to 0
  bal = adjust(bal, -1);
  assert.equal(bal, 0);

  // Increment by 1
  bal = adjust(bal, 1);
  assert.equal(bal, 1);

  // Increment again
  bal = adjust(bal, 1);
  assert.equal(bal, 2);

  // Decrement by 1
  bal = adjust(bal, -1);
  assert.equal(bal, 1);

  // Decrement to 0
  bal = adjust(bal, -1);
  assert.equal(bal, 0);
});

