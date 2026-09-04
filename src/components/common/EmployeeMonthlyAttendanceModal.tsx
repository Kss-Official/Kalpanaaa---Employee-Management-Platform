import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, AttendanceRecord, AttendanceStatus } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  X, 
  FileDown, 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  Coffee,
  PieChart as PieChartIcon,
  Sparkles,
  UtensilsCrossed,
  Users,
  Briefcase,
  GraduationCap,
  Zap,
  Timer,
  Edit3,
  Check,
  Save,
  AlertCircle,
  Palmtree,
  Stethoscope,
  CheckCircle2,
  XCircle,
  Info,
  CalendarDays,
  Layers
} from 'lucide-react';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';
import { toISTTimeString, todayInIST } from '../../lib/absoluteTime';
import { isNonWorkingDay, getHolidayInfo, isLateCheckIn, isWfhType, COMPANY_START_DATE, computeTotalLeaveBalances } from '../../lib/attendanceEngine';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useHaptic } from '../../hooks/useHaptic';

/* ─── Leave Balance KPI Box + Detail Modal ─── */
const LeaveBalanceKpiBox: React.FC<{
  employee: any;
  leaveRequests: any[];
  year: number;
  month: number;
  onOpen: () => void;
}> = ({ employee, leaveRequests, year, month, onOpen }) => {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<'All' | 'Earn Leave' | 'Sick Leave' | 'Casual Leave' | 'WFH'>('All');

  const refDate = React.useMemo(() => new Date(year, month - 1, 1), [year, month]);
  const overview = React.useMemo(
    () => computeTotalLeaveBalances(employee, leaveRequests, refDate),
    [employee, leaveRequests, refDate]
  );

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const allReqs = React.useMemo(() => {
    return (leaveRequests || []).filter((l: any) => {
      if (!l) return false;
      return (
        (l.employeeId && (l.employeeId === employee.id || l.employeeId === employee.employeeId)) ||
        (l.employeeUid && (l.employeeUid === (employee as any).uid || l.employeeUid === employee.id)) ||
        (l.employeeName && employee.fullName && l.employeeName.trim().toLowerCase() === employee.fullName.trim().toLowerCase())
      );
    });
  }, [leaveRequests, employee]);

  return (
    <>
      {/* KPI Trigger Box */}
      <button
        type="button"
        onClick={() => { onOpen(); setOpen(true); }}
        className="bg-gradient-to-br from-indigo-950 via-purple-950/80 to-slate-900 hover:from-indigo-900 hover:to-purple-900 p-2 rounded-xl border border-indigo-500/40 hover:border-indigo-400 transition-all cursor-pointer group text-center shadow-lg active:scale-95 flex flex-col justify-between relative overflow-hidden"
        title="Click to view leave balance: Earn Leave, Sick Leave, Casual Leave"
      >
        <div className="absolute -right-5 -top-5 w-12 h-12 bg-indigo-500/10 rounded-full blur-sm pointer-events-none" />
        <div className="flex items-center justify-center gap-1">
          <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider">Leaves Left</span>
          <Sparkles className="w-3 h-3 text-indigo-400 group-hover:rotate-12 transition-transform" />
        </div>
        <div className="flex items-center justify-center my-0.5">
          <span className="text-base font-black text-white group-hover:text-indigo-200 font-mono transition-colors">
            {overview.totalBalance} Days
          </span>
        </div>
        <div className="text-[9px] font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors">
          EL {overview.earnLeave.balance} • SL {overview.sickLeave.balance} • CL {overview.casualLeave.balance}
        </div>
      </button>

      {/* Leave Balance Detail Modal */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[300] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">Leave Quota & Balance Ledger</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {overview.totalBalance} Days Available
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-300">{employee.fullName}</span>
                      <span>•</span>
                      <span className="font-mono text-blue-400">{employee.employeeId}</span>
                      <span>•</span>
                      <span>{employee.designation || 'Staff'}</span>
                      <span>•</span>
                      <span className="text-slate-500">Joined: {employee.joiningDate || '2026-07-27'}</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">

                {/* Hero Summary */}
                <div className="bg-gradient-to-br from-indigo-950/60 via-slate-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Total Combined Leave Balance
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl font-black text-white font-mono tracking-tight">{overview.totalBalance}</span>
                        <span className="text-sm font-bold text-slate-300">{overview.totalBalance === 1 ? 'Day Left' : 'Days Left'}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Earn Leave + Sick Leave + Casual Leave combined balance.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Credited</span>
                        <span className="text-base font-black text-emerald-400 font-mono mt-0.5 block">{overview.totalCredited} Days</span>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Used</span>
                        <span className="text-base font-black text-rose-400 font-mono mt-0.5 block">{overview.totalTaken} Days</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3 Category Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Earn Leave */}
                  <div className="bg-slate-950/80 border border-purple-500/30 hover:border-purple-500/50 transition-all rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                          <Palmtree className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black text-purple-300 uppercase tracking-wider">Earn Leave (EL)</span>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30">Monthly</span>
                    </div>
                    <div className="text-center py-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Balance Available</span>
                      <span className="text-2xl font-black text-purple-300 font-mono">{overview.earnLeave.balance} <span className="text-xs text-slate-400 font-sans">Days</span></span>
                    </div>
                    <div className="space-y-1.5 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <div className="flex justify-between"><span className="text-slate-400">Total Credited:</span><span className="font-bold font-mono text-white">{overview.earnLeave.credited} Days</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Approved Taken:</span><span className="font-bold font-mono text-rose-400">{overview.earnLeave.taken} Days</span></div>
                      <div className="flex justify-between pt-1 border-t border-slate-800"><span className="text-slate-400">{monthNames[month - 1]} Balance:</span><span className="font-bold font-mono text-purple-300">{overview.earnLeave.monthlyBalance} Left</span></div>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>1 day credited on the 1st of every calendar month.</span>
                    </div>
                  </div>

                  {/* Sick Leave */}
                  <div className="bg-slate-950/80 border border-rose-500/30 hover:border-rose-500/50 transition-all rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                          <Stethoscope className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black text-rose-300 uppercase tracking-wider">Sick Leave (SL)</span>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">Recurring</span>
                    </div>
                    <div className="text-center py-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Balance Available</span>
                      <span className="text-2xl font-black text-rose-300 font-mono">{overview.sickLeave.balance} <span className="text-xs text-slate-400 font-sans">Days</span></span>
                    </div>
                    <div className="space-y-1.5 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <div className="flex justify-between"><span className="text-slate-400">Total Credited:</span><span className="font-bold font-mono text-white">{overview.sickLeave.credited} Days</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Approved Taken:</span><span className="font-bold font-mono text-rose-400">{overview.sickLeave.taken} Days</span></div>
                      <div className="flex justify-between pt-1 border-t border-slate-800"><span className="text-slate-400">Status:</span><span className="font-bold text-emerald-400">Active</span></div>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>1 day traineeship SL + 1 day every 3 recurring months.</span>
                    </div>
                  </div>

                  {/* Casual Leave */}
                  <div className="bg-slate-950/80 border border-cyan-500/30 hover:border-cyan-500/50 transition-all rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                          <Coffee className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">Casual Leave (CL)</span>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">Bi-Monthly</span>
                    </div>
                    <div className="text-center py-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Balance Available</span>
                      <span className="text-2xl font-black text-cyan-300 font-mono">{overview.casualLeave.balance} <span className="text-xs text-slate-400 font-sans">Days</span></span>
                    </div>
                    <div className="space-y-1.5 text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                      <div className="flex justify-between"><span className="text-slate-400">Total Credited:</span><span className="font-bold font-mono text-white">{overview.casualLeave.credited} Days</span></div>
                      <div className="flex justify-between"><span className="text-slate-400">Approved Taken:</span><span className="font-bold font-mono text-rose-400">{overview.casualLeave.taken} Days</span></div>
                      <div className="flex justify-between pt-1 border-t border-slate-800"><span className="text-slate-400">Policy:</span><span className="font-bold text-cyan-400">6 Days / Year</span></div>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>1 day credited every 2 months (6 per year).</span>
                    </div>
                  </div>
                </div>

                {/* Applied Leaves Table */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-blue-400" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Applied Leaves & Approval Status</h3>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold overflow-x-auto shrink-0">
                      {(['All', 'Earn Leave', 'Sick Leave', 'Casual Leave', 'WFH'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const filtered = allReqs.filter((req: any) => {
                      if (tab === 'All') return true;
                      const t = req.type || req.leaveCategory || '';
                      if (tab === 'Earn Leave') return t === 'Earn Leave' || t === 'Leave';
                      return t === tab;
                    });
                    if (!filtered.length) return (
                      <div className="py-10 text-center text-slate-500 text-xs">
                        <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                        <p>No leave requests found{tab !== 'All' ? ` for ${tab}` : ''}.</p>
                      </div>
                    );
                    return (
                      <div className="space-y-2.5">
                        {filtered.map((req: any) => {
                          const isApproved = req.status === 'Approved' ||
                            (['Approved','N/A','Bypassed'].includes(req.pmStatus) &&
                             ['Approved','N/A','Bypassed'].includes(req.hrStatus) &&
                             req.ceoStatus === 'Approved' && req.ctoStatus === 'Approved');
                          const isRejected = req.status === 'Rejected' || req.pmStatus === 'Rejected' || req.hrStatus === 'Rejected' || req.ceoStatus === 'Rejected' || req.ctoStatus === 'Rejected';
                          const rType = req.type || req.leaveCategory || 'Leave';
                          return (
                            <div key={req.id} className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${rType === 'Sick Leave' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : rType === 'Casual Leave' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : rType === 'WFH' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' : 'bg-purple-500/10 text-purple-400 border-purple-500/30'}`}>
                                  {rType === 'Sick Leave' ? <Stethoscope className="w-4 h-4" /> : rType === 'Casual Leave' ? <Coffee className="w-4 h-4" /> : rType === 'WFH' ? <Sparkles className="w-4 h-4" /> : <Palmtree className="w-4 h-4" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-white text-xs">{rType === 'Leave' ? 'Earn Leave' : rType}</span>
                                    <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700/60">{req.startDate}{req.endDate && req.endDate !== req.startDate ? ` → ${req.endDate}` : ''}</span>
                                  </div>
                                  {req.reason && <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">&ldquo;{req.reason}&rdquo;</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                <div className="hidden lg:flex items-center gap-1 text-[10px] text-slate-500">
                                  <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">PM: {req.pmStatus || '—'}</span>
                                  <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">HR: {req.hrStatus || '—'}</span>
                                  <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">CEO: {req.ceoStatus || '—'}</span>
                                  <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">CTO: {req.ctoStatus || '—'}</span>
                                </div>
                                {isApproved
                                  ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"><CheckCircle2 className="w-3.5 h-3.5" />Approved</span>
                                  : isRejected
                                    ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30"><XCircle className="w-3.5 h-3.5" />Rejected</span>
                                    : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"><Clock className="w-3.5 h-3.5" />Pending</span>
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
                <span className="text-[11px] text-slate-500">Kalpanaaa Attendance & Leave Ledger • Real-time</span>
                <button onClick={() => setOpen(false)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

interface EmployeeMonthlyAttendanceModalProps {
  employee: Employee;
  initialSelectedRecord?: AttendanceRecord | null;
  onClose?: () => void;
  isInline?: boolean;
}

export const EmployeeMonthlyAttendanceModal: React.FC<EmployeeMonthlyAttendanceModalProps> = ({ 
  employee, 
  initialSelectedRecord, 
  onClose,
  isInline = false
}) => {
  const { attendance, leaveRequests, settings, role, activeEmployee, applyAttendanceCorrection, updateEmployee } = useAuth();
  const { triggerHaptic } = useHaptic();

  const isSuperAdmin = role === 'SUPER_ADMIN' || activeEmployee?.role === 'SUPER_ADMIN';
  const isHr = role === 'HR_ADMIN' || activeEmployee?.role === 'HR_ADMIN';
  const isPm = role === 'PROJECT_MANAGER' || activeEmployee?.role === 'PROJECT_MANAGER';
  const canEditAttendance = isSuperAdmin || isHr || isPm;

  // Current selected Year-Month (default to initialSelectedRecord month or current month)
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => {
    if (initialSelectedRecord?.date) {
      return initialSelectedRecord.date.substring(0, 7);
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Active View Scope: 'month' (Full month time distribution) | 'week' | 'day'
  const [activeScope, setActiveScope] = useState<'month' | 'week' | 'day'>(initialSelectedRecord ? 'day' : 'month');
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(initialSelectedRecord?.date || null);

  // Attendance Editing Modal State for PM / Admin
  const [isEditingAttendance, setIsEditingAttendance] = useState(false);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('Present');
  const [editCheckInTime, setEditCheckInTime] = useState('09:30');
  const [editCheckOutTime, setEditCheckOutTime] = useState('18:30');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);

  // Leave Balance Details Modal State
  const [isLeaveBalanceModalOpen, setIsLeaveBalanceModalOpen] = useState(false);
  const [leaveCategoryTab, setLeaveCategoryTab] = useState<'All' | 'Earn Leave' | 'Sick Leave' | 'Casual Leave' | 'WFH'>('All');

  // KPI Click → Calendar Highlight
  const calendarRef = useRef<HTMLDivElement>(null);
  const [kpiHighlightFilter, setKpiHighlightFilter] = useState<string | null>(null);

  const handleKpiClick = (filter: string) => {
    triggerHaptic();
    setKpiHighlightFilter(prev => prev === filter ? null : filter);
    setTimeout(() => {
      calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  // Joining Date editing state — stays in sync with live context updates after save
  const [joiningDateValue, setJoiningDateValue] = useState<string>(employee.joiningDate || (employee as any).joining_date || '2026-07-27');
  const [isSavingJoiningDate, setIsSavingJoiningDate] = useState(false);
  const [joiningDateToast, setJoiningDateToast] = useState<string | null>(null);

  // Re-sync local state whenever the employee record is updated in context (e.g., after save)
  useEffect(() => {
    const fresh = employee.joiningDate || (employee as any).joining_date || '2026-07-27';
    setJoiningDateValue(fresh);
  }, [employee.joiningDate, (employee as any).joining_date]);

  const handleSaveJoiningDate = async () => {
    if (!joiningDateValue) return;
    triggerHaptic();
    setIsSavingJoiningDate(true);
    try {
      const targetId = employee.id || employee.employeeId || (employee as any).uid;
      await updateEmployee(targetId, { joiningDate: joiningDateValue });
      // In case id differed from employeeId, also ensure employeeId is targeted
      if (employee.employeeId && employee.employeeId !== targetId) {
        await updateEmployee(employee.employeeId, { joiningDate: joiningDateValue });
      }
      setJoiningDateToast('✓ Saved!');
      setTimeout(() => setJoiningDateToast(null), 3000);
    } catch (err: any) {
      setJoiningDateToast(`Error: ${err?.message || 'Failed'}`);
    } finally {
      setIsSavingJoiningDate(false);
    }
  };

  const [yearStr, monthStr] = selectedYearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed (1=Jan, 8=Aug)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Number of days in selected month
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  // Filter employee attendance records for this selected year & month
  const empRecords = useMemo(() => {
    return attendance.filter(rec => {
      const isEmpMatch = 
        rec.employeeId === employee.id || 
        rec.employeeCode === employee.employeeId || 
        (rec.employeeName && employee.fullName && rec.employeeName.trim().toLowerCase() === employee.fullName.trim().toLowerCase()) ||
        (employee.email && rec.employeeName && employee.email.toLowerCase().includes(rec.employeeName.toLowerCase()));
      const isMonthMatch = rec.date && rec.date.startsWith(selectedYearMonth);
      return isEmpMatch && isMonthMatch;
    });
  }, [attendance, employee, selectedYearMonth]);

  // Filter approved leave/WFH requests for this employee for this month
  const empLeaveRequests = useMemo(() => {
    return leaveRequests.filter(req => {
      const isEmpMatch = 
        (!!req.employeeId && (req.employeeId === employee.employeeId || req.employeeId === employee.id)) ||
        (!!req.employeeUid && (req.employeeUid === employee.uid || req.employeeUid === employee.id)) ||
        (!!req.employeeName && !!employee.fullName && req.employeeName.trim().toLowerCase() === employee.fullName.trim().toLowerCase());
      const isApproved = req.status === 'Approved';
      const isMonthMatch = (req.startDate && req.startDate.startsWith(selectedYearMonth)) || (req.endDate && req.endDate.startsWith(selectedYearMonth));
      return isEmpMatch && isApproved && isMonthMatch;
    });
  }, [leaveRequests, employee, selectedYearMonth]);

  // Build Day Map (keyed by 'YYYY-MM-DD')
  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    empRecords.forEach(rec => {
      if (rec.date) map.set(rec.date, rec);
    });
    return map;
  }, [empRecords]);

  // Selected Day Record
  const selectedDayRecord = useMemo(() => {
    if (!selectedDateStr) return null;
    return recordsByDate.get(selectedDateStr) || null;
  }, [recordsByDate, selectedDateStr]);

  // Helper to compute activity breakdown for a single record
  const computeSingleRecordBreakdown = (record: AttendanceRecord) => {
    const breaks = record.breaks || [];
    const isToday = record.date === todayInIST();
    
    let teaBreakMins = 0;
    let mealBreakMins = 0;
    let teamHuddleMins = 0;
    let teamMeetingMins = 0;
    let trainingMins = 0;
    let activityMins = 0;
    let otherBreakMins = 0;

    breaks.forEach(b => {
      let duration = Number(b.durationMinutes) || 0;
      if (duration <= 0 && b.startAt) {
        if (b.endAt) {
          const diffMs = new Date(b.endAt).getTime() - new Date(b.startAt).getTime();
          duration = Math.max(1, Math.floor(diffMs / 60000));
        } else if (record.checkOutAt) {
          const diffMs = new Date(record.checkOutAt).getTime() - new Date(b.startAt).getTime();
          duration = Math.max(1, Math.min(30, Math.floor(diffMs / 60000)));
        } else if (isToday) {
          const diffMs = Date.now() - new Date(b.startAt).getTime();
          duration = Math.max(1, Math.min(50, Math.floor(diffMs / 60000)));
        } else {
          duration = b.type === 'Meal Break' ? 30 : 15;
        }
      }

      duration = Math.min(60, Math.max(1, duration));
      const type = b.type || 'Break';

      if (type === 'Tea Break') teaBreakMins += duration;
      else if (type === 'Meal Break' || type.includes('Lunch')) mealBreakMins += duration;
      else if (type === 'Team Huddle') teamHuddleMins += duration;
      else if (type === 'Team Meeting') teamMeetingMins += duration;
      else if (type.includes('Training') || type.includes('Attainment')) trainingMins += duration;
      else if (type === 'Activity') activityMins += duration;
      else otherBreakMins += duration;
    });

    const totalBreakMins = teaBreakMins + mealBreakMins + teamHuddleMins + teamMeetingMins + trainingMins + activityMins + otherBreakMins;
    
    let workingMins = Number(record.workingMinutes) || 0;
    if (workingMins <= 0 && record.checkInAt) {
      const shiftEndTime = record.checkOutAt 
        ? new Date(record.checkOutAt).getTime() 
        : (isToday ? Date.now() : new Date(record.checkInAt).getTime() + (8.5 * 3600000));
      const totalShiftMs = shiftEndTime - new Date(record.checkInAt).getTime();
      const totalShiftMins = Math.max(0, Math.floor(totalShiftMs / 60000));
      workingMins = Math.max(0, totalShiftMins - totalBreakMins);
    }

    return {
      workingMins,
      teaBreakMins,
      mealBreakMins,
      teamHuddleMins,
      teamMeetingMins,
      trainingMins,
      activityMins,
      otherBreakMins,
      totalBreakMins,
      grandTotalMins: workingMins + totalBreakMins
    };
  };

  // Aggregated Breakdown for Complete Month or Selected Week
  const aggregatedBreakdown = useMemo(() => {
    let targetRecords: AttendanceRecord[] = empRecords;

    if (activeScope === 'day' && selectedDayRecord) {
      targetRecords = [selectedDayRecord];
    } else if (activeScope === 'week') {
      const startDay = (selectedWeekNum - 1) * 7 + 1;
      const endDay = Math.min(daysInMonth, selectedWeekNum * 7);
      targetRecords = empRecords.filter(r => {
        const d = parseInt(r.date.split('-')[2], 10);
        return d >= startDay && d <= endDay;
      });
    }

    let workingMins = 0;
    let teaBreakMins = 0;
    let mealBreakMins = 0;
    let teamHuddleMins = 0;
    let teamMeetingMins = 0;
    let trainingMins = 0;
    let activityMins = 0;
    let otherBreakMins = 0;

    targetRecords.forEach(rec => {
      const single = computeSingleRecordBreakdown(rec);
      workingMins += single.workingMins;
      teaBreakMins += single.teaBreakMins;
      mealBreakMins += single.mealBreakMins;
      teamHuddleMins += single.teamHuddleMins;
      teamMeetingMins += single.teamMeetingMins;
      trainingMins += single.trainingMins;
      activityMins += single.activityMins;
      otherBreakMins += single.otherBreakMins;
    });

    const totalBreakMins = teaBreakMins + mealBreakMins + teamHuddleMins + teamMeetingMins + trainingMins + activityMins + otherBreakMins;
    const grandTotalMins = workingMins + totalBreakMins;

    const categories = [
      { name: 'Working Time', value: workingMins, color: '#10b981', icon: Timer },
      { name: 'Tea Break', value: teaBreakMins, color: '#f59e0b', icon: Coffee },
      { name: 'Meal Break', value: mealBreakMins, color: '#f43f5e', icon: UtensilsCrossed },
      { name: 'Team Huddle', value: teamHuddleMins, color: '#3b82f6', icon: Users },
      { name: 'Team Meeting', value: teamMeetingMins, color: '#a855f7', icon: Briefcase },
      { name: 'Training', value: trainingMins, color: '#06b6d4', icon: GraduationCap },
      { name: 'Activity', value: activityMins, color: '#eab308', icon: Zap },
      { name: 'Other Breaks', value: otherBreakMins, color: '#64748b', icon: Coffee }
    ].filter(c => c.value > 0);

    return {
      workingMins,
      teaBreakMins,
      mealBreakMins,
      teamHuddleMins,
      teamMeetingMins,
      trainingMins,
      activityMins,
      otherBreakMins,
      totalBreakMins,
      grandTotalMins,
      categories,
      recordsCount: targetRecords.length
    };
  }, [empRecords, activeScope, selectedWeekNum, selectedDayRecord, daysInMonth]);

  const holidayDates = useMemo<string[]>(
    () => (((settings as any)?.holidayDates) || []) as string[],
    [settings]
  );

  const todayStr = todayInIST();

  // Monthly Counts
  let presentDays = 0;
  let lateDays = 0;
  let wfhDays = 0;
  let leaveDays = 0;
  let holidayDays = 0;
  let absentDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateFormatted = `${selectedYearMonth}-${String(d).padStart(2, '0')}`;
    const rec = recordsByDate.get(dateFormatted);
    const nonWorking = isNonWorkingDay(dateFormatted, holidayDates);
    const isFuture = dateFormatted > todayStr;

    const currentJoinDate = joiningDateValue || employee.joiningDate || (employee as any).joining_date;
    const effectiveStartDate = currentJoinDate && currentJoinDate > COMPANY_START_DATE ? currentJoinDate : COMPANY_START_DATE;
    const isPreInception = dateFormatted < effectiveStartDate;

    const wfhReq = empLeaveRequests.find(l => (isWfhType(l.type) || isWfhType(l.leaveCategory)) && dateFormatted >= (l.startDate || (l as any).fromDate) && dateFormatted <= (l.endDate || (l as any).toDate || l.startDate));
    const hasLeave = empLeaveRequests.some(l => !isWfhType(l.type) && !isWfhType(l.leaveCategory) && dateFormatted >= (l.startDate || (l as any).fromDate) && dateFormatted <= (l.endDate || (l as any).toDate || l.startDate));
    const isApprovedWfh = !hasLeave && (!!wfhReq || (employee.approvedWfhDates || []).includes(dateFormatted) || ((settings as any)?.companyWideWfhDates || []).includes(dateFormatted) || (rec && (rec.isWfh === true || rec.status === 'Work From Home')));

    if (rec) {
      if (hasLeave || rec.status === 'On Leave') {
        leaveDays++;
      } else if ((rec.isWfh || rec.status === 'Work From Home') && isApprovedWfh) {
        wfhDays++;
      } else if (rec.status === 'Late' || (rec.checkInAt && isLateCheckIn(rec.checkInAt))) {
        lateDays++;
      } else if (rec.status === 'Present' || rec.checkInAt) {
        presentDays++;
      } else if (rec.status === 'Holiday' || nonWorking) {
        holidayDays++;
      } else if (rec.status === 'Absent' || !isFuture) {
        if (!isPreInception) absentDays++;
      }
    } else if (isPreInception) {
      // Days before company start (27 July 2026) or before employee joining date are unmarked (not absent)
      continue;
    } else {
      if (hasLeave) {
        leaveDays++;
      } else if (isApprovedWfh) {
        wfhDays++;
      } else if (nonWorking) {
        holidayDays++;
      } else if (!isFuture) {
        absentDays++;
      }
    }
  }

  const handlePrevMonth = () => {
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setSelectedYearMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
    setSelectedDateStr(null);
  };

  const handleNextMonth = () => {
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setSelectedYearMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
    setSelectedDateStr(null);
  };

  // Open Edit Form for a specific day
  const handleOpenEditForDate = (dateStr: string, rec?: AttendanceRecord | null) => {
    triggerHaptic();
    setSelectedDateStr(dateStr);
    setActiveScope('day');
    setIsEditingAttendance(true);

    if (rec) {
      setEditStatus(rec.status || 'Present');
      if (rec.checkInAt) {
        const d = new Date(rec.checkInAt);
        setEditCheckInTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } else {
        setEditCheckInTime('09:30');
      }

      if (rec.checkOutAt) {
        const d = new Date(rec.checkOutAt);
        setEditCheckOutTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } else {
        setEditCheckOutTime('18:30');
      }
      setEditNotes(rec.notes || '');
    } else {
      setEditStatus('Present');
      setEditCheckInTime('09:30');
      setEditCheckOutTime('18:30');
      setEditNotes('Project Manager attendance override');
    }
  };

  // 1-Click Quick Status Override for Selected Date (Direct Firestore Sync)
  const handleQuickMarkStatus = async (dateStr: string, newStatus: AttendanceStatus) => {
    triggerHaptic();
    setIsSavingCorrection(true);
    setQuickFeedback(null);

    try {
      const existingRecord = recordsByDate.get(dateStr);
      const targetRecord: any = existingRecord || {
        id: `synthetic_${employee.id}_${dateStr}`,
        employeeId: employee.id,
        employeeCode: employee.employeeId,
        employeeName: employee.fullName,
        department: employee.department,
        date: dateStr,
        isSynthetic: true
      };

      const isLeave = newStatus === 'On Leave';
      const isWfh = newStatus === 'Work From Home';
      const isAbsent = newStatus === 'Absent';
      const isPresent = newStatus === 'Present' || newStatus === 'Late';

      const updates: Partial<AttendanceRecord> = {
        status: newStatus,
        checkInAt: (isLeave || isAbsent) ? null : (targetRecord.checkInAt || `${dateStr}T09:30:00.000Z`),
        checkOutAt: (isLeave || isAbsent) ? null : (targetRecord.checkOutAt || `${dateStr}T18:30:00.000Z`),
        workingMinutes: (isLeave || isAbsent) ? 0 : (targetRecord.workingMinutes || 540),
        isWfh: isWfh,
        notes: `Quick updated to ${newStatus} by ${activeEmployee?.fullName || 'Admin/PM'}`
      };

      // If marking as On Leave or Absent, also ensure employee.approvedWfhDates does not have this date
      if ((isLeave || isAbsent || isPresent) && employee.approvedWfhDates && employee.approvedWfhDates.includes(dateStr)) {
        const cleanedDates = employee.approvedWfhDates.filter(d => d !== dateStr);
        updateEmployee(employee.id, { approvedWfhDates: cleanedDates });
      }

      const res = await applyAttendanceCorrection(targetRecord, updates);
      if (res.success) {
        setQuickFeedback(`✓ Saved! Marked as "${newStatus}" for ${dateStr}`);
        setTimeout(() => setQuickFeedback(null), 4000);
      } else {
        setQuickFeedback(`Error: ${res.message}`);
      }
    } catch (err: any) {
      console.error('Quick status override error:', err);
      setQuickFeedback(`Failed: ${err?.message || 'Error updating status'}`);
    } finally {
      setIsSavingCorrection(false);
    }
  };

  // Commit Attendance Correction to Firestore
  const handleSaveAttendanceCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateStr) return;

    setIsSavingCorrection(true);
    setSaveFeedback(null);

    try {
      const checkInDateTime = new Date(`${selectedDateStr}T${editCheckInTime}:00`).toISOString();
      const checkOutDateTime = editStatus === 'Present' || editStatus === 'Late' || editStatus === 'Work From Home'
        ? new Date(`${selectedDateStr}T${editCheckOutTime}:00`).toISOString()
        : null;

      const diffMs = checkOutDateTime 
        ? new Date(checkOutDateTime).getTime() - new Date(checkInDateTime).getTime()
        : (8.5 * 3600000);
      const workingMinutes = Math.max(0, Math.floor(diffMs / 60000));

      const existingRecord = recordsByDate.get(selectedDateStr);

      const targetRecord: any = existingRecord || {
        id: `synthetic_${employee.id}_${selectedDateStr}`,
        employeeId: employee.id,
        employeeCode: employee.employeeId,
        employeeName: employee.fullName,
        department: employee.department,
        date: selectedDateStr,
        isSynthetic: true
      };

      const updates: Partial<AttendanceRecord> = {
        status: editStatus,
        checkInAt: editStatus === 'Absent' || editStatus === 'On Leave' ? null : checkInDateTime,
        checkOutAt: checkOutDateTime,
        workingMinutes: editStatus === 'Absent' || editStatus === 'On Leave' ? 0 : workingMinutes,
        isWfh: editStatus === 'Work From Home',
        notes: editNotes || `Corrected by ${activeEmployee?.fullName || 'Project Manager'}`
      };

      const res = await applyAttendanceCorrection(targetRecord, updates);

      if (res.success) {
        setSaveFeedback('✓ Attendance record updated & live synced to database!');
        setTimeout(() => {
          setIsEditingAttendance(false);
          setSaveFeedback(null);
        }, 1500);
      } else {
        setSaveFeedback(`Error: ${res.message}`);
      }
    } catch (err: any) {
      console.error('Save correction error:', err);
      setSaveFeedback(`Failed: ${err.message || 'Error updating attendance'}`);
    } finally {
      setIsSavingCorrection(false);
    }
  };

  const innerContent = (
    <motion.div 
      initial={{ opacity: 0, scale: isInline ? 1 : 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col ${
        isInline ? 'min-h-[600px]' : 'max-w-5xl max-h-[96vh] sm:max-h-[90vh]'
      }`}
    >
      {/* Header */}
      <div className="bg-slate-950 p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <img
            src={employee.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.fullName)}&background=0f172a&color=fff`}
            alt={employee.fullName}
            className="w-11 h-11 rounded-2xl object-cover border-2 border-blue-500/50 shadow-md shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white truncate">{employee.fullName}</h2>
              <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                {employee.employeeId}
              </span>
              {canEditAttendance && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  PM / Admin Editable
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <p className="text-xs text-slate-400 font-medium truncate">
                {employee.designation} • <span className="text-slate-300">{employee.department}</span>
              </p>
              <div className="flex items-center gap-2 text-xs bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Joining Date:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={joiningDateValue}
                    onChange={e => setJoiningDateValue(e.target.value)}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500 font-bold cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={handleSaveJoiningDate}
                    disabled={isSavingJoiningDate}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-md shadow-blue-900/40 flex items-center gap-1.5 shrink-0"
                    title="Save Joining Date for this employee"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingJoiningDate ? 'Saving...' : 'Save Date'}</span>
                  </button>
                  {joiningDateToast && (
                    <span className="text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 animate-pulse">
                      {joiningDateToast}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5">
          <button
            onClick={() => generateAttendanceReportPdf(empRecords, settings, `Monthly Attendance Statement — ${employee.fullName} (${selectedYearMonth})`)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40 active:scale-95"
          >
            <FileDown className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          {!isInline && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={`p-4 sm:p-6 space-y-6 flex-1 ${isInline ? '' : 'overflow-y-auto'}`}>

            {/* Month Switcher & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-950/80 p-4 rounded-3xl border border-slate-800">
              
              {/* Clickable Month Name Header Button (triggers Complete Month Time Distribution) */}
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => {
                    setActiveScope('month');
                    setSelectedDateStr(null);
                  }}
                  className="text-left px-3 py-1.5 rounded-xl hover:bg-blue-600/10 border border-transparent hover:border-blue-500/30 transition-all cursor-pointer group"
                  title="Click to view complete month time distribution pie chart"
                >
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-black text-white group-hover:text-blue-300 transition-colors">
                      {monthNames[month - 1]} {year}
                    </h3>
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                    {activeScope === 'month' ? '★ Full Month Selected' : 'Click for Full Month'}
                  </p>
                </button>

                <button
                  onClick={handleNextMonth}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Monthly Turnout KPIs + Leave Balance Box */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2 w-full lg:w-auto text-center text-xs">
                <button
                  type="button"
                  onClick={() => handleKpiClick('Present')}
                  className={`p-2.5 rounded-xl border flex flex-col justify-center transition-all cursor-pointer active:scale-95 ${
                    kpiHighlightFilter === 'Present'
                      ? 'bg-emerald-500/20 border-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-900 border-slate-800 hover:border-emerald-500/40'
                  }`}
                  title="Click to highlight Present days in calendar"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present</span>
                  <span className="text-base font-black text-emerald-400 font-mono">{presentDays} Days</span>
                  {kpiHighlightFilter === 'Present' && <span className="text-[9px] text-emerald-400 font-bold mt-0.5">↓ Highlighted</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handleKpiClick('Late')}
                  className={`p-2.5 rounded-xl border flex flex-col justify-center transition-all cursor-pointer active:scale-95 ${
                    kpiHighlightFilter === 'Late'
                      ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-900 border-slate-800 hover:border-amber-500/40'
                  }`}
                  title="Click to highlight Late days in calendar"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Late</span>
                  <span className="text-base font-black text-amber-400 font-mono">{lateDays} Days</span>
                  {kpiHighlightFilter === 'Late' && <span className="text-[9px] text-amber-400 font-bold mt-0.5">↓ Highlighted</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handleKpiClick('WFH')}
                  className={`p-2.5 rounded-xl border flex flex-col justify-center transition-all cursor-pointer active:scale-95 ${
                    kpiHighlightFilter === 'WFH'
                      ? 'bg-sky-500/20 border-sky-400 shadow-lg shadow-sky-500/20'
                      : 'bg-slate-900 border-slate-800 hover:border-sky-500/40'
                  }`}
                  title="Click to highlight WFH days in calendar"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WFH</span>
                  <span className="text-base font-black text-sky-400 font-mono">{wfhDays} Days</span>
                  {kpiHighlightFilter === 'WFH' && <span className="text-[9px] text-sky-400 font-bold mt-0.5">↓ Highlighted</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handleKpiClick('Leave')}
                  className={`p-2.5 rounded-xl border flex flex-col justify-center transition-all cursor-pointer active:scale-95 ${
                    kpiHighlightFilter === 'Leave'
                      ? 'bg-purple-500/20 border-purple-400 shadow-lg shadow-purple-500/20'
                      : 'bg-slate-900 border-slate-800 hover:border-purple-500/40'
                  }`}
                  title="Click to highlight Leave days in calendar"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Leave</span>
                  <span className="text-base font-black text-purple-400 font-mono">{leaveDays} Days</span>
                  {kpiHighlightFilter === 'Leave' && <span className="text-[9px] text-purple-400 font-bold mt-0.5">↓ Highlighted</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handleKpiClick('Holiday')}
                  className={`p-2.5 rounded-xl border flex flex-col justify-center transition-all cursor-pointer active:scale-95 ${
                    kpiHighlightFilter === 'Holiday'
                      ? 'bg-slate-700/60 border-slate-400 shadow-lg shadow-slate-500/20'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                  }`}
                  title="Click to highlight Holiday / Off days in calendar"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Holiday / Off</span>
                  <span className="text-base font-black text-slate-300 font-mono">{holidayDays} Days</span>
                  {kpiHighlightFilter === 'Holiday' && <span className="text-[9px] text-slate-300 font-bold mt-0.5">↓ Highlighted</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handleKpiClick('Absent')}
                  className={`p-2.5 rounded-xl border flex flex-col justify-center transition-all cursor-pointer active:scale-95 ${
                    kpiHighlightFilter === 'Absent'
                      ? 'bg-rose-500/20 border-rose-400 shadow-lg shadow-rose-500/20'
                      : 'bg-slate-900 border-slate-800 hover:border-rose-500/40'
                  }`}
                  title="Click to highlight Absent days in calendar"
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Absent</span>
                  <span className="text-base font-black text-rose-400 font-mono">{absentDays} Days</span>
                  {kpiHighlightFilter === 'Absent' && <span className="text-[9px] text-rose-400 font-bold mt-0.5">↓ Highlighted</span>}
                </button>

                {/* 🌟 Interactive Leave Balance Section Box */}
                <LeaveBalanceKpiBox
                  employee={employee}
                  leaveRequests={leaveRequests}
                  year={year}
                  month={month}
                  onOpen={() => { triggerHaptic(); setIsLeaveBalanceModalOpen(true); }}
                />
              </div>
            </div>

            {/* Time Distribution Scope Selector (Month vs Week vs Day) */}
            <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    {activeScope === 'month' ? `Complete Month Activity Time Distribution — ${monthNames[month - 1]} ${year}` :
                     activeScope === 'week' ? `Week ${selectedWeekNum} Activity Time Distribution — ${monthNames[month - 1]} ${year}` :
                     `Day Shift Time Distribution — ${selectedDateStr}`}
                  </h4>
                </div>

                {/* View Toggles */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold overflow-x-auto">
                  <button
                    onClick={() => {
                      setActiveScope('month');
                      setSelectedDateStr(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
                      activeScope === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Exact Month
                  </button>

                  {[1, 2, 3, 4, 5].map(w => (
                    <button
                      key={w}
                      onClick={() => {
                        setActiveScope('week');
                        setSelectedWeekNum(w);
                        setSelectedDateStr(null);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shrink-0 ${
                        activeScope === 'week' && selectedWeekNum === w ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      W{w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aggregated Donut Pie Chart & Breakdown */}
              {aggregatedBreakdown.categories.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No attendance records or shift activities found for the selected {activeScope}.
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-2">
                  {/* Donut Chart */}
                  <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={aggregatedBreakdown.categories}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {aggregatedBreakdown.categories.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="#020617" strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [`${Math.floor(Number(val) / 60)}h ${Number(val) % 60}m`, 'Duration']}
                          contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #1e293b', color: '#fff', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-base font-black text-white font-mono leading-none">
                        {Math.floor(aggregatedBreakdown.grandTotalMins / 60)}h {aggregatedBreakdown.grandTotalMins % 60}m
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Activities</span>
                    </div>
                  </div>

                  {/* Legend Grid */}
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs w-full">
                    {aggregatedBreakdown.categories.map((cat, idx) => (
                      <div key={idx} className="p-3 rounded-2xl bg-slate-900 border border-slate-800/80 flex flex-col justify-between space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-slate-300 font-semibold truncate text-xs">{cat.name}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                          <span className="font-mono text-xs font-black text-white">
                            {cat.value >= 60 ? `${Math.floor(cat.value / 60)}h ${cat.value % 60}m` : `${cat.value}m`}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500">
                            {Math.round((cat.value / aggregatedBreakdown.grandTotalMins) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Monthly Calendar Grid & Day Inspector */}
            <div ref={calendarRef} className="space-y-4 scroll-mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>Click any date below to inspect &amp; edit attendance</span>
                </h4>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                  {kpiHighlightFilter && (
                    <button
                      onClick={() => setKpiHighlightFilter(null)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-full font-bold hover:bg-blue-500/25 transition-colors cursor-pointer"
                    >
                      Showing: {kpiHighlightFilter} <X className="w-3 h-3" />
                    </button>
                  )}
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Present</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Late</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> WFH</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Leave</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" /> Holiday / Off</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Absent</span>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-950 py-2 rounded-xl border border-slate-800">
                <span className="text-rose-400/80">Sun (Off)</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[60px] bg-slate-950/20 border border-slate-900 rounded-2xl opacity-30 pointer-events-none" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateFormatted = `${selectedYearMonth}-${String(dayNum).padStart(2, '0')}`;
                  const rec = recordsByDate.get(dateFormatted);
                  const wfhReq = empLeaveRequests.find(l => (isWfhType(l.type) || isWfhType(l.leaveCategory)) && dateFormatted >= (l.startDate || (l as any).fromDate) && dateFormatted <= (l.endDate || (l as any).toDate || l.startDate));
                  const isApprovedLeave = empLeaveRequests.some(l => !isWfhType(l.type) && !isWfhType(l.leaveCategory) && dateFormatted >= (l.startDate || (l as any).fromDate) && dateFormatted <= (l.endDate || (l as any).toDate || l.startDate));
                  const isApprovedWfh = !isApprovedLeave && (!!wfhReq || (employee.approvedWfhDates || []).includes(dateFormatted) || ((settings as any)?.companyWideWfhDates || []).includes(dateFormatted) || (rec && (rec.isWfh === true || rec.status === 'Work From Home')));
                  const isNonWorking = isNonWorkingDay(dateFormatted, holidayDates);
                  const holidayInfo = getHolidayInfo(dateFormatted);
                  const isFuture = dateFormatted > todayStr;

                  const currentJoinDate = joiningDateValue || employee.joiningDate || (employee as any).joining_date;
                  const effectiveStartDate = currentJoinDate && currentJoinDate > COMPANY_START_DATE ? currentJoinDate : COMPANY_START_DATE;
                  const isPreInception = dateFormatted < effectiveStartDate;

                  let statusBg = 'bg-slate-950 border-slate-800 text-slate-400';
                  let statusLabel = 'Absent';
                  let statusDot = 'bg-rose-500';

                  if (rec) {
                    if (isApprovedLeave || rec.status === 'On Leave') {
                      statusBg = 'bg-purple-500/10 border-purple-500/30 text-purple-300';
                      statusLabel = 'Leave';
                      statusDot = 'bg-purple-400';
                    } else if ((rec.isWfh || rec.status === 'Work From Home') && isApprovedWfh) {
                      statusBg = 'bg-sky-500/10 border-sky-500/30 text-sky-300';
                      statusLabel = 'WFH';
                      statusDot = 'bg-sky-400';
                    } else if (rec.status === 'Late' || (rec.checkInAt && isLateCheckIn(rec.checkInAt))) {
                      statusBg = 'bg-amber-500/10 border-amber-500/30 text-amber-300';
                      statusLabel = 'Late';
                      statusDot = 'bg-amber-400';
                    } else if (rec.status === 'Present' || rec.checkInAt) {
                      statusBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
                      statusLabel = 'Present';
                      statusDot = 'bg-emerald-400';
                    } else if (rec.status === 'Holiday' || isNonWorking) {
                      statusBg = 'bg-slate-800/40 border-slate-800 text-slate-400';
                      statusLabel = holidayInfo ? holidayInfo.name : 'Holiday';
                      statusDot = 'bg-slate-500';
                    } else if (rec.status === 'Half Day') {
                      statusBg = 'bg-orange-500/10 border-orange-500/30 text-orange-300';
                      statusLabel = 'Half Day';
                      statusDot = 'bg-orange-400';
                    } else if (rec.status === 'Absent') {
                      if (isPreInception) {
                        statusBg = 'bg-slate-950/40 border-slate-900/60 text-slate-600';
                        statusLabel = '—';
                        statusDot = 'bg-slate-800';
                      } else {
                        statusBg = 'bg-rose-500/10 border-rose-500/30 text-rose-300';
                        statusLabel = 'Absent';
                        statusDot = 'bg-rose-400';
                      }
                    }
                  } else if (isPreInception) {
                    statusBg = 'bg-slate-950/40 border-slate-900/60 text-slate-600';
                    statusLabel = '—';
                    statusDot = 'bg-slate-800';
                  } else if (isApprovedLeave) {
                    statusBg = 'bg-purple-500/10 border-purple-500/30 text-purple-300';
                    statusLabel = 'Leave';
                    statusDot = 'bg-purple-400';
                  } else if (isApprovedWfh) {
                    statusBg = 'bg-sky-500/10 border-sky-500/30 text-sky-300';
                    statusLabel = 'WFH';
                    statusDot = 'bg-sky-400';
                  } else if (isNonWorking) {
                    statusBg = 'bg-slate-900/60 border-slate-800/80 text-slate-400';
                    statusLabel = holidayInfo ? holidayInfo.name : 'Weekly Off';
                    statusDot = 'bg-slate-600';
                  } else if (isFuture) {
                    statusBg = 'bg-slate-950/40 border-slate-900 text-slate-600';
                    statusLabel = 'Upcoming';
                    statusDot = 'bg-slate-800';
                  } else {
                    statusBg = 'bg-rose-500/10 border-rose-500/30 text-rose-300';
                    statusLabel = 'Absent';
                    statusDot = 'bg-rose-400';
                  }

                  const isSelected = selectedDateStr === dateFormatted;

                  // KPI highlight: does this day match the active filter?
                  const isKpiHighlighted = kpiHighlightFilter !== null && (() => {
                    if (kpiHighlightFilter === 'Present') return statusLabel === 'Present';
                    if (kpiHighlightFilter === 'Late') return statusLabel === 'Late';
                    if (kpiHighlightFilter === 'WFH') return statusLabel === 'WFH';
                    if (kpiHighlightFilter === 'Leave') return statusLabel === 'Leave';
                    if (kpiHighlightFilter === 'Holiday') return statusLabel === 'Holiday' || statusLabel === 'Weekly Off' || isNonWorking;
                    if (kpiHighlightFilter === 'Absent') return statusLabel === 'Absent';
                    return false;
                  })();

                  // Dim non-matching cells when a filter is active
                  const isDimmed = kpiHighlightFilter !== null && !isKpiHighlighted;

                  return (
                    <div
                      key={dayNum}
                      onClick={() => {
                        setSelectedDateStr(dateFormatted);
                        setActiveScope('day');
                      }}
                      className={`p-2 min-h-[60px] rounded-2xl border flex flex-col justify-between transition-all cursor-pointer ${statusBg} ${
                        isSelected ? 'ring-2 ring-blue-500 border-blue-400 scale-[1.02] shadow-lg' :
                        isKpiHighlighted ? 'ring-2 ring-offset-1 ring-offset-slate-950 scale-[1.03] shadow-xl z-10 relative' :
                        'hover:scale-[1.02]'
                      } ${
                        isKpiHighlighted ? (
                          kpiHighlightFilter === 'Present' ? 'ring-emerald-400 shadow-emerald-500/30' :
                          kpiHighlightFilter === 'Late' ? 'ring-amber-400 shadow-amber-500/30' :
                          kpiHighlightFilter === 'WFH' ? 'ring-sky-400 shadow-sky-500/30' :
                          kpiHighlightFilter === 'Leave' ? 'ring-purple-400 shadow-purple-500/30' :
                          'ring-slate-400 shadow-slate-500/20'
                        ) : ''
                      } ${
                        isDimmed ? 'opacity-30' : ''
                      } ${isFuture && !rec ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">{dayNum}</span>
                        <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[9px] font-bold block truncate" title={statusLabel}>{statusLabel}</span>
                        {rec?.checkInAt && (
                          <span className="text-[9px] font-mono text-slate-300 block truncate">
                            {toISTTimeString(rec.checkInAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Feedback Toast */}
              {quickFeedback && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{quickFeedback}</span>
                </div>
              )}

              {/* Selected Day Details & PM/Admin Attendance Action Toolbar */}
              {selectedDateStr && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-blue-500/30 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-in fade-in">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-white">Selected Date: {selectedDateStr}</h5>
                      <p className="text-[11px] text-slate-400">
                        Current Status: <strong className="text-slate-200">{selectedDayRecord?.status || (empLeaveRequests.some(l => (l.type || '').toUpperCase() !== 'WFH' && selectedDateStr >= (l.startDate || (l as any).fromDate) && selectedDateStr <= (l.endDate || (l as any).toDate || l.startDate)) ? 'On Leave' : 'No record / Absent')}</strong>
                        {selectedDayRecord?.checkInAt && (
                          <> • In: <span className="text-emerald-400 font-mono">{toISTTimeString(selectedDayRecord.checkInAt)}</span></>
                        )}
                        {selectedDayRecord?.checkOutAt && (
                          <> • Out: <span className="text-blue-400 font-mono">{toISTTimeString(selectedDayRecord.checkOutAt)}</span></>
                        )}
                      </p>
                    </div>
                  </div>

                  {canEditAttendance && (
                    <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
                      {/* 1-Click: Mark On Leave Button */}
                      <button
                        disabled={isSavingCorrection}
                        onClick={() => handleQuickMarkStatus(selectedDateStr, 'On Leave')}
                        className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Mark this employee as On Leave on this date"
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-400" />
                        <span>Mark On Leave</span>
                      </button>

                      {/* 1-Click: Mark Present Button */}
                      <button
                        disabled={isSavingCorrection}
                        onClick={() => handleQuickMarkStatus(selectedDateStr, 'Present')}
                        className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Mark this employee as Present on this date"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Mark Present</span>
                      </button>

                      {/* 1-Click: Mark WFH Button */}
                      <button
                        disabled={isSavingCorrection}
                        onClick={() => handleQuickMarkStatus(selectedDateStr, 'Work From Home')}
                        className="px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Mark this employee as Work From Home on this date"
                      >
                        <span className="w-2 h-2 rounded-full bg-sky-400" />
                        <span>Mark WFH</span>
                      </button>

                      {/* 1-Click: Mark Absent Button */}
                      <button
                        disabled={isSavingCorrection}
                        onClick={() => handleQuickMarkStatus(selectedDateStr, 'Absent')}
                        className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Mark this employee as Absent on this date"
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span>Mark Absent</span>
                      </button>

                      {/* Full Edit Modal Trigger */}
                      <button
                        onClick={() => handleOpenEditForDate(selectedDateStr, selectedDayRecord)}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer shrink-0 active:scale-95"
                        title="Custom Shift & Timings Correction"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Custom Timings</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </motion.div>
  );

  return (
    <>
      {isInline ? (
        <div className="w-full space-y-6 animate-in fade-in duration-200">
          {innerContent}
        </div>
      ) : (
        <AnimatePresence>
          <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
            {innerContent}
          </div>
        </AnimatePresence>
      )}

      {/* Attendance Day Correction Modal (For PM & Admin) */}
      {isEditingAttendance && selectedDateStr && (
        <div className="fixed inset-0 z-[180] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Project Manager / Admin Override
                </span>
                <h3 className="text-sm font-black text-white mt-1">Edit Attendance Record</h3>
                <p className="text-xs text-slate-400">{employee.fullName} ({employee.employeeId}) • {selectedDateStr}</p>
              </div>
              <button
                onClick={() => setIsEditingAttendance(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAttendanceCorrection} className="space-y-4 text-xs">
              {/* Status Selector */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Attendance Status:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Present', 'Late', 'Work From Home', 'Half Day', 'On Leave', 'Absent'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditStatus(st)}
                      className={`py-2 px-2 rounded-xl font-bold border transition-all cursor-pointer text-center text-xs truncate ${
                        editStatus === st
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing Controls (only for Present / Late / Half Day / WFH) */}
              {editStatus !== 'Absent' && editStatus !== 'On Leave' && editStatus !== 'Holiday' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      Check In Time:
                    </label>
                    <input
                      type="time"
                      value={editCheckInTime}
                      onChange={(e) => setEditCheckInTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      Check Out Time:
                    </label>
                    <input
                      type="time"
                      value={editCheckOutTime}
                      onChange={(e) => setEditCheckOutTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-xs focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">Correction / Audit Note:</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g., Punch miss corrected after PM verification..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 text-xs resize-none"
                />
              </div>

              {saveFeedback && (
                <div className={`p-2.5 rounded-xl text-xs font-bold ${
                  saveFeedback.startsWith('Error') || saveFeedback.startsWith('Failed')
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {saveFeedback}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingAttendance(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCorrection}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/40"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingCorrection ? 'Saving...' : 'Save & Live Sync'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
