import { INITIAL_EMPLOYEES } from '../src/lib/demoData.ts';
import { computeTotalLeaveBalances, computeEmployeeLeaveBalance, computeSickLeaveBalance, computeCasualLeaveBalance } from '../src/lib/attendanceEngine.ts';

const refDate = new Date(2026, 9, 1); // October 2026

console.log("=== CHECKING ALL INITIAL_EMPLOYEES ===");
for (const emp of INITIAL_EMPLOYEES) {
  const tot = computeTotalLeaveBalances(emp, [], refDate);
  const el = computeEmployeeLeaveBalance(emp, [], refDate);
  const sl = computeSickLeaveBalance(emp, [], refDate);
  const cl = computeCasualLeaveBalance(emp, [], refDate);
  console.log(`[${emp.employeeId}] ${emp.fullName}:`);
  console.log(`   EL credited: ${el.credited}, taken: ${el.taken}, bal: ${el.balance}`);
  console.log(`   SL credited: ${sl.credited}, taken: ${sl.taken}, bal: ${sl.balance}`);
  console.log(`   CL credited: ${cl.credited}, taken: ${cl.taken}, bal: ${cl.balance}`);
  console.log(`   TOTAL CREDITED: ${tot.totalCredited}, TOTAL BAL: ${tot.totalBalance}`);
  if (tot.totalCredited > 3 || el.credited > 2 || sl.credited > 1) {
    console.error(`   ❌ VIOLATION: TotalCredited=${tot.totalCredited}, EL=${el.credited}, SL=${sl.credited}`);
  }
}
