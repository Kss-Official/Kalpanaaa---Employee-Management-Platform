import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Check, X, Clock, CalendarDays, Plus, Send, Calendar, ChevronRight, 
  Palmtree, Stethoscope, Info, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '../../hooks/useHaptic';
import { 
  isEmployeeMatch, 
  computeEmployeeLeaveBalance, 
  computeSickLeaveBalance,
  computeEarnLeaveMonthlyCreditHistory,
  computeSickLeaveCreditHistory
} from '../../lib/attendanceEngine';
import { todayInIST } from '../../lib/absoluteTime';

export const EmployeeLeaveTab: React.FC = () => {
  const { activeEmployee, leaveRequests, submitLeaveRequest, cancelLeaveRequest } = useAuth();
  const { triggerHaptic } = useHaptic();
  
  const [type, setType] = useState<'Earn Leave' | 'Sick Leave' | 'WFH'>('Earn Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{success: boolean; message: string} | null>(null);

  // Credit Breakdown Modals State
  const [isEarnLeaveModalOpen, setIsEarnLeaveModalOpen] = useState(false);
  const [isSickLeaveModalOpen, setIsSickLeaveModalOpen] = useState(false);

  const [filterType, setFilterType] = useState<'All' | 'Earn Leave' | 'Sick Leave' | 'WFH'>('All');
  const [timeFilter, setTimeFilter] = useState<'All' | 'Today' | 'Upcoming' | 'Previous' | 'Approved' | 'Rejected'>('All');
  const todayStr = todayInIST();

  const myRequests = leaveRequests.filter(r => 
    (r.employeeUid && activeEmployee?.uid && r.employeeUid === activeEmployee.uid) ||
    isEmployeeMatch(activeEmployee, r.employeeId) || 
    r.employeeId === activeEmployee?.id || 
    r.employeeId === activeEmployee?.employeeId || 
    (r.employeeName && activeEmployee?.fullName && r.employeeName.trim().toLowerCase() === activeEmployee.fullName.trim().toLowerCase())
  );

  const filteredMyRequests = myRequests.filter(r => {
    // Normalise legacy 'Leave' type to 'Earn Leave'
    const normalisedType = r.type === 'Leave' ? 'Earn Leave' : r.type;

    if (filterType !== 'All' && normalisedType !== filterType) {
      return false;
    }
    if (timeFilter === 'Today') {
      const isActiveToday = r.startDate <= todayStr && r.endDate >= todayStr;
      const isSubmittedToday = r.requestDate?.startsWith(todayStr);
      return isActiveToday || isSubmittedToday;
    }
    if (timeFilter === 'Upcoming') {
      return r.startDate > todayStr;
    }
    if (timeFilter === 'Previous') {
      return r.endDate < todayStr || r.status === 'Approved' || r.status === 'Rejected';
    }
    if (timeFilter === 'Approved') {
      return r.status === 'Approved';
    }
    if (timeFilter === 'Rejected') {
      return r.status === 'Rejected';
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!startDate || !endDate || !reason) {
      setFeedback({ success: false, message: 'Please fill out all fields.' });
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setFeedback({ success: false, message: 'End date cannot be before start date.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await submitLeaveRequest({
        employeeUid: activeEmployee?.uid,
        employeeId: activeEmployee?.employeeId || activeEmployee?.id || '',
        employeeName: activeEmployee?.fullName || 'Employee',
        department: activeEmployee?.department || 'Engineering',
        employeeRole: activeEmployee?.role || 'EMPLOYEE',
        pmUid: activeEmployee?.pmUid || activeEmployee?.reportingManagerUid || 'uid-KSS2407003',
        type: type === 'WFH' ? 'WFH' : type,
        leaveCategory: type === 'WFH' ? 'WFH' : type,
        startDate,
        endDate,
        reason
      });

      setFeedback({ success: true, message: `${type} request submitted successfully.` });
      setStartDate('');
      setEndDate('');
      setReason('');
      setShowForm(false);
    } catch (err: any) {
      setFeedback({ success: false, message: err?.message || 'Failed to submit request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const myEarnLeave = computeEmployeeLeaveBalance(activeEmployee as any, leaveRequests);
  const mySickLeave = computeSickLeaveBalance(activeEmployee as any, leaveRequests);
  const earnLeaveHistory = computeEarnLeaveMonthlyCreditHistory(activeEmployee as any);
  const sickLeaveHistory = computeSickLeaveCreditHistory(activeEmployee as any);

  return (
    <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-4 sm:p-8 shadow-2xl w-full space-y-6 backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4 mb-2">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400 shrink-0" />
            <span>My Leave &amp; WFH Requests</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">
            Submit Earn Leave, Sick Leave, or WFH requests and track your 4-stage approval status.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={() => { triggerHaptic(); setType('WFH'); setShowForm(true); setFeedback(null); }}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 ${showForm && type === 'WFH' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'} hover:bg-purple-500 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer w-full`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>WFH</span>
          </button>
          <button
            onClick={() => { triggerHaptic(); setType('Earn Leave'); setShowForm(true); setFeedback(null); }}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 ${showForm && type === 'Earn Leave' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'} hover:bg-amber-500 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer w-full`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Earn Leave</span>
          </button>
          <button
            onClick={() => { triggerHaptic(); setType('Sick Leave'); setShowForm(true); setFeedback(null); }}
            className={`flex items-center justify-center gap-1 px-3 py-2.5 ${showForm && type === 'Sick Leave' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'} hover:bg-rose-500 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer w-full`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Sick Leave</span>
          </button>
        </div>
      </div>

      {/* ── Leave Quota Cards (Earn Leave & Sick Leave) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        
        {/* Card 1: Interactive Earn Leave Balance Card */}
        <button
          type="button"
          onClick={() => { triggerHaptic(); setIsEarnLeaveModalOpen(true); }}
          className="bg-slate-950/70 hover:bg-slate-950 border border-purple-500/30 hover:border-purple-500/60 rounded-2xl p-4 flex items-center justify-between text-left transition-all group cursor-pointer shadow-lg shadow-purple-950/20 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Palmtree className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Earn Leave Balance</span>
                <span className="text-[9px] text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">Monthly</span>
              </div>
              <span className="text-sm sm:text-base font-black text-purple-300 font-mono block mt-0.5">
                {myEarnLeave.balance} Days Left
              </span>
              <span className="text-[10px] text-purple-400/80 font-semibold group-hover:text-purple-300 flex items-center gap-1 mt-0.5">
                <span>View Monthly Credit History</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-medium hidden sm:inline text-right">
            1 day/mo (1st date)
          </span>
        </button>

        {/* Card 2: Interactive Sick Leave Card */}
        <button
          type="button"
          onClick={() => { triggerHaptic(); setIsSickLeaveModalOpen(true); }}
          className="bg-slate-950/70 hover:bg-slate-950 border border-rose-500/30 hover:border-rose-500/60 rounded-2xl p-4 flex items-center justify-between text-left transition-all group cursor-pointer shadow-lg shadow-rose-950/20 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sick Leave</span>
                <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">Recurring</span>
              </div>
              <span className="text-sm sm:text-base font-black text-rose-300 font-mono block mt-0.5">
                {mySickLeave.balance} {mySickLeave.balance === 1 ? 'Day' : 'Days'} Left
              </span>
              <span className="text-[10px] text-rose-400/80 font-semibold group-hover:text-rose-300 flex items-center gap-1 mt-0.5">
                <span>1 day / 3 months ({mySickLeave.taken} used)</span>
                <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-medium hidden sm:inline text-right">
            Traineeship + Qrtly
          </span>
        </button>

        {/* Card 3: Total Approved Leaves Taken */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Leaves Taken</span>
              <span className="text-sm sm:text-base font-black text-amber-300 font-mono block mt-0.5">
                {myEarnLeave.taken + mySickLeave.taken} Days Taken
              </span>
              <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                EL: {myEarnLeave.taken} • SL: {mySickLeave.taken}
              </span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 font-medium hidden sm:inline text-right">
            Approved only
          </span>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${feedback.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {feedback.success ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── Leave Application Form ── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-950/50 p-4 sm:p-6 rounded-2xl border border-slate-800/60 space-y-4 mb-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Request Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer h-[42px]"
              >
                <option value="Earn Leave">Earn Leave (EL)</option>
                <option value="Sick Leave">Sick Leave (SL)</option>
                <option value="WFH">Work From Home (WFH)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark] h-[42px]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark] h-[42px]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason / Notes</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Provide a brief explanation for your leave or WFH request..."
              rows={3}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-colors shadow-lg shadow-blue-900/20 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : `Submit ${type} Request`}</span>
            </button>
          </div>
        </form>
      )}

      {/* ── Request History Section ── */}
      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Request History</span>
          </h3>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            {/* Time Filter Dropdown */}
            <select
              value={timeFilter}
              onChange={e => { triggerHaptic(); setTimeFilter(e.target.value as any); }}
              className="bg-slate-950 text-white font-bold text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-all cursor-pointer shadow-md w-full"
            >
              <option value="All">All Timeframes</option>
              <option value="Today">Today's Requests</option>
              <option value="Upcoming">Upcoming Requests</option>
              <option value="Previous">Previous Requests</option>
              <option value="Approved">Approved Requests</option>
              <option value="Rejected">Rejected Requests</option>
            </select>

            {/* Type Filter Select */}
            <select
              value={filterType}
              onChange={e => { triggerHaptic(); setFilterType(e.target.value as any); }}
              className="bg-slate-950 text-white font-bold text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-all cursor-pointer shadow-md w-full"
            >
              <option value="All">All Categories</option>
              <option value="Earn Leave">Earn Leave</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="WFH">WFH Only</option>
            </select>
          </div>
        </div>
        
        <div className="space-y-4">
          {filteredMyRequests.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 flex flex-col items-center justify-center text-center bg-slate-950/60 border border-slate-800 rounded-3xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mb-4 text-slate-500">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-white font-bold text-sm">No {filterType !== 'All' ? filterType : ''} requests found</h3>
              <p className="text-slate-500 text-xs mt-1 max-w-xs">When you apply for Earn Leave, Sick Leave, or WFH, it will appear here.</p>
            </motion.div>
          ) : (
            <motion.div 
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: { opacity: 1, transition: { staggerChildren: 0.05 } }
              }}
              className="space-y-3"
            >
              {filteredMyRequests.map((req) => {
                const isApplicantPmOrHr = req.employeeRole === 'PROJECT_MANAGER' || req.employeeRole === 'HR_ADMIN' ||
                  (req.department || '').toLowerCase().includes('hr') ||
                  (req.employeeName || '').toLowerCase().includes('koushik') ||
                  (req.employeeName || '').toLowerCase().includes('abhinaya');

                const pmState = isApplicantPmOrHr ? 'N/A' : (req.pmStatus || 'Pending');
                const hrState = isApplicantPmOrHr ? 'N/A' : (req.hrStatus || (pmState === 'Approved' ? 'Pending' : 'Waiting PM'));
                const ceoState = req.ceoStatus || (isApplicantPmOrHr ? 'Pending' : hrState === 'Approved' ? 'Pending' : 'Waiting HR');
                const ctoState = req.ctoStatus || (ceoState === 'Approved' ? 'Pending' : 'Waiting CEO');

                const isFullyApproved = (pmState === 'Approved' || pmState === 'N/A') && (hrState === 'Approved' || hrState === 'N/A') && ceoState === 'Approved' && ctoState === 'Approved';
                const isRejected = pmState === 'Rejected' || hrState === 'Rejected' || ceoState === 'Rejected' || ctoState === 'Rejected';
                const currentStatus = isFullyApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending';

                const statusColor = 
                  currentStatus === 'Approved' ? 'var(--accent-emerald, #10b981)' : 
                  currentStatus === 'Rejected' ? 'var(--accent-rose, #f43f5e)' : 
                  'var(--accent-amber, #f59e0b)';

                const Icon = currentStatus === 'Approved' ? Check : currentStatus === 'Rejected' ? X : Clock;
                const displayType = req.type === 'Leave' ? 'Earn Leave' : req.type;

                return (
                  <motion.div 
                    key={req.id} 
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                    }}
                    className="bg-slate-950/80 rounded-2xl border border-slate-800 p-4 shadow-md flex flex-col relative overflow-hidden"
                    style={{ borderLeft: `4px solid ${statusColor}` }}
                  >
                    <div className="flex items-start justify-between mb-3 relative z-10">
                      <div>
                        <span className="font-mono text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1 block">
                          {req.id}
                        </span>
                        <div className="text-white font-bold text-base flex items-center gap-2 tabular-nums">
                          {req.startDate}
                          {req.startDate !== req.endDate && (
                            <>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                              {req.endDate}
                            </>
                          )}
                        </div>
                      </div>
                      <span 
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: statusColor, backgroundColor: `${statusColor}15`, border: `1px solid ${statusColor}30` }}
                      >
                        <Icon className="w-3 h-3" />
                        {currentStatus}
                      </span>
                    </div>

                    {/* 4-Stage Pipeline Progress Tracker */}
                    <div className="flex items-center gap-1 my-2 text-[10px] font-bold flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded border ${pmState === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : pmState === 'Rejected' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : pmState === 'N/A' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                        PM: {pmState}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                      <span className={`px-1.5 py-0.5 rounded border ${hrState === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : hrState === 'Rejected' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : hrState === 'N/A' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                        HR: {hrState === 'Approved' ? 'Approved' : hrState === 'Rejected' ? 'Rejected' : hrState === 'N/A' ? 'N/A' : pmState === 'Approved' ? 'Pending' : 'Waiting PM'}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                      <span className={`px-1.5 py-0.5 rounded border ${ceoState === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : ceoState === 'Rejected' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : (hrState === 'Approved' || isApplicantPmOrHr) ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                        CEO: {ceoState === 'Approved' ? 'Approved' : ceoState === 'Rejected' ? 'Rejected' : (hrState === 'Approved' || isApplicantPmOrHr) ? 'Pending' : 'Waiting HR'}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                      <span className={`px-1.5 py-0.5 rounded border ${ctoState === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : ctoState === 'Rejected' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : ceoState === 'Approved' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                        CTO: {ctoState === 'Approved' ? 'Approved' : ctoState === 'Rejected' ? 'Rejected' : ceoState === 'Approved' ? 'Pending' : 'Waiting CEO'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800 pt-3 relative z-10">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        displayType === 'WFH' 
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                          : displayType === 'Sick Leave'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {displayType}
                      </span>
                      
                      {currentStatus !== 'Pending' ? (
                        <span className="text-slate-400 text-[10px] max-w-[200px] truncate" title={req.reviewNotes || `Reviewed by ${req.reviewedBy}`}>
                          {req.reviewNotes || `Final Sanction by ${req.reviewedBy || 'Executive Board'}`}
                        </span>
                      ) : (
                        <button 
                          onClick={() => {
                            triggerHaptic('warning');
                            if (window.confirm(`Cancel this ${displayType} request for ${req.startDate}?`)) {
                              cancelLeaveRequest(req.id);
                              setFeedback({ success: true, message: `${displayType} request cancelled successfully.` });
                              setTimeout(() => setFeedback(null), 3000);
                            }
                          }} 
                          className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all hover:bg-rose-500/20 flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" /> Cancel Request
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── MODAL 1: Earn Leave Monthly Credit History Table ── */}
      <AnimatePresence>
        {isEarnLeaveModalOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Palmtree className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Earn Leave Monthly Credit History</h3>
                    <p className="text-xs text-slate-400">1 Earn Leave credited on the 1st date of each eligible month (Zero-base policy)</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEarnLeaveModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                <div className="bg-slate-950/60 rounded-2xl border border-slate-800/80 p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Employee</span>
                    <span className="font-black text-white">{activeEmployee?.fullName} ({activeEmployee?.employeeId})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Joining Date</span>
                    <span className="font-mono text-purple-300 font-bold">{activeEmployee?.joiningDate || '2026-01-01'}</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Month</th>
                        <th className="py-3 px-4">Credited Date</th>
                        <th className="py-3 px-4 text-right">Earn Leave Credited</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {earnLeaveHistory.map((item) => (
                        <tr key={item.monthKey} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span>{item.monthLabel}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                            {item.creditedDate}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg border ${
                              item.creditedDays > 0 
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' 
                                : 'bg-slate-800/50 text-slate-500 border-slate-800'
                            }`}>
                              {item.creditedDays} {item.creditedDays === 1 ? 'day' : 'days'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/20 text-[11px] text-purple-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <p>
                    Earn Leaves are credited chronologically on the 1st of every month for active employment tenure. Approved Earn Leave requests deduct from the active quota.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setIsEarnLeaveModalOpen(false)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: Sick Leave Recurring & Traineeship Credit History Modal ── */}
      <AnimatePresence>
        {isSickLeaveModalOpen && (
          <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Sick Leave Entitlement &amp; History</h3>
                    <p className="text-xs text-slate-400">1 Sick Leave day during 3-month traineeship, plus 1 day every 3 months recurring</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSickLeaveModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                {/* Summary Row */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Credited</span>
                    <span className="text-lg font-black text-white font-mono">{mySickLeave.credited} Days</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Used / Taken</span>
                    <span className="text-lg font-black text-rose-400 font-mono">{mySickLeave.taken} Days</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining</span>
                    <span className="text-lg font-black text-rose-300 font-mono">{mySickLeave.balance} Days</span>
                  </div>
                </div>

                {/* Periods Table */}
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4">Date Window</th>
                        <th className="py-3 px-4 text-right">Sick Leave Credited</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {sickLeaveHistory.map((item) => (
                        <tr key={item.periodKey} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{item.periodLabel}</span>
                              {item.isTraineeship && (
                                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded">
                                  Traineeship
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                            {item.startDate} → {item.endDate}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg border ${
                              item.status === 'Credited' 
                                ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
                                : 'bg-slate-800/50 text-slate-500 border-slate-800'
                            }`}>
                              {item.creditedDays} day ({item.status})
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20 text-[11px] text-rose-300 flex items-start gap-2">
                  <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p>
                    Sick Leave entitlements are calculated from the employee's joining date. 1 Sick Leave day is allocated for the 3-month traineeship tenure, followed by 1 day every 3 subsequent calendar months.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setIsSickLeaveModalOpen(false)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
