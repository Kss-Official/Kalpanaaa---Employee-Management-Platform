import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  AlertTriangle,
  FileText,
  UserCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import {
  SummaryDateRange,
  computeLeaveHistorySummary,
  formatDisplayDate
} from '../../lib/leaveHistorySummaryService';

export const LeaveHistorySummarySection: React.FC = () => {
  const { employees, leaveRequests, attendance } = useAuth();
  const [selectedRange, setSelectedRange] = useState<SummaryDateRange>('7d');
  const [showAmbiguousDrawer, setShowAmbiguousDrawer] = useState(false);

  const summary = useMemo(() => {
    return computeLeaveHistorySummary(
      employees || [],
      leaveRequests || [],
      attendance || [],
      selectedRange
    );
  }, [employees, leaveRequests, attendance, selectedRange]);

  const rangeLabels: Record<SummaryDateRange, string> = {
    '7d': 'Last 7 Days',
    '15d': 'Last 15 Days',
    '30d': 'Last 30 Days'
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* ── Header & Range Filter Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Calendar className="w-4 h-4" />
            </span>
            <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
              Admin Leave History &amp; LOP Summary
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Period: <strong className="text-slate-200">{formatDisplayDate(summary.startDate)}</strong> – <strong className="text-slate-200">{formatDisplayDate(summary.endDate)}</strong> ({summary.daysCount} calendar days, Asia/Kolkata)
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto shrink-0">
          {(['7d', '15d', '30d'] as SummaryDateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedRange === r
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3 Summary KPI Cards: LOP, EL, CL ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* LOP Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-950/30 via-slate-900 to-slate-950 border border-rose-500/20 text-rose-400">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
              Loss of Pay (LOP)
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{summary.totalLopDays}</span>
            <span className="text-xs text-slate-400 font-medium">days taken</span>
          </div>
          <div className="mt-2 pt-2 border-t border-rose-500/10 text-xs text-rose-300 font-semibold flex items-center justify-between">
            <span>Unique staff:</span>
            <span className="font-mono text-white font-bold">{summary.uniqueLopEmployees} employees</span>
          </div>
        </div>

        {/* EL Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/30 via-slate-900 to-slate-950 border border-blue-500/20 text-blue-400">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">
              Earned Leave (EL)
            </span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{summary.totalElDays}</span>
            <span className="text-xs text-slate-400 font-medium">days taken</span>
          </div>
          <div className="mt-2 pt-2 border-t border-blue-500/10 text-xs text-blue-300 font-semibold flex items-center justify-between">
            <span>Unique staff:</span>
            <span className="font-mono text-white font-bold">{summary.uniqueElEmployees} employees</span>
          </div>
        </div>

        {/* CL Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border border-amber-500/20 text-amber-400">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              Casual Leave (CL)
            </span>
            <UserCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{summary.totalClDays}</span>
            <span className="text-xs text-slate-400 font-medium">days taken</span>
          </div>
          <div className="mt-2 pt-2 border-t border-amber-500/10 text-xs text-amber-300 font-semibold flex items-center justify-between">
            <span>Unique staff:</span>
            <span className="font-mono text-white font-bold">{summary.uniqueClEmployees} employees</span>
          </div>
        </div>
      </div>

      {/* ── Employee-Wise Breakdown Table ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Employee Leave Breakdown ({summary.rows.length} {summary.rows.length === 1 ? 'employee' : 'employees'})
          </h4>

          {summary.ambiguousRecordsCount > 0 && (
            <button
              onClick={() => setShowAmbiguousDrawer(!showAmbiguousDrawer)}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold cursor-pointer"
            >
              <HelpCircle className="w-3 h-3" />
              <span>{summary.ambiguousRecordsCount} Unspecified note(s) for verification</span>
              {showAmbiguousDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Optional ambiguous records drawer */}
        {showAmbiguousDrawer && summary.ambiguousRecords.length > 0 && (
          <div className="p-3 bg-slate-950 rounded-2xl border border-amber-500/30 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px]">
              <Info className="w-3.5 h-3.5" />
              <span>Records mentioning leave without explicit LOP, EL, or CL tag (treated under default policy):</span>
            </div>
            <div className="divide-y divide-slate-800/80">
              {summary.ambiguousRecords.map(a => (
                <div key={a.id} className="py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span className="font-bold text-white">{a.employeeName} ({a.dates})</span>
                  <span className="text-slate-400 italic truncate max-w-md">Reason: "{a.reason || a.reviewNotes || 'Unspecified'}"</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden border border-slate-800 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              <tr>
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-4 text-right text-rose-400">LOP Days</th>
                <th className="py-2.5 px-4 text-right text-blue-400">EL Days</th>
                <th className="py-2.5 px-4 text-right text-amber-400">CL Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {summary.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    <CheckCircle2 className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-400">No LOP, EL, or CL recorded in the {rangeLabels[selectedRange].toLowerCase()}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">All employees were present or on official weekly off.</p>
                  </td>
                </tr>
              ) : (
                summary.rows.map(r => (
                  <tr key={r.employeeId} className="hover:bg-slate-850/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-white">{r.employeeName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {r.employeeCode} • {r.department}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      {r.lopDays > 0 ? (
                        <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                          {r.lopDays}d
                        </span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      {r.elDays > 0 ? (
                        <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                          {r.elDays}d
                        </span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">
                      {r.clDays > 0 ? (
                        <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {r.clDays}d
                        </span>
                      ) : (
                        <span className="text-slate-600">0</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
