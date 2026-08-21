import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Check, X, Clock, CalendarDays, Plus, Send, Calendar, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '../../hooks/useHaptic';
import { isEmployeeMatch } from '../../lib/attendanceEngine';
import { todayInIST } from '../../lib/absoluteTime';

export const EmployeeLeaveTab: React.FC = () => {
  const { activeEmployee, leaveRequests, submitLeaveRequest, cancelLeaveRequest } = useAuth();
  const { triggerHaptic } = useHaptic();
  
  const [type, setType] = useState<'Leave' | 'WFH'>('WFH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{success: boolean; message: string} | null>(null);

  const [filterType, setFilterType] = useState<'All' | 'Leave' | 'WFH'>('All');
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
    if (filterType !== 'All' && r.type !== filterType) {
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
        type,
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

  const isWfhDisabledForEmployee = 
    activeEmployee?.email?.toLowerCase().includes('asbin') || 
    activeEmployee?.employeeId === 'KSS2407004' || 
    (activeEmployee?.fullName || '').toLowerCase().includes('asbin');

  return (
    <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-4 sm:p-8 shadow-2xl w-full space-y-6 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4 mb-2">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400 shrink-0" />
            <span>{isWfhDisabledForEmployee ? 'My Leave Requests' : 'My Leave & WFH Requests'}</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">Submit new requests and track your 4-stage approval status.</p>
        </div>
        <div className={`grid ${isWfhDisabledForEmployee ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5 w-full sm:w-auto shrink-0`}>
          {!isWfhDisabledForEmployee && (
            <button
              onClick={() => { setType('WFH'); setShowForm(true); setFeedback(null); }}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 ${showForm && type === 'WFH' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'} hover:bg-purple-500 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer w-full`}
            >
              <Plus className="w-4 h-4" />
              <span>Request WFH</span>
            </button>
          )}
          <button
            onClick={() => { setType('Leave'); setShowForm(true); setFeedback(null); }}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 ${showForm && type === 'Leave' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300'} hover:bg-orange-500 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer w-full`}
          >
            <Plus className="w-4 h-4" />
            <span>Request Leave</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${feedback.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {feedback.success ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-950/50 p-4 sm:p-6 rounded-2xl border border-slate-800/60 space-y-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Request Type</label>
              <div className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center h-[42px]">
                {type === 'WFH' ? (
                  <span className="text-purple-400">Work From Home (WFH)</span>
                ) : (
                  <span className="text-orange-400">Time Off / Leave</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reason / Notes</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Provide a brief explanation for your request..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-colors shadow-lg shadow-blue-900/20 w-full sm:w-auto cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--accent-blue)] shrink-0" />
            <span>Request History</span>
          </h3>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            {/* Time Filter Dropdown */}
            <select
              value={timeFilter}
              onChange={e => { triggerHaptic(); setTimeFilter(e.target.value as any); }}
              className="bg-slate-950 text-white font-bold text-xs px-3 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-all cursor-pointer shadow-md w-full"
            >
              <option value="All">All Requests</option>
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
              <option value="All">All Types</option>
              <option value="Leave">Leave Only</option>
              <option value="WFH">WFH Only</option>
            </select>
          </div>
        </div>
        
        <div className="space-y-4">
          {filteredMyRequests.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 flex flex-col items-center justify-center text-center bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-3xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <h3 className="text-[var(--text-primary)] font-bold text-sm">No {filterType !== 'All' ? filterType : ''} requests yet</h3>
              <p className="text-[var(--text-tertiary)] text-xs mt-1 max-w-[200px]">When you apply for leave or WFH, it will appear here.</p>
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
                  currentStatus === 'Approved' ? 'var(--accent-emerald)' : 
                  currentStatus === 'Rejected' ? 'var(--accent-rose)' : 
                  'var(--accent-amber)';

                const Icon = currentStatus === 'Approved' ? Check : currentStatus === 'Rejected' ? X : Clock;

                return (
                  <motion.div 
                    key={req.id} 
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
                    }}
                    className="bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-sm)] flex flex-col relative overflow-hidden"
                    style={{ borderLeft: `4px solid ${statusColor}` }}
                  >
                    <div className="absolute top-0 right-0 h-[60px] w-[150px] opacity-10 pointer-events-none" style={{ background: `radial-gradient(ellipse at top right, ${statusColor}, transparent)` }} />
                    
                    <div className="flex items-start justify-between mb-3 relative z-10">
                      <div>
                        <span className="font-mono text-[10px] text-[var(--text-tertiary)] font-black uppercase tracking-wider mb-1 block">
                          {req.id}
                        </span>
                        <div className="text-[var(--text-primary)] font-bold text-base flex items-center gap-2 tabular-nums">
                          {req.startDate}
                          {req.startDate !== req.endDate && (
                            <>
                              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
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
                    <div className="flex items-center gap-1 my-2.5 text-[10px] font-bold flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded border ${pmState === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : pmState === 'Rejected' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : pmState === 'N/A' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                        PM: {pmState}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                      <span className={`px-1.5 py-0.5 rounded border ${hrState === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : hrState === 'Rejected' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : hrState === 'N/A' ? 'bg-slate-800 border-slate-700 text-slate-400' : pmState === 'Approved' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
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

                    <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 relative z-10">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        req.type === 'WFH' ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]' : 'bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]'
                      }`}>
                        {req.type}
                      </span>
                      
                      {currentStatus !== 'Pending' ? (
                        <span className="text-[var(--text-tertiary)] text-[10px] max-w-[200px] truncate" title={req.reviewNotes || `Reviewed by ${req.reviewedBy}`}>
                          {req.reviewNotes || `Final Sanction by ${req.reviewedBy || 'Executive Board'}`}
                        </span>
                      ) : (
                        <button 
                          onClick={() => {
                            triggerHaptic('warning');
                            if (window.confirm(`Cancel this ${req.type} request for ${req.startDate}?`)) {
                              cancelLeaveRequest(req.id);
                              setFeedback({ success: true, message: `${req.type} request cancelled successfully.` });
                              setTimeout(() => setFeedback(null), 3000);
                            }
                          }} 
                          className="text-[10px] font-bold text-[var(--accent-rose)] bg-[var(--accent-rose)]/10 border border-[var(--accent-rose)]/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all hover:bg-[var(--accent-rose)]/20 flex items-center gap-1"
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
    </div>
  );
};
