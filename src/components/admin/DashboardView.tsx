import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../common/StatCard';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Palmtree, 
  Plus, 
  FileDown, 
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  X,
  MapPin,
  Timer,
  Home,
  Loader2,
  Coffee,
  PieChart as PieChartIcon,
  Sparkles,
  ChevronRight,
  Eye,
  Calendar,
  UtensilsCrossed,
  Briefcase,
  GraduationCap,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useHaptic } from '../../hooks/useHaptic';
import { toISTTimeString, todayInIST } from '../../lib/absoluteTime';
import { getEmployeeWorkDate, getAttendanceDocId, getCanonicalEmployeeUid, getWorkDate, isShiftComplete, safeGetTimestampMillis, isExecutiveOrLeadership, isLateCheckIn } from '../../lib/attendanceEngine';
import { Employee, AttendanceRecord } from '../../types';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenAddEmployee: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab, onOpenAddEmployee }) => {
  const { employees, attendance, settings, activeEmployee, auditLogs, companyWideWfhDates, addAuditLog, leaveRequests, updateAttendanceRecord } = useAuth();
  const { triggerHaptic } = useHaptic();

  // Override: admin manually removes WFH flag from an attendance record
  const removeWfhOverride = async (rec: AttendanceRecord, emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rec?.id) return;
    try {
      let realStatus: string = 'Present';
      if (rec.checkInAt) {
        try {
          const iso = typeof rec.checkInAt === 'string'
            ? rec.checkInAt
            : (rec.checkInAt as any)?.toDate?.()?.toISOString?.() || new Date((rec.checkInAt as any)?.seconds * 1000).toISOString();
          const d = new Date(iso);
          const istMins = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % (24 * 60);
          const h = Math.floor(istMins / 60);
          const m = istMins % 60;
          realStatus = (h > 10 || (h === 10 && m > 15)) ? 'Late' : 'Present';
        } catch { realStatus = 'Present'; }
      }
      await setDoc(doc(db, 'attendance', rec.id), {
        isWfh: false,
        status: realStatus,
        updatedAt: serverTimestamp(),
        notes: ((rec.notes || '') + ' [Admin override: WFH removed]').trim()
      }, { merge: true });
      addAuditLog('ADMIN_WFH_OVERRIDE', emp.employeeId, `Removed WFH flag for ${emp.fullName} on ${rec.date}. Status set to ${realStatus}`);
      triggerHaptic('success');
    } catch (err) {
      console.error('[WFH Override] Failed:', err);
    }
  };
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month'>('today');
  
  // Loading state for restore logs
  const [isRestoringLogs, setIsRestoringLogs] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ current: number; total: number } | null>(null);

  // Full Roster Table Modal State
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [rosterFilter, setRosterFilter] = useState<string>('ALL');
  const [rosterSearch, setRosterSearch] = useState('');

  // Single Employee Live Activity Pie Chart Modal
  const [selectedEmployeeActivity, setSelectedEmployeeActivity] = useState<{
    employee: Employee;
    record?: AttendanceRecord | null;
  } | null>(null);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };
  const displayName = activeEmployee?.fullName?.split(' ')[0] || 'there';

  const todayStr = getWorkDate(new Date());
  const todayRecords = attendance.filter(a => a && a.date === todayStr && a.employeeName && a.employeeName.trim() !== '' && a.employeeName !== '.');

  // Exclude Executive Leadership & Founders (CEO, CTO, COO Rahul Pathak, Founders) from operational metrics & graphs
  const activeEmployees = useMemo(() => employees.filter(e => e.status !== 'Terminated' && !isExecutiveOrLeadership(e)), [employees]);
  const totalEmployeesCount = activeEmployees.length;

  // Build full daily roster for all active employees with accurate live status
  const dailyRoster = useMemo(() => {
    return activeEmployees.map(emp => {
      const rec = todayRecords.find(r => 
        r.employeeId === emp.id || 
        r.employeeCode === emp.employeeId || 
        (r.employeeName && emp.fullName && r.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase())
      );

      // Check if employee has approved leave or WFH today
      const leaveReq = leaveRequests.find(l => 
        ((!!l.employeeId && (l.employeeId === emp.id || l.employeeId === emp.employeeId)) ||
         (!!l.employeeUid && (l.employeeUid === emp.uid || l.employeeUid === emp.id)) ||
         (!!l.employeeName && !!emp.fullName && l.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase())) &&
        l.status === 'Approved' &&
        todayStr >= (l.startDate || (l as any).fromDate) && 
        todayStr <= (l.endDate || (l as any).toDate || l.startDate)
      );

      const isCompanyWfh = (companyWideWfhDates || []).includes(todayStr) || ((settings as any)?.companyWideWfhDates || []).includes(todayStr);
      // Individual WFH approval: must have an explicit approved WFH leave request or entry in approvedWfhDates
      const isApprovedEmpWfh = (emp.approvedWfhDates || []).includes(todayStr) || (!!leaveReq && leaveReq.type === 'WFH');
      // True WFH = individual approval OR company-wide WFH (but NOT overriding an actual office check-in)
      // If the employee has a real attendance record with a check-in and NO individual WFH approval,
      // they physically came to office (or checked in genuinely) — treat as Present/Late, not WFH.
      const hasRealCheckIn = !!(rec?.checkInAt) && !isApprovedEmpWfh;
      const isWfh = isApprovedEmpWfh || (isCompanyWfh && !hasRealCheckIn);

      // Active break detection
      const activeBreak = rec?.breaks?.find(b => !b.endAt && !(b as any).endTime);
      const isComplete = isShiftComplete(rec);
      const isCheckedIn = !!rec?.checkInAt && !isComplete;
      const isLate = rec?.status === 'Late' || (!!rec?.checkInAt && isLateCheckIn(rec.checkInAt));

      // Determine accurate real-time status:
      // Differentiate Work From Home clearly from in-office Present and Absent
      let computedStatus: 'Present' | 'Work From Home' | 'On Leave' | 'LOP' | 'On Break' | 'Absent' = 'Absent';

      if (activeBreak && isCheckedIn) {
        computedStatus = 'On Break';
      } else if (rec?.checkInAt && !isApprovedEmpWfh) {
        // Real check-in record without individual WFH approval → Present/Late (office attendance)
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

      // Check for Loss of Pay (LOP) designation or consecutive absences
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
  }, [activeEmployees, todayRecords, leaveRequests, companyWideWfhDates, settings, todayStr]);

  // Counts based on the daily roster
  const presentTodayCount = dailyRoster.filter(r => r.status === 'Present' || r.status === 'On Break').length;
  const onBreakCount = dailyRoster.filter(r => r.status === 'On Break').length;
  const lateTodayCount = dailyRoster.filter(r => r.isLate).length;
  const wfhTodayCount = dailyRoster.filter(r => r.status === 'Work From Home').length;
  const onLeaveCount = dailyRoster.filter(r => r.status === 'On Leave').length;
  const lopCount = dailyRoster.filter(r => r.status === 'LOP').length;
  const absentTodayCount = dailyRoster.filter(r => r.status === 'Absent').length;

  // Filtered Roster for Modal Table
  const filteredRoster = useMemo(() => {
    return dailyRoster.filter(item => {
      const matchesSearch = 
        item.employee.fullName.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        item.employee.employeeId.toLowerCase().includes(rosterSearch.toLowerCase()) ||
        (item.employee.department || '').toLowerCase().includes(rosterSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (rosterFilter === 'ALL') return true;
      if (rosterFilter === 'Present') return item.status === 'Present' || item.status === 'On Break';
      if (rosterFilter === 'On Break') return item.status === 'On Break';
      if (rosterFilter === 'Late') return item.isLate;
      if (rosterFilter === 'Work From Home') return item.status === 'Work From Home';
      if (rosterFilter === 'On Leave') return item.status === 'On Leave';
      if (rosterFilter === 'LOP') return item.status === 'LOP';
      if (rosterFilter === 'Absent') return item.status === 'Absent';
      return true;
    });
  }, [dailyRoster, rosterFilter, rosterSearch]);

  // Compute activity breakdown for any record
  const computeDetailedBreakdown = (record?: AttendanceRecord | null, emp?: Employee) => {
    if (!record) {
      return {
        workingMins: 0,
        teaBreakMins: 0,
        mealBreakMins: 0,
        teamHuddleMins: 0,
        teamMeetingMins: 0,
        trainingMins: 0,
        activityMins: 0,
        otherBreakMins: 0,
        totalBreakMins: 0,
        grandTotalMins: 0,
        categories: []
      };
    }

    const breaks = record.breaks || [];
    let teaBreakMins = 0;
    let mealBreakMins = 0;
    let teamHuddleMins = 0;
    let teamMeetingMins = 0;
    let trainingMins = 0;
    let activityMins = 0;
    let otherBreakMins = 0;

    breaks.forEach(b => {
      let dur = Number(b.durationMinutes) || 0;
      if (dur <= 0 && b.startAt) {
        if (b.endAt) {
          dur = Math.max(1, Math.floor((new Date(b.endAt).getTime() - new Date(b.startAt).getTime()) / 60000));
        } else {
          dur = Math.max(1, Math.floor((Date.now() - new Date(b.startAt).getTime()) / 60000));
        }
      }
      dur = Math.min(120, Math.max(1, dur));

      const type = b.type || 'Break';
      if (type === 'Tea Break') teaBreakMins += dur;
      else if (type === 'Meal Break' || type.includes('Lunch')) mealBreakMins += dur;
      else if (type === 'Team Huddle') teamHuddleMins += dur;
      else if (type === 'Team Meeting') teamMeetingMins += dur;
      else if (type.includes('Training') || type.includes('Attainment')) trainingMins += dur;
      else if (type === 'Activity') activityMins += dur;
      else otherBreakMins += dur;
    });

    const totalBreakMins = teaBreakMins + mealBreakMins + teamHuddleMins + teamMeetingMins + trainingMins + activityMins + otherBreakMins;

    let workingMins = Number(record.workingMinutes) || 0;
    if (workingMins <= 0 && record.checkInAt) {
      const endMs = record.checkOutAt ? new Date(record.checkOutAt).getTime() : Date.now();
      const elapsedMins = Math.max(0, Math.floor((endMs - new Date(record.checkInAt).getTime()) / 60000));
      workingMins = Math.max(0, elapsedMins - totalBreakMins);
    }

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
      categories
    };
  };

  // Pie chart data for dashboard overview
  const statusPieData = useMemo(() => {
    return [
      { name: 'Present', value: presentTodayCount - onBreakCount, color: '#10b981' },
      { name: 'On Break (Live)', value: onBreakCount, color: '#f59e0b' },
      { name: 'Late', value: lateTodayCount, color: '#fbbf24' },
      { name: 'Work From Home', value: wfhTodayCount, color: '#38bdf8' },
      { name: 'On Leave', value: onLeaveCount, color: '#c084fc' },
      { name: 'LOP', value: lopCount, color: '#e11d48' },
      { name: 'Absent', value: absentTodayCount, color: '#64748b' }
    ].filter(d => d.value > 0);
  }, [presentTodayCount, onBreakCount, lateTodayCount, wfhTodayCount, onLeaveCount, lopCount, absentTodayCount]);

  // Compute 7-day attendance trend chart data
  const trendData = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const dStr = getWorkDate(d);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayRecs = attendance.filter(a => a.date === dStr);

    return {
      date: dayLabel,
      Present: dayRecs.filter(a => a.status === 'Present' || a.status === 'Late' || a.status === 'Work From Home').length,
      Late: dayRecs.filter(a => a.status === 'Late').length,
      Absent: Math.max(0, totalEmployeesCount - dayRecs.length),
    };
  });

  const recentCheckIns = todayRecords
    .filter(a => a.checkInAt)
    .sort((a, b) => new Date(b.checkInAt!).getTime() - new Date(a.checkInAt!).getTime())
    .slice(0, 6);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Present': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'On Break': return 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse ring-1 ring-amber-400/50';
      case 'Late': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Work From Home': return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'On Leave': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'LOP': return 'bg-rose-600/20 text-rose-300 border-rose-600/40 font-black';
      case 'Absent': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Banner & Quick Action Buttons */}
      <div className="relative bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] p-4 sm:p-7 rounded-3xl shadow-[var(--shadow-md)] overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-5 backdrop-blur-md">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent pointer-events-none opacity-50"></div>
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
            <span>Executive Command Center</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">{settings.companyName}</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            Live workforce telemetry and real-time attendance analytics for {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto shrink-0">
          <button
            onClick={() => {
              triggerHaptic();
              onOpenAddEmployee();
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40 active:scale-95 w-full"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            <span>New Employee</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              setRosterFilter('ALL');
              setIsRosterModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md active:scale-95 w-full"
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>Live Workforce Table</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              generateAttendanceReportPdf(todayRecords, settings, 'Daily Attendance Summary Report');
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md active:scale-95 w-full"
          >
            <FileDown className="w-4 h-4 text-emerald-400" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (Clickable to open Roster Table filtered to that category) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        
        {/* Card 1: Total Workforce (e.g. 9/15 Present) */}
        <div 
          onClick={() => {
            triggerHaptic();
            setRosterFilter('ALL');
            setIsRosterModalOpen(true);
          }}
          className="cursor-pointer group relative bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 p-4 sm:p-5 rounded-2xl border border-blue-500/30 shadow-lg hover:border-blue-400 transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Total Active</span>
            <Users className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-white">{presentTodayCount}</span>
            <span className="text-sm font-bold text-slate-400">/{totalEmployeesCount}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Present Today • Click for Table</p>
        </div>

        {/* Card 2: On Break (Live highlighted) */}
        <div 
          onClick={() => {
            triggerHaptic();
            setRosterFilter('On Break');
            setIsRosterModalOpen(true);
          }}
          className="cursor-pointer group relative bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 p-4 sm:p-5 rounded-2xl border border-amber-500/40 shadow-lg hover:border-amber-400 transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              On Break
            </span>
            <Coffee className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300">{onBreakCount}</div>
          <p className="text-[10px] text-amber-400/80 font-semibold mt-0.5">Live Break Sessions</p>
        </div>

        {/* Card 3: Late Arrivals */}
        <div 
          onClick={() => {
            triggerHaptic();
            setRosterFilter('Late');
            setIsRosterModalOpen(true);
          }}
          className="cursor-pointer group relative bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md hover:border-amber-500/40 transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Late Check-In</span>
            <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400">{lateTodayCount}</div>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">&gt; {settings.gracePeriodMinutes}m grace period</p>
        </div>

        {/* Card 4: Work From Home */}
        <div 
          onClick={() => {
            triggerHaptic();
            setRosterFilter('Work From Home');
            setIsRosterModalOpen(true);
          }}
          className="cursor-pointer group relative bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md hover:border-sky-500/40 transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider">WFH Active</span>
            <Home className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-black text-sky-300">{wfhTodayCount}</div>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Approved remote duty</p>
        </div>

        {/* Card 5: On Leave / LOP */}
        <div 
          onClick={() => {
            triggerHaptic();
            setRosterFilter('On Leave');
            setIsRosterModalOpen(true);
          }}
          className="cursor-pointer group relative bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md hover:border-purple-500/40 transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider">Leave & LOP</span>
            <Palmtree className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-black text-purple-300">{onLeaveCount + lopCount}</div>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{lopCount > 0 ? `${lopCount} LOP • ${onLeaveCount} Leave` : 'Sanctioned time-off'}</p>
        </div>

        {/* Card 6: Absent Today */}
        <div 
          onClick={() => {
            triggerHaptic();
            setRosterFilter('Absent');
            setIsRosterModalOpen(true);
          }}
          className="cursor-pointer group relative bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-md hover:border-rose-500/40 transition-all hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">Absent</span>
            <UserX className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-400">{absentTodayCount}</div>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Unexcused missing</p>
        </div>

      </div>

      {/* Main Analytics Row: Today's Status Pie Chart & 7-Day Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Pie Chart: Today's Live Workforce Distribution */}
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-blue-400" />
                Today's Workforce Status Breakdown
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Live distribution of all {totalEmployeesCount} active personnel</p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20">
              {todayStr}
            </span>
          </div>

          {/* SVG/Recharts Donut Pie */}
          <div className="h-56 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #1e293b', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-white">{presentTodayCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Present</span>
            </div>
          </div>

          {/* Legend Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-[11px]">
            {statusPieData.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  triggerHaptic();
                  const targetFilter = item.name.includes('Break') ? 'On Break' : item.name;
                  setRosterFilter(targetFilter);
                  setIsRosterModalOpen(true);
                }}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 font-semibold truncate text-[10px]">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-white text-xs ml-1">{item.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 7-Day Attendance Trend Area Chart */}
        <div className="lg:col-span-2 bg-slate-900/90 rounded-3xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                Attendance Trend (Past 7 Days)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Daily turnout of present, late, and absent personnel</p>
            </div>
            
            <button
              onClick={() => {
                triggerHaptic();
                setRosterFilter('ALL');
                setIsRosterModalOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Inspect Today's Roster</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #1e293b', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="Present" stroke="#10b981" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={3} />
                <Area type="monotone" dataKey="Late" stroke="#f59e0b" fillOpacity={1} fill="url(#colorLate)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present Turnout</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late Arrivals</span>
            </div>
            <span className="font-mono text-slate-500">Auto-synced</span>
          </div>
        </div>

      </div>

      {/* Live Activity Feed */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Live Check-In Activity Stream
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Real-time attendance events for {new Date().toLocaleDateString()}</p>
          </div>
          <button
            onClick={() => { triggerHaptic(); setRosterFilter('ALL'); setIsRosterModalOpen(true); }}
            className="text-xs font-bold text-blue-400 hover:text-white bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 px-4 py-2 rounded-xl flex items-center gap-1 transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <span>Open All Workforce Table</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-800">
          {recentCheckIns.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-medium space-y-2">
              <Clock className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
              <p>No check-in activity recorded yet for today.</p>
            </div>
          ) : (
            recentCheckIns.map((rec, i) => {
              const emp = employees.find(e => e.employeeId === rec.employeeCode || e.id === rec.employeeId);
              const isWfhRec = rec.isWfh === true || rec.status === 'Work From Home';
              return (
                <div 
                  key={rec.id || i}
                  onClick={() => emp && setSelectedEmployeeActivity({ employee: emp, record: rec })}
                  className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={emp?.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(rec.employeeName || 'User')}&background=0f172a&color=fff`}
                        alt={rec.employeeName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700/60 group-hover:border-blue-500/60 transition-all"
                      />
                      <span className={`w-2.5 h-2.5 rounded-full ${isWfhRec ? 'bg-sky-400' : 'bg-emerald-500'} absolute -bottom-0.5 -right-0.5 border-2 border-slate-900`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-bold text-white truncate group-hover:text-blue-300 transition-colors">{rec.employeeName}</span>
                        {isWfhRec && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                            <Home className="w-2.5 h-2.5" /> WFH
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{rec.employeeCode} • {rec.department}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] text-slate-500 font-mono block">Check In Time</span>
                      <span className="font-mono text-xs font-bold text-white">{rec.checkInAt ? toISTTimeString(rec.checkInAt) : '--'}</span>
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        emp && setSelectedEmployeeActivity({ employee: emp, record: rec });
                      }}
                      className="px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
                    >
                      <PieChartIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Inspect Day Pie</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. ALL-EMPLOYEE ROSTER TABLE MODAL (Triggered from 9/15 Box)   */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isRosterModalOpen && (
          <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-950 p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <h2 className="text-lg font-black text-white tracking-tight">Today's Live Workforce Roster &amp; Shift Table</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time status for {todayStr} • Click any employee to view their detailed activity pie chart &amp; work/break duration.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-xl border border-blue-500/20">
                    {filteredRoster.length} Personnel Listed
                  </span>
                  <button
                    onClick={() => setIsRosterModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filters & Search Row */}
              <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                <input
                  type="text"
                  placeholder="Search by employee name, ID, or department..."
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  className="w-full md:w-80 px-3.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />

                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs font-bold">
                  {[
                    { key: 'ALL', label: 'All Personnel', count: dailyRoster.length },
                    { key: 'Present', label: 'Present', count: presentTodayCount },
                    { key: 'On Break', label: 'On Break', count: onBreakCount },
                    { key: 'Late', label: 'Late', count: lateTodayCount },
                    { key: 'Work From Home', label: 'WFH', count: wfhTodayCount },
                    { key: 'On Leave', label: 'Leave', count: onLeaveCount },
                    { key: 'LOP', label: 'LOP', count: lopCount },
                    { key: 'Absent', label: 'Absent', count: absentTodayCount }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setRosterFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                        rosterFilter === tab.key
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-950/60 rounded-md">
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Roster Table Body */}
              <div className="overflow-y-auto flex-1 p-4 sm:p-6">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Today's Live Status</th>
                      <th className="py-3 px-4">Check In / Out</th>
                      <th className="py-3 px-4">Working &amp; Break Time</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredRoster.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                          No employees match the selected status or search filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRoster.map((item) => {
                        const emp = item.employee;
                        const rec = item.record;
                        const breakdown = computeDetailedBreakdown(rec, emp);

                        return (
                          <tr 
                            key={emp.id}
                            onClick={() => setSelectedEmployeeActivity({ employee: emp, record: rec })}
                            className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          >
                            {/* Employee Details */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=0f172a&color=fff`}
                                  alt={emp.fullName}
                                  className="w-9 h-9 rounded-xl object-cover border border-slate-700/60"
                                />
                                <div>
                                  <div className="font-bold text-white group-hover:text-blue-300 transition-colors">{emp.fullName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.employeeId}</div>
                                </div>
                              </div>
                            </td>

                            {/* Department */}
                            <td className="py-3 px-4 font-semibold text-slate-300">
                              <div>{emp.department || 'General'}</div>
                              <div className="text-[10px] text-slate-500">{emp.designation}</div>
                            </td>

                            {/* Status Badge */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold border ${getStatusBadgeClass(item.status)}`}>
                                  {item.status === 'On Break' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                                  {item.status === 'Present' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                  {item.status === 'Work From Home' && <Home className="w-3 h-3 text-sky-400" />}
                                  {item.status === 'On Leave' && <Palmtree className="w-3 h-3 text-purple-400" />}
                                  {item.status === 'Absent' && <UserX className="w-3 h-3 text-rose-400" />}
                                  <span>{item.status}</span>
                                  {item.activeBreak && (
                                    <span className="font-mono text-amber-300 ml-1">({item.activeBreak.type})</span>
                                  )}
                                </span>
                                {/* Admin WFH Override Button — always visible when status is WFH but employee has a real check-in */}
                                {item.status === 'Work From Home' && item.record?.checkInAt && (
                                  <button
                                    onClick={(e) => removeWfhOverride(item.record!, item.employee, e)}
                                    title="Remove WFH — mark as Present/Late based on check-in time"
                                    className="ml-1 px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-[10px] rounded-lg inline-flex items-center gap-1 transition-all"
                                  >
                                    <X className="w-2.5 h-2.5" /> Remove WFH
                                  </button>
                                )}
                                {/* Fix DB button — record has isWfh=true but display already shows correct status */}
                                {item.record?.isWfh && item.status !== 'Work From Home' && (
                                  <button
                                    onClick={(e) => removeWfhOverride(item.record!, item.employee, e)}
                                    title="Fix WFH flag in database"
                                    className="ml-1 px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-[10px] rounded-lg inline-flex items-center gap-1 transition-all"
                                  >
                                    <ShieldCheck className="w-2.5 h-2.5" /> Fix DB
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Check In / Out */}
                            <td className="py-3 px-4 font-mono text-xs">
                              {rec?.checkInAt ? (
                                <div className="space-y-1">
                                  <div className={`font-bold flex items-center gap-1.5 ${item.isLate ? 'text-orange-500 font-black' : item.isWfh ? 'text-sky-400' : 'text-emerald-400'}`}>
                                    <span className={`w-2 h-2 rounded-full ${item.isLate ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)] animate-pulse' : item.isWfh ? 'bg-sky-400' : 'bg-emerald-400'}`} />
                                    <span className={item.isLate ? 'text-orange-500 font-black tracking-wide' : ''}>In: {toISTTimeString(rec.checkInAt)}</span>
                                    {item.isLate && (
                                      <span className="text-[9px] font-sans font-bold text-orange-400 bg-orange-500/15 border border-orange-500/30 px-1 py-0.2 rounded ml-1">
                                        LATE
                                      </span>
                                    )}
                                    {item.isWfh && <span className="text-[9px] text-sky-300 font-sans font-extrabold bg-sky-500/20 px-1.5 py-0.2 rounded border border-sky-500/30">WFH</span>}
                                  </div>
                                  <div className="text-slate-400 text-[10px]">
                                    Out: {rec.checkOutAt ? toISTTimeString(rec.checkOutAt) : item.isCheckedIn ? 'Active Now' : '--:--'}
                                  </div>
                                </div>
                              ) : item.status === 'Work From Home' ? (
                                <div className="space-y-0.5">
                                  <span className="text-sky-400 font-bold flex items-center gap-1">
                                    <Home className="w-3 h-3 text-sky-400" />
                                    <span>WFH (Remote Duty)</span>
                                  </span>
                                  <div className="text-[10px] text-slate-500 font-sans">Pending Check-In</div>
                                </div>
                              ) : (
                                <span className="text-slate-600 font-bold">Not Checked In</span>
                              )}
                            </td>

                            {/* Working & Break Duration */}
                            <td className="py-3 px-4 font-mono text-xs">
                              {rec?.checkInAt ? (
                                <div className="space-y-0.5">
                                  <div className="text-white font-bold">
                                    Work: {Math.floor(breakdown.workingMins / 60)}h {breakdown.workingMins % 60}m
                                  </div>
                                  <div className="text-amber-400 text-[10px]">
                                    Break: {Math.floor(breakdown.totalBreakMins / 60)}h {breakdown.totalBreakMins % 60}m
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600">--</span>
                              )}
                            </td>

                            {/* Action Button */}
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmployeeActivity({ employee: emp, record: rec });
                                }}
                                className="px-3.5 py-1.5 bg-blue-600/10 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-all shadow-sm"
                              >
                                <PieChartIcon className="w-3.5 h-3.5 text-blue-400" />
                                <span>Inspect Live Day Pie</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 2. EMPLOYEE LIVE DAY ACTIVITY & DONUT PIE CHART MODAL          */}
      {/* ============================================================== */}
      <AnimatePresence>
        {selectedEmployeeActivity && (
          <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border-2 border-blue-500/40 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-slate-950 p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedEmployeeActivity.employee.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployeeActivity.employee.fullName)}&background=0f172a&color=fff`}
                    alt={selectedEmployeeActivity.employee.fullName}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-blue-500/50 shadow-md shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">{selectedEmployeeActivity.employee.fullName}</h3>
                      <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                        {selectedEmployeeActivity.employee.employeeId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {selectedEmployeeActivity.employee.designation} • {selectedEmployeeActivity.employee.department}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEmployeeActivity(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
                
                {/* Top Timing Metrics Cards */}
                {(() => {
                  const rec = selectedEmployeeActivity.record;
                  const breakdown = computeDetailedBreakdown(rec, selectedEmployeeActivity.employee);
                  const activeBreak = rec?.breaks?.find(b => !b.endAt && !(b as any).endTime);

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Check-In Time</span>
                          <span className="font-mono text-sm font-black text-emerald-400">
                            {rec?.checkInAt ? toISTTimeString(rec.checkInAt) : 'Not Checked In'}
                          </span>
                        </div>

                        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Check-Out Time</span>
                          <span className="font-mono text-sm font-black text-rose-400">
                            {rec?.checkOutAt ? toISTTimeString(rec.checkOutAt) : rec?.checkInAt ? 'Active Shift' : '--:--'}
                          </span>
                        </div>

                        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Worked Time</span>
                          <span className="font-mono text-sm font-black text-white">
                            {Math.floor(breakdown.workingMins / 60)}h {breakdown.workingMins % 60}m
                          </span>
                        </div>

                        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Break Duration</span>
                          <span className="font-mono text-sm font-black text-amber-400">
                            {Math.floor(breakdown.totalBreakMins / 60)}h {breakdown.totalBreakMins % 60}m
                          </span>
                        </div>
                      </div>

                      {/* Active Break Alert if employee is currently on break */}
                      {activeBreak && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-2xl flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                              <Coffee className="w-5 h-5 animate-pulse" />
                            </span>
                            <div>
                              <div className="font-black text-amber-300 text-sm">Currently On {activeBreak.type}</div>
                              <div className="text-[11px] text-slate-400">
                                Started at {activeBreak.startAt ? toISTTimeString(activeBreak.startAt) : 'recently'}
                              </div>
                            </div>
                          </div>
                          <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs animate-pulse">
                            Break Active
                          </span>
                        </div>
                      )}

                      {/* Donut Chart & Activity Legend */}
                      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-blue-400" />
                            Live Shift Productivity &amp; Break Time Distribution
                          </h4>
                          <span className="font-mono text-xs font-bold text-slate-300">
                            Total Shift: {Math.floor(breakdown.grandTotalMins / 60)}h {breakdown.grandTotalMins % 60}m
                          </span>
                        </div>

                        {breakdown.categories.length === 0 ? (
                          <div className="py-8 text-center text-slate-500 text-xs">
                            No shift activities or working hours recorded for this employee today.
                          </div>
                        ) : (
                          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            {/* Donut Pie Chart */}
                            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={breakdown.categories}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={3}
                                    dataKey="value"
                                  >
                                    {breakdown.categories.map((entry, index) => (
                                      <Cell key={`slice-${index}`} fill={entry.color} stroke="#020617" strokeWidth={2} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    formatter={(val: any) => [`${Math.floor(Number(val) / 60)}h ${Number(val) % 60}m`, 'Duration']}
                                    contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #1e293b', color: '#fff', fontSize: '12px' }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                                <span className="text-base font-black text-emerald-400 font-mono">
                                  {breakdown.grandTotalMins > 0 ? `${Math.round((breakdown.workingMins / breakdown.grandTotalMins) * 100)}%` : '0%'}
                                </span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Productivity</span>
                              </div>
                            </div>

                            {/* Legend Cards */}
                            <div className="flex-1 grid grid-cols-2 gap-2 text-xs w-full">
                              {breakdown.categories.map((cat, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                    <span className="text-slate-300 font-semibold truncate text-[11px]">{cat.name}</span>
                                  </div>
                                  <span className="font-mono font-bold text-white text-xs shrink-0 ml-2">
                                    {cat.value >= 60 ? `${Math.floor(cat.value / 60)}h ${cat.value % 60}m` : `${cat.value}m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chronological Event Log */}
                      {rec?.breaks && rec.breaks.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-400" />
                            Chronological Break &amp; Shift Event Logs
                          </h4>

                          <div className="space-y-2">
                            {rec.breaks.map((b, idx) => (
                              <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2.5">
                                  <Coffee className="w-4 h-4 text-amber-400" />
                                  <div>
                                    <span className="font-bold text-white">{b.type}</span>
                                    <span className="text-slate-500 text-[10px] ml-2">
                                      {b.startAt ? toISTTimeString(b.startAt) : '--'} ➔ {b.endAt ? toISTTimeString(b.endAt) : 'Ongoing'}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                  {b.durationMinutes || 15}m
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
