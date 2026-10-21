import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  Calendar,
  Users,
  Palmtree,
  AlertTriangle,
  HeartPulse,
  Laptop,
  Layers,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Info,
  CalendarDays,
  Clock,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '../../../hooks/useHaptic';
import {
  DateRangePreset,
  buildDateRangeInterval,
  calculateLeaveAnalytics,
  EmployeeLeaveMetric
} from '../../../lib/leaveAnalyticsService';
import { LeaveAnalyticsCharts } from './LeaveAnalyticsCharts';
import { EmployeeLeaveTable } from './EmployeeLeaveTable';
import { EmployeeLeaveDetailModal } from './EmployeeLeaveDetailModal';
import { todayInIST } from '../../../lib/absoluteTime';
import { isExecutiveOrLeadership } from '../../../lib/attendanceEngine';

interface LeaveAnalyticsDashboardProps {
  onNavigateTab?: (tab: string) => void;
}

export const LeaveAnalyticsDashboard: React.FC<LeaveAnalyticsDashboardProps> = ({
  onNavigateTab
}) => {
  const { employees, leaveRequests, attendance, settings, activeEmployee, role } = useAuth();
  const { triggerHaptic } = useHaptic();

  const effectiveRole = activeEmployee?.role || role;
  const isExecutive = effectiveRole === 'SUPER_ADMIN';
  const isHr = effectiveRole === 'HR_ADMIN';
  const isAdmin = isExecutive || isHr;

  // Filter States
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('7d');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const today = todayInIST();
    const [y, m, d] = today.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 6, 12, 0, 0));
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => todayInIST());

  // Modal State for inspecting individual employee
  const [inspectedEmployee, setInspectedEmployee] = useState<EmployeeLeaveMetric | null>(null);

  // Chart 4 Selection State
  const [chartSelectedEmployee, setChartSelectedEmployee] = useState<EmployeeLeaveMetric | null>(null);

  // Compute canonical interval
  const interval = useMemo(() => {
    return buildDateRangeInterval(selectedPreset, customStartDate, customEndDate);
  }, [selectedPreset, customStartDate, customEndDate]);

  // Compute analytics
  const analytics = useMemo(() => {
    return calculateLeaveAnalytics(
      employees || [],
      leaveRequests || [],
      attendance || [],
      settings,
      interval
    );
  }, [employees, leaveRequests, attendance, settings, interval]);

  // Keep inspected and chart selected employee synchronized when data changes
  useEffect(() => {
    if (inspectedEmployee) {
      const refreshed = analytics.employeeMetrics.find(m => m.employeeId === inspectedEmployee.employeeId);
      if (refreshed) setInspectedEmployee(refreshed);
    }
    if (chartSelectedEmployee) {
      const refreshed = analytics.employeeMetrics.find(m => m.employeeId === chartSelectedEmployee.employeeId);
      if (refreshed) setChartSelectedEmployee(refreshed);
    } else if (analytics.employeeMetrics.length > 0) {
      setChartSelectedEmployee(analytics.employeeMetrics[0]);
    }
  }, [analytics]);

  const handleSelectPreset = (preset: DateRangePreset) => {
    triggerHaptic();
    setSelectedPreset(preset);
  };

  const handleOpenEmployeeDetail = (emp: EmployeeLeaveMetric) => {
    triggerHaptic();
    setInspectedEmployee(emp);
    setChartSelectedEmployee(emp);
  };

  // Permission Guard
  if (!isAdmin) {
    return (
      <div className="bg-slate-900 border border-rose-900/50 rounded-3xl p-8 max-w-2xl mx-auto my-12 text-center space-y-4 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-white">Leave Analytics Restricted</h2>
        <p className="text-xs text-slate-300 leading-relaxed max-w-lg mx-auto">
          Company-wide Leave &amp; LOP Analytics is strictly restricted to authorized company{' '}
          <strong className="text-white font-black">Executives and HR Administrators</strong>.
        </p>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('dashboard')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Return to Dashboard
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-12 animate-in fade-in duration-300">
      {/* ─── Top Header Banner ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start gap-4 relative z-10">
          <div className="p-3.5 bg-gradient-to-tr from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl shrink-0 text-blue-400">
            <CalendarDays className="w-8 h-8" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Enterprise Leave Intelligence
              </span>
              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                Timezone: <strong className="text-slate-300">Asia/Kolkata</strong>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Admin Leave Analytics &amp; Loss of Pay (LOP) Dashboard
            </h1>

            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Consolidated intelligence on company leave consumption, unexcused Loss of Pay (LOP), Earned Leave (EL), Sick Leave (SL), and remote Work From Home days with zero duplicate counting.
            </p>
          </div>
        </div>

        {/* Quick Nav & Info Badge */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0 relative z-10">
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-2.5 text-right">
            <span className="text-[9px] text-slate-500 font-bold uppercase block">Active Workforce</span>
            <span className="text-sm font-extrabold text-white font-mono">
              {analytics.totalActiveEmployees} Employees
            </span>
          </div>

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('leave_approvals')}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-2xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>Leave Inbox</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Date Range Filter Toolbar ───────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Reporting Range:</span>
            </span>

            {/* Presets buttons */}
            {(['1d', '7d', '15d', '30d', 'custom'] as DateRangePreset[]).map(preset => {
              const labelMap: Record<DateRangePreset, string> = {
                '1d': 'Today / Last 1 Day',
                '7d': 'Last 7 Days',
                '15d': 'Last 15 Days',
                '30d': 'Last 30 Days',
                'custom': 'Custom Range'
              };

              return (
                <button
                  key={preset}
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedPreset === preset
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400/30'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {labelMap[preset]}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers */}
          {selectedPreset === 'custom' && (
            <div className="flex items-center gap-2 self-start md:self-auto bg-slate-950 p-1.5 rounded-2xl border border-slate-800 animate-in fade-in">
              <div className="flex items-center gap-1 px-2 text-xs text-slate-400">
                <span>From</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <span className="text-slate-600 text-xs">to</span>

              <div className="flex items-center gap-1 px-2 text-xs text-slate-400">
                <span>To</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Current Active Interval Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Active Window: <strong className="text-white">{interval.label}</strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-slate-400">
              {interval.daysCount} calendar {interval.daysCount === 1 ? 'day' : 'days'} inclusive
            </span>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            Calendar boundary: {interval.startDate} → {interval.endDate}
          </div>
        </div>
      </div>

      {/* ─── 6 KPI Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Total Active Employees */}
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              1. Total Employees
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-2 font-mono">
            {analytics.totalActiveEmployees}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>Active Team Members</span>
            <span className="text-slate-500 font-mono">Company</span>
          </div>
        </div>

        {/* Card 2: Employees on Leave */}
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block">
              2. On Leave (Period)
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Palmtree className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-purple-300 mt-2 font-mono">
            {analytics.employeesOnLeaveCount}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span>Unique staff on leave</span>
            <span className="text-purple-400 font-mono text-[10px]">
              {analytics.totalActiveEmployees > 0 
                ? `${Math.round((analytics.employeesOnLeaveCount / analytics.totalActiveEmployees) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Card 3: Total LOP Days */}
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 block">
              3. Total LOP Days
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-rose-300 mt-2 font-mono">
            {analytics.totalLopDays}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span className="text-rose-400 font-medium">
              {analytics.uniqueLopEmployeesCount} {analytics.uniqueLopEmployeesCount === 1 ? 'staff' : 'staff'} affected
            </span>
            <span className="text-slate-500 font-mono text-[10px]">Unpaid</span>
          </div>
        </div>

        {/* Card 4: Total EL Days */}
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">
              4. Total EL Days
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-300 mt-2 font-mono">
            {analytics.totalElDays}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span className="text-blue-400 font-medium">
              {analytics.uniqueElEmployeesCount} {analytics.uniqueElEmployeesCount === 1 ? 'staff' : 'staff'} took EL
            </span>
            <span className="text-slate-500 font-mono text-[10px]">Paid</span>
          </div>
        </div>

        {/* Card 5: Total SL Days */}
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
              5. Total SL Days
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-300 mt-2 font-mono">
            {analytics.totalSlDays}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span className="text-amber-400 font-medium">
              {analytics.uniqueSlEmployeesCount} {analytics.uniqueSlEmployeesCount === 1 ? 'staff' : 'staff'} took SL
            </span>
            <span className="text-slate-500 font-mono text-[10px]">Medical</span>
          </div>
        </div>

        {/* Card 6: Total WFH Days (Reported Separately) */}
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
              6. Total WFH Days
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Laptop className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-cyan-300 mt-2 font-mono">
            {analytics.totalWfhDays}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/60">
            <span className="text-cyan-400 font-medium">
              {analytics.uniqueWfhEmployeesCount} {analytics.uniqueWfhEmployeesCount === 1 ? 'staff' : 'staff'} remote
            </span>
            <span className="text-slate-500 font-mono text-[10px]">Non-Leave</span>
          </div>
        </div>
      </div>

      {/* ─── Graphical Visualizations (4 Charts) ─────────────────────────── */}
      <LeaveAnalyticsCharts
        analytics={analytics}
        selectedEmployee={chartSelectedEmployee}
        onSelectEmployee={(emp) => {
          setChartSelectedEmployee(emp);
          setInspectedEmployee(emp);
        }}
      />

      {/* ─── Employee-Wise Leave Table ─────────────────────────────────────── */}
      <EmployeeLeaveTable
        metrics={analytics.employeeMetrics}
        onSelectEmployee={handleOpenEmployeeDetail}
      />

      {/* ─── Modal: Individual Employee Leave Details ───────────────────────── */}
      {inspectedEmployee && (
        <EmployeeLeaveDetailModal
          metric={inspectedEmployee}
          rawEmployee={employees.find(e => e.id === inspectedEmployee.employeeId)}
          initialPreset={selectedPreset}
          initialCustomStart={customStartDate}
          initialCustomEnd={customEndDate}
          onClose={() => setInspectedEmployee(null)}
          onIntervalChange={(preset, start, end) => {
            setSelectedPreset(preset);
            if (start && end) {
              setCustomStartDate(start);
              setCustomEndDate(end);
            }
          }}
        />
      )}
    </div>
  );
};
