import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Kanban, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertTriangle, 
  Users, 
  Calendar, 
  TrendingUp, 
  ChevronLeft,
  ChevronRight,
  Flame,
  FileText,
  UserCheck,
  Coffee,
  Loader2,
  PieChart as PieChartIcon,
  Sparkles,
  X,
  Search,
  Eye,
  Timer,
  UtensilsCrossed,
  Briefcase,
  GraduationCap,
  Zap,
  MapPin,
  Edit3
} from 'lucide-react';
import { Project, LeaveRequest, Employee, AttendanceRecord } from '../../types';
import { db, subscribeWithRecovery } from '../../lib/firebase';
import { collection, setDoc, doc } from 'firebase/firestore';
import {
  getEmployeeWorkDate,
  resolveAttendanceRecord,
  isShiftComplete,
  buildWorkWeek,
  buildWeekWorkRow,
  hasApprovedLeaveOn,
  EXCUSED_LEAVE_TYPES,
  formatDuration,
  formatShortDate,
  SHIFT_LABEL,
  SHIFT_TOTAL_MINUTES,
  WORK_WEEK_DAYS,
  isExecutiveOrLeadership,
  getWorkDate,
  formatShiftTiming,
  isLateCheckIn
} from '../../lib/attendanceEngine';
import type { DayWorkSummary, WorkWeekDay } from '../../lib/attendanceEngine';
import { toISTTimeString, todayInIST } from '../../lib/absoluteTime';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';
import { useHaptic } from '../../hooks/useHaptic';

interface PMDashboardProps {
  onNavigateTab: (tab: string) => void;
}

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Core API & Auth Engine Refactor',
    description: 'Optimizing Firestore indexing and sub-100ms response times.',
    client: 'Internal Platform',
    startDate: '2026-07-01',
    deadline: '2026-08-20',
    status: 'In Progress',
    progressPercent: 72,
    teamMemberIds: ['emp-1', 'emp-2'],
    managerId: 'pm-1',
    createdAt: '2026-07-01',
    updatedAt: '2026-08-01'
  },
  {
    id: 'proj-2',
    name: 'PWA Biometric & Face ID Integration',
    description: 'Client-side TinyFaceDetector and MediaPipe liveness mesh.',
    client: 'Enterprise HRMS',
    startDate: '2026-07-15',
    deadline: '2026-08-25',
    status: 'In Progress',
    progressPercent: 58,
    teamMemberIds: ['emp-3', 'emp-4'],
    managerId: 'pm-1',
    createdAt: '2026-07-15',
    updatedAt: '2026-08-01'
  },
  {
    id: 'proj-3',
    name: 'Executive Dashboard Analytics',
    description: 'Stripe KPI card layout and SVG sparklines.',
    client: 'Management Team',
    startDate: '2026-08-01',
    deadline: '2026-08-30',
    status: 'At Risk',
    progressPercent: 35,
    teamMemberIds: ['emp-1'],
    managerId: 'pm-1',
    createdAt: '2026-08-01',
    updatedAt: '2026-08-05'
  }
];

export const PMDashboard: React.FC<PMDashboardProps> = ({ onNavigateTab }) => {
  const { employees, leaveRequests, attendance, activeEmployee, updateLeaveRequestStage, startBreak, endBreak, isAuthenticated, settings } = useAuth();
  const { triggerHaptic } = useHaptic();

  const todayStr = getWorkDate(new Date());

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Filter operational workforce (excluding CEO, CTO, COO Rahul Pathak, Founders)
  const operationalEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'Terminated' && !isExecutiveOrLeadership(e));
  }, [employees]);

  const totalWorkforceCount = operationalEmployees.length;

  const todayRecords = attendance.filter(a => a && a.date === todayStr && a.employeeName && a.employeeName.trim() !== '' && a.employeeName !== '.');

  // Build daily roster for PM view with live status
  const dailyRoster = useMemo(() => {
    return operationalEmployees.map(emp => {
      const rec = todayRecords.find(r => 
        r.employeeId === emp.id || 
        r.employeeCode === emp.employeeId || 
        (r.employeeName && emp.fullName && r.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase())
      );

      const leaveReq = leaveRequests.find(l => 
        ((!!l.employeeId && (l.employeeId === emp.id || l.employeeId === emp.employeeId)) ||
         (!!l.employeeUid && (l.employeeUid === emp.uid || l.employeeUid === emp.id)) ||
         (!!l.employeeName && !!emp.fullName && l.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase())) &&
        l.status === 'Approved' &&
        todayStr >= (l.startDate || (l as any).fromDate) && 
        todayStr <= (l.endDate || (l as any).toDate || l.startDate)
      );

      const isCompanyWfh = ((settings as any)?.companyWideWfhDates || []).includes(todayStr);
      const isApprovedEmpWfh = (emp.approvedWfhDates || []).includes(todayStr) || (!!leaveReq && leaveReq.type === 'WFH');
      const hasRealCheckIn = !!(rec?.checkInAt) && !isApprovedEmpWfh;
      const isWfh = isApprovedEmpWfh || (isCompanyWfh && !hasRealCheckIn);

      const activeBreak = rec?.breaks?.find(b => !b.endAt && !(b as any).endTime);
      const isComplete = isShiftComplete(rec);
      const isCheckedIn = !!rec?.checkInAt && !isComplete;
      const isLate = rec?.status === 'Late' || (!!rec?.checkInAt && isLateCheckIn(rec.checkInAt));

      let computedStatus: 'Present' | 'Work From Home' | 'On Leave' | 'LOP' | 'On Break' | 'Absent' = 'Absent';

      if (activeBreak && isCheckedIn) {
        computedStatus = 'On Break';
      } else if (rec?.checkInAt && !isApprovedEmpWfh) {
        computedStatus = 'Present';
      } else if (isWfh) {
        computedStatus = 'Work From Home';
      } else if (rec) {
        if (rec.status === 'Present' || rec.status === 'Late' || rec.checkInAt) {
          computedStatus = 'Present';
        } else if (rec.status === 'On Leave' || rec.status === 'Half Day') {
          computedStatus = 'On Leave';
        } else if (rec.status === 'Absent') {
          computedStatus = 'Absent';
        }
      } else if (leaveReq) {
        computedStatus = 'On Leave';
      } else if (emp.status === 'On Leave') {
        computedStatus = 'On Leave';
      }

      if (emp.status === 'Suspended' || (rec && (rec.notes || '').toLowerCase().includes('lop'))) {
        computedStatus = 'LOP';
      }

      return {
        employee: emp,
        record: rec,
        status: computedStatus,
        isCheckedIn,
        activeBreak,
        isLate,
        isWfh,
        isShiftComplete: isComplete,
        leaveReq
      };
    });
  }, [operationalEmployees, todayRecords, leaveRequests, todayStr]);

  // Turnout KPI Counts
  const presentCount = dailyRoster.filter(r => (r.status === 'Present' || r.status === 'On Break') && !r.isWfh).length;
  const onTimePresentCount = dailyRoster.filter(r => r.status === 'Present' && !r.isLate && !r.isWfh).length;
  const onBreakCount = dailyRoster.filter(r => r.status === 'On Break').length;
  const lateCount = dailyRoster.filter(r => r.isLate && !r.isWfh).length;
  const wfhCount = dailyRoster.filter(r => r.status === 'Work From Home').length;
  const onLeaveCount = dailyRoster.filter(r => r.status === 'On Leave').length;
  const lopCount = dailyRoster.filter(r => r.status === 'LOP').length;
  const absentCount = dailyRoster.filter(r => r.status === 'Absent').length;

  // Real unique active working employees today (strictly 1 per person)
  const totalActiveWorkingToday = dailyRoster.filter(r => r.status === 'Present' || r.status === 'On Break' || r.status === 'Work From Home').length;

  // Donut Pie Data - Mutually exclusive slices whose sum matches totalWorkforceCount exactly
  const statusDistributionData = useMemo(() => {
    return [
      { name: 'Present (On-Time)', value: onTimePresentCount, color: '#10b981' },
      { name: 'Late Check-In', value: lateCount, color: '#f59e0b' },
      { name: 'On Break', value: onBreakCount, color: '#06b6d4' },
      { name: 'Work From Home', value: wfhCount, color: '#0ea5e9' },
      { name: 'On Leave', value: onLeaveCount, color: '#a855f7' },
      { name: 'LOP', value: lopCount, color: '#ec4899' },
      { name: 'Absent', value: absentCount, color: '#f43f5e' },
    ].filter(d => d.value > 0);
  }, [onTimePresentCount, lateCount, onBreakCount, wfhCount, onLeaveCount, lopCount, absentCount]);

  // Modals
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [rosterFilter, setRosterFilter] = useState<string>('ALL');
  const [rosterSearch, setRosterSearch] = useState('');

  const [selectedEmployeeActivity, setSelectedEmployeeActivity] = useState<{
    employee: Employee;
    record?: AttendanceRecord | null;
  } | null>(null);

  const [monthlyAttendanceEmp, setMonthlyAttendanceEmp] = useState<Employee | null>(null);

  // PM's own live attendance record
  const pmTodayRecord = resolveAttendanceRecord(attendance, activeEmployee, todayStr);
  const isPmCheckedIn = !!pmTodayRecord?.checkInAt && !isShiftComplete(pmTodayRecord);
  const activePmBreak = pmTodayRecord?.breaks?.find(b => !b.endAt && !(b as any).endTime);
  const [isBreakActionLoading, setIsBreakActionLoading] = useState(false);

  const handlePmBreakToggle = async () => {
    if (!activeEmployee) return;
    if (!isPmCheckedIn) {
      alert("You are not checked in yet today. Please check in first before taking a break.");
      return;
    }
    setIsBreakActionLoading(true);
    try {
      if (activePmBreak) {
        await endBreak(activeEmployee.id);
      } else {
        await startBreak(activeEmployee.id, 'Meal Break');
      }
    } catch (e) {
      console.error('Break action error:', e);
    } finally {
      setIsBreakActionLoading(false);
    }
  };

  // Projects
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('kss_pm_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROJECTS;
      } catch (e) {}
    }
    return DEFAULT_PROJECTS;
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsub = subscribeWithRecovery(collection(db, 'projects'), (snapshot) => {
      if (!snapshot.empty) {
        const fetched: Project[] = [];
        snapshot.forEach(d => fetched.push(d.data() as Project));
        setProjects(fetched);
        localStorage.setItem('kss_pm_projects', JSON.stringify(fetched));
      } else {
        DEFAULT_PROJECTS.forEach(p => {
          setDoc(doc(db, 'projects', p.id), p).catch(console.error);
        });
      }
    }, (err) => console.warn('[PMDashboard] Firestore projects listener error:', err));

    return () => unsub();
  }, [isAuthenticated]);

  // Modal State for PM Custom Sprint Conflict / Rejection Reason
  const [rejectModalReq, setRejectModalReq] = useState<LeaveRequest | null>(null);
  const [customRejectReason, setCustomRejectReason] = useState('Sprint 14 Deadline Conflict — Key deliverable scheduled during request dates');

  const handleRecommend = (reqId: string, type: 'Approved' | 'Flagged', customReason?: string) => {
    const reasonText = customReason || (type === 'Approved' ? 'PM Recommended Approval' : 'Sprint 14 Deadline Conflict');
    const targetReq = leaveRequests.find(r => r.id === reqId);

    updateLeaveRequestStage(
      reqId,
      'PM',
      type === 'Approved' ? 'Approved' : 'Rejected',
      activeEmployee?.fullName || 'Project Manager',
      reasonText,
      targetReq?.employeeId,
      targetReq?.startDate,
      targetReq?.endDate
    );
  };

  // Capacity week
  const [weekOffset, setWeekOffset] = useState(0);
  const weekAnchor = React.useMemo(
    () => new Date(nowMs + weekOffset * 7 * 86400000),
    [todayStr, weekOffset]
  );
  const holidayDates = React.useMemo<string[]>(
    () => (((settings as any)?.holidayDates) || []) as string[],
    [settings]
  );
  const weekDays = React.useMemo(
    () => buildWorkWeek(weekAnchor, { nowMs, holidayDates }),
    [weekAnchor, holidayDates, todayStr]
  );
  const weekLabel = weekDays.length
    ? `${formatShortDate(weekDays[0].dateStr)} → ${formatShortDate(weekDays[weekDays.length - 1].dateStr)}`
    : '';
  const isCurrentWeek = weekOffset === 0;

  const pendingTeamRequests = leaveRequests.filter(r => {
    if (r.status !== 'Pending') return false;
    if (r.pmStatus !== 'Pending' && r.pmStatus !== undefined) return false;
    if (r.pmStatus === 'N/A' || r.pmStatus === 'Bypassed') return false;

    if (
      r.employeeUid === activeEmployee?.uid ||
      r.employeeId === activeEmployee?.id ||
      r.employeeId === activeEmployee?.employeeId ||
      (r.employeeName && activeEmployee?.fullName && r.employeeName.trim().toLowerCase() === activeEmployee.fullName.trim().toLowerCase())
    ) {
      return false;
    }

    const isHrOrPmEmployee = (r.department || '').toLowerCase().includes('hr') ||
      r.employeeRole === 'HR_ADMIN' ||
      r.employeeRole === 'SUPER_ADMIN';

    return !isHrOrPmEmployee;
  });

  // Filtered Roster for Modal Table
  const filteredRosterModal = useMemo(() => {
    return dailyRoster.filter(r => {
      if (rosterFilter === 'ALL') {
        // match all
      } else if (rosterFilter === 'Late') {
        if (!r.isLate) return false;
      } else if (rosterFilter === 'Present') {
        if (r.status !== 'Present' && r.status !== 'On Break') return false;
      } else if (rosterFilter === 'On Break') {
        if (r.status !== 'On Break') return false;
      } else if (rosterFilter === 'Work From Home') {
        if (r.status !== 'Work From Home') return false;
      } else if (rosterFilter === 'On Leave') {
        if (r.status !== 'On Leave') return false;
      } else if (rosterFilter === 'LOP') {
        if (r.status !== 'LOP') return false;
      } else if (rosterFilter === 'Absent') {
        if (r.status !== 'Absent') return false;
      } else if (r.status !== rosterFilter) {
        return false;
      }

      if (rosterSearch.trim() !== '') {
        const q = rosterSearch.toLowerCase();
        const matchesName = (r.employee.fullName || '').toLowerCase().includes(q);
        const matchesId = (r.employee.employeeId || '').toLowerCase().includes(q);
        const matchesDept = (r.employee.department || '').toLowerCase().includes(q);
        return matchesName || matchesId || matchesDept;
      }
      return true;
    });
  }, [dailyRoster, rosterFilter, rosterSearch]);

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
              Project Delivery &amp; Workforce Portal
            </span>
            <span className="text-xs text-slate-500 font-mono">Live Sync Active</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">Project Manager Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor real-time team turnout ({totalActiveWorkingToday}/{totalWorkforceCount} active today), review sprints, and edit 30-day attendance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* PM Break Toggle */}
          <button
            onClick={handlePmBreakToggle}
            disabled={isBreakActionLoading}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              activePmBreak 
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30' 
                : isPmCheckedIn 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
                  : 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
          >
            {isBreakActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coffee className="w-3.5 h-3.5" />}
            <span>{activePmBreak ? 'End My Break' : 'Take Break'}</span>
          </button>
        </div>
      </div>

      {/* ── 1. WORKFORCE TURNOUT KPI CARDS (Clickable for Roster Modal) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Active (9/15 Box) */}
        <div
          onClick={() => { triggerHaptic(); setRosterFilter('ALL'); setIsRosterModalOpen(true); }}
          className="bg-gradient-to-br from-blue-900/40 via-slate-900 to-slate-900 rounded-2xl p-4 border-2 border-blue-500/40 shadow-xl hover:border-blue-400 hover:scale-[1.02] transition-all cursor-pointer group col-span-2 sm:col-span-2 lg:col-span-1"
        >
          <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block">Total Workforce</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-white font-mono">{totalActiveWorkingToday}</span>
            <span className="text-xs font-bold text-slate-400 font-mono">/ {totalWorkforceCount}</span>
          </div>
          <span className="text-[10px] text-blue-300 font-bold mt-1 block group-hover:underline">Click for Live Table →</span>
        </div>

        {/* Present */}
        <div
          onClick={() => { triggerHaptic(); setRosterFilter('Present'); setIsRosterModalOpen(true); }}
          className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md hover:border-emerald-500/50 transition-all cursor-pointer"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present</span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">{presentCount}</span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">On Duty</span>
        </div>

        {/* On Break (Glowing Live Beacon) */}
        <div
          onClick={() => { triggerHaptic(); setRosterFilter('On Break'); setIsRosterModalOpen(true); }}
          className="bg-slate-900/90 rounded-2xl p-4 border-2 border-amber-500/40 shadow-lg shadow-amber-950/20 hover:border-amber-400 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">On Break</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
          </div>
          <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">{onBreakCount}</span>
          <span className="text-[9px] text-amber-300/80 font-semibold block mt-0.5">Live Active</span>
        </div>

        {/* Late */}
        <div
          onClick={() => { triggerHaptic(); setRosterFilter('Late'); setIsRosterModalOpen(true); }}
          className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md hover:border-amber-500/50 transition-all cursor-pointer"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Late</span>
          <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">{lateCount}</span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">Shift Delayed</span>
        </div>

        {/* Work From Home */}
        <div
          onClick={() => { triggerHaptic(); setRosterFilter('Work From Home'); setIsRosterModalOpen(true); }}
          className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md hover:border-sky-500/50 transition-all cursor-pointer"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WFH</span>
          <span className="text-2xl font-black text-sky-400 font-mono mt-1 block">{wfhCount}</span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">Remote Staff</span>
        </div>

        {/* On Leave */}
        <div
          onClick={() => { triggerHaptic(); setRosterFilter('On Leave'); setIsRosterModalOpen(true); }}
          className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md hover:border-purple-500/50 transition-all cursor-pointer"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">On Leave</span>
          <span className="text-2xl font-black text-purple-400 font-mono mt-1 block">{onLeaveCount}</span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">Approved</span>
        </div>

        {/* Absent */}
        <div
          onClick={() => { triggerHaptic(); setRosterFilter('Absent'); setIsRosterModalOpen(true); }}
          className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 shadow-md hover:border-rose-500/50 transition-all cursor-pointer"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Absent</span>
          <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">{absentCount}</span>
          <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">No Check-in</span>
        </div>
      </div>

      {/* ── 2. WORKFORCE STATUS PIE CHART & PENDING SPRINT LEAVES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Today's Workforce Status Donut Pie Chart */}
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Today's Workforce Status</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 font-bold">{todayStr}</span>
          </div>

          <div className="relative w-full h-44 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#020617" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} Employees`, name]}
                  contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #1e293b', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-xl font-black text-white font-mono leading-none">
                {totalActiveWorkingToday}/{totalWorkforceCount}
              </span>
              <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">Active Workforce</span>
            </div>
          </div>

          {/* Legend Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            {statusDistributionData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 font-semibold truncate text-[10px]">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-white text-[11px]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Team Sprint Leave Approvals */}
        <div className="lg:col-span-2 bg-slate-900/90 rounded-3xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Pending Sprint Recommendations ({pendingTeamRequests.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Step 1: PM Recommendation</span>
          </div>

          {pendingTeamRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
              <span>All team leave and WFH requests are up to date!</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {pendingTeamRequests.map(req => (
                <div key={req.id} className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-xs">{req.employeeName}</span>
                      <span className="text-[9px] font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800">{req.employeeId}</span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">{req.type}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Dates: <strong className="text-slate-200">{req.startDate}</strong> to <strong className="text-slate-200">{req.endDate}</strong>
                    </p>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">"{req.reason}"</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRecommend(req.id, 'Approved')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      ✓ Recommend
                    </button>
                    <button
                      onClick={() => setRejectModalReq(req)}
                      className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      ✕ Flag Conflict
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── 3. TEAM WEEKLY CAPACITY & HEATMAP MATRIX ── */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Team Weekly Shift Capacity &amp; Heatmap
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Mon–Sat working schedule with individual day hours</p>
          </div>

          {/* Week Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold text-white bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              {weekLabel} {isCurrentWeek && '(Current)'}
            </span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Heatmap Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Team Member</th>
                {weekDays.map(d => (
                  <th key={d.dateStr} className="py-3 px-3 text-center">
                    <div>{d.dayName}</div>
                    <div className="text-[9px] text-slate-600">{d.shortDate}</div>
                  </th>
                ))}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {operationalEmployees.map(emp => {
                const weekRow = buildWeekWorkRow(weekDays, emp, attendance, {
                  leaveRequests,
                  holidayDates,
                  nowMs
                });

                return (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=0f172a&color=fff`}
                          alt={emp.fullName}
                          className="w-8 h-8 rounded-xl object-cover border border-slate-700/60"
                        />
                        <div>
                          <div className="font-bold text-white text-xs">{emp.fullName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{emp.employeeId}</div>
                        </div>
                      </div>
                    </td>

                    {weekDays.map((d, dIdx) => {
                      const daySummary = weekRow.days[dIdx] || weekRow.days.find(s => s.dateStr === d.dateStr);
                      const rec = resolveAttendanceRecord(attendance, emp, d.dateStr);
                      
                      const isApprovedLeave = hasApprovedLeaveOn(
                        leaveRequests, emp, d.dateStr, EXCUSED_LEAVE_TYPES as unknown as string[]
                      );
                      const isWfhApproved = hasApprovedLeaveOn(leaveRequests, emp, d.dateStr, ['WFH']) || (emp.approvedWfhDates || []).includes(d.dateStr);

                      let status = daySummary?.status || rec?.status || 'Absent';
                      if (d.isFuture) status = 'Upcoming';
                      else if (d.isNonWorking) status = 'Holiday';
                      else if (isApprovedLeave) status = 'On Leave';
                      else if (isWfhApproved) status = 'Work From Home';
                      else if (status === 'Work From Home') {
                        status = (daySummary?.checkInMs || rec?.checkInAt) ? (isLateCheckIn(rec?.checkInAt) ? 'Late' : 'Present') : 'Absent';
                      }

                      const isCheckedIn = !!(daySummary?.checkInMs || rec?.checkInAt);
                      const workedMins = daySummary?.workedMinutes || (rec?.workingMinutes ? Number(rec.workingMinutes) : 0);

                      const isWfhDay = isWfhApproved;

                      let cellColor = 'bg-slate-950 text-slate-600 border-slate-800';

                      if (daySummary?.isOnBreak) {
                        cellColor = 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold animate-pulse';
                      } else if (isWfhDay) {
                        cellColor = 'bg-sky-500/15 text-sky-300 border-sky-500/40 font-bold';
                      } else if (status === 'Late') {
                        cellColor = 'bg-orange-500/15 text-orange-400 border-orange-500/30 font-bold';
                      } else if (isCheckedIn || status === 'Present') {
                        cellColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold';
                      } else if (status === 'On Leave') {
                        cellColor = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
                      } else if (status === 'Holiday') {
                        cellColor = 'bg-slate-900 text-slate-500 border-slate-800/60';
                      } else if (d.isFuture) {
                        cellColor = 'bg-slate-950/40 text-slate-700 border-slate-900';
                      }

                      return (
                        <td key={d.dateStr} className="py-2.5 px-2 text-center">
                          <div className={`p-1.5 rounded-xl border text-[10px] font-mono ${cellColor}`}>
                            {d.isFuture ? (
                              '—'
                            ) : isWfhDay ? (
                              isCheckedIn && workedMins > 0 ? `🏠 ${Math.floor(workedMins / 60)}h ${workedMins % 60}m` : '🏠 WFH'
                            ) : isCheckedIn && workedMins > 0 ? (
                              `${Math.floor(workedMins / 60)}h ${workedMins % 60}m`
                            ) : isCheckedIn ? (
                              'Active'
                            ) : (
                              status
                            )}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setMonthlyAttendanceEmp(emp)}
                        className="px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold rounded-xl flex items-center gap-1 ml-auto cursor-pointer"
                        title="View 30-Day Calendar & Edit Attendance"
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-400" />
                        <span>Monthly Calendar &amp; Override</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. FULL LIVE WORKFORCE ROSTER TABLE MODAL ── */}
      {isRosterModalOpen && (
        <div className="fixed inset-0 z-[150] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-950 p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                    Live Shift Roster
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{todayStr}</span>
                </div>
                <h3 className="text-lg font-black text-white tracking-tight mt-1">Today's Workforce Roster &amp; Shift Table</h3>
                <p className="text-xs text-slate-400">
                  Real-time status, check-in timestamps, working durations, and breakdown pie charts.
                </p>
              </div>

              <button
                onClick={() => setIsRosterModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer self-end sm:self-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
                {['ALL', 'Present', 'On Break', 'Late', 'Work From Home', 'On Leave', 'LOP', 'Absent'].map(st => {
                  let count = 0;
                  if (st === 'ALL') count = dailyRoster.length;
                  else if (st === 'Present') count = presentCount;
                  else if (st === 'On Break') count = onBreakCount;
                  else if (st === 'Late') count = lateCount;
                  else if (st === 'Work From Home') count = wfhCount;
                  else if (st === 'On Leave') count = onLeaveCount;
                  else if (st === 'LOP') count = lopCount;
                  else if (st === 'Absent') count = absentCount;

                  return (
                    <button
                      key={st}
                      onClick={() => setRosterFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        rosterFilter === st
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      <span>{st === 'Work From Home' ? 'WFH' : st}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        rosterFilter === st ? 'bg-white/20 text-white' : st === 'Late' && lateCount > 0 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search employee, ID, department..."
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            {/* Roster Table */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Employee</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Check-In</th>
                      <th className="py-3.5 px-4">Check-Out</th>
                      <th className="py-3.5 px-4">Working Time</th>
                      <th className="py-3.5 px-4">Shift Timings</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-xs">
                    {filteredRosterModal.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                          No employees match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRosterModal.map(r => {
                        const isBreak = r.status === 'On Break';

                        return (
                          <tr key={r.employee.id} className="hover:bg-slate-800/40 transition-colors group">
                            {/* Employee */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={r.employee.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.employee.fullName)}&background=0f172a&color=fff`}
                                  alt={r.employee.fullName}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-700/60"
                                />
                                <div>
                                  <div className="font-bold text-white">{r.employee.fullName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{r.employee.employeeId} • {r.employee.department}</div>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              {isBreak ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                  <span>On Break</span>
                                </span>
                              ) : r.status === 'Present' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Present</span>
                                </span>
                              ) : r.status === 'Work From Home' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                  <span>WFH</span>
                                </span>
                              ) : r.status === 'On Leave' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                  <span>On Leave</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                  <span>{r.status}</span>
                                </span>
                              )}
                            </td>

                            {/* Check-In */}
                            <td className="py-3.5 px-4 font-mono font-bold">
                              {r.record?.checkInAt ? (
                                <span className={`inline-flex items-center gap-1.5 ${r.isLate ? 'text-orange-500 font-black' : 'text-slate-200'}`}>
                                  <span className={`w-2 h-2 rounded-full ${r.isLate ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)] animate-pulse' : 'bg-emerald-400'}`} />
                                  <span className={r.isLate ? 'text-orange-500 font-black tracking-wide' : ''}>{toISTTimeString(r.record.checkInAt)}</span>
                                  {r.isLate && (
                                    <span className="text-[9px] font-sans font-bold text-orange-400 bg-orange-500/15 border border-orange-500/30 px-1 py-0.2 rounded ml-1">
                                      LATE
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-600 font-bold">—</span>
                              )}
                            </td>

                            {/* Check-Out */}
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                              {r.record?.checkOutAt ? toISTTimeString(r.record.checkOutAt) : r.isCheckedIn ? <span className="text-emerald-400">In Progress</span> : '—'}
                            </td>

                            {/* Working Time */}
                            <td className="py-3.5 px-4 font-mono text-slate-200">
                              {r.record?.workingMinutes ? `${Math.floor(r.record.workingMinutes / 60)}h ${r.record.workingMinutes % 60}m` : '0m'}
                            </td>

                            {/* Shift */}
                            <td className="py-3.5 px-4 text-slate-300 font-medium text-xs">
                              {formatShiftTiming(r.employee.shift || r.employee.preferredShift)}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setSelectedEmployeeActivity({ employee: r.employee, record: r.record })}
                                  className="px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                                  title="Inspect Today's Live Pie Chart"
                                >
                                  <PieChartIcon className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Live Day Pie</span>
                                </button>

                                <button
                                  onClick={() => setMonthlyAttendanceEmp(r.employee)}
                                  className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                                  title="Open Monthly Attendance & Edit Calendar"
                                >
                                  <Calendar className="w-4 h-4 text-blue-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── 5. SINGLE EMPLOYEE LIVE DAY ACTIVITY & DONUT PIE CHART MODAL ── */}
      {selectedEmployeeActivity && (
        <div className="fixed inset-0 z-[160] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden p-6 space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={selectedEmployeeActivity.employee.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployeeActivity.employee.fullName)}&background=0f172a&color=fff`}
                  alt={selectedEmployeeActivity.employee.fullName}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500/50 shadow-md"
                />
                <div>
                  <h3 className="text-base font-black text-white">{selectedEmployeeActivity.employee.fullName}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedEmployeeActivity.employee.employeeId} • {selectedEmployeeActivity.employee.department}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedEmployeeActivity(null)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Donut Pie Chart & Stats Breakdown */}
            {(() => {
              const rec = selectedEmployeeActivity.record;
              const breaks = rec?.breaks || [];
              
              let workingMins = Number(rec?.workingMinutes) || 0;
              let teaMins = 0;
              let mealMins = 0;
              let huddleMins = 0;
              let meetingMins = 0;
              let trainingMins = 0;
              let activityMins = 0;
              let otherMins = 0;

              breaks.forEach(b => {
                let duration = Number(b.durationMinutes) || 0;
                if (duration <= 0 && b.startAt) {
                  const end = b.endAt ? new Date(b.endAt).getTime() : Date.now();
                  duration = Math.max(1, Math.floor((end - new Date(b.startAt).getTime()) / 60000));
                }
                const t = b.type || 'Break';
                if (t === 'Tea Break') teaMins += duration;
                else if (t === 'Meal Break' || t.includes('Lunch')) mealMins += duration;
                else if (t === 'Team Huddle') huddleMins += duration;
                else if (t === 'Team Meeting') meetingMins += duration;
                else if (t.includes('Training')) trainingMins += duration;
                else if (t === 'Activity') activityMins += duration;
                else otherMins += duration;
              });

              const totalBreakMins = teaMins + mealMins + huddleMins + meetingMins + trainingMins + activityMins + otherMins;
              if (workingMins <= 0 && rec?.checkInAt) {
                const shiftEnd = rec.checkOutAt ? new Date(rec.checkOutAt).getTime() : Date.now();
                const totalMins = Math.max(0, Math.floor((shiftEnd - new Date(rec.checkInAt).getTime()) / 60000));
                workingMins = Math.max(0, totalMins - totalBreakMins);
              }

              const categories = [
                { name: 'Working Time', value: workingMins, color: '#10b981' },
                { name: 'Tea Break', value: teaMins, color: '#f59e0b' },
                { name: 'Meal Break', value: mealMins, color: '#f43f5e' },
                { name: 'Team Huddle', value: huddleMins, color: '#3b82f6' },
                { name: 'Team Meeting', value: meetingMins, color: '#a855f7' },
                { name: 'Training', value: trainingMins, color: '#06b6d4' },
                { name: 'Activity', value: activityMins, color: '#eab308' },
                { name: 'Other Breaks', value: otherMins, color: '#64748b' },
              ].filter(c => c.value > 0);

              const grandTotal = workingMins + totalBreakMins;

              return (
                <div className="space-y-6">
                  {categories.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      No shift activities or check-in recorded for today yet.
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categories}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {categories.map((entry, index) => (
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
                            {Math.floor(grandTotal / 60)}h {grandTotal % 60}m
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Shift</span>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-2 gap-2.5 text-xs w-full">
                        {categories.map((cat, idx) => (
                          <div key={idx} className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="text-slate-300 font-semibold truncate text-[11px]">{cat.name}</span>
                            </div>
                            <span className="font-mono text-xs font-black text-white">
                              {cat.value >= 60 ? `${Math.floor(cat.value / 60)}h ${cat.value % 60}m` : `${cat.value}m`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <button
                      onClick={() => {
                        const emp = selectedEmployeeActivity.employee;
                        setSelectedEmployeeActivity(null);
                        setMonthlyAttendanceEmp(emp);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-900/40 cursor-pointer"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Open Monthly Calendar &amp; Override</span>
                    </button>

                    <button
                      onClick={() => setSelectedEmployeeActivity(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ── 6. MONTHLY ATTENDANCE MODAL (With PM/Admin Day Editor) ── */}
      {monthlyAttendanceEmp && (
        <EmployeeMonthlyAttendanceModal
          employee={monthlyAttendanceEmp}
          onClose={() => setMonthlyAttendanceEmp(null)}
        />
      )}

      {/* ── 7. PM SPRINT CONFLICT / REJECT REASON MODAL ── */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-[160] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Flag Sprint Delivery Conflict
              </h3>
              <button onClick={() => setRejectModalReq(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Provide feedback to the employee ({rejectModalReq.employeeName}) and Executive Management regarding sprint deliverable conflicts.
            </p>

            <textarea
              rows={3}
              value={customRejectReason}
              onChange={e => setCustomRejectReason(e.target.value)}
              className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-amber-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRecommend(rejectModalReq.id, 'Flagged', customRejectReason);
                  setRejectModalReq(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Confirm Conflict Flag
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
