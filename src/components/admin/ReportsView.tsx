import React from 'react';
import { FileSpreadsheet, Sparkles, ShieldCheck } from 'lucide-react';
import { PMAttendanceCycleSection } from '../pm/PMAttendanceCycleSection';

export const ReportsView: React.FC = () => {
  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-600/15 border border-blue-500/30 rounded-2xl shrink-0">
            <FileSpreadsheet className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Executive Reporting Suite
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Higher Official Audit Ready</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
              Enterprise Attendance &amp; Payroll Intelligence Hub
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Export comprehensive, high-level multi-sheet Excel workbooks (.xlsx) depicting day-by-day attendance across the full 26th-to-26th cycle with rostered work days, payable days, and salary disbursement metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <div className="text-right">
            <span className="text-[9px] text-slate-500 font-bold uppercase block">Compliance Engine</span>
            <span className="text-xs font-bold text-white font-mono">26th to 26th Active</span>
          </div>
        </div>
      </div>

      {/* Main 26-to-26 Cycle Attendance & Salary Disbursement Suite */}
      <PMAttendanceCycleSection />
    </div>
  );
};
