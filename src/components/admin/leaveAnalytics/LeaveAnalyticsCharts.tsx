import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import {
  PieChart as PieChartIcon,
  TrendingUp,
  BarChart3,
  User,
  Layers,
  ChevronDown,
  Info,
  Calendar
} from 'lucide-react';
import {
  LeaveAnalyticsSummary,
  EmployeeLeaveMetric,
  DailyLeaveTrendPoint
} from '../../../lib/leaveAnalyticsService';

interface LeaveAnalyticsChartsProps {
  analytics: LeaveAnalyticsSummary;
  selectedEmployee: EmployeeLeaveMetric | null;
  onSelectEmployee: (emp: EmployeeLeaveMetric) => void;
}

const COLORS = {
  el: '#3b82f6',   // Blue for Earned Leave
  sl: '#f59e0b',   // Amber for Sick Leave
  lop: '#f43f5e',  // Rose / Red for Loss of Pay
  wfh: '#06b6d4',  // Cyan for WFH
};

export const LeaveAnalyticsCharts: React.FC<LeaveAnalyticsChartsProps> = ({
  analytics,
  selectedEmployee,
  onSelectEmployee
}) => {
  // Chart 3 filter: which leave type to compare employees by
  const [comparisonType, setComparisonType] = useState<'total' | 'lop' | 'el' | 'sl'>('total');

  // Chart 1 Data: Leave Type Distribution
  const pieData = [
    { name: 'Earned Leave (EL)', value: analytics.totalElDays, color: COLORS.el, isLeave: true },
    { name: 'Sick Leave (SL)', value: analytics.totalSlDays, color: COLORS.sl, isLeave: true },
    { name: 'Loss of Pay (LOP)', value: analytics.totalLopDays, color: COLORS.lop, isLeave: true },
    { name: 'Work From Home (WFH)', value: analytics.totalWfhDays, color: COLORS.wfh, isLeave: false }
  ].filter(d => d.value > 0);

  // Chart 3 Data: Top employees sorted by selected metric
  const sortedEmployees = [...analytics.employeeMetrics]
    .map(emp => {
      let metricValue = 0;
      if (comparisonType === 'total') metricValue = emp.totalLeaveDays;
      else if (comparisonType === 'lop') metricValue = emp.lopDays;
      else if (comparisonType === 'el') metricValue = emp.elDays;
      else if (comparisonType === 'sl') metricValue = emp.slDays;

      return {
        ...emp,
        metricValue,
        shortName: emp.fullName.length > 15 ? emp.fullName.slice(0, 13) + '..' : emp.fullName
      };
    })
    .filter(emp => emp.metricValue > 0)
    .sort((a, b) => b.metricValue - a.metricValue)
    .slice(0, 10); // top 10

  // Chart 4 Employee Composition: selected employee
  const currentSelected = selectedEmployee || (analytics.employeeMetrics.length > 0 ? analytics.employeeMetrics[0] : null);

  const compositionData = currentSelected ? [
    { name: 'Earned Leave (EL)', days: currentSelected.elDays, fill: COLORS.el },
    { name: 'Sick Leave (SL)', days: currentSelected.slDays, fill: COLORS.sl },
    { name: 'Loss of Pay (LOP)', days: currentSelected.lopDays, fill: COLORS.lop },
    { name: 'Work From Home (WFH)', days: currentSelected.wfhDays, fill: COLORS.wfh }
  ] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ─── Chart 1: Leave Type Distribution ─────────────────────────────── */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <PieChartIcon className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Leave Type Distribution
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Overall proportion of EL, SL, LOP, and remote WFH days taken.
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Leave Days</span>
            <span className="text-lg font-black text-white font-mono">{analytics.totalLeaveDays}</span>
          </div>
        </div>

        {pieData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-2xl border border-slate-800/80">
            <Info className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-bold text-white">No Leave or WFH Recorded</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Zero leave or LOP days fell within this reporting window.
            </p>
          </div>
        ) : (
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${value}d`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-950/95 border border-slate-800 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                            <span>{data.name}</span>
                          </p>
                          <p className="text-slate-300 font-mono">
                            Total Days: <strong className="text-white">{data.value}</strong>
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {data.isLeave ? 'Counted in Total Leave' : 'Reported separately (Non-Leave)'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(val, entry: any) => (
                    <span className="text-xs text-slate-300 font-medium mr-3">{val}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Breakdown pill indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
            <span className="text-[9px] text-blue-400 font-bold uppercase block">EL Days</span>
            <span className="text-sm font-black text-blue-300 font-mono">{analytics.totalElDays}</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <span className="text-[9px] text-amber-400 font-bold uppercase block">SL Days</span>
            <span className="text-sm font-black text-amber-300 font-mono">{analytics.totalSlDays}</span>
          </div>
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
            <span className="text-[9px] text-rose-400 font-bold uppercase block">LOP Days</span>
            <span className="text-sm font-black text-rose-300 font-mono">{analytics.totalLopDays}</span>
          </div>
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
            <span className="text-[9px] text-cyan-400 font-bold uppercase block">WFH (Remote)</span>
            <span className="text-sm font-black text-cyan-300 font-mono">{analytics.totalWfhDays}</span>
          </div>
        </div>
      </div>

      {/* ─── Chart 2: Daily Leave Trend ──────────────────────────────────── */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Daily Leave Trend
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {analytics.interval.preset === '1d' 
                ? 'Breakdown of leave taken on this day.'
                : `Day-by-day pattern of EL, SL, and LOP across ${analytics.interval.daysCount} days.`}
            </p>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 font-mono text-[11px] font-bold shrink-0">
            {analytics.interval.daysCount} {analytics.interval.daysCount === 1 ? 'Day' : 'Days'}
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis 
                dataKey="displayDate" 
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis 
                tick={{ fill: '#64748b', fontSize: 10 }} 
                axisLine={{ stroke: '#334155' }}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const el = payload.find(p => p.dataKey === 'elDays')?.value || 0;
                    const sl = payload.find(p => p.dataKey === 'slDays')?.value || 0;
                    const lop = payload.find(p => p.dataKey === 'lopDays')?.value || 0;
                    const wfh = payload.find(p => p.dataKey === 'wfhDays')?.value || 0;
                    const total = Number(el) + Number(sl) + Number(lop);

                    return (
                      <div className="p-3 bg-slate-950/95 border border-slate-800 rounded-xl shadow-xl text-xs space-y-1.5">
                        <p className="font-black text-white border-b border-slate-800 pb-1">{label}</p>
                        <div className="space-y-1 font-mono text-[11px]">
                          <p className="text-blue-400">Earned Leave: <strong className="text-white">{el}d</strong></p>
                          <p className="text-amber-400">Sick Leave: <strong className="text-white">{sl}d</strong></p>
                          <p className="text-rose-400">Loss of Pay: <strong className="text-white">{lop}d</strong></p>
                          <p className="text-cyan-400">WFH (Remote): <strong className="text-white">{wfh}d</strong></p>
                        </div>
                        <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 font-bold">
                          Total Leave Taken: <span className="text-white">{total} days</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={30}
                formatter={(val) => {
                  const labelMap: Record<string, string> = {
                    elDays: 'EL (Earned)',
                    slDays: 'SL (Sick)',
                    lopDays: 'LOP (Loss of Pay)',
                    wfhDays: 'WFH (Remote)'
                  };
                  return <span className="text-xs text-slate-300 font-medium mr-2">{labelMap[val] || val}</span>;
                }}
              />
              <Bar dataKey="elDays" stackId="leave" fill={COLORS.el} radius={[0, 0, 0, 0]} />
              <Bar dataKey="slDays" stackId="leave" fill={COLORS.sl} radius={[0, 0, 0, 0]} />
              <Bar dataKey="lopDays" stackId="leave" fill={COLORS.lop} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
          <span>* Bars show stacked leave days (EL + SL + LOP).</span>
          <span>Asia/Kolkata Calendar Dates</span>
        </div>
      </div>

      {/* ─── Chart 3: Employee-Wise Leave Comparison ─────────────────────── */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-blue-500/20">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Top Employees by Leave
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Compare individual employees taking the most leave or LOP.
            </p>
          </div>

          {/* Metric switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            {(['total', 'lop', 'el', 'sl'] as const).map(type => (
              <button
                key={type}
                onClick={() => setComparisonType(type)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  comparisonType === type
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {type === 'total' ? 'All Leave' : type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {sortedEmployees.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-2xl border border-slate-800/80">
            <Info className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-bold text-white">No Employees Met Criteria</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              No employee took {comparisonType === 'total' ? 'any leave' : comparisonType.toUpperCase()} in this period.
            </p>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                layout="vertical"
                data={sortedEmployees} 
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                <YAxis 
                  dataKey="shortName" 
                  type="category" 
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  width={90}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const emp = payload[0].payload as EmployeeLeaveMetric & { metricValue: number };
                      return (
                        <div className="p-3 bg-slate-950/95 border border-slate-800 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{emp.fullName}</p>
                          <p className="text-slate-400 text-[10px]">{emp.department} • {emp.employeeCode}</p>
                          <div className="pt-1.5 border-t border-slate-800 space-y-0.5 text-xs font-mono">
                            <p className="text-rose-400">LOP: <strong className="text-white">{emp.lopDays}d</strong></p>
                            <p className="text-blue-400">EL: <strong className="text-white">{emp.elDays}d</strong></p>
                            <p className="text-amber-400">SL: <strong className="text-white">{emp.slDays}d</strong></p>
                            <p className="text-cyan-400">WFH: <strong className="text-white">{emp.wfhDays}d</strong></p>
                            <p className="text-purple-400 font-bold pt-1 border-t border-slate-800">
                              Total Leave: <strong className="text-white">{emp.totalLeaveDays}d</strong>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="metricValue" 
                  fill={
                    comparisonType === 'lop' ? COLORS.lop :
                    comparisonType === 'el' ? COLORS.el :
                    comparisonType === 'sl' ? COLORS.sl :
                    '#8b5cf6'
                  }
                  radius={[0, 6, 6, 0]}
                  onClick={(entry) => onSelectEmployee(entry as any)}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
          <span>Click any employee bar to inspect detailed leave history.</span>
          <span className="font-mono">Top {sortedEmployees.length} staff</span>
        </div>
      </div>

      {/* ─── Chart 4: Employee Leave Composition ─────────────────────────── */}
      <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Layers className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Employee Leave Composition
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Select an individual employee to view their detailed leave breakdown.
            </p>
          </div>

          {/* Employee Dropdown Selector */}
          <div className="relative shrink-0">
            <select
              value={currentSelected?.employeeId || ''}
              onChange={(e) => {
                const found = analytics.employeeMetrics.find(m => m.employeeId === e.target.value);
                if (found) onSelectEmployee(found);
              }}
              className="pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500 appearance-none font-medium cursor-pointer"
            >
              {analytics.employeeMetrics.map(emp => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.fullName} ({emp.employeeCode || emp.employeeId})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {currentSelected ? (
          <div className="space-y-4">
            {/* Employee Quick Info Badge */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {currentSelected.avatarUrl ? (
                  <img src={currentSelected.avatarUrl} alt="" className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                    {currentSelected.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-black text-white">{currentSelected.fullName}</h4>
                  <p className="text-[10px] text-slate-400">{currentSelected.department} • {currentSelected.designation}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">Total Leave</span>
                <span className="text-base font-black text-purple-400 font-mono">
                  {currentSelected.totalLeaveDays} <span className="text-xs font-normal">days</span>
                </span>
              </div>
            </div>

            {/* Composition Bars */}
            <div className="space-y-3 pt-1">
              {compositionData.map(item => {
                const maxVal = Math.max(1, currentSelected.totalLeaveDays + currentSelected.wfhDays);
                const percent = Math.round((item.days / maxVal) * 100);

                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                        {item.name}
                      </span>
                      <span className="font-mono text-white font-bold">
                        {item.days} <span className="text-slate-400 font-normal">days</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%`, backgroundColor: item.fill }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-xs text-slate-500">
            No employees available to display.
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
          <span>Available Balances: EL ({currentSelected?.currentEarnLeaveBalance || 0}) • SL ({currentSelected?.currentSickLeaveBalance || 0})</span>
          <button
            onClick={() => currentSelected && onSelectEmployee(currentSelected)}
            className="text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
          >
            View Full Employee Profile →
          </button>
        </div>
      </div>
    </div>
  );
};
