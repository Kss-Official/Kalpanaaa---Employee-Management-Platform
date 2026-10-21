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
  buildDateRangeInterval,
  isAuthoritativeApprovedLeave,
  classifyLeaveRequestType,
  calculateLeaveAnalytics,
  isEmployeeMatch,
  generateDateSequence
} = await import(pathToFileURL(join(OUT, 'leaveAnalyticsService.cjs')).href);

test('leave analytics: buildDateRangeInterval generates accurate date intervals in Asia/Kolkata', () => {
  const int1d = buildDateRangeInterval('1d');
  assert.equal(int1d.daysCount, 1);
  assert.equal(int1d.dateList.length, 1);
  assert.equal(int1d.startDate, int1d.endDate);

  const int7d = buildDateRangeInterval('7d');
  assert.equal(int7d.daysCount, 7);
  assert.equal(int7d.dateList.length, 7);
  assert.equal(int7d.dateList[6], int7d.endDate);

  const int15d = buildDateRangeInterval('15d');
  assert.equal(int15d.daysCount, 15);
  assert.equal(int15d.dateList.length, 15);

  const int30d = buildDateRangeInterval('30d');
  assert.equal(int30d.daysCount, 30);
  assert.equal(int30d.dateList.length, 30);

  const intCustom = buildDateRangeInterval('custom', '2026-08-01', '2026-08-05');
  assert.equal(intCustom.daysCount, 5);
  assert.deepEqual(intCustom.dateList, [
    '2026-08-01',
    '2026-08-02',
    '2026-08-03',
    '2026-08-04',
    '2026-08-05'
  ]);

  // Swapped custom dates self-heal
  const intSwapped = buildDateRangeInterval('custom', '2026-08-05', '2026-08-01');
  assert.equal(intSwapped.daysCount, 5);
  assert.equal(intSwapped.startDate, '2026-08-01');
  assert.equal(intSwapped.endDate, '2026-08-05');
});

test('leave analytics: isAuthoritativeApprovedLeave enforces strict approval state', () => {
  // Direct Approved
  assert.equal(isAuthoritativeApprovedLeave({ status: 'Approved' }), true);

  // Multi-tier approved
  assert.equal(isAuthoritativeApprovedLeave({
    status: 'Pending',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Approved'
  }), true);

  // Bypassed/NA stages
  assert.equal(isAuthoritativeApprovedLeave({
    status: 'Pending',
    pmStatus: 'Bypassed',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'N/A'
  }), true);

  // Still Waiting / Pending
  assert.equal(isAuthoritativeApprovedLeave({
    status: 'Pending',
    pmStatus: 'Approved',
    hrStatus: 'Waiting PM',
    ceoStatus: 'Waiting HR',
    ctoStatus: 'Waiting CEO'
  }), false);

  // Rejected must NEVER count
  assert.equal(isAuthoritativeApprovedLeave({
    status: 'Rejected',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Approved'
  }), false);

  // Cancelled must NEVER count
  assert.equal(isAuthoritativeApprovedLeave({
    status: 'Cancelled',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Approved'
  }), false);
});

test('leave analytics: classifyLeaveRequestType categorizes correctly', () => {
  assert.equal(classifyLeaveRequestType({ type: 'WFH' }), 'WFH');
  assert.equal(classifyLeaveRequestType({ type: 'Leave', leaveCategory: 'WFH' }), 'WFH');
  assert.equal(classifyLeaveRequestType({ type: 'Sick Leave' }), 'SL');
  assert.equal(classifyLeaveRequestType({ type: 'Leave', leaveCategory: 'Sick Leave' }), 'SL');
  assert.equal(classifyLeaveRequestType({ type: 'Leave', reason: 'High fever and sick leave needed' }), 'SL');
  assert.equal(classifyLeaveRequestType({ type: 'Loss of Pay' }), 'LOP');
  assert.equal(classifyLeaveRequestType({ type: 'LOP' }), 'LOP');
  assert.equal(classifyLeaveRequestType({ type: 'Leave', reviewNotes: 'Loss of Pay deducted' }), 'LOP');
  assert.equal(classifyLeaveRequestType({ type: 'Earn Leave' }), 'EL');
  assert.equal(classifyLeaveRequestType({ type: 'Leave' }), 'EL');
});

test('leave analytics: overlap clipping and duplicate prevention', () => {
  const employees = [
    {
      id: 'emp-1',
      employeeId: 'KSS2407001',
      fullName: 'Alice Test',
      department: 'Engineering',
      designation: 'Developer',
      status: 'Active',
      joiningDate: '2026-07-27',
      earnLeaveBalance: 5,
      sickLeaveBalance: 3,
      casualLeaveBalance: 2
    }
  ];

  // Request spans 10 days: 2026-08-01 to 2026-08-10
  // Selected reporting window: 2026-08-05 to 2026-08-07 (3 days overlap)
  const leaveRequests = [
    {
      id: 'req-1',
      employeeId: 'KSS2407001',
      employeeName: 'Alice Test',
      type: 'Earn Leave',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      status: 'Approved'
    }
  ];

  const interval = buildDateRangeInterval('custom', '2026-08-05', '2026-08-07');
  const result = calculateLeaveAnalytics(employees, leaveRequests, [], undefined, interval);

  assert.equal(result.totalActiveEmployees, 1);
  assert.equal(result.totalElDays, 3); // ONLY 3 days in window
  assert.equal(result.totalLeaveDays, 3);
  assert.equal(result.employeesOnLeaveCount, 1);
  assert.equal(result.uniqueElEmployeesCount, 1);

  // Live balance is NOT confused with days taken
  const metric = result.employeeMetrics[0];
  assert.equal(metric.elDays, 3);
  assert.equal(metric.currentEarnLeaveBalance, 5);
  assert.equal(metric.currentSickLeaveBalance, 3);
});

test('leave analytics: WFH is strictly excluded from Total Leave Days', () => {
  const employees = [
    {
      id: 'emp-2',
      employeeId: 'KSS2407002',
      fullName: 'Bob Remote',
      department: 'Design',
      designation: 'UI Designer',
      status: 'Active',
      joiningDate: '2026-07-27'
    }
  ];

  const leaveRequests = [
    {
      id: 'req-wfh-1',
      employeeId: 'KSS2407002',
      employeeName: 'Bob Remote',
      type: 'WFH',
      startDate: '2026-08-03',
      endDate: '2026-08-05',
      status: 'Approved'
    }
  ];

  const interval = buildDateRangeInterval('custom', '2026-08-01', '2026-08-07');
  const result = calculateLeaveAnalytics(employees, leaveRequests, [], undefined, interval);

  assert.equal(result.totalWfhDays, 3);
  assert.equal(result.totalLeaveDays, 0); // WFH NEVER added to total leave days!
  assert.equal(result.totalElDays, 0);
  assert.equal(result.totalLopDays, 0);
  assert.equal(result.employeesOnLeaveCount, 0); // On WFH is not on leave
  assert.equal(result.uniqueWfhEmployeesCount, 1);
});

test('leave analytics: Loss of Pay from both approved requests and attendance logs', () => {
  const employees = [
    {
      id: 'emp-3',
      employeeId: 'KSS2407003',
      fullName: 'Charlie Lop',
      department: 'QA',
      designation: 'QA Lead',
      status: 'Active',
      joiningDate: '2026-07-27'
    }
  ];

  // Charlie has 1 approved LOP request and 1 attendance record marked as Loss of Pay
  const leaveRequests = [
    {
      id: 'req-lop-1',
      employeeId: 'KSS2407003',
      type: 'Loss of Pay',
      startDate: '2026-08-03', // Mon
      endDate: '2026-08-03',
      status: 'Approved'
    }
  ];

  const attendance = [
    {
      id: 'att-lop-1',
      employeeId: 'emp-3',
      employeeCode: 'KSS2407003',
      date: '2026-08-04', // Tue
      status: 'Loss of Pay',
      notes: 'Unexcused Absence LOP'
    }
  ];

  const interval = buildDateRangeInterval('custom', '2026-08-03', '2026-08-05');
  const result = calculateLeaveAnalytics(employees, leaveRequests, attendance, undefined, interval);

  assert.equal(result.totalLopDays, 2);
  assert.equal(result.uniqueLopEmployeesCount, 1);
  assert.equal(result.totalLeaveDays, 2);
  assert.equal(result.employeesOnLeaveCount, 1);

  const empMetric = result.employeeMetrics[0];
  assert.equal(empMetric.lopDays, 2);
  assert.equal(empMetric.qualifyingDays.length, 2);
  assert.equal(empMetric.qualifyingDays[0].source, 'leave_request');
  assert.equal(empMetric.qualifyingDays[1].source, 'attendance_record');
});

test('leave analytics: pending and rejected requests never count as taken', () => {
  const employees = [
    {
      id: 'emp-4',
      employeeId: 'KSS2407004',
      fullName: 'Diana Pending',
      department: 'Marketing',
      designation: 'Specialist',
      status: 'Active',
      joiningDate: '2026-07-27'
    }
  ];

  const leaveRequests = [
    {
      id: 'req-pending-1',
      employeeId: 'KSS2407004',
      type: 'Earn Leave',
      startDate: '2026-08-03',
      endDate: '2026-08-04',
      status: 'Pending'
    },
    {
      id: 'req-rejected-1',
      employeeId: 'KSS2407004',
      type: 'Sick Leave',
      startDate: '2026-08-05',
      endDate: '2026-08-05',
      status: 'Rejected'
    }
  ];

  const interval = buildDateRangeInterval('custom', '2026-08-01', '2026-08-07');
  const result = calculateLeaveAnalytics(employees, leaveRequests, [], undefined, interval);

  assert.equal(result.totalLeaveDays, 0);
  assert.equal(result.totalElDays, 0);
  assert.equal(result.totalSlDays, 0);
  assert.equal(result.employeesOnLeaveCount, 0);
  assert.equal(result.totalQualifyingRequests, 0);
});
