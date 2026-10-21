import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Load the compiled module from KSS_TEST_OUT
const OUT = process.env.KSS_TEST_OUT;
if (!OUT) {
  throw new Error('KSS_TEST_OUT environment variable is missing.');
}

const {
  classifyLeaveRecordStrict,
  getSummaryIntervalDates,
  computeLeaveHistorySummary,
  formatDisplayDate
} = await import(pathToFileURL(join(OUT, 'leaveHistorySummaryService.cjs')).href);

test('leave classification: detects structured Loss of Pay, Earned Leave, and Casual Leave', () => {
  // LOP structured
  const res1 = classifyLeaveRecordStrict({ type: 'Loss of Pay' });
  assert.equal(res1.classifiedType, 'LOP');
  assert.equal(res1.isAmbiguous, false);

  const res2 = classifyLeaveRecordStrict({ leaveCategory: 'LOP' });
  assert.equal(res2.classifiedType, 'LOP');

  // CL structured
  const res3 = classifyLeaveRecordStrict({ type: 'Casual Leave' });
  assert.equal(res3.classifiedType, 'CL');
  assert.equal(res3.isAmbiguous, false);

  const res4 = classifyLeaveRecordStrict({ leaveCategory: 'CL' });
  assert.equal(res4.classifiedType, 'CL');

  // EL structured
  const res5 = classifyLeaveRecordStrict({ type: 'Earn Leave' });
  assert.equal(res5.classifiedType, 'EL');

  const res6 = classifyLeaveRecordStrict({ type: 'Earned Leave' });
  assert.equal(res6.classifiedType, 'EL');

  // WFH excluded from leave
  const resWfh = classifyLeaveRecordStrict({ type: 'WFH' });
  assert.equal(resWfh.classifiedType, 'WFH');
});

test('leave classification: detects explicit mentions in notes and reasons with whole-word safety', () => {
  // LOP variants in notes
  const lopNote1 = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Taking 2 days loss of pay due to personal work' });
  assert.equal(lopNote1.classifiedType, 'LOP');
  assert.equal(lopNote1.confidence, 'HIGH_EXPLICIT_NOTE');

  const lopNote2 = classifyLeaveRecordStrict({ type: 'Leave', reviewNotes: 'Approved as LOP by PM' });
  assert.equal(lopNote2.classifiedType, 'LOP');

  const lopNote3 = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Leave without pay for exam preparation' });
  assert.equal(lopNote3.classifiedType, 'LOP');

  const lopNote4 = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Unpaid leave requested' });
  assert.equal(lopNote4.classifiedType, 'LOP');

  // Casual Leave variants in notes
  const clNote1 = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Applying for casual leave for family function' });
  assert.equal(clNote1.classifiedType, 'CL');

  const clNote2 = classifyLeaveRecordStrict({ type: 'Leave', reviewNotes: 'Deduct from CL balance' });
  assert.equal(clNote2.classifiedType, 'CL');

  // Earned Leave variants in notes
  const elNote1 = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Applying for earned leave for annual vacation' });
  assert.equal(elNote1.classifiedType, 'EL');

  const elNote2 = classifyLeaveRecordStrict({ type: 'Leave', pmNotes: 'Sanctioned under EL quota' });
  assert.equal(elNote2.classifiedType, 'EL');
});

test('leave classification: avoids false positives on substrings like "clearance", "develop", "element"', () => {
  // "clearance" must NOT be matched as "CL"
  const clearanceRes = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Need security clearance from HR office' });
  assert.notEqual(clearanceRes.classifiedType, 'CL');
  assert.equal(clearanceRes.isAmbiguous, true); // Falls to generic leave flagged for review

  // "client" must NOT match as "CL"
  const clientRes = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Attending offsite client meeting' });
  assert.notEqual(clientRes.classifiedType, 'CL');

  // "develop" or "slope" must NOT match as "LOP"
  const devRes = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Researching app develop features' });
  assert.notEqual(devRes.classifiedType, 'LOP');

  // "element" or "help" must NOT match as "EL"
  const helpRes = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Need help moving household items' });
  assert.notEqual(helpRes.classifiedType, 'EL');
  assert.equal(helpRes.isAmbiguous, true);
});

test('leave classification: flags ambiguous generic leave records for admin verification', () => {
  const genericRes = classifyLeaveRecordStrict({ type: 'Leave', reason: 'Family emergency' });
  assert.equal(genericRes.classifiedType, 'OTHER');
  assert.equal(genericRes.isAmbiguous, true);
  assert.equal(genericRes.confidence, 'AMBIGUOUS');
});

test('summary intervals: generates 7d, 15d, and 30d periods accurately', () => {
  const int7 = getSummaryIntervalDates('7d');
  assert.equal(int7.dateList.length, 7);
  assert.equal(int7.dateList[int7.dateList.length - 1], int7.endDate);

  const int15 = getSummaryIntervalDates('15d');
  assert.equal(int15.dateList.length, 15);
  assert.equal(int15.dateList[int15.dateList.length - 1], int15.endDate);

  const int30 = getSummaryIntervalDates('30d');
  assert.equal(int30.dateList.length, 30);
  assert.equal(int30.dateList[int30.dateList.length - 1], int30.endDate);
});

test('summary engine: aggregates unique employees, total days, and breakdown rows correctly', () => {
  const { startDate, endDate, dateList } = getSummaryIntervalDates('7d');
  const midDate1 = dateList[2]; // Guaranteed inside 7-day range
  const midDate2 = dateList[4];

  const employees = [
    { id: 'emp_1', employeeId: 'EMP001', fullName: 'Alice Sharma', department: 'Engineering' },
    { id: 'emp_2', employeeId: 'EMP002', fullName: 'Bob Verma', department: 'Operations' },
    { id: 'emp_3', employeeId: 'EMP003', fullName: 'Charlie Singh', department: 'Design' }
  ];

  const leaveRequests = [
    // Alice took 1 day LOP
    {
      id: 'req_1',
      employeeId: 'EMP001',
      employeeName: 'Alice Sharma',
      type: 'Loss of Pay',
      startDate: midDate1,
      endDate: midDate1,
      status: 'Approved'
    },
    // Bob took 1 day Casual Leave
    {
      id: 'req_2',
      employeeId: 'EMP002',
      employeeName: 'Bob Verma',
      type: 'Casual Leave',
      startDate: midDate2,
      endDate: midDate2,
      status: 'Approved'
    },
    // Charlie took 1 day Earned Leave
    {
      id: 'req_3',
      employeeId: 'EMP003',
      employeeName: 'Charlie Singh',
      type: 'Earned Leave',
      startDate: midDate1,
      endDate: midDate1,
      status: 'Approved'
    },
    // Pending request for Alice — MUST BE EXCLUDED
    {
      id: 'req_4',
      employeeId: 'EMP001',
      employeeName: 'Alice Sharma',
      type: 'Loss of Pay',
      startDate: midDate2,
      endDate: midDate2,
      status: 'Pending'
    },
    // Rejected request for Bob — MUST BE EXCLUDED
    {
      id: 'req_5',
      employeeId: 'EMP002',
      employeeName: 'Bob Verma',
      type: 'Casual Leave',
      startDate: midDate1,
      endDate: midDate1,
      status: 'Rejected'
    }
  ];

  const summary = computeLeaveHistorySummary(employees, leaveRequests, [], '7d');

  assert.equal(summary.uniqueLopEmployees, 1);
  assert.equal(summary.totalLopDays, 1);

  assert.equal(summary.uniqueClEmployees, 1);
  assert.equal(summary.totalClDays, 1);

  assert.equal(summary.uniqueElEmployees, 1);
  assert.equal(summary.totalElDays, 1);

  // Check breakdown rows
  assert.equal(summary.rows.length, 3);
  const aliceRow = summary.rows.find(r => r.employeeCode === 'EMP001');
  assert.ok(aliceRow);
  assert.equal(aliceRow.lopDays, 1);
  assert.equal(aliceRow.clDays, 0);
  assert.equal(aliceRow.elDays, 0);

  const bobRow = summary.rows.find(r => r.employeeCode === 'EMP002');
  assert.ok(bobRow);
  assert.equal(bobRow.clDays, 1);
  assert.equal(bobRow.lopDays, 0);

  const charlieRow = summary.rows.find(r => r.employeeCode === 'EMP003');
  assert.ok(charlieRow);
  assert.equal(charlieRow.elDays, 1);
});

test('summary engine: handles multi-day leaves spanning window boundary without double counting', () => {
  const { startDate, dateList } = getSummaryIntervalDates('7d');
  
  // Date 2 days BEFORE the start of the 7-day window
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const beforeStart = new Date(Date.UTC(sy, sm - 1, sd - 2, 12, 0, 0));
  const beforeStartStr = `${beforeStart.getUTCFullYear()}-${String(beforeStart.getUTCMonth() + 1).padStart(2, '0')}-${String(beforeStart.getUTCDate()).padStart(2, '0')}`;
  
  // Span from before window into the first 2 days of window
  const insideEndStr = dateList[1]; // 2nd day in window

  const employees = [{ id: 'emp_10', employeeId: 'EMP010', fullName: 'Dave Rao' }];
  const leaveRequests = [
    {
      id: 'req_span',
      employeeId: 'EMP010',
      employeeName: 'Dave Rao',
      type: 'Loss of Pay',
      startDate: beforeStartStr,
      endDate: insideEndStr,
      status: 'Approved'
    }
  ];

  const summary = computeLeaveHistorySummary(employees, leaveRequests, [], '7d');
  
  // Only the dates inside the 7-day window should be counted
  assert.equal(summary.uniqueLopEmployees, 1);
  assert.ok(summary.totalLopDays <= 2); // At most 2 days inside window (excluding any Sunday/holiday)
  assert.ok(summary.totalLopDays >= 1);
});
