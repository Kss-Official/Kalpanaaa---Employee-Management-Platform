import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../common/StatCard';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Palmtree, 
  QrCode, 
  Plus, 
  FileDown, 
  ArrowUpRight,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle
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
  Legend 
} from 'recharts';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenAddEmployee: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab, onOpenAddEmployee }) => {
  const { employees, attendance, settings, activeEmployee } = useAuth();
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month'>('today');

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };
  const displayName = activeEmployee?.fullName?.split(' ')[0] || 'there';

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = attendance.filter(a => a.date === todayStr);

  const totalEmployeesCount = employees.filter(e => e.status === 'Active').length;
  const presentTodayCount = todayRecords.filter(a => a.status === 'Present').length;
  const lateTodayCount = todayRecords.filter(a => a.status === 'Late').length;
  const absentTodayCount = todayRecords.filter(a => a.status === 'Absent').length;
  const onLeaveCount = employees.filter(e => e.status === 'On Leave').length;
  const currentlyCheckedInCount = todayRecords.filter(a => a.checkInAt && !a.checkOutAt).length;

  // Compute 7-day attendance trend chart data
  const trendData = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const dStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayRecs = attendance.filter(a => a.date === dStr);

    return {
      date: dayLabel,
      Present: dayRecs.filter(a => a.status === 'Present').length,
      Late: dayRecs.filter(a => a.status === 'Late').length,
      Absent: dayRecs.filter(a => a.status === 'Absent').length,
    };
  });

  // Department Stats
  const departments = Array.from(new Set(employees.map(e => e.department)));
  const deptData = departments.map(dept => {
    const deptEmps = employees.filter(e => e.department === dept);
    const deptPresent = todayRecords.filter(a => a.department === dept && (a.status === 'Present' || a.status === 'Late')).length;
    return {
      department: dept,
      Total: deptEmps.length,
      Present: deptPresent
    };
  });

  const recentCheckIns = todayRecords
    .filter(a => a.checkInAt)
    .sort((a, b) => new Date(b.checkInAt!).getTime() - new Date(a.checkInAt!).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            <span>Enterprise Workforce Overview</span>
            <span>•</span>
            <span>{settings.companyName}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{getGreeting()}, {displayName} 👋</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time workforce activity and attendance status for {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenAddEmployee}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>

          <button
            onClick={() => onNavigateTab('qr_kiosk')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Scanner Kiosk
          </button>

          <button
            onClick={() => generateAttendanceReportPdf(todayRecords, settings, 'Daily Attendance Summary Report')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            Export Daily PDF
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Workforce"
          value={totalEmployeesCount}
          subtext="Active Employees"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Present Today"
          value={presentTodayCount}
          subtext={`${Math.round((presentTodayCount / (totalEmployeesCount || 1)) * 100)}% attendance rate`}
          icon={UserCheck}
          color="emerald"
        />
        <StatCard
          title="Late Arrivals"
          value={lateTodayCount}
          subtext={`Grace > ${settings.gracePeriodMinutes} mins`}
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Absent Today"
          value={absentTodayCount}
          subtext="Unexcused missing"
          icon={UserX}
          color="rose"
        />
        <StatCard
          title="On Leave"
          value={onLeaveCount}
          subtext="Approved HR leaves"
          icon={Palmtree}
          color="purple"
        />
        <StatCard
          title="Active Checked-In"
          value={currentlyCheckedInCount}
          subtext="Currently on premises"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Trend Chart */}
        <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-white">Attendance Trend (Past 7 Days)</h3>
              <p className="text-xs text-slate-400">Daily breakdown of present, late, and absent employees</p>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg text-xs font-medium border border-slate-800">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${dateFilter === 'today' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${dateFilter === 'week' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
              >
                7 Days
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #1e293b', color: '#ffffff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="Present" stroke="#10b981" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={2} />
                <Area type="monotone" dataKey="Late" stroke="#f59e0b" fillOpacity={1} fill="url(#colorLate)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Stats Bar Chart */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-white">Department Turnout</h3>
            <p className="text-xs text-slate-400">Present vs Total employees per department</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderRadius: '12px', border: '1px solid #1e293b', color: '#ffffff', fontSize: '12px' }}
                />
                <Bar dataKey="Total" fill="#334155" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Present" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Recent Attendance Ticker */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Live Attendance Feed</h3>
            <p className="text-xs text-slate-400">Most recent employee check-ins recorded today</p>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
          >
            View All Records
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCheckIns.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-medium">
            No check-in activity recorded yet for today.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentCheckIns.map(rec => {
              const checkInFormatted = new Date(rec.checkInAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={rec.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      rec.status === 'Present' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {rec.employeeName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{rec.employeeName}</p>
                      <p className="text-[11px] text-slate-400">{rec.employeeCode} • {rec.department}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-white">{checkInFormatted}</div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 justify-end">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${rec.locationVerified ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      {rec.locationVerified ? 'GPS Verified' : 'Standard'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
