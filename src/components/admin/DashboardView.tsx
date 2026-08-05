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
import { motion } from 'framer-motion';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';
import { db } from '../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useHaptic } from '../../hooks/useHaptic';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenAddEmployee: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab, onOpenAddEmployee }) => {
  const { employees, attendance, settings, activeEmployee, auditLogs } = useAuth();
  const { triggerHaptic } = useHaptic();
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
    <div className="space-y-6 pb-20">
      {/* Top Banner & Quick Actions */}
      <div className="relative bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] p-8 rounded-3xl shadow-[var(--shadow-md)] overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Subtle engineering background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[var(--accent-blue)]/10 via-transparent to-transparent pointer-events-none opacity-50"></div>
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[var(--accent-blue)]/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[10px] font-black text-[var(--accent-blue)] uppercase tracking-widest mb-2">
            <span>Executive Command Center</span>
            <span className="text-[var(--text-tertiary)]">•</span>
            <span className="text-[var(--text-secondary)]">{settings.companyName}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] mb-1">
            {getGreeting()}, {displayName}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            System overview and workforce analytics for {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              triggerHaptic();
              onOpenAddEmployee();
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--text-primary)] hover:opacity-90 text-black text-xs font-black tracking-wide uppercase rounded-xl transition-all cursor-pointer shadow-[var(--shadow-sm)] active:scale-95"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            New Employee
          </button>


          <button
            onClick={async () => {
              triggerHaptic();
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
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-amber)]/10 hover:bg-[var(--accent-amber)]/20 border border-[var(--accent-amber)]/30 text-[var(--accent-amber)] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-[var(--shadow-sm)] active:scale-95"
          >
            <AlertTriangle className="w-4 h-4" />
            Restore Check-ins
          </button>

          <button
            onClick={() => {
              triggerHaptic();
              generateAttendanceReportPdf(todayRecords, settings, 'Daily Attendance Summary Report');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-[var(--shadow-sm)] active:scale-95"
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
        <div className="lg:col-span-2 bg-[var(--bg-tertiary)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Attendance Trend (Past 7 Days)</h3>
              <p className="text-xs text-[var(--text-secondary)]">Daily breakdown of present, late, and absent employees</p>
            </div>
            <div className="flex items-center gap-1.5 bg-[var(--bg-elevated)] p-1 rounded-xl border border-[var(--border-subtle)] overflow-x-auto hide-scrollbar">
              <button
                onClick={() => { triggerHaptic(); setDateFilter('today'); }}
                className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-bold whitespace-nowrap ${dateFilter === 'today' ? 'bg-[var(--accent-blue)] text-white shadow-[var(--shadow-glow-blue)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
              >
                Today
              </button>
              <button
                onClick={() => { triggerHaptic(); setDateFilter('week'); }}
                className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-bold whitespace-nowrap ${dateFilter === 'week' ? 'bg-[var(--accent-blue)] text-white shadow-[var(--shadow-glow-blue)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
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
                    <stop offset="5%" stopColor="var(--accent-emerald)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent-emerald)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-amber)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--accent-amber)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-medium)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontSize: '12px', boxShadow: 'var(--shadow-md)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="Present" stroke="var(--accent-emerald)" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={3} />
                <Area type="monotone" dataKey="Late" stroke="var(--accent-amber)" fillOpacity={1} fill="url(#colorLate)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Stats Bar Chart */}
        <div className="bg-[var(--bg-tertiary)] rounded-3xl border border-[var(--border-subtle)] p-6 shadow-[var(--shadow-sm)] flex flex-col">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Department Turnout</h3>
            <p className="text-xs text-[var(--text-secondary)]">Present vs Total employees per department</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-medium)" vertical={false} />
                <XAxis dataKey="department" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', fontSize: '12px', boxShadow: 'var(--shadow-md)' }}
                  cursor={{fill: 'var(--border-subtle)'}}
                />
                <Bar dataKey="Total" fill="var(--text-muted)" radius={[6, 6, 0, 0]} barSize={12} />
                <Bar dataKey="Present" fill="var(--accent-blue)" radius={[6, 6, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="bg-[var(--bg-tertiary)] rounded-3xl border border-[var(--border-subtle)] overflow-hidden shadow-[var(--shadow-sm)]">
        <div className="p-6 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Live Activity Feed</h3>
            <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-1">Real-time check-ins for {new Date().toLocaleDateString()}</p>
          </div>
          <button
            onClick={() => { triggerHaptic(); onNavigateTab('attendance'); }}
            className="text-[10px] font-bold text-[var(--accent-blue)] hover:text-[var(--text-primary)] bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/20 px-4 py-2 rounded-xl flex items-center gap-1 transition-colors cursor-pointer w-full sm:w-auto justify-center"
          >
            View All <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
        {recentCheckIns.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)] text-xs font-medium">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center">
              <Clock className="w-6 h-6 text-[var(--text-tertiary)] opacity-50" />
            </div>
            No check-in activity recorded yet for today.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {recentCheckIns.map((rec, i) => {
              const emp = employees.find(e => e.employeeId === rec.employeeCode);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, ...{ type: 'spring', stiffness: 300, damping: 30 } }}
                  key={rec.id} 
                  className="grid grid-cols-4 items-center hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <div className="col-span-2 px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={emp?.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(rec.employeeName || 'User')}&background=111118&color=fff`}
                          alt={rec.employeeName}
                          className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)]"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--accent-emerald)] rounded-full border-2 border-[var(--bg-tertiary)]"></div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--text-primary)] leading-tight">{rec.employeeName || 'Unknown'}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] font-semibold mt-0.5">{rec.department || '--'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 text-xs text-[var(--text-secondary)] font-mono font-bold text-center">
                    {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                  </div>
                  <div className="px-6 py-4 text-right flex justify-end">
                    {rec.locationVerified ? (
                      <span className="text-[var(--accent-emerald)] bg-[var(--accent-emerald)]/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold uppercase w-fit">
                        <CheckCircle2 className="w-3 h-3"/> Office GPS
                      </span>
                    ) : (
                      <span className="text-[var(--accent-amber)] bg-[var(--accent-amber)]/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-bold uppercase w-fit">
                        <AlertTriangle className="w-3 h-3"/> Unverified
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
