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
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenAddEmployee: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab, onOpenAddEmployee }) => {
  const { employees, attendance, settings, activeEmployee, auditLogs } = useAuth();
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
      <div className="relative bg-slate-900/90 border border-slate-800/80 p-8 rounded-2xl shadow-sm overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Subtle engineering background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900/0 to-slate-900/0 pointer-events-none opacity-50"></div>
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">
            <span>Executive Command Center</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{settings.companyName}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            System overview and workforce analytics for {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenAddEmployee}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-900 text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            New Employee
          </button>


          <button
            onClick={async () => {
              const todayStr = new Date().toISOString().split('T')[0];
              const checkinLogs = auditLogs.filter(log => log.action === 'ATTENDANCE_CHECKIN' && log.timestamp.startsWith(todayStr));
              if (checkinLogs.length === 0) {
                alert('No check-ins found in Audit Logs for today.'); return;
              }
              let restored = 0;
              for (const log of checkinLogs) {
                const match = log.target.match(/^(.*?)\s\(/);
                const empCode = match ? match[1] : log.target;
                const emp = employees.find(e => e.employeeId === empCode);
                if (!emp) continue;
                const recordId = `att-${emp.employeeId}-${todayStr}`;
                const status = log.details.includes('Status: Late') ? 'Late' : 'Present';
                const newRecord = {
                  id: recordId, employeeId: emp.id, employeeCode: emp.employeeId,
                  employeeName: emp.fullName, department: emp.department, date: todayStr,
                  checkInAt: log.timestamp, checkOutAt: null, workingMinutes: 0,
                  status, attendanceMethod: 'Self Portal', locationVerified: log.details.includes('GPS: Verified'),
                  createdAt: log.timestamp, updatedAt: new Date().toISOString()
                };
                try {
                  await setDoc(doc(db, 'attendance', recordId), newRecord);
                  restored++;
                } catch (e) { console.error(e); }
              }
              alert(`Successfully restored ${restored} check-ins from Audit Logs!`);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-950/50 hover:bg-amber-800 border border-amber-700/50 text-amber-300 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" />
            Restore Today's Check-ins
          </button>

          <button
            onClick={() => generateAttendanceReportPdf(todayRecords, settings, 'Daily Attendance Summary Report')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/50 hover:bg-slate-800 border border-slate-700/50 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            Export PDF
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
        <div className="lg:col-span-2 bg-slate-900/90 rounded-2xl border border-slate-800/80 p-6 shadow-sm">
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
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 p-6 shadow-sm flex flex-col">
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

      {/* Recent Activity List */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Live Activity Feed</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Real-time check-ins for {new Date().toLocaleDateString()}</p>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="text-[10px] font-bold text-blue-500 hover:text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          >
            View All <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="divide-y divide-slate-800/60">
        {recentCheckIns.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs font-medium">
            No check-in activity recorded yet for today.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentCheckIns.map(rec => {
              const emp = employees.find(e => e.employeeId === rec.employeeCode);
              return (
                <div key={rec.id} className="grid grid-cols-4 items-center">
                  <div className="col-span-2 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp?.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(rec.employeeName || 'User')}&background=0D8ABC&color=fff`}
                        alt={rec.employeeName}
                        className="w-8 h-8 rounded-full border border-slate-700"
                      />
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">{rec.employeeName || 'Unknown'}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{rec.department || '--'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 text-xs text-slate-300 font-mono font-bold">
                    {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </div>
                  <div className="px-6 py-4 text-right">
                    {rec.locationVerified ? (
                      <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-bold uppercase justify-end"><CheckCircle2 className="w-3 h-3"/> Office GPS</span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 text-[10px] font-bold uppercase justify-end"><AlertTriangle className="w-3 h-3"/> Unverified</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
