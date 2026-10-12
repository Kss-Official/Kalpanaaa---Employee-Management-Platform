import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCyclePresetList,
  generateConsecutiveDates,
  computeEmployeeCycleMetrics,
  filterEmployeesForCycleExport
} from '../src/lib/payrollCycleExporter.ts';

test('getCyclePresetList generates 26-to-26 cycle date ranges', () => {
  const presets = getCyclePresetList(new Date('2026-09-15T00:00:00Z'));
  assert.ok(presets.length >= 6, 'Should generate multiple cycle presets');

  const activePreset = presets.find(p => p.isCurrent);
  assert.ok(activePreset, 'Should identify current active cycle preset');
  
  // Verify start date ends with -26 and end date ends with -26
  presets.forEach(p => {
    assert.ok(p.startDate.endsWith('-26'), `Start date ${p.startDate} must be on the 26th`);
    assert.ok(p.endDate.endsWith('-26'), `End date ${p.endDate} must be on the 26th`);
    assert.ok(p.startDate < p.endDate, `Start date ${p.startDate} must be before end date ${p.endDate}`);
  });
});

test('generateConsecutiveDates produces exact 32 days for 26 Aug to 26 Sep', () => {
  const dates = generateConsecutiveDates('2026-08-26', '2026-09-26');
  assert.equal(dates.length, 32, 'August 26 to September 26 inclusive should be 32 calendar days');
  assert.equal(dates[0], '2026-08-26');
  assert.equal(dates[dates.length - 1], '2026-09-26');
});

test('computeEmployeeCycleMetrics accurately computes attendance, payable days, and salary', () => {
  const mockEmp = {
    id: 'emp-101',
    employeeId: 'KSS2407003',
    fullName: 'D. Koushik',
    department: 'IT',
    designation: 'Project Manager',
    joiningDate: '2026-07-27',
    baseSalary: 65000
  };

  const mockAttendance = [
    {
      id: 'att-1',
      employeeId: 'KSS2407003',
      date: '2026-08-26',
      status: 'Present',
      checkInAt: '2026-08-26T04:30:00.000Z', // 10:00 AM IST
      checkOutAt: '2026-08-26T13:30:00.000Z', // 7:00 PM IST
      workingMinutes: 540
    },
    {
      id: 'att-2',
      employeeId: 'KSS2407003',
      date: '2026-08-27',
      status: 'Work From Home',
      isWfh: true,
      workingMinutes: 540
    }
  ];

  const mockLeaveRequests = [
    {
      id: 'lr-1',
      employeeId: 'KSS2407003',
      type: 'Earn Leave',
      startDate: '2026-08-28',
      endDate: '2026-08-28',
      status: 'Approved'
    }
  ];

  const holidays = ['2026-08-29'];

  const metrics = computeEmployeeCycleMetrics(
    mockEmp,
    mockAttendance,
    mockLeaveRequests,
    '2026-08-26',
    '2026-09-26',
    holidays,
    [],
    new Date('2026-09-28T00:00:00Z').getTime()
  );

  assert.equal(metrics.calendarDays, 30);
  assert.equal(metrics.employeeId, 'KSS2407003');
  assert.equal(metrics.baseSalary, 65000);
  assert.equal(metrics.grossSalary, 67000); // 65000 + 2000 allowance
  assert.ok(metrics.rosteredWorkingDays > 0);
  assert.ok(metrics.payableDays > 0);
  assert.ok(metrics.netPayableSalary >= 0);

  // Check specific day mappings
  assert.equal(metrics.dailyDetails['2026-08-26'].code, 'P');
  assert.equal(metrics.dailyDetails['2026-08-27'].code, 'WFH');
  assert.equal(metrics.dailyDetails['2026-08-28'].code, 'L');
  assert.equal(metrics.dailyDetails['2026-08-29'].code, 'H');
  // Sunday 2026-08-30
  assert.equal(metrics.dailyDetails['2026-08-30'].code, 'WO');
});

test('filterEmployeesForCycleExport excludes founders and exempt executives', () => {
  const mockEmployees = [
    { id: '1', employeeId: 'KSS2407001', fullName: 'Gaurav Founder', designation: 'Managing Director' },
    { id: '2', employeeId: 'KSS2407003', fullName: 'D. Koushik', department: 'IT', designation: 'Project Manager' },
    { id: '3', employeeId: 'KSS2407010', fullName: 'Inactive Emp', status: 'Terminated' }
  ];

  const filtered = filterEmployeesForCycleExport(mockEmployees, {
    departmentFilter: 'ALL',
    employmentTypeFilter: 'ALL',
    includeInactive: false
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].employeeId, 'KSS2407003');
});
