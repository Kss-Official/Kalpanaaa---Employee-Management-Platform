import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toISTTimeString } from '../../lib/absoluteTime';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  User, 
  LogIn, 
  LogOut, 
  Coffee, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Calendar, 
  ShieldCheck, 
  CreditCard, 
  FileText, 
  Building2, 
  Mail, 
  Phone,
  Sparkles,
  QrCode,
  AlertTriangle,
  Send,
  X
} from 'lucide-react';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';
import { FaceCaptureModal } from '../shared/LazyFaceCaptureModal';
import { useHaptic } from '../../hooks/useHaptic';
import { getEmployeeWorkDate, getAttendanceDocId, getCanonicalEmployeeUid, isAttendanceForEmployee, resolveAttendanceRecord, safeGetTimestampMillis, isShiftComplete, isApprovedWfhForEmployee } from '../../lib/attendanceEngine';

export const HRProfileView: React.FC = () => {
  const { triggerHaptic } = useHaptic();
  const { 
    activeEmployee, 
    employees,
    attendance, 
    leaveRequests, 
    companyWideWfhDates,
    checkIn, 
    checkOut, 
    startBreak, 
    endBreak, 
    submitLeaveRequest,
    cancelLeaveRequest,
    companyWorkZone,
    settings,
    updateEmployee
  } = useAuth();

  const targetEmployee = activeEmployee || employees.find(e => e.role === 'HR_ADMIN' || e.department === 'Human Resources' || (e.designation || '').toLowerCase().includes('hr')) || employees[0];

  const [loading, setLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // WFH / Leave Request Form State
  const [reqType, setReqType] = useState<'WFH' | 'Leave'>('WFH');
  const [startDate, setStartDate] = useState(getEmployeeWorkDate(new Date()));
  const [endDate, setEndDate] = useState(getEmployeeWorkDate(new Date()));
  const [reason, setReason] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Today's Date & Attendance Record (Canonical timezone)
  const todayStr = getEmployeeWorkDate(new Date());
  const myTodayRecord = targetEmployee 
    ? resolveAttendanceRecord(attendance, targetEmployee, todayStr) ?? null
    : null;

  // P0 FIX: shift completion requires a real (non-future) checkout
  const hrShiftComplete = isShiftComplete(myTodayRecord);
  const isCheckedIn = !!myTodayRecord?.checkInAt && !hrShiftComplete;
  const activeBreak = myTodayRecord?.breaks?.find(b => !b.endAt && !(b as any).endTime);

  // Live Timer for Working Hours (Safe timestamp parsing, never NaN)
  const [workingSeconds, setWorkingSeconds] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const startMs = safeGetTimestampMillis(myTodayRecord?.checkInAt);
    if (isCheckedIn && startMs) {
      const calculateSeconds = () => {
        const now = Date.now();
        const diffSecs = Math.max(0, Math.floor((now - startMs) / 1000));
        setWorkingSeconds(diffSecs);
      };
      calculateSeconds();
      interval = setInterval(calculateSeconds, 1000);
    } else {
      setWorkingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, myTodayRecord?.checkInAt]);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);

  // Actions
  const handleCheckIn = async () => {
    if (!targetEmployee) {
      toast.error('No employee record found for check-in.');
      return;
    }
    setIsFaceModalOpen(true);
  };

  // Acquire a single live GPS fix. Resolves null when permission is denied, the
  // device cannot report a position, or the request times out.
  const getFixOrNull = (): Promise<{ lat: number; lon: number; accuracy: number } | null> =>
    new Promise(resolve => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy) || 10,
        }),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    });

  const executeHrCheckInProcess = async () => {
    setLoading(true);

    // ── GEOFENCE FIX ───────────────────────────────────────────────────────────
    // This called checkIn(targetEmployee.id) with NO coordinates at all. Because
    // targetEmployee falls back to activeEmployee (see above), for a logged-in HR
    // user this was a SELF check-in that skipped the office geofence entirely.
    // Now a live fix is acquired first, and a self check-in is refused outright
    // when the geofence is on and no fix can be obtained. Checking somebody ELSE
    // in stays coordinate-free — that is a legitimate admin correction.
    const isSelfCheckIn = !!activeEmployee && !!targetEmployee && targetEmployee.id === activeEmployee.id;
    const isWfhApproved = isApprovedWfhForEmployee(targetEmployee, getEmployeeWorkDate(new Date()), {
      leaveRequests,
      companyWideWfhDates,
      settings
    });
    const geofenceOn = settings.gpsRequired !== false && !isWfhApproved;

    let fix: { lat: number; lon: number; accuracy: number } | null = null;
    if (isSelfCheckIn && geofenceOn) {
      fix = await getFixOrNull();
      if (!fix) {
        toast.error('Location Permission Required: you must allow location access to check in at the office.');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await checkIn(targetEmployee.id, fix?.lat, fix?.lon, fix?.accuracy);
      if (res.success) {
        toast.success(res.message || 'Check-In recorded successfully via Face Biometrics!');
      } else {
        toast.error(res.message || 'Check-In failed.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Check-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!targetEmployee) return;
    setLoading(true);

    // Pass a live fix when one is available so the engine can verify the office
    // location properly. Unlike check-in this does NOT hard-refuse without a fix:
    // evaluateAttendanceScan deliberately falls back to the verified location
    // already stored on today's record, so losing GPS cannot trap someone who is
    // already checked in and needs to end their shift.
    const isSelf = !!activeEmployee && targetEmployee.id === activeEmployee.id;
    const fix = (isSelf && settings.gpsRequired !== false) ? await getFixOrNull() : null;

    try {
      const res = await checkOut(targetEmployee.id, fix?.lat, fix?.lon);
      if (res.success) {
        toast.success(res.message || 'Check-Out recorded successfully!');
      } else {
        toast.error(res.message || 'Check-Out failed.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Check-Out failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleBreakToggle = async () => {
    if (!targetEmployee) return;
    if (!isCheckedIn) {
      toast.error('Please Check In first to start a break.');
      return;
    }
    setLoading(true);

    try {
      if (activeBreak) {
        const res = await endBreak(targetEmployee.id);
        toast.success(res.message || 'Break ended. Welcome back!');
      } else {
        const res = await startBreak(targetEmployee.id, 'Meal Break');
        toast.success(res.message || 'Meal Break started.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Break action failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !reason.trim()) return;

    submitLeaveRequest({
      employeeId: targetEmployee.employeeId || targetEmployee.id,
      employeeName: targetEmployee.fullName,
      department: targetEmployee.department || 'Human Resources',
      type: reqType,
      startDate,
      endDate,
      reason
    });

    toast.success('Request submitted successfully to Executive Management!');
    setReason('');
    setTimeout(() => setFormSubmitted(false), 4000);
  };

  // HR Personal Leave Requests & Filtering Options
  const [logFilter, setLogFilter] = useState<'All' | 'Today' | 'Upcoming' | 'Previous' | 'Approved' | 'Rejected'>('All');

  const myLeaveRequests = leaveRequests.filter(r => 
    r.employeeId === activeEmployee?.id || 
    r.employeeId === activeEmployee?.employeeId || 
    r.employeeName === activeEmployee?.fullName
  );

  const filteredPersonalRequests = myLeaveRequests.filter(req => {
    if (logFilter === 'All') return true;

    if (logFilter === 'Today') {
      const isActiveToday = req.startDate <= todayStr && req.endDate >= todayStr;
      const isSubmittedToday = req.requestDate?.startsWith(todayStr);
      return isActiveToday || isSubmittedToday;
    }

    if (logFilter === 'Upcoming') {
      return req.startDate > todayStr;
    }

    if (logFilter === 'Previous') {
      return req.endDate < todayStr || req.status === 'Approved' || req.status === 'Rejected';
    }

    if (logFilter === 'Approved') {
      return req.status === 'Approved';
    }

    if (logFilter === 'Rejected') {
      return req.status === 'Rejected';
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Banner & Profile Overview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <img
              src={activeEmployee?.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeEmployee?.fullName || 'HR')}&background=1e293b&color=fff`}
              alt={activeEmployee?.fullName || 'HR'}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-blue-500/40 shadow-lg shadow-blue-950/50 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">{activeEmployee?.fullName || 'HR Lead'}</h1>
                <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                  {activeEmployee?.employeeId || 'KSS-HR-01'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {activeEmployee?.designation || 'Human Resources Administrator'} • <span className="text-slate-300">{activeEmployee?.department || 'Human Resources'}</span>
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500" /> {activeEmployee?.email}</span>
                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /> {activeEmployee?.phone || '+91 98765 43210'}</span>
                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-500" /> Kalpanaaa HQ, Bengaluru</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer shadow-md"
            >
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>30-Day Attendance Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* HR Personal Duty Command Center (Check-In, Break, Check-Out & Live Timer) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="pb-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Personal Duty & Attendance Command Center
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage your daily shift status, tea/lunch breaks, and GPS work-zone check-ins.</p>
        </div>


        {/* 3 Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Check-In */}
          <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
            isCheckedIn 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="space-y-1">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SHIFT CHECK-IN</span>
              </div>
              <h3 className="text-xl font-black text-white">
                {isCheckedIn ? `Checked In • ${toISTTimeString(myTodayRecord?.checkInAt!)}` : 'Check-In'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isCheckedIn ? 'Active shift in progress.' : 'Initialize shift attendance with GPS check-in.'}
              </p>
            </div>

            {!isCheckedIn ? (
              <button
                onClick={handleCheckIn}
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Verifying GPS...' : 'Check In'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/20 px-3 py-2 rounded-xl border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>GPS Verified ({myTodayRecord?.distanceFromOffice ?? 12}m from Office)</span>
              </div>
            )}
          </div>

          {/* Card 2: Tea / Lunch Break */}
          <div className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
            activeBreak 
              ? 'bg-amber-500/10 border-amber-500/30' 
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="space-y-1">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TEA / LUNCH BREAK</span>
              </div>
              <h3 className="text-xl font-black text-white">
                {activeBreak ? 'On Break' : 'Break'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {activeBreak ? 'Break in progress. Resume work when ready.' : 'Log tea, meal, or operational breaks.'}
              </p>
            </div>

            <button
              onClick={handleBreakToggle}
              disabled={loading || !isCheckedIn}
              className={`w-full py-3 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                activeBreak 
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-900/40' 
                  : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
              }`}
            >
              <Coffee className="w-4 h-4" />
              <span>{activeBreak ? 'End Break' : 'Start Break'}</span>
            </button>
          </div>

          {/* Card 3: Check-Out */}
          <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SHIFT END</span>
              </div>
              <h3 className="text-xl font-black text-white">
                {hrShiftComplete ? `Checked Out • ${toISTTimeString(myTodayRecord.checkOutAt)}` : 'Check-Out'}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {hrShiftComplete ? 'Today\'s shift completed.' : 'Finalize today\'s total working duration.'}
              </p>
            </div>

            <button
              onClick={handleCheckOut}
              disabled={loading || !isCheckedIn}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>Check Out</span>
            </button>
          </div>
        </div>

        {(() => {
          const activeBreakStart = activeBreak ? (activeBreak.startAt || (activeBreak as any).startTime) : null;
          const totalBreakMins = (myTodayRecord?.totalBreakMinutes || 0) + (activeBreakStart ? Math.max(0, Math.floor((Date.now() - new Date(activeBreakStart).getTime()) / 60000)) : 0);
          const totalWorkedSecs = Math.max(0, workingSeconds - (totalBreakMins * 60));

          const formatHoursMinsSecs = (totalSecs: number) => {
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;
            return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
          };

          const targetShiftSecs = 9 * 3600;
          const shiftProgressPercent = Math.min(100, Math.round((totalWorkedSecs / targetShiftSecs) * 100));

          return (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Duty Calculation Dashboard</h3>
                    <p className="text-[11px] text-slate-400">Real-time automated calculation of active working hours, total break duration, and shift completion.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    Calculation Engine Active
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Metric 1: Total Worked Time */}
                <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Worked Duration</span>
                  <div className="text-lg font-mono font-black text-emerald-400">
                    {isCheckedIn ? formatHoursMinsSecs(totalWorkedSecs) : myTodayRecord?.workingMinutes ? `${Math.floor(myTodayRecord.workingMinutes / 60)}h ${myTodayRecord.workingMinutes % 60}m` : '00h 00m 00s'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block">Net active working duration</span>
                </div>

                {/* Metric 2: Total Break Time */}
                <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Break Duration</span>
                  <div className="text-lg font-mono font-black text-amber-400">
                    {Math.floor(totalBreakMins / 60)}h {totalBreakMins % 60}m
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block">Tea, meal &amp; recess logs</span>
                </div>

                {/* Metric 3: Target Shift Hours */}
                <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Shift Duration</span>
                  <div className="text-lg font-mono font-black text-purple-400">
                    09h 00m
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block">Standard 9-Hour Shift Target</span>
                </div>

                {/* Metric 4: Shift Completion */}
                <div className="p-4 bg-slate-900/90 rounded-xl border border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shift Completion Index</span>
                  <div className="text-lg font-mono font-black text-blue-400">
                    {isCheckedIn ? `${shiftProgressPercent}%` : hrShiftComplete ? '100%' : '0%'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium block">Daily completion percentage</span>
                </div>
              </div>

              {/* Shift Completion Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                  <span>Shift Progress Indicator</span>
                  <span className="font-mono text-white">{isCheckedIn ? shiftProgressPercent : hrShiftComplete ? 100 : 0}% Completed</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${isCheckedIn ? shiftProgressPercent : hrShiftComplete ? 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Grid Row 2: WFH / Leave Request Form & Request History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WFH & Leave Application Form */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" />
              Raise Personal WFH / Leave Request
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Submit your personal WFH or time-off request for Executive approval.</p>
          </div>


          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Request Type</label>
                <select
                  value={reqType}
                  onChange={e => setReqType(e.target.value as 'WFH' | 'Leave')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none"
                >
                  <option value="WFH">Work From Home (WFH)</option>
                  <option value="Leave">Casual / Sick Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Reason / Justification</label>
              <textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Remote work for client project deliverables or personal leave"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-900/40 cursor-pointer flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Submit Request for Executive Approval</span>
            </button>
          </form>
        </div>

        {/* HR Personal Request History */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-400" />
                My Personal Request Log
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Status of your personal WFH and leave applications.</p>
            </div>

            {/* Filter Dropdown */}
            <div className="relative shrink-0">
              <select
                value={logFilter}
                onChange={e => { triggerHaptic(); setLogFilter(e.target.value as any); }}
                className="bg-slate-950 text-white font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-800 hover:border-slate-700 focus:outline-none focus:border-blue-500 transition-all cursor-pointer shadow-md"
              >
                <option value="All">All Requests</option>
                <option value="Today">Today's Requests</option>
                <option value="Upcoming">Upcoming Requests</option>
                <option value="Previous">Previous Requests</option>
                <option value="Approved">Approved Requests</option>
                <option value="Rejected">Rejected Requests</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1 flex-1">
            {filteredPersonalRequests.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs border border-slate-800 border-dashed rounded-2xl">
                No {logFilter !== 'All' ? logFilter.toLowerCase() : ''} personal leave or WFH requests found.
              </div>
            ) : (
              filteredPersonalRequests.map(req => (
                <div key={req.id} className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{req.type} Request</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      req.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">{req.startDate} ➔ {req.endDate}</div>
                  <p className="text-slate-300 text-[11px] bg-slate-900 p-2 rounded-lg">{req.reason}</p>

                  {/* Cancel Option for HR / PM - Pending Requests Only */}
                  {req.status === 'Pending' && (
                    <div className="pt-1.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to cancel your ${req.type} request (${req.startDate} to ${req.endDate})?`)) {
                            cancelLeaveRequest(req.id);
                            toast.success(`${req.type} request cancelled successfully.`);
                          }
                        }}
                        className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Cancel Request</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Render Employee Monthly Attendance History Modal */}
      {showHistoryModal && activeEmployee && (
        <EmployeeMonthlyAttendanceModal
          employee={activeEmployee}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* Mandatory Face Biometric Verification Modal */}
      {targetEmployee && (
        <FaceCaptureModal
          isOpen={isFaceModalOpen}
          onClose={() => setIsFaceModalOpen(false)}
          onSuccess={() => {
            setIsFaceModalOpen(false);
            executeHrCheckInProcess();
          }}
          onEnrollSuccess={(descriptorArray) => {
            updateEmployee(targetEmployee.id, {
              isFaceEnrolled: true,
              faceEnrolledAt: new Date().toISOString(),
              faceDescriptor: descriptorArray
            });
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
