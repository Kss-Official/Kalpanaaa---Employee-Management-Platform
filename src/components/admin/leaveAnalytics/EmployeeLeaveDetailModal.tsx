import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Building2,
  Briefcase,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { Employee, LeaveRequest } from '../../../types';
import { 
  EmployeeLeaveMetric, 
  DateRangePreset, 
  buildDateRangeInterval, 
  formatDisplayDate,
  QualifyingDayDetail
} from '../../../lib/leaveAnalyticsService';

interface EmployeeLeaveDetailModalProps {
  metric: EmployeeLeaveMetric;
  rawEmployee?: Employee;
  initialPreset: DateRangePreset;
  initialCustomStart?: string;
  initialCustomEnd?: string;
  onClose: () => void;
  onIntervalChange?: (preset: DateRangePreset, start?: string, end?: string) => void;
}

export const EmployeeLeaveDetailModal: React.FC<EmployeeLeaveDetailModalProps> = ({
  metric,
  rawEmployee,
  initialPreset,
  initialCustomStart,
  initialCustomEnd,
  onClose,
  onIntervalChange
}) => {
  const [activePreset, setActivePreset] = useState<DateRangePreset>(initialPreset);
  const [customStart, setCustomStart] = useState<string>(initialCustomStart || '');
  const [customEnd, setCustomEnd] = useState<string>(initialCustomEnd || '');
  const [activeTab, setActiveTab] = useState<'days' | 'requests' | 'balances'>('days');

  const handlePresetSelect = (preset: DateRangePreset) => {
    setActivePreset(preset);
    if (preset !== 'custom' && onIntervalChange) {
      onIntervalChange(preset);
    }
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd && onIntervalChange) {
      onIntervalChange('custom', customStart, customEnd);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-start justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              {metric.avatarUrl ? (
                <img
                  src={metric.avatarUrl}
                  alt={metric.fullName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/30 shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center border-2 border-blue-400/30 shadow-md">
                  {metric.fullName.charAt(0)}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-[10px] text-white font-bold" title="Verified Staff">
                ✓
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {metric.fullName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono font-bold">
                  {metric.employeeCode || metric.employeeId}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  metric.status === 'Active' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {metric.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  {metric.department}
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                  {metric.designation}
                </span>
                {metric.joiningDate && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">
                      Joined: <strong className="text-slate-300 font-mono">{metric.joiningDate}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Filter Toolbar (Inside Modal) */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Period:</span>
            {(['1d', '7d', '15d', '30d', 'custom'] as DateRangePreset[]).map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetSelect(preset)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePreset === preset
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700/50'
                }`}
              >
                {preset === '1d' ? 'Today (1D)' : preset === '7d' ? 'Last 7D' : preset === '15d' ? 'Last 15D' : preset === '30d' ? 'Last 30D' : 'Custom'}
              </button>
            ))}
          </div>

          {activePreset === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-2.5 py-1 bg-slate-850 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500 font-mono"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 bg-slate-850 border border-slate-700 rounded-lg text-xs text-white focus:outline-hidden focus:border-blue-500 font-mono"
              />
              <button
                onClick={handleApplyCustom}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 overscroll-contain">
          {/* Summary KPI Cards Grid for this Employee */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <span className="text-[10px] font-black uppercase tracking-wider block">Approved LOP</span>
              <div className="text-2xl font-black mt-1 text-rose-300 font-mono">
                {metric.lopDays} <span className="text-xs font-normal">days</span>
              </div>
              <span className="text-[10px] text-rose-400/80 block mt-0.5">Loss of Pay Taken</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <span className="text-[10px] font-black uppercase tracking-wider block">Earned Leave</span>
              <div className="text-2xl font-black mt-1 text-blue-300 font-mono">
                {metric.elDays} <span className="text-xs font-normal">days</span>
              </div>
              <span className="text-[10px] text-blue-400/80 block mt-0.5">Paid EL Taken</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <span className="text-[10px] font-black uppercase tracking-wider block">Sick Leave</span>
              <div className="text-2xl font-black mt-1 text-amber-300 font-mono">
                {metric.slDays} <span className="text-xs font-normal">days</span>
              </div>
              <span className="text-[10px] text-amber-400/80 block mt-0.5">Medical SL Taken</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <span className="text-[10px] font-black uppercase tracking-wider block">Total Leave</span>
              <div className="text-2xl font-black mt-1 text-purple-300 font-mono">
                {metric.totalLeaveDays} <span className="text-xs font-normal">days</span>
              </div>
              <span className="text-[10px] text-purple-400/80 block mt-0.5">LOP + EL + SL</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase tracking-wider block">Work From Home</span>
              <div className="text-2xl font-black mt-1 text-cyan-300 font-mono">
                {metric.wfhDays} <span className="text-xs font-normal">days</span>
              </div>
              <span className="text-[10px] text-cyan-400/80 block mt-0.5">Reported Separately</span>
            </div>
          </div>

          {/* Current Live Leave Balances Card (Strictly Separated from Period Taken) */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Current Live Leave Balances</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">Official Ledger</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Available credit balances maintained separately from period leave days taken above.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-start sm:self-auto shrink-0 bg-slate-900 border border-slate-800/80 rounded-xl px-4 py-2">
              <div className="text-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">EL Balance</span>
                <span className="text-base font-extrabold text-blue-400 font-mono">
                  {metric.currentEarnLeaveBalance}
                </span>
              </div>
              <div className="w-px h-7 bg-slate-800" />
              <div className="text-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">SL Balance</span>
                <span className="text-base font-extrabold text-amber-400 font-mono">
                  {metric.currentSickLeaveBalance}
                </span>
              </div>
              <div className="w-px h-7 bg-slate-800" />
              <div className="text-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase block">CL Balance</span>
                <span className="text-base font-extrabold text-emerald-400 font-mono">
                  {metric.currentCasualLeaveBalance}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs Navigation for Detailed Views */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('days')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                activeTab === 'days'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Chronological Leave Dates ({metric.qualifyingDays.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                activeTab === 'requests'
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Qualifying Leave Requests ({metric.qualifyingRequests.length})</span>
            </button>
          </div>

          {/* Tab 1: Chronological Qualifying Dates List */}
          {activeTab === 'days' && (
            <div className="space-y-3">
              {metric.qualifyingDays.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-white">No Leave or LOP Recorded in This Period</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    This employee had 100% active attendance or non-chargeable rest days during the selected reporting window.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-3">Day</th>
                        <th className="py-2.5 px-3">Leave Type</th>
                        <th className="py-2.5 px-3">Chargeable Days</th>
                        <th className="py-2.5 px-3">Status / Source</th>
                        <th className="py-2.5 px-4">Reason / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {metric.qualifyingDays.map((q, idx) => (
                        <tr key={`${q.date}-${idx}`} className="hover:bg-slate-850/40 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-200">
                            {q.date}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {q.dayOfWeek}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              q.leaveType === 'LOP' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                              q.leaveType === 'EL' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                              q.leaveType === 'SL' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                              'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            }`}>
                              {q.leaveType === 'LOP' ? 'Loss of Pay' :
                               q.leaveType === 'EL' ? 'Earned Leave' :
                               q.leaveType === 'SL' ? 'Sick Leave' : 'WFH (Remote)'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-300">
                            {q.daysValue} {q.isHalfDay && <span className="text-[10px] text-amber-400 font-normal">(Half Day)</span>}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${q.isFuture ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                              <span className="text-[11px] text-slate-300">
                                {q.isFuture ? 'Approved Future' : q.status || 'Approved'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                ({q.source === 'leave_request' ? 'Request' : 'Attendance'})
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 max-w-xs truncate" title={q.reason || q.notes || ''}>
                            {q.reason || q.notes || '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Qualifying Leave Requests List */}
          {activeTab === 'requests' && (
            <div className="space-y-3">
              {metric.qualifyingRequests.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-white">No Leave Requests Found</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Any leave or LOP counted in this period was derived directly from attendance logs.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {metric.qualifyingRequests.map(req => (
                    <div
                      key={req.id}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold">
                            {req.id}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {req.type} {req.leaveCategory && req.leaveCategory !== req.type ? `(${req.leaveCategory})` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                          <span>{req.startDate}</span>
                          <span>→</span>
                          <span>{req.endDate}</span>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="text-xs text-slate-300 leading-relaxed">
                          <strong className="text-slate-500 font-medium">Reason: </strong>
                          {req.reason}
                        </p>
                      )}

                      {/* Multi-Tier Approval Chain Status */}
                      <div className="pt-2 border-t border-slate-800/40 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="text-slate-500 uppercase font-bold tracking-wider mr-1">Approvals:</span>
                        
                        <span className={`px-2 py-0.5 rounded-md border font-bold ${
                          req.pmStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          req.pmStatus === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          PM: {req.pmStatus || 'N/A'}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md border font-bold ${
                          req.hrStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          req.hrStatus === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          HR: {req.hrStatus || 'N/A'}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md border font-bold ${
                          req.ceoStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          req.ceoStatus === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          CEO: {req.ceoStatus || 'N/A'}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md border font-bold ${
                          req.ctoStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          req.ctoStatus === 'Rejected' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          CTO: {req.ctoStatus || 'N/A'}
                        </span>

                        {req.reviewNotes && (
                          <span className="text-slate-400 ml-auto italic">
                            Notes: "{req.reviewNotes}"
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Company Timezone: <strong className="text-slate-300">Asia/Kolkata</strong>. Multi-day requests are clipped strictly to the reporting window.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
