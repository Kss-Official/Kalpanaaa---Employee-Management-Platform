import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
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
  Loader2
} from 'lucide-react';
import { Project, LeaveRequest } from '../../types';
import { db, subscribeWithRecovery } from '../../lib/firebase';
import { collection, setDoc, doc } from 'firebase/firestore';
import {
  getEmployeeWorkDate,
  resolveAttendanceRecord,
  isShiftComplete,
  buildWorkWeek,
  buildWeekWorkRow,
  hasApprovedLeaveOn,
  formatDuration,
  formatShortDate,
  SHIFT_LABEL,
  SHIFT_TOTAL_MINUTES,
  WORK_WEEK_DAYS
} from '../../lib/attendanceEngine';
import type { DayWorkSummary, WorkWeekDay } from '../../lib/attendanceEngine';
import { toISTTimeString } from '../../lib/absoluteTime';

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

  const todayStr = getEmployeeWorkDate(new Date());

  // One clock drives every live duration on this screen. Holding the timestamp
  // itself (rather than an opaque counter) means the memos below can depend on
  // it explicitly, so a cell can never render a duration from a stale `now`.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // PM's own live attendance record (canonical resolver — same doc the backend writes to)
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
        await startBreak(activeEmployee.id, 'Tea / Lunch Break');
      }
    } catch (e) {
      console.error('Break action error:', e);
    } finally {
      setIsBreakActionLoading(false);
    }
  };

  // Real-time Firestore Sync for PM Projects (Fixes P14 Contract)
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
    // P0 FIX: never attach while unauthenticated — a permission-denied kills a
    // listener permanently, and this effect previously ran once with [] deps.
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

  // Item #15: the roster is a SIX day week (Mon–Sat). The previous loop ran
  // `i < 5` and hardcoded ['Mon'..'Fri'], so Saturday — a full working day here —
  // was structurally invisible in the capacity table: an employee could work
  // every Saturday of the month and the heatmap would never show one hour of it.
  const [weekOffset, setWeekOffset] = useState(0);
  const weekAnchor = React.useMemo(
    () => new Date(nowMs + weekOffset * 7 * 86400000),
    // Re-anchoring on every tick would be wasteful and would fight the arrows;
    // the anchor only needs the CURRENT week, which changes at most daily.
    [todayStr, weekOffset] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const holidayDates = React.useMemo<string[]>(
    () => (((settings as any)?.holidayDates) || []) as string[],
    [settings]
  );
  const weekDays = React.useMemo(
    () => buildWorkWeek(weekAnchor, { nowMs, holidayDates }),
    [weekAnchor, holidayDates, todayStr] // eslint-disable-line react-hooks/exhaustive-deps
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
      r.employeeRole === 'PROJECT_MANAGER' ||
      r.employeeRole === 'SUPER_ADMIN';

    return !isHrOrPmEmployee;
  });

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Header Command Center */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-extrabold text-blue-400 uppercase tracking-wider mb-1">
            <Kanban className="w-4 h-4 text-blue-400" />
            <span>Project Manager Command Center</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight leading-tight">
            Engineering Sprint &amp; Workload Control
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Monitor project health, balance team capacity, and send HR leave recommendations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
          {/* PM Break & Duty Status Widget */}
          <button
            onClick={handlePmBreakToggle}
            disabled={isBreakActionLoading || !isPmCheckedIn}
            className={`flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
              activePmBreak 
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse font-extrabold'
                : isPmCheckedIn
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800/60 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-70'
            }`}
            title={!isPmCheckedIn ? 'Check in first to take a break' : activePmBreak ? 'End your active break' : 'Take a break'}
          >
            {isBreakActionLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Coffee className="w-4 h-4 text-amber-400" />
            )}
            <span>{activePmBreak ? 'End Break (Active)' : 'Take Break'}</span>
          </button>

          <button
            onClick={() => onNavigateTab('leave_approvals')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer flex-1 sm:flex-initial"
          >
            <FileText className="w-4 h-4" />
            <span>Leave Approvals ({pendingTeamRequests.length})</span>
          </button>
          <button
            onClick={() => onNavigateTab('pm_projects')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-blue-900/30 transition-all cursor-pointer flex-1 sm:flex-initial"
          >
            <Kanban className="w-4 h-4" />
            <span>Open Task Kanban Board</span>
          </button>
        </div>
      </div>

      {/* Zone 1: Pending Team Requests for PM Approval */}
      <div className="bg-slate-900/90 border border-purple-500/30 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400 shrink-0" /> 
            <span>Team Leave &amp; WFH Pending Approvals (PM Stage)</span>
          </h3>
          <span className="text-[11px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20 shrink-0">
            {pendingTeamRequests.length} Pending
          </span>
        </div>

        <div className="space-y-3 pt-1">
          {pendingTeamRequests.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-400">All caught up!</p>
              <p className="text-[11px] text-slate-500 mt-0.5">No pending employee leave or WFH requests requiring PM review.</p>
            </div>
          ) : (
            pendingTeamRequests.map(req => (
              <div 
                key={req.id}
                className="bg-slate-950/70 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-3.5 sm:p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">{req.employeeName}</span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {req.department}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      req.type === 'WFH' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {req.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    <span className="font-semibold text-purple-300">{req.startDate}</span> to <span className="font-semibold text-purple-300">{req.endDate}</span> ({req.durationDays || 1} day{(req.durationDays || 1) > 1 ? 's' : ''})
                  </p>
                  <p className="text-[11px] text-slate-400 italic bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 mt-1">
                    "{req.reason}"
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRecommend(req.id, 'Approved')}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Recommend</span>
                  </button>
                  <button
                    onClick={() => setRejectModalReq(req)}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Flag Conflict</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Zone 2: Project Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.map(proj => (
          <div 
            key={proj.id}
            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-lg flex flex-col justify-between space-y-4 group transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {proj.client}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  proj.status === 'In Progress' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  proj.status === 'At Risk' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {proj.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors leading-snug">{proj.name}</h3>
              <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">{proj.description}</p>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                <span>Sprint Progress</span>
                <span className="font-mono text-white">{proj.progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className={`h-full rounded-full ${
                    proj.progressPercent > 80 ? 'bg-emerald-500' : proj.progressPercent > 50 ? 'bg-blue-500' : 'bg-amber-500'
                  }`} 
                  style={{ width: `${proj.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Zone 3: Team Capacity — Mon–Sat real hours, live and closed */}
      {(() => {
        // Pure role-based filter: Super Admins & HR Admins excluded; EMPLOYEE and PROJECT_MANAGER included
        const teamMembersOnly = employees.filter(emp => {
          return emp.role !== 'SUPER_ADMIN' && emp.role !== 'HR_ADMIN';
        });

        // One roll-up per person, computed once per tick. Every cell, the week
        // total and the duty badge all read from this same object, so a row can
        // no longer disagree with its own total.
        const rows = teamMembersOnly.map(emp => ({
          emp,
          week: buildWeekWorkRow(weekDays, emp, attendance, { nowMs, leaveRequests })
        }));

        const teamWorkedMinutes = rows.reduce((acc, r) => acc + r.week.totalWorkedMinutes, 0);
        const liveNow = rows.filter(r => r.week.isLive).length;
        const cellBase = 'inline-block min-w-[46px] px-1.5 h-8 rounded-lg font-mono font-bold text-[11px] leading-8 border';

        const renderDayCell = (s: DayWorkSummary, meta: WorkWeekDay, emp: any) => {
          // Not yet happened: an empty cell is the honest answer. It is NOT an
          // absence and must not be coloured like one.
          if (meta.isFuture) {
            return (
              <span title={meta.dayNameLong + ' ' + meta.shortDate + ' — upcoming'}
                className={cellBase + ' bg-slate-950/40 text-slate-700 border-slate-900/60'}>·</span>
            );
          }
          if (meta.isNonWorking) {
            return (
              <span title={meta.dayNameLong + ' ' + meta.shortDate + ' — weekly off / holiday'}
                className={cellBase + ' bg-slate-800/40 text-slate-500 border-slate-700/40'}>Off</span>
            );
          }
          if (!s.checkInMs) {
            // Sanctioned leave is not truancy, so it gets its own colour rather
            // than being lumped in with an unexplained no-show.
            if (hasApprovedLeaveOn(leaveRequests, emp, meta.dateStr)) {
              return (
                <span title={meta.dayNameLong + ' ' + meta.shortDate + ' — approved leave'}
                  className={cellBase + ' bg-violet-500/15 text-violet-300 border-violet-500/25'}>Leave</span>
              );
            }
            return (
              <span title={'No check-in on ' + meta.dayNameLong + ' ' + meta.shortDate}
                className={cellBase + ' bg-rose-500/10 text-rose-400/80 border-rose-500/20'}>A</span>
            );
          }

          const hrs = s.workedHours;
          const tone =
            s.state === 'missing-checkout' ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' :
            hrs >= 8 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
            hrs >= 6 ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
            'bg-amber-500/20 text-amber-300 border-amber-500/30';

          const tip =
            meta.dayNameLong + ' ' + meta.shortDate + ' • ' + formatDuration(s.workedSecs) + ' worked'
            + (s.breakSecs > 0 ? ' • ' + formatDuration(s.breakSecs) + ' break' : '')
            + (s.checkInMs ? ' • In ' + toISTTimeString(new Date(s.checkInMs).toISOString()) : '')
            + (s.checkOutMs ? ' • Out ' + toISTTimeString(new Date(s.checkOutMs).toISOString()) : '')
            + (s.state === 'missing-checkout' ? ' • no check-out (capped at shift end)' : '')
            + (s.isOnBreak ? ' • on break: ' + s.activeBreakType : s.isLive ? ' • live' : '');

          return (
            <span title={tip} className={cellBase + ' ' + tone + ' relative'} data-testid={'pm-cell-' + meta.dateStr}>
              {hrs}h
              {s.isLive && (
                <span className={'absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ' +
                  (s.isOnBreak ? 'bg-amber-400' : 'bg-emerald-400') + ' animate-pulse'} />
              )}
              {s.state === 'missing-checkout' && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-400" />
              )}
            </span>
          );
        };

        return (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Team Work Duration — {WORK_WEEK_DAYS}-Day Week (Mon–Sat)</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  Shift {SHIFT_LABEL} · durations come from real check-in/out timestamps only
                </p>
              </div>

              {/* Week navigator */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWeekOffset(o => o - 1)}
                  title="Previous week"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span data-testid="pm-week-label" className="text-[11px] font-mono font-bold text-white bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-lg min-w-[140px] text-center">
                  {weekLabel}
                </span>
                <button
                  onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
                  disabled={isCurrentWeek}
                  title={isCurrentWeek ? 'Already on the current week' : 'Next week'}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {!isCurrentWeek && (
                  <button
                    onClick={() => setWeekOffset(0)}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 transition-colors cursor-pointer"
                  >
                    This Week
                  </button>
                )}
              </div>
            </div>

            {/* Team roll-up strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Members</p>
                <p className="text-lg font-black text-white font-mono">{teamMembersOnly.length}</p>
              </div>
              <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wide">Working Now</p>
                <p className="text-lg font-black text-emerald-300 font-mono flex items-center gap-1.5">
                  {liveNow}
                  {liveNow > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Team Hours</p>
                <p className="text-lg font-black text-white font-mono">{Math.round((teamWorkedMinutes / 60) * 10) / 10}h</p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rostered / Person</p>
                <p className="text-lg font-black text-slate-300 font-mono">{Math.round((SHIFT_TOTAL_MINUTES * WORK_WEEK_DAYS) / 60)}h</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800/80 custom-scrollbar">
              <table className="w-full text-left text-xs min-w-[860px]">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase text-[10px] bg-slate-950/50">
                    <th className="py-2.5 px-3">Team Member</th>
                    <th className="py-2.5 px-3">Department &amp; Role</th>
                    {weekDays.map(d => (
                      <th
                        key={d.dateStr}
                        className={'py-2 px-2 text-center ' + (d.isToday ? 'text-blue-400' : d.isNonWorking ? 'text-slate-700' : '')}
                      >
                        {/* Item #15: day NAME above the 17-8-26 date, so a column
                            is readable without counting across from Monday. */}
                        <span className="block text-[10px] font-extrabold tracking-wide">{d.dayName}</span>
                        <span className="block text-[9px] font-mono font-semibold text-slate-600 normal-case">{d.shortDate}</span>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center text-slate-400">Week Total</th>
                    <th className="py-2.5 px-3 text-right">Duty Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-semibold">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={weekDays.length + 4} className="py-8 text-center text-slate-500 text-xs">
                        No team members assigned yet.
                      </td>
                    </tr>
                  )}
                  {rows.map(({ emp, week }) => {
                    const today = week.days.find((_, i) => weekDays[i].isToday);
                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <img
                              src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=1e293b&color=fff`}
                              alt={emp.fullName}
                              className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                            />
                            <div>
                              <span className="block text-xs font-bold text-white">{emp.fullName}</span>
                              <span className="text-[10px] font-mono text-slate-500">{emp.employeeId}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-xs">
                          <span className="block font-bold text-slate-300">{emp.department}</span>
                          <span className="text-[10px] text-slate-500">{emp.designation}</span>
                        </td>

                        {week.days.map((s, i) => (
                          <td key={weekDays[i].dateStr} className={'py-3 px-2 text-center ' + (weekDays[i].isToday ? 'bg-blue-500/5' : '')}>
                            {renderDayCell(s, weekDays[i], emp)}
                          </td>
                        ))}

                        {/* Six-day total. Recomputed from timestamps on every tick,
                            so it moves the moment someone checks out. */}
                        <td className="py-3 px-3 text-center">
                          <span
                            data-testid={'pm-week-total-' + emp.id}
                            title={formatDuration(week.totalWorkedSecs) + ' worked over ' + week.daysPresent + ' day(s)'
                              + (week.expectedMinutes > 0 ? ' • ' + week.utilizationPercent + '% of ' + Math.round(week.expectedMinutes / 60) + 'h rostered so far' : '')}
                            className={'block font-mono font-black text-sm ' +
                              (week.utilizationPercent >= 95 ? 'text-emerald-300' :
                               week.utilizationPercent >= 80 ? 'text-blue-300' :
                               week.expectedMinutes === 0 ? 'text-slate-500' : 'text-amber-300')}
                          >
                            {week.totalWorkedHours}h
                          </span>
                          <span className="block text-[9px] font-mono text-slate-500">
                            {week.expectedMinutes > 0 ? week.utilizationPercent + '%' : '—'}
                            {week.daysAbsent > 0 && <span className="text-rose-400/80"> · {week.daysAbsent}A</span>}
                          </span>
                        </td>

                        {/* Item #15: this badge used to be driven by `!!checkInAt`
                            alone, so it read "On Duty (Office)" from check-in until
                            midnight — a PM could not tell who was still working from
                            who had gone home hours ago. It now follows the resolved
                            state of today's record. */}
                        <td className="py-3 px-3 text-right">
                          {!today || !today.checkInMs ? (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-800/50 px-2.5 py-1 rounded-lg border border-slate-700/50">
                              Off Duty
                            </span>
                          ) : today.state === 'complete' ? (
                            <span
                              title={'Checked out at ' + toISTTimeString(new Date(today.checkOutMs as number).toISOString())}
                              className="text-[10px] font-bold text-slate-300 bg-slate-700/40 px-2.5 py-1 rounded-lg border border-slate-600/40"
                            >
                              Checked Out • {today.workedHours}h
                            </span>
                          ) : today.state === 'missing-checkout' ? (
                            <span className="text-[10px] font-bold text-orange-300 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/25">
                              No Check-out
                            </span>
                          ) : today.isOnBreak ? (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/25 animate-pulse">
                              On Break • {today.activeBreakType}
                            </span>
                          ) : today.isWfh ? (
                            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
                              WFH Active • {toISTTimeString(new Date(today.checkInMs).toISOString())}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                              On Duty • {toISTTimeString(new Date(today.checkInMs).toISOString())}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-semibold text-slate-500 pt-1">
              {[
                { c: 'bg-emerald-500/60', l: 'Full shift (8h+)' },
                { c: 'bg-blue-500/60', l: '6–8h' },
                { c: 'bg-amber-500/60', l: 'Under 6h' },
                { c: 'bg-orange-500/60', l: 'No check-out' },
                { c: 'bg-violet-500/60', l: 'Approved leave' },
                { c: 'bg-rose-500/50', l: 'Absent' },
                { c: 'bg-slate-700', l: 'Off / upcoming' }
              ].map(x => (
                <span key={x.l} className="flex items-center gap-1.5">
                  <span className={'w-2 h-2 rounded-sm ' + x.c} />{x.l}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Modal for Custom Rejection Reason */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Flag Sprint / Workload Conflict</span>
            </h3>
            <p className="text-xs text-slate-400">
              Provide a sprint conflict note for <strong className="text-white">{rejectModalReq.employeeName}</strong>. This will be transmitted directly to HR.
            </p>

            <textarea
              rows={3}
              value={customRejectReason}
              onChange={(e) => setCustomRejectReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500/50"
              placeholder="e.g. Critical release milestone during requested dates..."
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleRecommend(rejectModalReq.id, 'Flagged', customRejectReason);
                  setRejectModalReq(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-950/50 cursor-pointer"
              >
                Submit Conflict to HR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
