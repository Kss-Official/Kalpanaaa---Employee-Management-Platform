import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Check, X, Clock, CalendarDays, FileText, Calendar, ChevronRight, ChevronLeft, Building2, ShieldCheck, Plus, CheckCircle2, XCircle, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '../../hooks/useHaptic';
import { LeaveRequest } from '../../types';

export const LeaveApprovalsView: React.FC = () => {
  const { leaveRequests, updateLeaveRequestStatus, activeEmployee, employees, settings, assignCompanyWideWfh, removeCompanyWideWfh, companyWideWfhDates, role } = useAuth();
  const { triggerHaptic } = useHaptic();

  const effectiveRole = activeEmployee?.role || role || 'SUPER_ADMIN';
  const isPm = effectiveRole === 'PROJECT_MANAGER';
  const todayStr = new Date().toISOString().split('T')[0];
  const [wfhDateInput, setWfhDateInput] = useState(todayStr);
  const [wfhFeedback, setWfhFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const isCeoOrCto = activeEmployee?.role === 'SUPER_ADMIN' ||
    (activeEmployee?.designation || '').toUpperCase().includes('CEO') ||
    (activeEmployee?.designation || '').toUpperCase().includes('CTO') ||
    (activeEmployee?.designation || '').toUpperCase().includes('FOUNDER') ||
    (activeEmployee?.designation || '').toUpperCase().includes('CIO') ||
    activeEmployee?.employeeId === 'CEO001' ||
    activeEmployee?.employeeId === 'CTO001';

  const handleAssignOfficeWfh = () => {
    if (!wfhDateInput) return;
    const res = assignCompanyWideWfh(wfhDateInput);
    setWfhFeedback(res);
    setTimeout(() => setWfhFeedback(null), 5000);
  };

  const handleRemoveOfficeWfh = (d: string) => {
    const res = removeCompanyWideWfh(d);
    setWfhFeedback(res);
    setTimeout(() => setWfhFeedback(null), 5000);
  };

  const canPerformStageAction = (req: LeaveRequest) => {
    if (req.status !== 'Pending') return false;

    // Self-request check: Cannot approve/reject your own request!
    const isSelfRequest = req.employeeId === activeEmployee?.id ||
      req.employeeId === activeEmployee?.employeeId ||
      req.employeeName === activeEmployee?.fullName;
    if (isSelfRequest) return false;

    const role = activeEmployee?.role || effectiveRole;
    const desig = (activeEmployee?.designation || '').toUpperCase();
    const empId = activeEmployee?.employeeId || activeEmployee?.id || '';
    const name = (activeEmployee?.fullName || '').toLowerCase();

    // Is applicant a PM, HR, or Executive?
    const isApplicantPmOrHr = req.employeeRole === 'PROJECT_MANAGER' ||
      req.employeeRole === 'HR_ADMIN' ||
      req.employeeRole === 'SUPER_ADMIN' ||
      (req.department || '').toLowerCase().includes('hr') ||
      (req.department || '').toLowerCase().includes('management') ||
      (req.employeeName || '').toLowerCase().includes('koushik') ||
      (req.employeeName || '').toLowerCase().includes('abhinaya');

    // 1. PM Stage: Can action standard employee requests at PM stage (pmStatus === 'Pending')
    if (role === 'PROJECT_MANAGER' || desig.includes('PROJECT MANAGER') || name.includes('koushik')) {
      if (isApplicantPmOrHr) return false; // PM/HR requests bypass PM and go directly to CEO!
      return req.pmStatus === 'Pending';
    }

    // 2. HR Stage (Abhinaya V / HR Admin):
    // Standard employees: PM must approve first (pmStatus === 'Approved' && hrStatus === 'Pending')
    if (role === 'HR_ADMIN' || desig.includes('HR') || name.includes('abhinaya')) {
      if (isApplicantPmOrHr) return false; // Self/PM/HR requests bypass HR stage
      return req.pmStatus === 'Approved' && (req.hrStatus === 'Pending' || req.hrStatus === 'Waiting PM');
    }

    // 3. CEO Stage (Akshit Ujjain):
    // Standard employees: HR must approve first (hrStatus === 'Approved' && ceoStatus === 'Pending')
    // PM & HR employees: DIRECTLY GOES TO CEO (ceoStatus === 'Pending')
    if (name.includes('akshit') || desig.includes('CEO') || empId === 'CEO001' || empId === 'KSS2407002') {
      if (isApplicantPmOrHr) {
        return req.ceoStatus === 'Pending';
      }
      const isHrPassed = req.hrStatus === 'Approved' || req.hrStatus === 'N/A';
      return isHrPassed && (req.ceoStatus === 'Pending' || req.ceoStatus === 'Waiting HR' || req.ceoStatus === 'Waiting PM');
    }

    // 4. CTO Stage (Gaurav Kumar Tripathi):
    // Requires CEO approval first (ceoStatus === 'Approved' && ctoStatus === 'Pending')
    if (name.includes('gaurav') || desig.includes('CTO') || desig.includes('CIO') || empId === 'CTO001' || empId === 'KSS2407001') {
      return req.ceoStatus === 'Approved' && (req.ctoStatus === 'Pending' || req.ctoStatus === 'Waiting CEO');
    }

    return false;
  };

  const handleApprove = (id: string) => {
    triggerHaptic('success');
    updateLeaveRequestStatus(id, 'Approved', activeEmployee?.fullName || 'Executive');
  };

  const handleReject = (id: string) => {
    triggerHaptic('error');
    updateLeaveRequestStatus(id, 'Rejected', activeEmployee?.fullName || 'Executive');
  };

  const [filterType, setFilterType] = useState<'All' | 'Leave' | 'WFH'>('All');

  const isRequestFullyApproved = (req: LeaveRequest) => {
    if (req.status === 'Approved') return true;

    const isApplicantPmOrHr = req.employeeRole === 'PROJECT_MANAGER' || req.employeeRole === 'HR_ADMIN' ||
      (req.department || '').toLowerCase().includes('hr') ||
      (req.employeeName || '').toLowerCase().includes('koushik') ||
      (req.employeeName || '').toLowerCase().includes('abhinaya');

    const pmState = isApplicantPmOrHr ? 'N/A' : (req.pmStatus || 'Pending');
    const hrState = isApplicantPmOrHr ? 'N/A' : (req.hrStatus || (pmState === 'Approved' ? 'Pending' : 'Waiting PM'));
    const ceoState = req.ceoStatus || (isApplicantPmOrHr ? 'Pending' : hrState === 'Approved' ? 'Pending' : 'Waiting HR');
    const ctoState = req.ctoStatus || (ceoState === 'Approved' ? 'Pending' : 'Waiting CEO');

    const isPmPassed = pmState === 'Approved' || pmState === 'N/A';
    const isHrPassed = hrState === 'Approved' || hrState === 'N/A';

    return isPmPassed && isHrPassed && ceoState === 'Approved' && ctoState === 'Approved';
  };

  const isRequestRejected = (req: LeaveRequest) => {
    return req.status === 'Rejected' || 
      req.pmStatus === 'Rejected' || 
      req.hrStatus === 'Rejected' || 
      req.ceoStatus === 'Rejected' || 
      req.ctoStatus === 'Rejected';
  };

  const pendingRequests = leaveRequests.filter(req => {
    const fullyApproved = isRequestFullyApproved(req);
    const rejected = isRequestRejected(req);
    if (fullyApproved || rejected) return false;

    if (filterType !== 'All' && req.type !== filterType) {
      return false;
    }

    if (isPm) {
      const isHrEmployee = (req.department || '').toLowerCase().includes('hr') ||
        (req.employeeRole || '').toLowerCase().includes('hr') ||
        (() => {
          const emp = employees.find(e => e.id === req.employeeId || e.employeeId === req.employeeId || e.fullName === req.employeeName);
          return emp?.department?.toLowerCase().includes('hr') || emp?.role === 'HR_ADMIN';
        })();
      if (isHrEmployee) return false;

      if (req.pmStatus === 'N/A' || req.employeeRole === 'PROJECT_MANAGER' || req.employeeId === activeEmployee?.id || req.employeeId === activeEmployee?.employeeId || req.employeeName === activeEmployee?.fullName) {
        return false;
      }
    } else if (isHr) {
      // HR should only see requests after PM approval (or if PM stage is N/A for HR/PM/Exec applicants)
      const isPmStagePassed = req.pmStatus === 'Approved' || req.pmStatus === 'N/A' || req.pmStatus === 'Bypassed';
      if (!isPmStagePassed) return false;
    }
    return true;
  });

  const pastRequests = leaveRequests.filter(req => {
    const fullyApproved = isRequestFullyApproved(req);
    const rejected = isRequestRejected(req);
    if (!fullyApproved && !rejected) return false;

    if (filterType !== 'All' && req.type !== filterType) {
      return false;
    }

    if (isPm) {
      const isHrEmployee = (req.department || '').toLowerCase().includes('hr') ||
        (req.employeeRole || '').toLowerCase().includes('hr') ||
        (() => {
          const emp = employees.find(e => e.id === req.employeeId || e.employeeId === req.employeeId || e.fullName === req.employeeName);
          return emp?.department?.toLowerCase().includes('hr') || emp?.role === 'HR_ADMIN';
        })();
      if (isHrEmployee) return false;
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState<'pending' | 'past'>('pending');

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] p-4 sm:p-6 rounded-3xl shadow-[var(--shadow-md)] relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent-blue)]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 space-y-1">
          <h1 className="text-lg sm:text-2xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 shrink-0">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span>Leave &amp; WFH Sanctions</span>
          </h1>
          {(() => {
            const desig = (activeEmployee?.designation || '').toUpperCase();
            const empId = activeEmployee?.employeeId || activeEmployee?.id || '';
            const name = (activeEmployee?.fullName || '').toLowerCase();
            const r = activeEmployee?.role || effectiveRole;

            if (r === 'HR_ADMIN') {
              return (
                <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] sm:text-xs font-extrabold leading-snug break-words max-w-full">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> 
                  <span>HR Read-Only Observer Ledger — Logged in as {activeEmployee?.fullName || 'Abhinaya V'}</span>
                </div>
              );
            }
            if (name.includes('gaurav') || desig.includes('CTO') || desig.includes('CIO') || empId === 'CTO001' || empId === 'KSS2407001') {
              return (
                <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] sm:text-xs font-extrabold leading-snug break-words max-w-full">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> 
                  <span>CTO/MD Final Sanction Portal — Logged in as {activeEmployee?.fullName || 'Gaurav Kumar Tripathi'}</span>
                </div>
              );
            }
            if (name.includes('akshit') || desig.includes('CEO') || empId === 'CEO001' || empId === 'KSS2407002') {
              return (
                <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[11px] sm:text-xs font-extrabold leading-snug break-words max-w-full">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> 
                  <span>CEO Sanction Portal — Logged in as {activeEmployee?.fullName || 'Akshit Ujjain'}</span>
                </div>
              );
            }
            if (r === 'PROJECT_MANAGER' || desig.includes('PROJECT MANAGER') || name.includes('koushik')) {
              return (
                <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] sm:text-xs font-extrabold leading-snug break-words max-w-full">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> 
                  <span>PM Team Review Portal — Logged in as {activeEmployee?.fullName || 'D. Koushik'}</span>
                </div>
              );
            }
            return (
              <p className="text-[var(--text-secondary)] text-xs sm:text-sm mt-1 font-medium">Review and manage employee leave and remote work requests.</p>
            );
          })()}
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 relative z-10 w-full lg:w-auto shrink-0">
          {/* Type Filter Dropdown */}
          <div className="flex items-center justify-between gap-2 bg-[var(--bg-elevated)] px-3 py-2 rounded-xl border border-[var(--border-subtle)] w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-slate-300 sm:hidden">Type:</span>
            </div>
            <select
              value={filterType}
              onChange={(e) => { triggerHaptic(); setFilterType(e.target.value as any); }}
              className="bg-slate-900 border border-slate-800 text-white text-xs font-bold rounded-lg px-2.5 py-1 focus:border-blue-500 focus:outline-hidden cursor-pointer w-full sm:w-auto"
            >
              <option value="All">All Request Types</option>
              <option value="Leave">Leave Requests Only</option>
              <option value="WFH">WFH Requests Only</option>
            </select>
          </div>

          {/* Pending / History Toggle */}
          <div className="flex items-center justify-center gap-1 bg-[var(--bg-elevated)] p-1 rounded-xl border border-[var(--border-subtle)] w-full sm:w-auto">
            <button
              onClick={() => { triggerHaptic(); setActiveTab('pending'); }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg font-bold text-xs transition-all text-center ${
                activeTab === 'pending' 
                  ? 'bg-[var(--accent-blue)] text-white shadow-[var(--shadow-glow-blue)]' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Pending {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </button>
            <button
              onClick={() => { triggerHaptic(); setActiveTab('past'); }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg font-bold text-xs transition-all text-center ${
                activeTab === 'past' 
                  ? 'bg-[var(--accent-blue)] text-white shadow-[var(--shadow-glow-blue)]' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {/* 🏢 CEO & CTO Executive Control: Office-Wide WFH Assignment */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5 sm:mt-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs sm:text-base font-bold text-white flex flex-wrap items-center gap-2 leading-snug">
                <span>CEO &amp; CTO Office-Wide WFH Assignment</span>
                <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold shrink-0">
                  Whole Office
                </span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">Assign Work From Home for all employees on days the physical office is closed or on leave.</p>
            </div>
          </div>

          <div className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 ${
            isCeoOrCto ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            <span>{isCeoOrCto ? 'Executive Clearance Granted' : '🔒 CEO & CTO Clearance Required'}</span>
          </div>
        </div>

        {wfhFeedback && (
          <div className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
            wfhFeedback.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}>
            {wfhFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{wfhFeedback.message}</span>
          </div>
        )}

        {isCeoOrCto ? (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <label className="text-xs font-bold text-slate-300 whitespace-nowrap">Assign Office WFH Date:</label>
              <input 
                type="date" 
                value={wfhDateInput}
                onChange={e => setWfhDateInput(e.target.value)}
                className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-cyan-500 outline-none font-mono"
              />
              <button 
                onClick={handleAssignOfficeWfh}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Publish Whole-Office WFH</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <p className="text-slate-400 text-xs leading-relaxed">
              Only CEO (Akshit) and CTO (Gaurav) have authority to assign Office-Wide WFH. Individual employee WFH requests continue below.
            </p>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold shrink-0 self-start sm:self-auto">
              Read Only
            </span>
          </div>
        )}
      </div>

      {/* Currently Active Office-Wide WFH Dates */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-400 font-semibold">Active Office WFH Dates:</span>
              {(companyWideWfhDates || settings?.companyWideWfhDates || []).length === 0 ? (
                <span className="text-slate-500 text-xs italic">None</span>
              ) : (
                (companyWideWfhDates || settings?.companyWideWfhDates || []).map(d => (
                  <span key={d} className="px-3 py-1 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-2 font-mono font-bold">
                    <span>🏠 {d}</span>
                    <button 
                      onClick={() => handleRemoveOfficeWfh(d)}
                      title="Remove Office-Wide WFH & Re-open Physical Office"
                      className="text-cyan-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {activeTab === 'pending' && pendingRequests.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-20 flex flex-col items-center justify-center text-center bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-3xl"
            >
              <div className="w-24 h-24 mb-6 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--border-subtle)] shadow-[var(--shadow-md)]">
                <Calendar className="w-10 h-10 text-[var(--text-tertiary)] opacity-50" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">You're All Caught Up!</h3>
              <p className="text-[var(--text-secondary)] text-sm max-w-xs">There are no pending leave or WFH requests to review at this time.</p>
            </motion.div>
          )}

          {activeTab === 'past' && pastRequests.length === 0 && (
             <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-20 flex flex-col items-center justify-center text-center bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-3xl"
            >
              <div className="w-24 h-24 mb-6 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--border-subtle)] shadow-[var(--shadow-md)]">
                <FileText className="w-10 h-10 text-[var(--text-tertiary)] opacity-50" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No History</h3>
              <p className="text-[var(--text-secondary)] text-sm max-w-xs">No processed requests found in the system yet.</p>
            </motion.div>
          )}

          {(activeTab === 'pending' ? pendingRequests : pastRequests).map((req, i) => {
            const emp = employees.find(e => e.id === req.employeeId || e.employeeId === req.employeeId);
            const isWfh = req.type === 'WFH';
            const statusColor = req.status === 'Approved' ? 'var(--accent-emerald)' : req.status === 'Rejected' ? 'var(--accent-rose)' : 'var(--accent-amber)';

            const isApplicantPmOrHr = req.employeeRole === 'PROJECT_MANAGER' ||
              req.employeeRole === 'HR_ADMIN' ||
              req.employeeRole === 'SUPER_ADMIN' ||
              (req.department || '').toLowerCase().includes('hr') ||
              (req.department || '').toLowerCase().includes('management') ||
              (req.employeeName || '').toLowerCase().includes('koushik') ||
              (req.employeeName || '').toLowerCase().includes('abhinaya');

            const displayPmStatus = isApplicantPmOrHr ? 'N/A' : (req.pmStatus || 'Pending');
            const displayHrStatus = isApplicantPmOrHr ? 'N/A' : (req.hrStatus || (displayPmStatus === 'Approved' ? 'Pending' : 'Waiting PM'));
            const displayCeoStatus = req.ceoStatus || (isApplicantPmOrHr ? 'Pending' : (displayHrStatus === 'Approved' ? 'Pending' : 'Waiting HR'));
            const displayCtoStatus = req.ctoStatus || (displayCeoStatus === 'Approved' ? 'Pending' : 'Waiting CEO');

            return (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 30 }}
                className="relative bg-[var(--bg-tertiary)] rounded-3xl border border-[var(--border-subtle)] overflow-hidden shadow-[var(--shadow-md)] group"
              >
                {req.status === 'Pending' && (
                  <div className="absolute inset-y-0 left-0 w-24 bg-[var(--accent-emerald)] flex flex-col items-center justify-center text-black font-bold z-0">
                    <Check className="w-8 h-8 mb-1" />
                    <span className="text-[10px] uppercase tracking-widest">Approve</span>
                  </div>
                )}
                {req.status === 'Pending' && (
                  <div className="absolute inset-y-0 right-0 w-24 bg-[var(--accent-rose)] flex flex-col items-center justify-center text-white font-bold z-0">
                    <X className="w-8 h-8 mb-1" />
                    <span className="text-[10px] uppercase tracking-widest">Reject</span>
                  </div>
                )}

                <motion.div
                  data-testid="leave-swipe-card"
                  data-drag-action="swipe"
                  drag={req.status === 'Pending' ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragSnapToOrigin={true}
                  dragElastic={0.4}
                  whileDrag={{ scale: 1.01 }}
                  onDragEnd={(_, info) => {
                    if (req.status !== 'Pending') return;
                    if (info.offset.x > 50 || info.velocity.x > 150) {
                      handleApprove(req.id);
                    } else if (info.offset.x < -50 || info.velocity.x < -150) {
                      handleReject(req.id);
                    }
                  }}
                  className="relative z-10 bg-[var(--bg-tertiary)] p-6 sm:p-8 w-full flex flex-col gap-5 touch-pan-y border-l-4 cursor-grab active:cursor-grabbing select-none"
                  style={{ borderLeftColor: isWfh ? 'var(--accent-violet)' : 'var(--accent-amber)' }}
                >
                  {req.status === 'Pending' && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-50 hidden md:flex">
                      <ChevronLeft className="w-4 h-4 text-[var(--accent-rose)]" />
                      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Swipe to action</span>
                      <ChevronRight className="w-4 h-4 text-[var(--accent-emerald)]" />
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={emp?.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.employeeName || 'User')}&background=111118&color=fff`}
                        alt={req.employeeName}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-[var(--bg-elevated)] shadow-[var(--shadow-sm)]"
                      />
                      <div>
                        <div className="text-lg font-extrabold text-[var(--text-primary)] leading-tight">{req.employeeName}</div>
                        <div className="text-xs text-[var(--text-secondary)] font-medium mt-1 flex items-center gap-2">
                          <span className="font-mono bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded text-[var(--text-tertiary)]">{req.employeeId}</span>
                          <span>•</span>
                          <span>{emp?.department || 'Unknown Dept'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        isWfh 
                          ? 'bg-[var(--accent-violet)]/10 text-[var(--accent-violet)] border-[var(--accent-violet)]/20' 
                          : 'bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] border-[var(--accent-amber)]/20'
                      }`}>
                        {req.type}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                        <span className={`px-2 py-0.5 rounded-md border ${
                          displayPmStatus === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
                          displayPmStatus === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' :
                          displayPmStatus === 'N/A' || displayPmStatus === 'Bypassed' ? 'bg-slate-800/80 text-slate-400 border-slate-700' :
                          'bg-amber-950/60 text-amber-400 border-amber-500/30'
                        }`}>
                          PM: {displayPmStatus}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border ${
                          displayHrStatus === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
                          displayHrStatus === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' :
                          displayHrStatus === 'N/A' || displayHrStatus === 'Bypassed' ? 'bg-slate-800/80 text-slate-400 border-slate-700' :
                          displayHrStatus === 'Pending' ? 'bg-blue-950/60 text-blue-400 border-blue-500/30' :
                          'bg-slate-900 text-slate-500 border-slate-800'
                        }`}>
                          HR: {displayHrStatus}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border ${
                          displayCeoStatus === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
                          displayCeoStatus === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' :
                          displayCeoStatus === 'Pending' ? 'bg-purple-950/60 text-purple-400 border-purple-500/30' :
                          'bg-slate-900 text-slate-500 border-slate-800'
                        }`}>
                          CEO: {displayCeoStatus}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border ${
                          displayCtoStatus === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
                          displayCtoStatus === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' :
                          displayCtoStatus === 'Pending' ? 'bg-cyan-950/60 text-cyan-400 border-cyan-500/30' :
                          'bg-slate-900 text-slate-500 border-slate-800'
                        }`}>
                          CTO/MD: {displayCtoStatus}
                        </span>
                      </div>
                      {req.status !== 'Pending' && (
                        <span 
                          className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5"
                          style={{ color: statusColor, backgroundColor: `${statusColor}15`, borderColor: `${statusColor}30` }}
                        >
                          {req.status === 'Approved' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {req.status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-elevated)] rounded-2xl p-4 border border-[var(--border-subtle)]">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3" /> Duration
                      </span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {req.startDate} {req.startDate !== req.endDate && `→ ${req.endDate}`}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3 h-3" /> Reason
                      </span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {req.reason || 'No reason provided'}
                      </span>
                    </div>
                  </div>

                  {canPerformStageAction(req) ? (
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => handleReject(req.id)}
                        className="flex-1 py-3 bg-[var(--accent-rose)]/10 text-[var(--accent-rose)] border border-[var(--accent-rose)]/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-[var(--accent-rose)]/20 cursor-pointer"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(req.id)}
                        className="flex-1 py-3 bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)] border border-[var(--accent-emerald)]/20 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-[var(--accent-emerald)]/20 cursor-pointer"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                    </div>
                  ) : isRequestFullyApproved(req) ? (
                    <div className="mt-2 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> ✓ Request Fully Sanctioned &amp; Approved Overall
                      </span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Approved</span>
                    </div>
                  ) : isRequestRejected(req) ? (
                    <div className="mt-2 p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-[11px] font-bold text-rose-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-400" /> ✕ Request Rejected
                      </span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">Rejected</span>
                    </div>
                  ) : (
                    <div className="mt-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] font-bold text-slate-400 flex items-center justify-between">
                      {req.employeeId === activeEmployee?.id || req.employeeId === activeEmployee?.employeeId || req.employeeName === activeEmployee?.fullName ? (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> Self-Request — Awaiting Executive Review (CEO &amp; CTO/MD)
                        </span>
                      ) : role === 'HR_ADMIN' || activeEmployee?.role === 'HR_ADMIN' ? (
                        <span className="text-blue-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> HR Observer Mode (Read-Only Status Ledger)
                        </span>
                      ) : (req.pmStatus === 'N/A' || req.employeeRole === 'PROJECT_MANAGER' || req.employeeRole === 'HR_ADMIN') && req.ceoStatus === 'Pending' ? (
                        <span className="text-purple-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> 🔒 PM / HR Request — Directly Awaiting CEO Review
                        </span>
                      ) : req.pmStatus === 'Pending' ? (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> 🔒 Awaiting PM Approval Stage
                        </span>
                      ) : req.ceoStatus === 'Pending' || req.ceoStatus === 'Waiting PM' ? (
                        <span className="text-purple-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> 🔒 Awaiting CEO Sanction Stage
                        </span>
                      ) : (
                        <span className="text-cyan-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> 🔒 Awaiting CTO/MD Final Sanction Stage
                        </span>
                      )}
                    </div>
                  )}

                  {req.status !== 'Pending' && req.reviewedBy && (
                    <div className="text-[10px] font-medium text-[var(--text-tertiary)] mt-1 flex items-center justify-end">
                      Reviewed by {req.reviewedBy}
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
