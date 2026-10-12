import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Search,
  Filter,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  X,
  ChevronDown,
  Building2,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useHaptic } from '../../hooks/useHaptic';
import {
  getCyclePresetList,
  generateConsecutiveDates,
  filterEmployeesForCycleExport,
  computeEmployeeCycleMetrics,
  generateAndDownloadPayrollCycleExcel,
  EmployeeCycleMetrics,
  CycleDateRange
} from '../../lib/payrollCycleExporter';
import { OFFICIAL_HOLIDAY_DATES_2026 } from '../../lib/attendanceEngine';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';

const DEPARTMENTS = [
  'ALL',
  'IT',
  'HR',
  'Product & Design',
  'Management',
  'Sales',
  'Marketing',
  'Finance',
  'Operations'
];

const EMPLOYMENT_TYPES = [
  'ALL',
  'Full-Time',
  'Intern',
  'Trainee',
  'Contract'
];

export const PMAttendanceCycleSection: React.FC = () => {
  const { employees, attendance, leaveRequests, settings, activeEmployee } = useAuth();
  const { triggerHaptic } = useHaptic();

  // Cycle Presets
  const presets = useMemo(() => getCyclePresetList(new Date()), []);
  const defaultPreset = useMemo(() => presets.find(p => p.isCurrent) || presets[0], [presets]);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(defaultPreset.id);
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);
  const [customStartDate, setCustomStartDate] = useState<string>(defaultPreset.startDate);
  const [customEndDate, setCustomEndDate] = useState<string>(defaultPreset.endDate);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedEmpType, setSelectedEmpType] = useState<string>('ALL');

  // Loading & Modal States
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState<boolean>(false);
  const [inspectEmployee, setInspectEmployee] = useState<EmployeeCycleMetrics | null>(null);
  const [monthlyAttendanceEmp, setMonthlyAttendanceEmp] = useState<any | null>(null);

  // Active Date Range Resolution
  const activeRange = useMemo(() => {
    if (isCustomRange) {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        label: `${customStartDate} to ${customEndDate} (Custom Date Range)`
      };
    }
    const match = presets.find(p => p.id === selectedPresetId) || defaultPreset;
    return {
      startDate: match.startDate,
      endDate: match.endDate,
      label: match.label
    };
  }, [isCustomRange, customStartDate, customEndDate, selectedPresetId, presets, defaultPreset]);

  // Consecutive dates in cycle
  const cycleDates = useMemo(() => {
    return generateConsecutiveDates(activeRange.startDate, activeRange.endDate);
  }, [activeRange.startDate, activeRange.endDate]);

  const holidayDates = useMemo(() => {
    const stored = ((settings as any)?.holidayDates || []) as string[];
    // Always union with official list so public holidays (e.g. Ganesh Chaturthi)
    // are never silently missing due to a stale Firestore value.
    return Array.from(new Set([...OFFICIAL_HOLIDAY_DATES_2026, ...stored]));
  }, [settings]);

  const companyWideWfhDates = useMemo(() => {
    return ((settings as any)?.companyWideWfhDates || []) as string[];
  }, [settings]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return filterEmployeesForCycleExport(employees, {
      departmentFilter: selectedDept,
      employmentTypeFilter: selectedEmpType,
      searchFilter: searchTerm,
      includeInactive: false
    });
  }, [employees, selectedDept, selectedEmpType, searchTerm]);

  // Compute metrics for each filtered employee
  const metricsList = useMemo<EmployeeCycleMetrics[]>(() => {
    return filteredEmployees.map(emp =>
      computeEmployeeCycleMetrics(
        emp,
        attendance,
        leaveRequests,
        activeRange.startDate,
        activeRange.endDate,
        holidayDates,
        companyWideWfhDates,
        Date.now()
      )
    ).sort((a, b) => (a.employeeId || '').localeCompare(b.employeeId || ''));
  }, [filteredEmployees, attendance, leaveRequests, activeRange.startDate, activeRange.endDate, holidayDates, companyWideWfhDates]);

  // Summary Metrics
  const totalEmployeesCount = metricsList.length;
  const totalNetDisbursement = useMemo(() => metricsList.reduce((sum, e) => sum + e.netPayableSalary, 0), [metricsList]);
  const totalPayableDaysSum = useMemo(() => metricsList.reduce((sum, e) => sum + e.payableDays, 0), [metricsList]);
  const totalLopDaysSum = useMemo(() => metricsList.reduce((sum, e) => sum + e.lossOfPayDays, 0), [metricsList]);
  const avgAttendanceCompliance = useMemo(() => {
    if (totalEmployeesCount === 0) return 0;
    const avg = metricsList.reduce((sum, e) => sum + e.attendanceRate, 0) / totalEmployeesCount;
    return Number(avg.toFixed(1));
  }, [metricsList, totalEmployeesCount]);

  // Handle Export Excel
  const handleExportExcel = async () => {
    if (metricsList.length === 0) {
      toast.error('No employee records available to export for the selected criteria.');
      return;
    }

    triggerHaptic();
    setIsExporting(true);
    const toastId = toast.loading('Generating executive attendance ledger workbook...');

    try {
      const result = await generateAndDownloadPayrollCycleExcel({
        employees,
        attendance,
        leaveRequests,
        holidayDates,
        settings,
        startDate: activeRange.startDate,
        endDate: activeRange.endDate,
        cycleLabel: activeRange.label,
        preparedBy: activeEmployee?.fullName || 'Project Manager',
        departmentFilter: selectedDept,
        employmentTypeFilter: selectedEmpType,
        searchFilter: searchTerm,
        includeInactive: false
      });

      toast.success(
        `✓ Excel exported: ${result.fileName} (${result.totalPersonnel} employees)`,
        { id: toastId, duration: 6000 }
      );
    } catch (err: any) {
      console.error('Error generating Excel workbook:', err);
      toast.error(`Export failed: ${err?.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 lg:p-7 shadow-2xl space-y-6">
      {/* Header & Title Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Payroll Attendance Cycle (30 Days Standard)
            </span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded">
              High-Level Executive Format
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Employee Attendance Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Full 30-day standard monthly cycle attendance audit with day-by-day roster, rostered work days, payable days, and LOP days — ready for higher official submission.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              triggerHaptic();
              setIsMatrixModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-700 shadow-sm hover:text-white"
            title="Inspect daily attendance grid on screen"
          >
            <Eye className="w-4 h-4 text-blue-400" />
            <span>View Attendance Matrix</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExporting || metricsList.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-95"
            title="Export full multi-sheet .xlsx workbook for higher officials"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>{isExporting ? 'Generating Excel...' : 'Export Excel Sheet (.xlsx)'}</span>
            <Download className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>
      </div>

      {/* Cycle Selector & Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Cycle Preset Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            Attendance Cycle (Standard 30 Days)
          </label>
          <div className="relative">
            <select
              value={isCustomRange ? 'CUSTOM' : selectedPresetId}
              onChange={(e) => {
                if (e.target.value === 'CUSTOM') {
                  setIsCustomRange(true);
                } else {
                  setIsCustomRange(false);
                  setSelectedPresetId(e.target.value);
                }
              }}
              className="w-full bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer"
            >
              {presets.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label} {p.isCurrent ? '★ (Active)' : ''}
                </option>
              ))}
              <option value="CUSTOM">Custom Date Range (Choose Dates)...</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Custom Range Inputs (if activated) or Department */}
        {isCustomRange ? (
          <div className="space-y-1 md:col-span-2 lg:col-span-1">
            <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Start &amp; End Dates
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="w-1/2 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="w-1/2 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Department
            </label>
            <div className="relative">
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="w-full bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer"
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d === 'ALL' ? 'All Departments' : d}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Employment Type */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Employment Type
          </label>
          <div className="relative">
            <select
              value={selectedEmpType}
              onChange={e => setSelectedEmpType(e.target.value)}
              className="w-full bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer"
            >
              {EMPLOYMENT_TYPES.map(t => (
                <option key={t} value={t}>{t === 'ALL' ? 'All Employment Types' : t}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Search Input */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            Search Employee
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Name or Emp ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eligible Staff</span>
          <span className="text-xl font-black text-white mt-1">{totalEmployeesCount}</span>
          <span className="text-[10px] text-slate-500 mt-auto">Filtered personnel</span>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cycle Span</span>
          <span className="text-xl font-black text-blue-400 mt-1">
            {metricsList.length > 0 ? Math.max(...metricsList.map(m => m.calendarDays)) : 30} Days
          </span>
          <span className="text-[10px] text-slate-500 mt-auto">Standard 30-day cycle</span>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Compliance</span>
          <span className="text-xl font-black text-emerald-400 mt-1">{avgAttendanceCompliance}%</span>
          <span className="text-[10px] text-emerald-500/80 mt-auto">Attendance ratio</span>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Payable Days</span>
          <span className="text-xl font-black text-teal-300 mt-1">{totalPayableDaysSum}</span>
          <span className="text-[10px] text-slate-500 mt-auto">Across all staff</span>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total LOP Days</span>
          <span className={`text-xl font-black mt-1 ${totalLopDaysSum > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
            {totalLopDaysSum}
          </span>
          <span className="text-[10px] text-slate-500 mt-auto">Loss of pay</span>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-3.5 flex flex-col bg-linear-to-br from-blue-950/30 to-slate-900">
          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">Net Disbursal</span>
          <span className="text-xl font-black text-emerald-300 mt-1">
            ₹{totalNetDisbursement >= 100000 ? `${(totalNetDisbursement / 100000).toFixed(2)}L` : totalNetDisbursement.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400 mt-auto">Total salary pool</span>
        </div>
      </div>

      {/* Live Table Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>Roster &amp; Disbursement Preview</span>
            <span className="text-slate-500 font-normal">({metricsList.length} rows)</span>
          </h3>
          <span className="text-[11px] text-slate-500 hidden sm:inline-block">
            Cycle: <strong className="text-slate-300">{activeRange.startDate}</strong> to <strong className="text-slate-300">{activeRange.endDate}</strong> <span className="text-blue-400 font-semibold">(30 Days Basis)</span>
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-3.5">Emp ID</th>
                <th className="py-3 px-3.5">Full Name</th>
                <th className="py-3 px-3.5">Department</th>
                <th className="py-3 px-3.5">Designation</th>
                <th className="py-3 px-3.5 text-center">Cycle Days</th>
                <th className="py-3 px-3.5 text-center">P</th>
                <th className="py-3 px-3.5 text-center">WFH</th>
                <th className="py-3 px-3.5 text-center">Leave</th>
                <th className="py-3 px-3.5 text-center">LOP</th>
                <th className="py-3 px-3.5 text-center">Payable Days</th>
                <th className="py-3 px-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {metricsList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 text-xs">
                    No employees matched the chosen criteria.
                  </td>
                </tr>
              ) : (
                metricsList.map((m, idx) => (
                  <tr key={m.employeeId || idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-blue-400 font-bold whitespace-nowrap">
                      {m.employeeId}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-white whitespace-nowrap">
                      {m.fullName}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-300 whitespace-nowrap">
                      {m.department}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-400 whitespace-nowrap text-[11px]">
                      {m.designation}
                    </td>
                    <td className="py-2.5 px-3.5 text-center text-slate-300 font-mono">
                      {m.calendarDays}
                    </td>
                    <td className="py-2.5 px-3.5 text-center text-emerald-400 font-bold font-mono">
                      {m.presentOfficeDays}
                    </td>
                    <td className="py-2.5 px-3.5 text-center text-sky-400 font-bold font-mono">
                      {m.wfhDays}
                    </td>
                    <td className="py-2.5 px-3.5 text-center text-purple-400 font-bold font-mono">
                      {m.paidLeaveDays}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold font-mono">
                      {m.lossOfPayDays > 0 ? (
                        <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                          {m.lossOfPayDays}
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center text-teal-300 font-black font-mono">
                      {m.payableDays}
                    </td>
                    <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            triggerHaptic();
                            setInspectEmployee(m);
                          }}
                          className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Inspect day-by-day roster in cycle"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic();
                            setMonthlyAttendanceEmp(m.employee);
                          }}
                          className="p-1 text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Open full monthly calendar history"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 1: Full 26-to-26 Interactive Attendance Matrix
      ───────────────────────────────────────────────────────────────────────────── */}
      {isMatrixModalOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                  Interactive Roster Grid
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  27-to-26 Daily Attendance Matrix ({cycleDates.length} Days)
                </h3>
                <span className="text-xs text-slate-400">
                  {activeRange.label} • {metricsList.length} Personnel
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
                </button>

                <button
                  onClick={() => setIsMatrixModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Matrix Legend */}
            <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center gap-3 text-[11px] shrink-0">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Status Legend:</span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-4 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center">P</span>
                <span className="text-slate-300">Office Present</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-4 rounded bg-sky-500/20 text-sky-400 font-bold text-[10px] flex items-center justify-center">WFH</span>
                <span className="text-slate-300">Work From Home</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-4 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center">HD</span>
                <span className="text-slate-300">Half Day</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-4 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px] flex items-center justify-center">L</span>
                <span className="text-slate-300">Paid Leave</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-4 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px] flex items-center justify-center">LOP</span>
                <span className="text-slate-300">Loss of Pay / Absent</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-4 rounded bg-slate-800 text-slate-400 font-bold text-[10px] flex items-center justify-center">WO</span>
                <span className="text-slate-400">Weekly Off (Sunday)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-4 rounded bg-teal-500/20 text-teal-400 font-bold text-[10px] flex items-center justify-center">H</span>
                <span className="text-slate-300">Holiday</span>
              </span>
            </div>

            {/* Matrix Table with sticky headers and pinned employee columns */}
            <div className="flex-1 overflow-auto p-4">
              <table className="border-collapse text-left text-xs min-w-full">
                <thead>
                  <tr className="bg-slate-800 text-slate-300 sticky top-0 z-30">
                    <th className="sticky left-0 z-40 bg-slate-800 px-3 py-2.5 font-bold border-r border-slate-700 min-w-[180px]">
                      Employee
                    </th>
                    <th className="px-3 py-2.5 font-bold border-r border-slate-700 whitespace-nowrap">
                      Department
                    </th>
                    {cycleDates.map(dateStr => {
                      const dObj = new Date(`${dateStr}T00:00:00Z`);
                      const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
                      const dayNum = dObj.getUTCDate();
                      return (
                        <th key={dateStr} className="px-1.5 py-1 text-center border-r border-slate-700/60 min-w-[36px]">
                          <span className="text-[9px] text-slate-400 block font-normal">{dayName}</span>
                          <span className="font-bold text-white text-[11px]">{dayNum}</span>
                        </th>
                      );
                    })}
                    <th className="px-2 py-2.5 font-bold text-center bg-slate-800/90 text-emerald-400 min-w-[40px]">P</th>
                    <th className="px-2 py-2.5 font-bold text-center bg-slate-800/90 text-sky-400 min-w-[40px]">WFH</th>
                    <th className="px-2 py-2.5 font-bold text-center bg-slate-800/90 text-purple-400 min-w-[40px]">L</th>
                    <th className="px-2 py-2.5 font-bold text-center bg-slate-800/90 text-rose-400 min-w-[40px]">LOP</th>
                    <th className="px-2 py-2.5 font-bold text-center bg-slate-800/90 text-teal-300 min-w-[48px]">Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {metricsList.map((m, idx) => (
                    <tr key={m.employeeId || idx} className="hover:bg-slate-800/30">
                      {/* Pinned Employee Name Cell */}
                      <td className="sticky left-0 z-20 bg-slate-900 px-3 py-2 border-r border-slate-800 whitespace-nowrap shadow-md">
                        <div className="font-bold text-white text-xs">{m.fullName}</div>
                        <div className="text-[10px] text-blue-400 font-mono">{m.employeeId}</div>
                      </td>
                      <td className="px-3 py-2 border-r border-slate-800 whitespace-nowrap text-slate-400 text-[11px]">
                        {m.department}
                      </td>

                      {/* Day cells */}
                      {cycleDates.map(dateStr => {
                        const detail = m.dailyDetails[dateStr];
                        const code = detail?.code || 'LOP';

                        let colorClass = 'bg-slate-800/40 text-slate-400';
                        if (code === 'P') colorClass = 'bg-emerald-500/20 text-emerald-300 font-black';
                        else if (code === 'WFH') colorClass = 'bg-sky-500/20 text-sky-300 font-bold';
                        else if (code === 'HD') colorClass = 'bg-amber-500/20 text-amber-300 font-bold';
                        else if (code === 'L') colorClass = 'bg-purple-500/20 text-purple-300 font-bold';
                        else if (code === 'LOP') colorClass = 'bg-rose-500/20 text-rose-400 font-bold';
                        else if (code === 'WO') colorClass = 'bg-slate-800/60 text-slate-500';
                        else if (code === 'H') colorClass = 'bg-teal-500/20 text-teal-300 font-bold';
                        else if (code === 'NJ') colorClass = 'bg-slate-900 text-slate-600';

                        return (
                          <td
                            key={dateStr}
                            className={`p-0.5 text-center border-r border-slate-800/40 text-[10px] font-mono`}
                            title={`${detail?.date} (${detail?.dayOfWeek}): ${detail?.status} ${detail?.checkIn ? `[${detail.checkIn}]` : ''}`}
                          >
                            <span className={`block w-full py-1 rounded ${colorClass}`}>
                              {code}
                            </span>
                          </td>
                        );
                      })}

                      {/* Right summary counters */}
                      <td className="px-1 py-1 text-center font-bold text-emerald-400 bg-slate-950/50 font-mono">
                        {m.presentOfficeDays}
                      </td>
                      <td className="px-1 py-1 text-center font-bold text-sky-400 bg-slate-950/50 font-mono">
                        {m.wfhDays}
                      </td>
                      <td className="px-1 py-1 text-center font-bold text-purple-400 bg-slate-950/50 font-mono">
                        {m.paidLeaveDays}
                      </td>
                      <td className="px-1 py-1 text-center font-bold text-rose-400 bg-slate-950/50 font-mono">
                        {m.lossOfPayDays}
                      </td>
                      <td className="px-1 py-1 text-center font-black text-teal-300 bg-slate-950/60 font-mono">
                        {m.payableDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODAL 2: Single Employee Roster Inspector
      ───────────────────────────────────────────────────────────────────────────── */}
      {inspectEmployee && (
        <div className="fixed inset-0 z-[210] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">
                  Individual Cycle Audit
                </span>
                <h3 className="text-lg font-black text-white">{inspectEmployee.fullName}</h3>
                <span className="text-xs text-slate-400">{inspectEmployee.employeeId} • {inspectEmployee.department}</span>
              </div>
              <button
                onClick={() => setInspectEmployee(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">Payable Days</span>
                  <span className="text-lg font-black text-teal-300">{inspectEmployee.payableDays}</span>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">LOP Days</span>
                  <span className="text-lg font-black text-rose-400">{inspectEmployee.lossOfPayDays}</span>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">Net Salary</span>
                  <span className="text-lg font-black text-emerald-400">₹{inspectEmployee.netPayableSalary.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Day-by-Day Roster Log ({cycleDates.length} Days)
                </h4>
                <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-800 rounded-xl p-2 bg-slate-950/50">
                  {cycleDates.map(d => {
                    const detail = inspectEmployee.dailyDetails[d];
                    const code = detail?.code || 'LOP';
                    return (
                      <div key={d} className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-slate-900/60 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-[11px]">{d} ({detail?.dayOfWeek})</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            code === 'P' ? 'bg-emerald-500/20 text-emerald-300' :
                            code === 'WFH' ? 'bg-sky-500/20 text-sky-300' :
                            code === 'HD' ? 'bg-amber-500/20 text-amber-300' :
                            code === 'L' ? 'bg-purple-500/20 text-purple-300' :
                            code === 'LOP' ? 'bg-rose-500/20 text-rose-400' :
                            code === 'H' ? 'bg-teal-500/20 text-teal-300' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {detail?.status || code}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {detail?.checkIn ? `In: ${detail.checkIn}` : detail?.notes || '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Attendance Calendar Modal */}
      {monthlyAttendanceEmp && (
        <EmployeeMonthlyAttendanceModal
          employee={monthlyAttendanceEmp}
          onClose={() => setMonthlyAttendanceEmp(null)}
        />
      )}
    </div>
  );
};
