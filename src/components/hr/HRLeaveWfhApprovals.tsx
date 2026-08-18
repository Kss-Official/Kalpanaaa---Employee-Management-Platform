import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  User, 
  Check, 
  X,
  Sparkles,
  Search,
  Filter,
  Building2,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { LeaveRequest } from '../../types';

export const HRLeaveWfhApprovals: React.FC = () => {
  const { leaveRequests, updateLeaveRequestStage, updateLeaveRequestStatus, activeEmployee, settings, assignCompanyWideWfh, removeCompanyWideWfh } = useAuth();
  const [filterType, setFilterType] = useState<'All' | 'Leave' | 'WFH'>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const [wfhDateInput, setWfhDateInput] = useState(tomorrowStr);
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

  const filteredRequests = leaveRequests.filter(req => {
    // Before PM approval, hide standard employee requests from HR inbox (must be Approved or N/A)
    const isPmStagePassed = req.pmStatus === 'Approved' || req.pmStatus === 'N/A' || req.pmStatus === 'Bypassed';
    if (!isPmStagePassed) return false;

    const matchesType = filterType === 'All' || req.type === filterType;
    const matchesStatus = filterStatus === 'All' || req.status === filterStatus;
    const matchesSearch = (req.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (req.reason || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400 shrink-0" />
            <span>Leave &amp; WFH Approvals Inbox</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Sequential Approval Cycle: Employee Request → PM Approval → CTO Approval → CEO Final Sanction.
          </p>
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee or reason..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* 🏢 CEO & CTO Executive Control: Office-Wide WFH Assignment */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5 sm:mt-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white flex flex-wrap items-center gap-2">
                <span>CEO &amp; CTO Office-Wide WFH Assignment</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold shrink-0">
                  Whole Office
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Assign Work From Home for all employees on days the physical office is closed or on leave.</p>
            </div>
          </div>

          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0 ${
            isCeoOrCto ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-950 text-slate-400 border-slate-800'
          }`}>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
            <span>{isCeoOrCto ? 'CEO / CTO Access Granted' : '🔒 CEO & CTO Clearance Required'}</span>
          </div>
        </div>

        {wfhFeedback && (
          <div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
            wfhFeedback.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}>
            {wfhFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{wfhFeedback.message}</span>
          </div>
        )}

        {isCeoOrCto ? (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <label className="text-xs font-bold text-slate-300 whitespace-nowrap">Assign Office WFH Date:</label>
              <input 
                type="date" 
                value={wfhDateInput}
                onChange={e => setWfhDateInput(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:border-cyan-500 outline-none font-mono"
              />
              <button 
                onClick={handleAssignOfficeWfh}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Assign Office-Wide WFH
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

      {/* Filter Bar: Mobile Select Dropdowns & Desktop Pills */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 backdrop-blur-md">
        {/* Mobile Select Dropdowns (<640px) */}
        <div className="grid grid-cols-2 gap-2 sm:hidden w-full">
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
            <Filter className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer w-full"
            >
              <option value="All">All Types</option>
              <option value="Leave">Leave Only</option>
              <option value="WFH">WFH Only</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer w-full"
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="All">All Statuses</option>
            </select>
          </div>
        </div>

        {/* Desktop Pills (>=640px) */}
        <div className="hidden sm:flex items-center gap-2">
          {['All', 'Leave', 'WFH'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                filterType === type 
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-2">
          {['Pending', 'Approved', 'Rejected', 'All'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as any)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                filterStatus === status 
                  ? 'bg-slate-800 text-white border-slate-700' 
                  : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-slate-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Inbox Table & Cards View */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
        {/* Mobile Cards View (<640px) */}
        <div className="sm:hidden p-3.5 space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-1">
              <p className="text-xs font-bold text-slate-300">No requests match current filters</p>
              <p className="text-[11px] text-slate-500">Try adjusting your type or status filter above.</p>
            </div>
          ) : (
            filteredRequests.map(req => {
              const isApplicantPmOrHr = req.employeeRole === 'PROJECT_MANAGER' || 
                req.employeeRole === 'HR_ADMIN' ||
                req.employeeRole === 'SUPER_ADMIN' ||
                (req.department || '').toLowerCase().includes('hr') ||
                (req.department || '').toLowerCase().includes('management');

              const pmState = isApplicantPmOrHr ? 'N/A' : (req.pmStatus || 'Pending');
              const hrState = isApplicantPmOrHr ? 'N/A' : (req.hrStatus || (pmState === 'Approved' ? 'Pending' : 'Waiting PM'));
              const ceoState = req.ceoStatus || (isApplicantPmOrHr ? 'Pending' : hrState === 'Approved' ? 'Pending' : 'Waiting HR');
              const ctoState = req.ctoStatus || (ceoState === 'Approved' ? 'Pending' : 'Waiting CEO');
              const isFullyApproved = (pmState === 'Approved' || pmState === 'N/A') && (hrState === 'Approved' || hrState === 'N/A') && ceoState === 'Approved' && ctoState === 'Approved';
              const isRejected = pmState === 'Rejected' || hrState === 'Rejected' || ceoState === 'Rejected' || ctoState === 'Rejected';

              return (
                <div key={req.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  {/* Employee Info Header */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <h4 className="text-xs font-bold text-white truncate">{req.employeeName}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{req.startDate} → {req.endDate}</p>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold border shrink-0 ${
                      req.type === 'WFH' ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}>
                      {req.type}
                    </span>
                  </div>

                  {/* Reason */}
                  <p className="text-xs text-slate-300 font-medium leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block font-mono font-bold uppercase mb-0.5">Reason:</span>
                    {req.reason}
                  </p>

                  {/* 4-Stage Approval Pipeline Tracker */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className={`px-2 py-0.5 rounded border ${pmState === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : pmState === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : pmState === 'N/A' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-amber-950/60 text-amber-400 border-amber-500/30'}`}>
                      PM: {pmState}
                    </span>
                    <span className={`px-2 py-0.5 rounded border ${hrState === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : hrState === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : hrState === 'N/A' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-blue-950/60 text-blue-400 border-blue-500/30'}`}>
                      HR: {hrState}
                    </span>
                    <span className={`px-2 py-0.5 rounded border ${ceoState === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : ceoState === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : 'bg-purple-950/60 text-purple-400 border-purple-500/30'}`}>
                      CEO: {ceoState}
                    </span>
                    <span className={`px-2 py-0.5 rounded border ${ctoState === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : ctoState === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' : 'bg-cyan-950/60 text-cyan-400 border-cyan-500/30'}`}>
                      CTO: {ctoState}
                    </span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      isFullyApproved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : isRejected ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      ● {isFullyApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                    </span>

                    {(hrState === 'Pending' || hrState === 'Waiting PM') && !isFullyApproved && !isRejected ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateLeaveRequestStage(req.id, 'HR', 'Approved', activeEmployee?.fullName || 'HR Admin', 'HR Sanction Granted');
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-950/40 active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateLeaveRequestStage(req.id, 'HR', 'Rejected', activeEmployee?.fullName || 'HR Admin', 'HR Rejected');
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-rose-950/40 active:scale-95"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    ) : hrState === 'Approved' && !isFullyApproved && !isRejected ? (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        ✓ HR Approved — Waiting CEO
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (hidden on sm, block on sm+) */}
        <div className="hidden sm:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4 w-44">EMPLOYEE</th>
                <th className="py-3.5 px-4 w-24">TYPE</th>
                <th className="py-3.5 px-4 w-48">DATES</th>
                <th className="py-3.5 px-4 w-48">REASON</th>
                <th className="py-3.5 px-4 w-28">PM STATUS</th>
                <th className="py-3.5 px-4 w-28">HR STATUS</th>
                <th className="py-3.5 px-4 w-28">CEO STATUS</th>
                <th className="py-3.5 px-4 w-28">CTO/MD STATUS</th>
                <th className="py-3.5 px-4 w-24">STATUS</th>
                <th className="py-3.5 px-4 text-right w-36">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <p className="text-sm font-semibold">No requests match the current filters.</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => {
                  const isApplicantPmOrHr = req.employeeRole === 'PROJECT_MANAGER' || 
                    req.employeeRole === 'HR_ADMIN' ||
                    req.employeeRole === 'SUPER_ADMIN' ||
                    (req.department || '').toLowerCase().includes('hr') ||
                    (req.department || '').toLowerCase().includes('management');

                  const pmState = isApplicantPmOrHr ? 'N/A' : (req.pmStatus || 'Pending');
                  const hrState = isApplicantPmOrHr ? 'N/A' : (req.hrStatus || (pmState === 'Approved' ? 'Pending' : 'Waiting PM'));
                  const ceoState = req.ceoStatus || (isApplicantPmOrHr ? 'Pending' : hrState === 'Approved' ? 'Pending' : 'Waiting HR');
                  const ctoState = req.ctoStatus || (ceoState === 'Approved' ? 'Pending' : 'Waiting CEO');
                  const isFullyApproved = (pmState === 'Approved' || pmState === 'N/A') && (hrState === 'Approved' || hrState === 'N/A') && ceoState === 'Approved' && ctoState === 'Approved';
                  const isRejected = pmState === 'Rejected' || hrState === 'Rejected' || ceoState === 'Rejected' || ctoState === 'Rejected';

                  return (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{req.employeeName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.type === 'WFH' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {req.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        {req.startDate} {req.startDate !== req.endDate && `→ ${req.endDate}`}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          pmState === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
                          pmState === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' :
                          pmState === 'N/A' || pmState === 'Bypassed' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                          'bg-amber-950/60 text-amber-400 border-amber-500/30'
                        }`}>
                          {pmState}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          hrState === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
                          hrState === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' :
                          hrState === 'N/A' || hrState === 'Bypassed' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                          hrState === 'Pending' ? 'bg-blue-950/60 text-blue-400 border-blue-500/30' :
                          'bg-slate-900 text-slate-500 border-slate-800'
                        }`}>
                          {hrState}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          ceoState === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
                          ceoState === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' :
                          ceoState === 'Pending' ? 'bg-purple-950/60 text-purple-400 border-purple-500/30' :
                          'bg-slate-900 text-slate-500 border-slate-800'
                        }`}>
                          {ceoState}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          ctoState === 'Approved' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
                          ctoState === 'Rejected' ? 'bg-rose-950/60 text-rose-400 border-rose-500/30' :
                          ctoState === 'Pending' ? 'bg-cyan-950/60 text-cyan-400 border-cyan-500/30' :
                          'bg-slate-900 text-slate-500 border-slate-800'
                        }`}>
                          {ctoState}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isFullyApproved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          isRejected ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {isFullyApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {(hrState === 'Pending' || hrState === 'Waiting PM') && !isFullyApproved && !isRejected ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLeaveRequestStage(req.id, 'HR', 'Approved', activeEmployee?.fullName || 'HR Admin', 'HR Sanction Granted');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              Approve HR
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLeaveRequestStage(req.id, 'HR', 'Rejected', activeEmployee?.fullName || 'HR Admin', 'HR Rejected');
                              }}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/30 text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                              Reject
                            </button>
                          </div>
                        ) : hrState === 'Approved' && !isFullyApproved && !isRejected ? (
                          <span className="text-[10px] font-bold text-emerald-400">
                            ✓ HR Approved — Waiting CEO
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500">
                            {isFullyApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
