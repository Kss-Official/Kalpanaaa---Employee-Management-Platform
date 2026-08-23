import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Banknote, Download, FileText, CheckCircle2, TrendingUp, DollarSign, Send, Edit3, Calendar, X, Save, Clock, UserCheck, AlertTriangle, PackageCheck } from 'lucide-react';
import { SalaryDisbursement, Employee, AttendanceRecord } from '../../types';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';
import { generatePayslipPdf } from '../../lib/pdfGenerator';
import {
  buildPayrollAttendanceBasis,
  listPayrollMonths,
  listDatesInMonth,
  isNonWorkingDay,
  formatMonthKey,
  getMonthKey,
  getWorkDate,
  isExecutiveOrLeadership
} from '../../lib/attendanceEngine';

interface PayrollAdjustment {
  baseSalary?: number;
  allowances?: number;
  deduction?: number;
  daysWorked?: number;
  status?: 'Draft' | 'Approved' | 'Paid';
}

/** Per-month adjustment reader. Never throws on corrupt or absent storage. */
function readAdjustments(monthKey: string): Record<string, PayrollAdjustment> {
  try {
    const saved = localStorage.getItem(`kss_payroll_adjustments_${monthKey}`);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    console.warn('[HRPayrollView] Failed to parse payroll adjustments', e);
    return {};
  }
}

export const HRPayrollView: React.FC = () => {
  const { employees, attendance, activeEmployee, role, settings, leaveRequests } = useAuth();
  const holidayDates = React.useMemo<string[]>(
    () => (((settings as any)?.holidayDates) || []) as string[],
    [settings]
  );
  // Item #17: this was pinned to the string '2026-08'. From September onward the
  // view opened a month in the past by default and had no option to reach the
  // current one, so "this month's payroll" was literally unreachable.
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()));
  const payrollMonths = React.useMemo(() => listPayrollMonths(12), []);

  // Month-level roster facts. These do not vary by employee -- every person is
  // rostered on the same days -- so they are computed once rather than read off
  // an arbitrary row (which would also break when `employees` is empty).
  const monthBasis = React.useMemo(() => {
    const todayStr = getWorkDate(new Date());
    const dates = listDatesInMonth(selectedMonth);
    const rostered = dates.filter(d => !isNonWorkingDay(d, holidayDates));
    return {
      rosteredDays: rostered.length,
      elapsedDays: rostered.filter(d => d <= todayStr).length,
      isPartialMonth: selectedMonth >= getMonthKey(new Date())
    };
  }, [selectedMonth, holidayDates]);
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [bulkExportProgress, setBulkExportProgress] = useState(0);
  
  // Executive Board (CEO & CTO) have Read-Only view access — HR Admin manages salary assignments
  // Routed through the shared matcher: the previous version keyed on
  // `email.includes('akshit')` and `email.includes('founder')`, so any future
  // hire with those fragments in their address silently lost the ability to
  // edit salaries, while `designation.includes('CTO')` also matched "CONTRACTOR".
  const isExecutiveUser = isExecutiveOrLeadership(activeEmployee);

  const canEditSalary = (activeEmployee?.role === 'HR_ADMIN' || role === 'HR_ADMIN') && !isExecutiveUser;

  // Persistent Payroll Status per Month
  const [payrollStatus, setPayrollStatus] = useState<'Draft' | 'Approved' | 'Paid'>(() => {
    return (localStorage.getItem(`kss_payroll_status_${selectedMonth}`) as any) || 'Draft';
  });

  // Sync status when selected month changes
  useEffect(() => {
    const saved = localStorage.getItem(`kss_payroll_status_${selectedMonth}`);
    setPayrollStatus((saved as any) || 'Draft');
  }, [selectedMonth]);

  const handleUpdateStatus = (newStatus: 'Draft' | 'Approved' | 'Paid') => {
    if (!canEditSalary) return;
    setPayrollStatus(newStatus);
    localStorage.setItem(`kss_payroll_status_${selectedMonth}`, newStatus);
  };

  // HR Manual Adjustments Map state (keyed by employee ID, stored per month).
  //
  // The declared shape used to be { bonus, deduction, notes } while every write
  // and read actually used { baseSalary, allowances, deduction, daysWorked,
  // status } -- the type documented a record that never existed.
  const [manualAdjustments, setManualAdjustments] = useState<Record<string, PayrollAdjustment>>(
    () => readAdjustments(selectedMonth)
  );

  // P1: the state initialiser runs ONCE. Switching months therefore kept the
  // previous month's adjustments in state, and the save effect below then wrote
  // them under the NEW month's key -- silently copying August's manual salary
  // corrections onto July the moment HR opened July. Reload on every change.
  useEffect(() => {
    setManualAdjustments(readAdjustments(selectedMonth));
  }, [selectedMonth]);

  // Save manual adjustments persistently
  useEffect(() => {
    try {
      localStorage.setItem(`kss_payroll_adjustments_${selectedMonth}`, JSON.stringify(manualAdjustments));
    } catch (e) {
      console.warn('[HRPayrollView] Could not persist payroll adjustments', e);
    }
  }, [manualAdjustments, selectedMonth]);

  // Modal State: HR Manual Salary Adjustment
  const [editingDisbursement, setEditingDisbursement] = useState<{ emp: Employee; disb: SalaryDisbursement } | null>(null);
  const [baseSalaryInput, setBaseSalaryInput] = useState<number>(0);
  const [allowancesInput, setAllowancesInput] = useState<number>(0);
  const [deductionInput, setDeductionInput] = useState<number>(0);
  const [daysWorkedInput, setDaysWorkedInput] = useState<number>(0);
  const [modalStatusInput, setModalStatusInput] = useState<'Draft' | 'Approved' | 'Paid'>('Draft');

  // Modal State: Employee Monthly Attendance History
  const [historyModalEmp, setHistoryModalEmp] = useState<Employee | null>(null);

  const openAdjustmentModal = (emp: Employee, disb: SalaryDisbursement) => {
    if (!canEditSalary) return;
    const existing = manualAdjustments[emp.id] || {};
    setBaseSalaryInput(existing.baseSalary !== undefined ? existing.baseSalary : disb.baseSalary);
    setAllowancesInput(existing.allowances !== undefined ? existing.allowances : disb.allowances);
    setDeductionInput(existing.deduction !== undefined ? existing.deduction : disb.deductions);
    setDaysWorkedInput(existing.daysWorked !== undefined ? existing.daysWorked : disb.daysWorked);
    setModalStatusInput(existing.status || disb.status || 'Draft');
    setEditingDisbursement({ emp, disb });
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDisbursement || !canEditSalary) return;

    setManualAdjustments(prev => ({
      ...prev,
      [editingDisbursement.emp.id]: {
        baseSalary: Number(baseSalaryInput) || 0,
        allowances: Number(allowancesInput) || 0,
        deduction: Number(deductionInput) || 0,
        daysWorked: Number(daysWorkedInput) || 0,
        status: modalStatusInput
      }
    }));
    setEditingDisbursement(null);
  };

  // Build salary disbursements from the SELECTED MONTH's roster.
  //
  // Item #17 -- three fabrications lived here:
  //
  //  1. `empAttendance` was filtered by employee but NOT by month, so August
  //     payroll counted every Present day the employee had ever recorded,
  //     including July and June. Days worked grew without bound over time.
  //  2. With no records at all it fell back to `22 - (idx % 2)` days worked, so
  //     an employee who never checked in was paid for a near-full month.
  //  3. Base salary defaulted to `45000 + (idx % 3) * 5000` -- derived from the
  //     employee's INDEX IN THE ARRAY, so inserting or reordering one row
  //     changed other people's pay. Employee carries no salary field, so the
  //     only honest default is "unset", which HR then assigns explicitly.
  // Filter out Executive Leadership (CEO, CTO, COO Rahul Pathak, Founders) from employee payroll
  const operationalEmployees = employees.filter(e => e.status !== 'Terminated' && !isExecutiveOrLeadership(e));

  const disbursements = operationalEmployees.map(emp => {
    const custom = manualAdjustments[emp.id];
    const basis = buildPayrollAttendanceBasis(emp, attendance, selectedMonth, {
      leaveRequests,
      holidayDates,
      nowMs: Date.now()
    });

    const daysWorked = custom?.daysWorked !== undefined ? custom.daysWorked : basis.payableDays;
    const salaryAssigned = custom?.baseSalary !== undefined;
    const baseSalary = salaryAssigned ? (custom!.baseSalary as number) : 0;
    const allowances = custom?.allowances !== undefined ? custom.allowances : 0;

    // Loss of pay is pro-rated against the month's own rostered days rather than
    // a hardcoded 22, and only unexplained absences are deducted -- approved
    // leave and company holidays are paid.
    const perDay = basis.rosteredDays > 0 ? (baseSalary + allowances) / basis.rosteredDays : 0;
    const autoDeductions = Math.round(perDay * basis.lossOfPayDays);
    const totalDeductions = custom?.deduction !== undefined ? custom.deduction : autoDeductions;

    const netPay = Math.max(0, (baseSalary + allowances) - totalDeductions);
    const empStatus = custom?.status || payrollStatus;

    return {
      id: `sal-${emp.id}-${selectedMonth}`,
      month: selectedMonth,
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      department: emp.department,
      baseSalary,
      allowances,
      deductions: totalDeductions,
      manualAdjustment: (custom?.allowances || 0) - (custom?.deduction || 0),
      netPay,
      daysWorked,
      status: empStatus,
      basis,
      salaryAssigned,
      rawEmp: emp
    };
  });

  const unassignedCount = disbursements.filter(d => !d.salaryAssigned).length;

  const totalPayroll = disbursements.reduce((sum, d) => sum + d.netPay, 0);

  // Month label e.g. "August 2026". The local copy defaulted an unparseable
  // month to "August", which turned a bad key into a confidently wrong heading.
  const getMonthFormatted = (ym: string) => formatMonthKey(ym);

  const modalNetPayable = Math.max(0, (Number(baseSalaryInput) || 0) + (Number(allowancesInput) || 0) - (Number(deductionInput) || 0));

  const handleBulkExportAllPayslips = async () => {
    if (disbursements.length === 0 || isBulkExporting) return;
    setIsBulkExporting(true);
    setBulkExportProgress(0);

    const [y, m] = selectedMonth.split('-');
    const monthLabel = formatMonthKey(selectedMonth);
    const issueDate = new Date(parseInt(y), parseInt(m), 0).toISOString().split('T')[0];

    for (let i = 0; i < disbursements.length; i++) {
      const disb = disbursements[i];
      const emp = disb.rawEmp;

      generatePayslipPdf(emp, {
        monthLabel,
        issueDate,
        baseSalary: disb.baseSalary,
        allowances: disb.allowances,
        deductions: disb.deductions,
        daysWorked: disb.daysWorked,
        netPay: disb.netPay,
        status: disb.status
      }, settings);

      setBulkExportProgress(Math.round(((i + 1) / disbursements.length) * 100));
      await new Promise(r => setTimeout(r, 200));
    }

    setIsBulkExporting(false);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Banknote className="w-5 h-5 text-purple-400 shrink-0" />
            <span>HR Salary Disbursement &amp; Attendance Master</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {canEditSalary 
              ? 'Calculate monthly salaries, perform manual HR corrections, track 30-day attendance history, and approve disbursements.'
              : 'Executive Read-Only View: Inspect employee salary data assigned and generated by HR Lead.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          {/* Bulk Export Button */}
          <button
            onClick={handleBulkExportAllPayslips}
            disabled={isBulkExporting}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-900/40 cursor-pointer transition-all disabled:opacity-50 w-full sm:w-auto"
          >
            <PackageCheck className="w-4 h-4" />
            <span>{isBulkExporting ? `Exporting (${bulkExportProgress}%)...` : `Export All Payslips (${disbursements.length})`}</span>
          </button>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-hidden w-full sm:w-auto cursor-pointer"
            >
              {payrollMonths.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>

            {/* Quick Payroll Status Setter (Editable ONLY by HR Admin) */}
            {canEditSalary ? (
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold w-full sm:w-auto justify-between">
                <button
                  onClick={() => handleUpdateStatus('Draft')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${payrollStatus === 'Draft' ? 'bg-slate-800 text-white font-black' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Draft
                </button>
                <button
                  onClick={() => handleUpdateStatus('Approved')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${payrollStatus === 'Approved' ? 'bg-blue-600 text-white font-black shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Approved
                </button>
                <button
                  onClick={() => handleUpdateStatus('Paid')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-[11px] ${payrollStatus === 'Paid' ? 'bg-emerald-600 text-white font-black shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Paid
                </button>
              </div>
            ) : (
              <span className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1.5 w-full sm:w-auto">
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Assigned by HR</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-md space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Monthly Payroll</span>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">₹{totalPayroll.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{disbursements.length} Workforce Disbursements</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-md space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disbursement Status</span>
          <div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border inline-block ${
              payrollStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
              payrollStatus === 'Approved' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
              'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              ● {payrollStatus}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">Saved in persistent system log</span>
        </div>

        {/* Attendance basis. This card previously read "Last Day of Month
            (Auto)" over "Direct Deposit Integration Ready" -- there is no
            automatic run and no deposit integration, so it advertised
            capabilities the product does not have. It now reports the roster
            this month's pay is actually computed from. */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-md space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance Basis</span>
          <div className="text-sm font-bold text-slate-200" data-testid="payroll-basis-days">
            {monthBasis.rosteredDays} rostered day{monthBasis.rosteredDays === 1 ? '' : 's'}
            <span className="text-slate-500 font-mono text-xs"> · {monthBasis.elapsedDays} elapsed</span>
          </div>
          <span className={`text-[10px] font-semibold ${monthBasis.isPartialMonth ? 'text-amber-400' : 'text-emerald-400'}`}>
            {monthBasis.isPartialMonth
              ? 'Month in progress — figures are provisional'
              : 'Month closed — figures are final'}
          </span>
        </div>
      </div>

      {/* Item #17: base salary used to be invented from the row index, so every
          employee always showed a plausible figure and HR had no way to tell
          which ones were never actually assigned one. Now it is explicit. */}
      {unassignedCount > 0 && (
        <div
          data-testid="payroll-unassigned-banner"
          className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-300">
              {unassignedCount} employee{unassignedCount === 1 ? ' has' : 's have'} no base salary assigned
            </p>
            <p className="text-[11px] text-amber-200/70 mt-0.5 leading-relaxed">
              They contribute ₹0 to the payroll total until HR sets a figure. Use
              <strong className="text-amber-200"> Adjust </strong>
              on the row to assign one — nothing is assumed on their behalf.
            </p>
          </div>
        </div>
      )}

      {/* Main Table & Cards View */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800/80 overflow-hidden shadow-xl">
        {/* Mobile Cards View (sm:hidden) */}
        <div className="sm:hidden p-3.5 space-y-3">
          {disbursements.map(disb => (
            <div key={disb.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              {/* Employee Info Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <img
                    src={disb.rawEmp.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={disb.employeeName}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-700/60 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{disb.employeeName}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{disb.employeeId} • {disb.department}</p>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                  disb.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  disb.status === 'Approved' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {disb.status}
                </span>
              </div>

              {/* 2x2 Breakdown Grid */}
              <div className="grid grid-cols-2 gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800/80 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block font-bold uppercase">Days Worked</span>
                  <span className="font-bold text-slate-200">
                    {disb.daysWorked}
                    <span className="text-slate-500 text-[11px]"> / {disb.basis.workingDays}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block font-bold uppercase">Base Salary</span>
                  <span className="font-bold text-slate-300">₹{disb.baseSalary.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block font-bold uppercase">Allowances</span>
                  <span className="font-bold text-emerald-400">+₹{disb.allowances.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-sans block font-bold uppercase">Deductions</span>
                  <span className="font-bold text-rose-400">-₹{disb.deductions.toLocaleString()}</span>
                </div>
              </div>

              {/* Net Payable Banner */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-slate-300">Net Payable Amount</span>
                <span className="text-sm font-black text-white font-mono">₹{disb.netPay.toLocaleString()}</span>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                <div className="flex items-center gap-2 w-full justify-between">
                  {canEditSalary ? (
                    <button
                      onClick={() => openAdjustmentModal(disb.rawEmp, disb)}
                      className="px-3 py-1.5 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>HR Correction</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-default">
                      <UserCheck className="w-3 h-3 text-blue-400" />
                      <span>Assigned by HR</span>
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => generatePayslipPdf(disb.rawEmp, {
                        monthLabel: getMonthFormatted(selectedMonth),
                        issueDate: new Date().toISOString().split('T')[0],
                        baseSalary: disb.baseSalary,
                        allowances: disb.allowances,
                        deductions: disb.deductions,
                        daysWorked: disb.daysWorked,
                        netPay: disb.netPay,
                        status: disb.status
                      }, settings)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                      title="Download PDF Payslip"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Payslip</span>
                    </button>

                    <button
                      onClick={() => setHistoryModalEmp(disb.rawEmp)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                      title="View 30-Day Attendance Log"
                    >
                      <Calendar className="w-4 h-4 text-blue-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View (hidden on sm, block on sm+) */}
        <div className="hidden sm:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="py-4 px-6 w-52">Employee</th>
                <th className="py-4 px-6 w-32">
                  Days Paid
                  <span className="block text-[9px] font-normal text-slate-500 normal-case tracking-normal">
                    of elapsed rostered
                  </span>
                </th>
                <th className="py-4 px-6 w-32">Base Salary</th>
                <th className="py-4 px-6 w-28">Allowances</th>
                <th className="py-4 px-6 w-28">Deductions</th>
                <th className="py-4 px-6 w-32">Net Payable</th>
                <th className="py-4 px-6 w-24">Status</th>
                <th className="py-4 px-6 text-right w-44">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-xs">
              {disbursements.map(disb => (
                <tr key={disb.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="py-3.5 px-6 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <img
                        src={disb.rawEmp.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={disb.employeeName}
                        className="w-8 h-8 rounded-full object-cover border border-slate-700/60 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-white">{disb.employeeName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{disb.employeeId} • {disb.department}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-6 font-mono font-bold text-slate-200 whitespace-nowrap">
                    <span
                      title={`${disb.basis.presentDays} present · ${disb.basis.leaveDays} approved leave · ${disb.basis.absentDays} absent · ${disb.basis.holidayDays} holiday`}
                    >
                      {disb.daysWorked}
                      <span className="text-slate-500 text-[11px]"> / {disb.basis.workingDays}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-6 font-mono text-slate-300 whitespace-nowrap">
                    {disb.salaryAssigned ? (
                      `₹${disb.baseSalary.toLocaleString()}`
                    ) : (
                      <span className="text-[10px] font-sans font-bold text-amber-400/90 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md">
                        Not set
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-6 font-mono text-emerald-400 whitespace-nowrap">
                    +₹{disb.allowances.toLocaleString()}
                  </td>

                  <td className="py-3.5 px-6 font-mono text-rose-400 whitespace-nowrap">
                    -₹{disb.deductions.toLocaleString()}
                  </td>

                  <td className="py-3.5 px-6 font-mono font-black text-white text-sm whitespace-nowrap">
                    ₹{disb.netPay.toLocaleString()}
                  </td>

                  <td className="py-3.5 px-6 whitespace-nowrap">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      disb.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      disb.status === 'Approved' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {disb.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {canEditSalary ? (
                        <button
                          onClick={() => openAdjustmentModal(disb.rawEmp, disb)}
                          className="px-3 py-1.5 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>HR Correction</span>
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-default">
                          <UserCheck className="w-3 h-3 text-blue-400" />
                          <span>Assigned by HR</span>
                        </span>
                      )}

                      <button
                        onClick={() => setHistoryModalEmp(disb.rawEmp)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                        title="View 30-Day Attendance Log"
                      >
                        <Calendar className="w-4 h-4 text-blue-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: HR Salary Correction Modal (Matches User Screenshot Exact Design) */}
      {editingDisbursement && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white"
          >
            {/* Header */}
            <div className="p-6 pb-4 flex justify-between items-start">
              <div>
                <h3 className="font-black text-white text-xl tracking-tight">HR Salary Correction</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Editing salary for <strong className="text-blue-400 font-bold">{editingDisbursement.emp.fullName}</strong> ({getMonthFormatted(selectedMonth)})
                </p>
              </div>
              <button
                onClick={() => setEditingDisbursement(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-6 pt-2 space-y-6">
              {/* 2x2 Form Input Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">Base Salary (₹)</label>
                  <input
                    type="number"
                    value={baseSalaryInput}
                    onChange={e => setBaseSalaryInput(Number(e.target.value))}
                    className="w-full bg-[#0b1324] border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">Allowances (₹)</label>
                  <input
                    type="number"
                    value={allowancesInput}
                    onChange={e => setAllowancesInput(Number(e.target.value))}
                    className="w-full bg-[#0b1324] border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">Deductions (₹)</label>
                  <input
                    type="number"
                    value={deductionInput}
                    onChange={e => setDeductionInput(Number(e.target.value))}
                    className="w-full bg-[#0b1324] border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">Days Worked</label>
                  <input
                    type="number"
                    value={daysWorkedInput}
                    onChange={e => setDaysWorkedInput(Number(e.target.value))}
                    className="w-full bg-[#0b1324] border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Disbursement Status Segmented Control */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">Disbursement Status</label>
                <div className="grid grid-cols-3 gap-3 bg-[#0b1324] p-1.5 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setModalStatusInput('Draft')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      modalStatusInput === 'Draft' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStatusInput('Approved')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      modalStatusInput === 'Approved' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Approved
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStatusInput('Paid')}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      modalStatusInput === 'Paid' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Paid
                  </button>
                </div>
              </div>

              {/* Net Payable Live Display */}
              <div className="flex items-center gap-2 pt-1 text-sm">
                <span className="text-slate-400 font-medium">Net Payable:</span>
                <span className="text-emerald-400 font-mono font-bold text-base">₹{modalNetPayable.toLocaleString()}</span>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDisbursement(null)}
                  className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-900/40"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Correction</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: Employee Monthly Attendance History Modal */}
      {historyModalEmp && (
        <EmployeeMonthlyAttendanceModal
          employee={historyModalEmp}
          onClose={() => setHistoryModalEmp(null)}
        />
      )}
    </div>
  );
};
