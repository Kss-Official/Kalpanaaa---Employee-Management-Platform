import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { Banknote, Download, FileText, CheckCircle2, TrendingUp, DollarSign, Send } from 'lucide-react';
import { SalaryDisbursement } from '../../types';

export const HRPayrollView: React.FC = () => {
  const { employees, attendance } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState('2026-07');
  const [payrollStatus, setPayrollStatus] = useState<'Draft' | 'Approved' | 'Paid'>('Draft');

  // Build salary disbursement list for employees
  const disbursements: SalaryDisbursement[] = employees.map((emp, idx) => {
    const baseSalary = 45000 + (idx % 3) * 5000;
    const daysWorked = 22 - (idx % 2);
    const deductions = (22 - daysWorked) * 1500;
    const netPay = baseSalary - deductions;

    return {
      id: `sal-${emp.id}-${selectedMonth}`,
      month: selectedMonth,
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      department: emp.department,
      baseSalary,
      allowances: 2000,
      deductions,
      netPay,
      daysWorked,
      status: payrollStatus
    };
  });

  const totalPayroll = disbursements.reduce((sum, d) => sum + d.netPay, 0);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Banknote className="w-5 h-5 text-purple-400" />
            Monthly Payroll Runs & Salary Approvals
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Calculate monthly salaries, verify days worked from attendance logs, and disburse payroll.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-hidden"
          >
            <option value="2026-07">July 2026</option>
            <option value="2026-06">June 2026</option>
            <option value="2026-05">May 2026</option>
          </select>

          {payrollStatus === 'Draft' && (
            <button
              onClick={() => setPayrollStatus('Approved')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-900/40 transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Payroll Run</span>
            </button>
          )}

          {payrollStatus === 'Approved' && (
            <button
              onClick={() => setPayrollStatus('Paid')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Mark All as Paid</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-md">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Net Payroll</p>
          <h3 className="text-3xl font-black text-white">₹{(totalPayroll / 100000).toFixed(2)} Lakhs</h3>
          <p className="text-[10px] text-slate-500 mt-1">Calculated for {disbursements.length} active employees</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-md">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-3 py-1 rounded-full font-extrabold text-xs border ${
              payrollStatus === 'Paid' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              payrollStatus === 'Approved' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
              'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              ● {payrollStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-md">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Batch Actions</p>
          <button
            onClick={() => alert(`Batch PDF payslips generated for ${selectedMonth}!`)}
            className="w-full mt-1 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-400 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Batch Export All PDF Payslips
          </button>
        </div>
      </div>

      {/* Salary Disbursement Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Days Worked</th>
                <th className="py-3 px-4">Base Salary</th>
                <th className="py-3 px-4">Deductions</th>
                <th className="py-3 px-4">Net Payable</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {disbursements.map(disb => (
                <tr key={disb.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">
                    {disb.employeeName} ({disb.employeeId})
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{disb.department}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">{disb.daysWorked} / 22 days</td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">₹{disb.baseSalary.toLocaleString()}</td>
                  <td className="py-3.5 px-4 font-mono text-rose-400">-₹{disb.deductions.toLocaleString()}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">₹{disb.netPay.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="text-[10px] font-bold text-slate-300 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md">
                      {disb.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
