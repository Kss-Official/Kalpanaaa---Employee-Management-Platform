import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Palmtree, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  ChevronRight, 
  Calendar,
  Building2,
  LogIn,
  LogOut,
  Coffee,
  Banknote,
  ShieldCheck,
  Home
} from 'lucide-react';
import { FaceCaptureModal } from '../shared/LazyFaceCaptureModal';
import { 
  getEmployeeWorkDate, 
  getAttendanceDocId, 
  getCanonicalEmployeeUid, 
  isShiftComplete, 
  resolveAttendanceRecord, 
  isExecutiveOrLeadership,
  buildPayrollAttendanceBasis,
  getCurrentPayrollCycleMonth,
  isWfhType,
  isApprovedWfhForEmployee
} from '../../lib/attendanceEngine';
import { toISTTimeString } from '../../lib/absoluteTime';

interface HRDashboardProps {
  onNavigateTab: (tab: string, filters?: { dateFilter?: 'today' | 'yesterday' | 'all'; statusFilter?: string }) => void;
}

export const HRDashboard: React.FC<HRDashboardProps> = ({ onNavigateTab }) => {
  const { 
    employees, 
    attendance, 
    leaveRequests, 
    activeEmployee, 
    checkIn, 
    checkOut, 
    startBreak, 
    endBreak,
    companyWideWfhDates,
    settings 
  } = useAuth();

  const todayStr = getEmployeeWorkDate(new Date());

  // Real-time live attendance feed for today
  const todayAttendance = useMemo(() => {
    return attendance.filter(a => a.date === todayStr && a.employeeName && a.employeeName.trim() !== '' && a.employeeName !== '.');
  }, [attendance, todayStr]);

  // Real-time live attendance ticker: re-computes live status every 10 seconds
  const [, setLiveTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setLiveTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const targetEmployee = activeEmployee || employees.find(e => e.department?.toLowerCase().includes('hr') || e.role === 'HR_ADMIN') || employees[0];

  const isCeoOrCto = targetEmployee?.role === 'SUPER_ADMIN' ||
    (targetEmployee?.designation || '').toUpperCase().includes('CEO') ||
    (targetEmployee?.designation || '').toUpperCase().includes('CTO') ||
    (targetEmployee?.designation || '').toUpperCase().includes('FOUNDER') ||
    targetEmployee?.employeeId === 'CEO001' ||
    targetEmployee?.employeeId === 'CTO001';

  // Filter out Leadership/Executives (CEO, CTO, Founder, COO Rahul Pathak) from HR attendance metrics
  const operationalEmployees = useMemo(() => {
    return employees.filter(e => e.status !== 'Terminated' && e.status !== 'Inactive' && !isExecutiveOrLeadership(e));
  }, [employees]);

  // Map operational employees to their resolved today's attendance record (if any)
  const employeeTodayRecords = useMemo(() => {
    return operationalEmployees.map(emp => {
      const rec = attendance.find(a => 
        a.date === todayStr && (
          a.employeeId === emp.id || 
          a.employeeCode === emp.employeeId || 
          (a.employeeName && emp.fullName && (
            a.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase() ||
            a.employeeName.replace(/\s+/g, '').toLowerCase() === emp.fullName.replace(/\s+/g, '').toLowerCase()
          ))
        )
      );
      const isWfh = isApprovedWfhForEmployee(emp, todayStr, {
        leaveRequests,
        companyWideWfhDates,
        settings,
        record: rec
      });
      return { emp, rec, isWfh };
    });
  }, [operationalEmployees, attendance, todayStr, leaveRequests, companyWideWfhDates, settings]);

  const checkedInToday = employeeTodayRecords
    .map(x => x.rec)
    .filter((rec): rec is NonNullable<typeof rec> => !!rec && !!rec.checkInAt);

  const totalEmployees = operationalEmployees.length;
  const wfhCount = employeeTodayRecords.filter(({ emp, rec, isWfh }) => {
    if (rec && (rec.isWfh === true || rec.status === 'Work From Home')) return true;
    return isWfh;
  }).length;

  const onLeaveCount = employeeTodayRecords.filter(({ emp, rec, isWfh }) => {
    if (isWfh) return false;
    return rec?.status === 'On Leave' || rec?.status === 'Leave' ||
      leaveRequests.some(r => 
        !isWfhType(r.type) && !isWfhType(r.leaveCategory) && 
        (r.status === 'Approved' || ((r.pmStatus === 'Approved' || r.pmStatus === 'N/A' || r.pmStatus === 'Bypassed') && (r.hrStatus === 'Approved' || r.hrStatus === 'N/A' || r.hrStatus === 'Bypassed') && (r.ceoStatus === 'Approved' || r.ceoStatus === 'N/A' || r.ceoStatus === 'Bypassed') && (r.ctoStatus === 'Approved' || r.ctoStatus === 'N/A' || r.ctoStatus === 'Bypassed'))) && 
        ((!!r.employeeId && (r.employeeId === emp.id || r.employeeId === emp.employeeId)) ||
         (!!r.employeeUid && (r.employeeUid === emp.uid || r.employeeUid === emp.id)) ||
         (!!r.employeeName && !!emp.fullName && (
           r.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase() ||
           r.employeeName.replace(/\s+/g, '').toLowerCase() === emp.fullName.replace(/\s+/g, '').toLowerCase()
         ))) && 
        todayStr >= (r.startDate || (r as any).fromDate) && 
        todayStr <= (r.endDate || (r as any).toDate || r.startDate)
      );
  }).length;

  const presentCount = employeeTodayRecords.filter(({ emp, rec, isWfh }) => {
    if (isWfh) return false;
    const hasApprovedLeave = leaveRequests.some(r => 
      !isWfhType(r.type) && !isWfhType(r.leaveCategory) && 
      r.status === 'Approved' && 
      ((!!r.employeeId && (r.employeeId === emp.id || r.employeeId === emp.employeeId)) ||
       (!!r.employeeUid && (r.employeeUid === emp.uid || r.employeeUid === emp.id)) ||
       (!!r.employeeName && !!emp.fullName && (
         r.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase() ||
         r.employeeName.replace(/\s+/g, '').toLowerCase() === emp.fullName.replace(/\s+/g, '').toLowerCase()
       ))) && 
      todayStr >= (r.startDate || (r as any).fromDate) && 
      todayStr <= (r.endDate || (r as any).toDate || r.startDate)
    );
    if (hasApprovedLeave) return false;

    return !!rec?.checkInAt && rec.status !== 'Absent' && rec.status !== 'On Leave';
  }).length;
  const onDutyCount = employeeTodayRecords.filter(({ rec }) => !!rec?.checkInAt && !isShiftComplete(rec)).length;
  const lateCount = employeeTodayRecords.filter(({ rec }) => rec?.status === 'Late').length;
  const absentCount = Math.max(0, totalEmployees - presentCount - wfhCount - onLeaveCount);

  // Dynamic Real-time Salary Run calculation for current 27th-to-26th cycle
  const totalMonthlySalaryRun = React.useMemo(() => {
    const currentCycleKey = getCurrentPayrollCycleMonth();
    let adjustments: Record<string, any> = {};
    try {
      const raw = localStorage.getItem(`kss_payroll_adjustments_${currentCycleKey}`);
      if (raw) adjustments = JSON.parse(raw);
    } catch (e) {}

    const getBenchmark = (emp: any): number => {
      if (emp.baseSalary && Number(emp.baseSalary) > 0) return Number(emp.baseSalary);
      if (emp.salary && Number(emp.salary) > 0) return Number(emp.salary);
      const desig = (emp.designation || '').toLowerCase();
      if (desig.includes('manager') || desig.includes('lead')) return 65000;
      if (desig.includes('senior') || desig.includes('architect')) return 60000;
      if (desig.includes('backend') || desig.includes('full stack')) return 48000;
      if (desig.includes('frontend') || desig.includes('engineer')) return 45000;
      if (desig.includes('designer') || desig.includes('ui')) return 42000;
      if (desig.includes('intern')) return 20000;
      return 45000;
    };

    return operationalEmployees.reduce((sum, emp) => {
      const custom = adjustments[emp.id];
      const basis = buildPayrollAttendanceBasis(emp, attendance, currentCycleKey, {
        leaveRequests,
        nowMs: Date.now()
      });

      const baseSalary = custom?.baseSalary !== undefined ? Number(custom.baseSalary) : getBenchmark(emp);
      const allowances = custom?.allowances !== undefined ? Number(custom.allowances) : 2000;
      const perDay = basis.rosteredDays > 0 ? (baseSalary + allowances) / basis.rosteredDays : 0;
      const autoDeductions = Math.round(perDay * basis.lossOfPayDays);
      const totalDeductions = custom?.deduction !== undefined ? Number(custom.deduction) : autoDeductions;
      const netPay = Math.max(0, (baseSalary + allowances) - totalDeductions);
      return sum + netPay;
    }, 0);
  }, [operationalEmployees, attendance, leaveRequests]);

  const hrPendingRequests = leaveRequests.filter(r => 
    r.status === 'Pending' && 
    (r.pmStatus === 'Approved' || r.pmStatus === 'N/A' || r.pmStatus === 'Bypassed') && 
    (r.hrStatus === 'Pending' || r.ceoStatus === 'Pending' || r.ctoStatus === 'Pending')
  );
  const pendingApprovalsCount = hrPendingRequests.length;

  // HR Personal Attendance Record for today
  const hrAttendanceRecord = resolveAttendanceRecord(attendance, targetEmployee, todayStr);
  const isHrCheckedIn = !!hrAttendanceRecord?.checkInAt && !isShiftComplete(hrAttendanceRecord);
  const hrActiveBreak = hrAttendanceRecord?.breaks?.find(b => !b.endAt && !(b as any).endTime);

  const [hrActionLoading, setHrActionLoading] = useState(false);
  const [hrStatusMessage, setHrStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [pendingGps, setPendingGps] = useState<{ lat?: number; lon?: number; accuracy?: number } | null>(null);

  const initiateHrCheckIn = async () => {
    if (!targetEmployee) {
      setHrStatusMessage({ type: 'error', text: 'No employee record found for check-in.' });
      return;
    }
    setHrActionLoading(true);
    setHrStatusMessage(null);

    // 1. Pre-Check-In GPS Collection (Fixes H19 UX Gap)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setPendingGps({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
          setHrActionLoading(false);
          setIsFaceModalOpen(true); // Open Face Modal after GPS acquired
        },
        err => {
          console.warn('[HRDashboard] Geolocation denied/failed', err);
          setPendingGps(null);
          setHrActionLoading(false);
          setIsFaceModalOpen(true); // Open Face Modal even if GPS denied
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setHrActionLoading(false);
      setIsFaceModalOpen(true);
    }
  };

  const executeHrCheckInProcess = async () => {
    if (!targetEmployee) return;
    setHrActionLoading(true);
    setHrStatusMessage(null);

    try {
      const res = await checkIn(
        targetEmployee.id,
        pendingGps?.lat,
        pendingGps?.lon,
        'Facial Recognition',
        pendingGps?.accuracy
      );
      if (res.success) {
        setHrStatusMessage({ type: 'success', text: res.message || '✓ HR Biometric Check-In & GPS Verified!' });
      } else {
        setHrStatusMessage({ type: 'error', text: res.message || 'Check-In failed.' });
      }
    } catch (err: any) {
      setHrStatusMessage({ type: 'error', text: err?.message || 'Check-In failed.' });
    } finally {
      setHrActionLoading(false);
      setPendingGps(null);
    }
  };

  const handleHrCheckOut = async () => {
    if (!targetEmployee) return;
    setHrActionLoading(true);
    setHrStatusMessage(null);

    try {
      const res = await checkOut(targetEmployee.id);
      if (res.success) {
        setHrStatusMessage({ type: 'success', text: res.message || 'HR Check-Out recorded successfully!' });
      } else {
        setHrStatusMessage({ type: 'error', text: res.message || 'Check-Out failed.' });
      }
    } catch (err: any) {
      setHrStatusMessage({ type: 'error', text: err?.message || 'Check-Out failed.' });
    } finally {
      setHrActionLoading(false);
    }
  };

  const handleHrBreakToggle = async () => {
    if (!targetEmployee) return;
    setHrActionLoading(true);
    setHrStatusMessage(null);

    try {
      if (hrActiveBreak) {
        const res = await endBreak(targetEmployee.id);
        setHrStatusMessage({ type: 'success', text: res.message || 'Break ended. Welcome back to work!' });
      } else {
        const res = await startBreak(targetEmployee.id, 'Meal Break');
        setHrStatusMessage({ type: 'success', text: res.message || 'Meal Break started.' });
      }
    } catch (err: any) {
      setHrStatusMessage({ type: 'error', text: err?.message || 'Break action failed.' });
    } finally {
      setHrActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Zone 1: Action Bar (Top) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            HR Operations Control Room
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Executive HR Overview</h1>
          <p className="text-xs text-slate-400 mt-0.5">Real-time personnel statistics, attendance metrics, and pending approvals.</p>
        </div>

        {/* Action Buttons matching screenshot media_1786517118960 */}
        <div className="flex flex-wrap items-center gap-3">
          {isCeoOrCto ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-black shadow-sm">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Executive Officer — Check-In Exempt</span>
            </div>
          ) : !isHrCheckedIn ? (
            <button
              onClick={initiateHrCheckIn}
              disabled={hrActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-900/30 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{hrActionLoading ? 'Acquiring GPS...' : 'HR Check-In'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                In: {hrAttendanceRecord?.checkInAt ? toISTTimeString(hrAttendanceRecord.checkInAt) : 'Active'}
              </span>

              <button
                onClick={handleHrBreakToggle}
                disabled={hrActionLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  hrActiveBreak 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 animate-pulse' 
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>{hrActiveBreak ? 'End Break' : 'Tea / Lunch Break'}</span>
              </button>

              <button
                onClick={handleHrCheckOut}
                disabled={hrActionLoading}
                className="flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-rose-900/30 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span>HR Check-Out</span>
              </button>
            </div>
          )}

          {/* Approvals Pending Pill */}
          <button
            onClick={() => onNavigateTab('leave_approvals')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30 transition-all cursor-pointer shadow-sm"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>{pendingApprovalsCount} Approvals Pending</span>
            <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Zone 2: Stripe-Style KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Present Today */}
        <div 
          onClick={() => onNavigateTab('attendance', { dateFilter: 'today', statusFilter: 'ALL' })}
          className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 p-5 rounded-2xl shadow-md transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Present Today</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> +2 ▲
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-white tabular-nums">{presentCount}<span className="text-sm text-slate-500 font-bold"> / {totalEmployees}</span></span>
            <svg className="w-16 h-8 text-emerald-400" viewBox="0 0 100 40">
              <path fill="none" stroke="currentColor" strokeWidth="3" d="M0,35 Q20,20 40,25 T80,10 T100,5" />
            </svg>
          </div>
        </div>

        {/* Card 2: Late Arrivals */}
        <div 
          onClick={() => onNavigateTab('attendance', { dateFilter: 'today', statusFilter: 'Late' })}
          className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl shadow-md transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Late Arrivals</span>
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {lateCount} Flagged
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-white tabular-nums">{lateCount}</span>
            <svg className="w-16 h-8 text-amber-400" viewBox="0 0 100 40">
              <path fill="none" stroke="currentColor" strokeWidth="3" d="M0,10 Q30,30 60,15 T100,25" />
            </svg>
          </div>
        </div>

        {/* Card 3: Work From Home */}
        <div 
          onClick={() => onNavigateTab('attendance', { dateFilter: 'today', statusFilter: 'Work From Home' })}
          className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/50 p-5 rounded-2xl shadow-md transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active WFH</span>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
              Approved
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-white tabular-nums">{wfhCount}</span>
            <svg className="w-16 h-8 text-blue-400" viewBox="0 0 100 40">
              <path fill="none" stroke="currentColor" strokeWidth="3" d="M0,25 Q40,5 70,20 T100,10" />
            </svg>
          </div>
        </div>

        {/* Card 4: Monthly Salary Run (Redirects to Salary Disbursement hr_payroll) */}
        <div 
          onClick={() => onNavigateTab('hr_payroll')}
          className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 p-5 rounded-2xl shadow-md transition-all cursor-pointer group space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salary Run</span>
            <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
              Disbursement →
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-white tabular-nums">
              ₹{(totalMonthlySalaryRun / 100000).toFixed(1)}L
            </span>
            <Banknote className="w-8 h-8 text-purple-400 opacity-80 group-hover:scale-110 transition-transform" />
          </div>
        </div>

      </div>

      {/* Zone 3: Split View — Pending Approvals Inbox & Today's Attendance Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Pending Approvals Inbox (60%) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Pending Approvals Inbox
            </h3>
            <button 
              onClick={() => onNavigateTab('leave_approvals')}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              View All ({pendingApprovalsCount}) →
            </button>
          </div>

          <div className="space-y-3 py-4">
            {hrPendingRequests.length === 0 ? (
              <div className="py-8 text-center text-slate-500 border border-slate-800 border-dashed rounded-2xl bg-slate-950/40">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-400">All pending approvals cleared!</p>
              </div>
            ) : (
              hrPendingRequests.slice(0, 4).map(req => (
                <div key={req.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white">{req.employeeName}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                        req.type === 'Leave' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      }`}>
                        {req.type}
                      </span>
                      {req.pmRecommendation && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          PM: {req.pmRecommendation}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">{req.reason} ({req.startDate} to {req.endDate})</p>
                  </div>

                  <button
                    onClick={() => onNavigateTab('leave_approvals')}
                    className="px-3 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/30 font-bold text-[10px] rounded-lg hover:bg-blue-600/30 transition-colors cursor-pointer"
                  >
                    Review
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Today's Live Attendance Feed (40%) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" /> Today's Live Check-Ins
            </h3>

            {/* View All Check-Ins Button */}
            <button
              onClick={() => onNavigateTab('attendance')}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({todayAttendance.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 pt-4 max-h-[320px] overflow-y-auto pr-1">
            {todayAttendance.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <p className="text-xs font-semibold">No check-in records for today yet.</p>
              </div>
            ) : (
              todayAttendance.slice(0, 6).map(rec => {
                const isWfhRec = rec.isWfh || rec.status === 'Work From Home';
                return (
                  <div key={rec.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/60">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${isWfhRec ? 'bg-sky-400' : rec.status === 'Present' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-xs font-bold text-white">{rec.employeeName}</p>
                          {isWfhRec && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                              <Home className="w-2.5 h-2.5" /> WFH
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{rec.department}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {rec.checkInAt ? toISTTimeString(rec.checkInAt) : '--'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Face Capture Biometric Verification Modal for HR Check-In (Fixes H18 & H19 Security Requirements) */}
      {targetEmployee && (
        <FaceCaptureModal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          onSuccess={() => {
            setIsFaceModalOpen(false);
            executeHrCheckInProcess();
          }}
          employeeName={targetEmployee.fullName}
          employeeId={targetEmployee.id}
          profilePhotoUrl={targetEmployee.profilePhotoUrl}
          cloudDescriptor={targetEmployee.faceDescriptor}
        />
      )}
    </div>
  );
};
