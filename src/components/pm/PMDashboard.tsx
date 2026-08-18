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
  ChevronRight,
  Flame,
  FileText,
  UserCheck
} from 'lucide-react';
import { Project, LeaveRequest } from '../../types';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, setDoc, doc } from 'firebase/firestore';

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
    deadline: '2026-08-15',
    status: 'On Track',
    progressPercent: 88,
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
  const { employees, leaveRequests, attendance, activeEmployee, updateLeaveRequestStage } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];

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
    const unsub = onSnapshot(collection(db, 'projects'), (snapshot) => {
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
  }, []);

  // Persisted PM Recommendations (Fixes P15)
  const [recommendations, setRecommendations] = useState<Record<string, 'Approved' | 'Flagged'>>(() => {
    const saved = localStorage.getItem('kss_pm_recommendations');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('kss_pm_recommendations', JSON.stringify(recommendations));
  }, [recommendations]);

  // Modal State for PM Custom Sprint Conflict / Rejection Reason (Fixes P16)
  const [rejectModalReq, setRejectModalReq] = useState<LeaveRequest | null>(null);
  const [customRejectReason, setCustomRejectReason] = useState('Sprint 14 Deadline Conflict — Key deliverable scheduled during request dates');

  const handleRecommend = (reqId: string, type: 'Approved' | 'Flagged', customReason?: string) => {
    setRecommendations(prev => ({ ...prev, [reqId]: type }));
    const reasonText = customReason || (type === 'Approved' ? 'PM Recommended Approval' : 'Sprint 14 Deadline Conflict');

    if (type === 'Approved') {
      updateLeaveRequestStage(reqId, 'PM', 'Approved', activeEmployee?.fullName || 'Project Manager', reasonText);
    } else {
      updateLeaveRequestStage(reqId, 'PM', 'Rejected', activeEmployee?.fullName || 'Project Manager', reasonText);
    }
  };

  // Calculate current week's Monday through Friday dates
  const getWeekDays = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const distanceToMon = (dayOfWeek + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - distanceToMon);

    const days: { label: string; dateStr: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i];
      days.push({ label, dateStr });
    }
    return days;
  };

  const weekDays = getWeekDays();

  const pendingTeamRequests = leaveRequests.filter(r => {
    if (r.status !== 'Pending') return false;

    // PM stage must be pending for PM to review
    if (r.pmStatus === 'N/A' || r.pmStatus === 'Bypassed') return false;

    // Self-request check: PM cannot approve/reject their own request!
    if (r.employeeId === activeEmployee?.id || r.employeeId === activeEmployee?.employeeId || r.employeeName === activeEmployee?.fullName) {
      return false;
    }

    // Exclude HR employees and PM/Executive applicants from PM leave approval pipeline
    const isHrOrPmEmployee = (r.department || '').toLowerCase().includes('hr') ||
      r.employeeRole === 'HR_ADMIN' ||
      r.employeeRole === 'PROJECT_MANAGER' ||
      r.employeeRole === 'SUPER_ADMIN' ||
      (() => {
        const emp = employees.find(e => e.id === r.employeeId || e.employeeId === r.employeeId || e.fullName === r.employeeName);
        return emp?.department?.toLowerCase().includes('hr') || emp?.role === 'HR_ADMIN' || emp?.role === 'PROJECT_MANAGER' || emp?.role === 'SUPER_ADMIN';
      })();

    if (isHrOrPmEmployee) return false;

    return r.pmStatus === 'Pending' || !r.pmStatus;
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full lg:w-auto shrink-0">
          <button
            onClick={() => onNavigateTab('leave_approvals')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer w-full"
          >
            <FileText className="w-4 h-4" />
            <span>Leave Approvals ({pendingTeamRequests.length})</span>
          </button>
          <button
            onClick={() => onNavigateTab('pm_projects')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-blue-900/30 transition-all cursor-pointer w-full"
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
            <div className="py-8 px-4 text-center rounded-2xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <UserCheck className="w-8 h-8 text-purple-400/60 mx-auto" />
              <p className="text-xs font-bold text-slate-300">No Pending Approvals</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">There are no team leave or WFH requests requiring PM review right now.</p>
            </div>
          ) : (
            pendingTeamRequests.map(req => {
              const recStatus = recommendations[req.id] || req.pmStatus;

              return (
                <div key={req.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-700">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-white">{req.employeeName}</span>
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-mono font-bold">
                        {req.type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">({req.department || 'Engineering'})</span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">{req.reason}</p>
                    <p className="text-[11px] text-slate-400 font-mono">Duration: {req.startDate} → {req.endDate}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {recStatus === 'Approved' ? (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PM Approved
                      </span>
                    ) : recStatus === 'Rejected' || recStatus === 'Flagged' ? (
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/30 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> PM Rejected
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRecommend(req.id, 'Approved')}
                          className="px-3.5 py-1.5 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectModalReq(req);
                            setCustomRejectReason('Sprint 14 Deadline Conflict — Key deliverable scheduled during request dates');
                          }}
                          className="px-3.5 py-1.5 bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject (Sprint Conflict)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Zone 2: Project Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {projects.map(proj => (
          <div
            key={proj.id}
            onClick={() => onNavigateTab('pm_projects')}
            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-4 sm:p-5 rounded-2xl shadow-md transition-all cursor-pointer group space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                proj.status === 'On Track' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                proj.status === 'In Progress' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}>
                ● {proj.status}
              </span>
              <span className="text-[10px] font-mono text-slate-400">Due {proj.deadline}</span>
            </div>

            <div>
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

      {/* Zone 3: Team Workload Heatmap Grid */}
      {(() => {
        const teamMembersOnly = employees.filter(emp => {
          const empName = (emp.fullName || '').toLowerCase();
          const empDesig = (emp.designation || '').toLowerCase();
          const empId = (emp.employeeId || '').toUpperCase();

          const isExecutive = empId === 'CEO001' || empId === 'CTO001' || empId === 'KSS2407001' || empId === 'KSS2407002' || empId === 'KSS2407014' ||
            empName.includes('gaurav') || empName.includes('akshit') ||
            empDesig.includes('ceo') || empDesig.includes('cto') || empDesig.includes('founder') || empDesig.includes('cio');

          const isHr = emp.role === 'HR_ADMIN' || empName.includes('abhinaya') || (emp.department || '').toLowerCase().includes('hr');

          return !isExecutive && !isHr;
        });

        return (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" /> 
                <span>Team Capacity &amp; Workload Heatmap (Real Attendance Hours)</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">Live Workforce ({teamMembersOnly.length} Members)</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800/80 custom-scrollbar">
              {/* Mobile Scroll Helper Indicator */}
              <div className="sm:hidden px-3.5 py-2 bg-slate-950 border-b border-slate-800 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span>← Swipe table left/right to view weekly hours →</span>
                <span className="text-blue-400 font-bold">5 Days</span>
              </div>
              <table className="w-full text-left text-xs min-w-[720px]">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase text-[10px] bg-slate-950/50">
                    <th className="py-2.5 px-3">Team Member</th>
                    <th className="py-2.5 px-3">Department &amp; Role</th>
                    {weekDays.map(d => (
                      <th key={d.dateStr} className="py-2.5 px-2 text-center font-mono">{d.label} ({d.dateStr.slice(5)})</th>
                    ))}
                    <th className="py-2.5 px-3 text-right">Duty Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-semibold">
                  {teamMembersOnly.map(emp => {
                    const empAtt = attendance.find(a => (a.employeeId === emp.id || a.employeeCode === emp.employeeId) && a.date === todayStr);
                    const isCheckedIn = !!empAtt?.checkInAt;
                    const isWfh = isCheckedIn && (empAtt?.isWfh === true || empAtt?.status === 'Work From Home');

                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                          <img
                            src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=1e293b&color=fff`}
                            alt={emp.fullName}
                            className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <span className="block text-xs font-bold text-white">{emp.fullName}</span>
                            <span className="text-[10px] font-mono text-slate-500">{emp.employeeId}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-xs">
                          <span className="block font-bold text-slate-300">{emp.department}</span>
                          <span className="text-[10px] text-slate-500">{emp.designation}</span>
                        </td>

                        {/* Real Hours Calculated per Date */}
                        {weekDays.map(d => {
                          const rec = attendance.find(a => 
                            (a.employeeId === emp.id || a.employeeCode === emp.employeeId) && 
                            a.date === d.dateStr
                          );

                          let hours = 0;
                          if (rec) {
                            if (rec.workingMinutes && rec.workingMinutes > 0) {
                              hours = Math.round((rec.workingMinutes / 60) * 10) / 10;
                            } else if (rec.checkInAt) {
                              const end = rec.checkOutAt ? new Date(rec.checkOutAt).getTime() : Date.now();
                              const diffMins = Math.max(0, Math.floor((end - new Date(rec.checkInAt).getTime()) / 60000));
                              const breakMins = rec.totalBreakMinutes || 0;
                              const netMins = Math.max(0, diffMins - breakMins);
                              hours = Math.round((netMins / 60) * 10) / 10;
                            }
                          }

                          return (
                            <td key={d.dateStr} className="py-3 px-2 text-center">
                              <span className={`inline-block min-w-[36px] px-1.5 h-8 rounded-lg font-mono font-bold text-xs leading-8 ${
                                hours >= 8.5 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                                hours >= 7.5 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                hours > 0 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                'bg-slate-950 text-slate-600 border border-slate-800'
                              }`}>
                                {hours > 0 ? `${hours}h` : '0h'}
                              </span>
                            </td>
                          );
                        })}

                        <td className="py-3 px-3 text-right">
                          {isWfh ? (
                            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
                              WFH Active
                            </span>
                          ) : isCheckedIn ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                              On Duty
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700">
                              Offline
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* PM Sprint Conflict / Rejection Reason Modal (Fixes P16) */}
      {rejectModalReq && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#0f172a] border border-rose-500/30 rounded-3xl shadow-2xl overflow-hidden text-white p-6 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>PM Sprint Conflict Rejection</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Specify the exact sprint conflict reason for rejecting <strong className="text-white">{rejectModalReq.employeeName}</strong>'s {rejectModalReq.type} request.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Sprint Conflict Reason / Notes:</label>
              <textarea
                rows={3}
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
                className="w-full bg-[#0b1324] border border-slate-800 focus:border-rose-500 rounded-xl p-3 text-xs text-white font-medium focus:outline-none"
                placeholder="Enter sprint conflict details..."
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRecommend(rejectModalReq.id, 'Flagged', customRejectReason);
                  setRejectModalReq(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-rose-950/40"
              >
                Confirm Rejection
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
// Clean HMR trigger
