import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Banknote,
  Download,
  FileText,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  Receipt
} from 'lucide-react';
import { generatePayslipPdf } from '../../lib/pdfGenerator';
import {
  buildPayrollAttendanceBasis,
  getPayrollCycleDates,
  listPayrollMonths,
  formatMonthKey
} from '../../lib/attendanceEngine';

interface PayslipRow {
  month: string;          // 'YYYY-MM'
  monthLabel: string;     // 'August 2026'
  cycleLabel: string;     // '27 Jul – 26 Aug'
  issueDate: string;      // 26th of month
  baseSalary: number;
  allowances: number;
  deductions: number;
  daysWorked: number;
  totalCycleDays: number;
  netPay: number;
  status: 'Draft' | 'Approved' | 'Paid';
}

const INR = (amount: number) =>
  '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const statusStyles: Record<string, string> = {
  Paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Approved: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Draft: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
};

const statusIcon: Record<string, React.ReactNode> = {
  Paid: <CheckCircle2 className="w-3 h-3" />,
  Approved: <Clock className="w-3 h-3" />,
  Draft: <AlertTriangle className="w-3 h-3" />,
};

export const EmployeePayslips: React.FC = () => {
  const { activeEmployee, attendance, settings, leaveRequests } = useAuth();
  const holidayDates = useMemo<string[]>(
    () => (((settings as any)?.holidayDates) || []) as string[],
    [settings]
  );
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  /** Build payslip rows — mirrors HRPayrollView 27th-to-26th disbursement logic exactly */
  const payslips: PayslipRow[] = useMemo(() => {
    if (!activeEmployee) return [];

    const cycleList = listPayrollMonths(12);
    const rows: PayslipRow[] = [];

    cycleList.forEach((cycle, loopIdx) => {
      const ym = cycle.key;
      const raw = localStorage.getItem(`kss_payroll_adjustments_${ym}`);
      let adjustments: Record<string, any> = {};
      if (raw) {
        try { adjustments = JSON.parse(raw); } catch (e) { console.warn('[EmployeePayslips] Failed to parse payroll adjustments', e); }
      }
      const custom = adjustments[activeEmployee.id];

      // Read payroll status for the month
      const savedStatus = localStorage.getItem(`kss_payroll_status_${ym}`);
      const monthStatus = (savedStatus as any) || 'Draft';

      const basis = buildPayrollAttendanceBasis(activeEmployee, attendance, ym, {
        leaveRequests,
        holidayDates,
        nowMs: Date.now()
      });

      const daysWorked = custom?.daysWorked !== undefined ? custom.daysWorked : basis.payableDays;
      const baseSalary = custom?.baseSalary !== undefined ? custom.baseSalary : 0;
      const allowances = custom?.allowances !== undefined ? custom.allowances : 0;
      const perDay = basis.rosteredDays > 0 ? (baseSalary + allowances) / basis.rosteredDays : 0;
      const autoDeductions = Math.round(perDay * basis.lossOfPayDays);
      const totalDeductions = custom?.deduction !== undefined ? custom.deduction : autoDeductions;

      const netPay = Math.max(0, baseSalary + allowances - totalDeductions);
      const status: 'Draft' | 'Approved' | 'Paid' = custom?.status || monthStatus;

      // Only include cycles where salary is assigned or HR has approved/paid
      const hrHasTouched = !!custom || status === 'Approved' || status === 'Paid';
      const isCurrentOrRecent = loopIdx <= 1;

      if (isCurrentOrRecent || hrHasTouched) {
        rows.push({
          month: ym,
          monthLabel: formatMonthKey(ym),
          cycleLabel: basis.cycleLabel,
          issueDate: basis.endDate,
          baseSalary,
          allowances,
          deductions: totalDeductions,
          daysWorked,
          totalCycleDays: basis.workingDays,
          netPay,
          status,
        });
      }
    });

    return rows;
  }, [activeEmployee, attendance, leaveRequests, holidayDates]);

  // Current month's data for the summary card
  const current = payslips[0];

  const toggleExpand = (month: string) =>
    setExpandedMonth((prev) => (prev === month ? null : month));

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Banknote className="w-5 h-5 text-blue-400" />
          Salary Payslips
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Your monthly salary breakdown as set by HR — view and download payslips.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Summary Card ── */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-md md:col-span-1 flex flex-col gap-5">
          {/* Current Base Salary */}
          <div>
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Current Base Salary
            </p>
            <h3 className="text-3xl font-black text-white">
              {current ? INR(current.baseSalary) : '—'}
              <span className="text-sm text-slate-500 font-medium">/mo</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">
              Next payout expected on{' '}
              {new Date(
                new Date().getFullYear(),
                new Date().getMonth() + 1,
                0
              ).toLocaleDateString('en-IN')}
            </p>
          </div>

          {/* Breakdown pills */}
          {current && (
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-blue-400" /> Allowances
                </span>
                <span className="font-bold text-blue-300">
                  +{INR(current.allowances)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-rose-400" /> Deductions
                </span>
                <span className="font-bold text-rose-300">
                  -{INR(current.deductions)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-2 mt-1">
                <span className="text-slate-300 font-bold">Net Pay</span>
                <span className="font-black text-emerald-400 text-sm">
                  {INR(current.netPay)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Days Worked</span>
                <span className="font-mono font-bold text-slate-200">
                  {current.daysWorked} / 22 days
                </span>
              </div>
              {/* Status badge */}
              <div className="pt-1">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyles[current.status]}`}
                >
                  {statusIcon[current.status]}
                  {current.status}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Payslip List ── */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-md md:col-span-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <FileText className="w-4 h-4 text-slate-400" /> Recent Payslips
          </h3>

          <div className="space-y-2">
            {payslips.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <Banknote className="w-8 h-8 mx-auto opacity-30" />
                <p>No payslips available yet. HR will generate them after payroll approval.</p>
              </div>
            ) : (
              payslips.map((slip) => (
                <div
                  key={slip.month}
                  className="rounded-xl border border-slate-800/60 bg-slate-950/50 overflow-hidden hover:border-slate-700 transition-colors"
                >
                  {/* Row Header — click to expand */}
                  <button
                    onClick={() => toggleExpand(slip.month)}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-4 mb-2 sm:mb-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {slip.monthLabel}
                        </h4>
                        <p className="text-[10px] font-mono text-slate-500">
                          Issued: {slip.issueDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                      <div className="text-left sm:text-right">
                        <span className="block text-[10px] font-medium text-slate-400 mb-0.5">
                          Net Pay
                        </span>
                        <span className="block text-sm font-black text-white">
                          {INR(slip.netPay)}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyles[slip.status]}`}
                      >
                        {statusIcon[slip.status]}
                        {slip.status}
                      </span>

                      {expandedMonth === slip.month ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Breakdown */}
                  {expandedMonth === slip.month && (
                    <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-900 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                            Base Salary
                          </p>
                          <p className="text-sm font-black text-white">
                            {INR(slip.baseSalary)}
                          </p>
                        </div>
                        <div className="bg-slate-900 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                            Allowances
                          </p>
                          <p className="text-sm font-black text-blue-300">
                            +{INR(slip.allowances)}
                          </p>
                        </div>
                        <div className="bg-slate-900 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                            Deductions
                          </p>
                          <p className="text-sm font-black text-rose-300">
                            -{INR(slip.deductions)}
                          </p>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">
                            Net Pay
                          </p>
                          <p className="text-sm font-black text-emerald-400">
                            {INR(slip.netPay)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900 rounded-xl px-4 py-2.5">
                        <span>Days Worked</span>
                        <span className="font-mono font-bold text-slate-200">
                          {slip.daysWorked} / 22 working days
                        </span>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => activeEmployee && generatePayslipPdf(activeEmployee, slip, settings)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download Official PDF Payslip
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
