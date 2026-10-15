import { computeTotalLeaveBalances, computeEmployeeLeaveBalance, computeSickLeaveBalance } from '../src/lib/attendanceEngine.ts';

const emp = {
  id: 'emp-KSS2407003',
  employeeId: 'KSS2407003',
  fullName: 'D. Koushik',
  joiningDate: '2026-07-27',
  earnLeaveBalance: 0,
  sickLeaveBalance: 0,
  casualLeaveBalance: 0
};

const leaveRequests = [
  {
    employeeId: 'KSS2407003',
    employeeName: 'D. Koushik',
    status: 'Approved',
    type: 'Leave',
    startDate: '2026-08-10',
    endDate: '2026-08-10'
  },
  {
    employeeId: 'KSS2407003',
    employeeName: 'D. Koushik',
    status: 'Approved',
    type: 'Leave',
    startDate: '2026-09-15',
    endDate: '2026-09-15'
  }
];

const refDate = new Date(2026, 9, 1); // Oct 1, 2026

console.log("EL:", computeEmployeeLeaveBalance(emp, leaveRequests, refDate));
console.log("SL:", computeSickLeaveBalance(emp, leaveRequests, refDate));
console.log("TOTAL:", computeTotalLeaveBalances(emp, leaveRequests, refDate));
