/**
 * PM Leave & WFH Management Panel
 * Allows the Project Manager to view and edit EL, SL, and monthly WFH allowances
 * for all team employees. Changes persist to Firestore and appear in real-time.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Edit3, Check, X, AlertTriangle, RefreshCw,
  TrendingUp, Home, Loader2, ChevronDown, ChevronUp,
  Calendar, Clock, Search, Save, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import {
  adjustLeaveBalance,
  adjustWfhAllowance,
  subscribeToEmployeeWfhMonths,
  calcApprovedWfhUsed,
  getMonthKey,
  MonthlyWfhRecord,
} from '../../lib/leaveBalanceService';
import { db } from '../../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditingLeave {
  empId: string;
  field: 'earnLeaveBalance' | 'sickLeaveBalance' | 'casualLeaveBalance';
  value: string;
  reason: string;
}

interface EditingWfh {
  empId: string;
  monthKey: string;
  allowance: string;
  reason: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function getLastNMonths(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(getMonthKey(d));
  }
  return keys;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const PMLeaveManagement: React.FC = () => {
  const {
    employees,
    leaveRequests,
    activeEmployee,
  } = useAuth();

  // Operational employees visible to PM
  const teamEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        e.status !== 'Terminated' &&
        e.status !== 'Inactive' &&
        e.role !== 'SUPER_ADMIN' &&
        e.role !== 'HR_ADMIN'
    );
  }, [employees]);

  const [search, setSearch] = useState('');
  const [editingLeave, setEditingLeave] = useState<EditingLeave | null>(null);
  const [editingWfh, setEditingWfh] = useState<EditingWfh | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));

  // WFH allowance records from Firestore (per employee, per month)
  const [wfhRecords, setWfhRecords] = useState<Record<string, Record<string, MonthlyWfhRecord>>>({});
  const [wfhLoading, setWfhLoading] = useState(true);

  const months = useMemo(() => getLastNMonths(6), []);

  // Subscribe to WFH allowance sub-collections for each visible employee
  useEffect(() => {
    if (!teamEmployees.length) return;
    const unsubs: (() => void)[] = [];
    setWfhLoading(true);

    teamEmployees.forEach((emp) => {
      const unsub = subscribeToEmployeeWfhMonths(
        emp.id,
        (records) => {
          setWfhRecords((prev) => ({
            ...prev,
            [emp.id]: records.reduce<Record<string, MonthlyWfhRecord>>((acc, r) => {
              acc[r.monthKey] = r;
              return acc;
            }, {}),
          }));
        }
      );
      unsubs.push(unsub);
    });

    setWfhLoading(false);
    return () => unsubs.forEach((u) => u());
  }, [teamEmployees.length]);

  // ── Filtered employee list ──────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamEmployees;
    return teamEmployees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        (e.employeeId || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q)
    );
  }, [teamEmployees, search]);

  // ── WFH usage calculation ───────────────────────────────────────────────────
  const getWfhUsed = useCallback(
    (emp: Employee, monthKey: string): number => {
      return calcApprovedWfhUsed(
        leaveRequests.map((r) => ({
          employeeId: r.employeeId,
          employeeUid: r.employeeUid,
          type: r.type,
          leaveCategory: r.leaveCategory,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
        })),
        emp.id,
        monthKey
      );
    },
    [leaveRequests]
  );

  const getWfhAllowance = useCallback(
    (emp: Employee, monthKey: string): number => {
      const record = wfhRecords[emp.id]?.[monthKey];
      if (record) return record.allowance;
      // Default: female employees get 1 WFH/month
      return emp.gender === 'Female' ? 1 : 0;
    },
    [wfhRecords]
  );

  // ── Leave balance save handler ──────────────────────────────────────────────
  const handleSaveLeave = async () => {
    if (!editingLeave || !activeEmployee) return;
    const newVal = parseFloat(editingLeave.value);
    if (isNaN(newVal) || newVal < 0) {
      toast.error('Balance must be a non-negative number.');
      return;
    }

    const emp = employees.find((e) => e.id === editingLeave.empId);
    if (!emp) {
      toast.error('Employee not found.');
      return;
    }

    const prev =
      editingLeave.field === 'earnLeaveBalance'
        ? emp.earnLeaveBalance ?? 0
        : editingLeave.field === 'sickLeaveBalance'
        ? emp.sickLeaveBalance ?? 0
        : emp.casualLeaveBalance ?? 0;

    if (newVal === prev) {
      setEditingLeave(null);
      return;
    }

    setSaving(true);
    try {
      const result = await adjustLeaveBalance({
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        field: editingLeave.field,
        previousValue: prev,
        newValue: newVal,
        reason: editingLeave.reason,
        adjustedBy: activeEmployee.id,
        adjustedByName: activeEmployee.fullName,
        adjustedAt: new Date().toISOString(),
      });

      if (result.success) {
        toast.success(result.message);
        setEditingLeave(null);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update balance.');
    } finally {
      setSaving(false);
    }
  };

  // ── WFH allowance save handler ─────────────────────────────────────────────
  const handleSaveWfh = async () => {
    if (!editingWfh || !activeEmployee) return;
    const newVal = parseInt(editingWfh.allowance, 10);
    if (isNaN(newVal) || newVal < 0) {
      toast.error('Allowance must be a non-negative integer.');
      return;
    }

    const emp = employees.find((e) => e.id === editingWfh.empId);
    if (!emp) {
      toast.error('Employee not found.');
      return;
    }

    const usedApproved = getWfhUsed(emp, editingWfh.monthKey);
    const prevAllowance = getWfhAllowance(emp, editingWfh.monthKey);

    setSaving(true);
    try {
      const result = await adjustWfhAllowance({
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        monthKey: editingWfh.monthKey,
        allowance: newVal,
        usedApproved,
        remaining: Math.max(0, newVal - usedApproved),
        updatedAt: new Date().toISOString(),
        adjustedBy: activeEmployee.id,
        adjustedByName: activeEmployee.fullName,
        previousAllowance: prevAllowance,
        reason: editingWfh.reason,
      });

      if (result.success) {
        toast.success(result.message);
        setEditingWfh(null);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update WFH allowance.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700/50 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Leave & WFH Management
              </span>
            </div>
            <h2 className="text-xl font-black text-white">Employee Leave Balances</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Edit EL, SL, and monthly WFH allowances. All changes persist to Firestore with audit trail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees..."
                className="pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Month selector for WFH */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400 font-medium">WFH Month:</span>
        {months.map((mk) => (
          <button
            key={mk}
            onClick={() => setSelectedMonth(mk)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedMonth === mk
                ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600'
            }`}
          >
            {monthLabel(mk)}
          </button>
        ))}
      </div>

      {/* Employee Table */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Table Header */}
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr_1fr] gap-4 px-5 py-3 bg-slate-800/50 border-b border-slate-700/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>Employee</span>
          <span>Earned Leave</span>
          <span>Sick Leave</span>
          <span>Casual Leave</span>
          <span>WFH ({monthLabel(selectedMonth)})</span>
          <span>Actions</span>
        </div>

        {/* Rows */}
        {filteredEmployees.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No employees found.
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const el = typeof emp.earnLeaveBalance === 'number' ? emp.earnLeaveBalance : 0;
            const sl = typeof emp.sickLeaveBalance === 'number' ? emp.sickLeaveBalance : 0;
            const cl = typeof emp.casualLeaveBalance === 'number' ? emp.casualLeaveBalance : 0;
            const wfhAllowance = getWfhAllowance(emp, selectedMonth);
            const wfhUsed = getWfhUsed(emp, selectedMonth);
            const wfhRemaining = Math.max(0, wfhAllowance - wfhUsed);
            const wfhRecord = wfhRecords[emp.id]?.[selectedMonth];
            const isExpanded = expandedEmpId === emp.id;

            const isEditingEL =
              editingLeave?.empId === emp.id &&
              editingLeave?.field === 'earnLeaveBalance';
            const isEditingSL =
              editingLeave?.empId === emp.id &&
              editingLeave?.field === 'sickLeaveBalance';
            const isEditingCL =
              editingLeave?.empId === emp.id &&
              editingLeave?.field === 'casualLeaveBalance';
            const isEditingWfhRow =
              editingWfh?.empId === emp.id &&
              editingWfh?.monthKey === selectedMonth;

            return (
              <div key={emp.id} className="border-b border-slate-800/60 last:border-0">
                {/* Main Row */}
                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1.5fr_1fr] gap-4 px-5 py-4 hover:bg-slate-800/30 transition-colors">
                  
                  {/* Employee Info */}
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        emp.profilePhotoUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=0f172a&color=fff`
                      }
                      alt={emp.fullName}
                      className="w-9 h-9 rounded-xl object-cover border border-slate-700/60 flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-bold text-white">{emp.fullName}</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-400">
                          {emp.employeeId}
                        </span>
                        <span className="text-slate-600 text-[10px]">•</span>
                        <span className="text-[10px] text-slate-500">{emp.department}</span>
                        {emp.gender === 'Female' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">
                            ♀ 1 WFH/mo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Earned Leave */}
                  <div className="flex items-center lg:block">
                    <span className="lg:hidden text-xs text-slate-500 w-28 flex-shrink-0">Earned Leave:</span>
                    {isEditingEL ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={editingLeave.value}
                          onChange={(e) =>
                            setEditingLeave((prev) =>
                              prev ? { ...prev, value: e.target.value } : null
                            )
                          }
                          className="w-16 px-2 py-1 bg-slate-800 border border-emerald-500/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveLeave}
                          disabled={saving}
                          className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingLeave(null)}
                          className="p-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${el > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {el}
                        </span>
                        <button
                          onClick={() =>
                            setEditingLeave({
                              empId: emp.id,
                              field: 'earnLeaveBalance',
                              value: String(el),
                              reason: '',
                            })
                          }
                          className="p-1 rounded-lg bg-slate-700/60 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors opacity-0 group-hover:opacity-100"
                          style={{ opacity: 1 }}
                          title="Edit EL"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sick Leave */}
                  <div className="flex items-center lg:block">
                    <span className="lg:hidden text-xs text-slate-500 w-28 flex-shrink-0">Sick Leave:</span>
                    {isEditingSL ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={editingLeave.value}
                          onChange={(e) =>
                            setEditingLeave((prev) =>
                              prev ? { ...prev, value: e.target.value } : null
                            )
                          }
                          className="w-16 px-2 py-1 bg-slate-800 border border-amber-500/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveLeave}
                          disabled={saving}
                          className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingLeave(null)}
                          className="p-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${sl > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                          {sl}
                        </span>
                        <button
                          onClick={() =>
                            setEditingLeave({
                              empId: emp.id,
                              field: 'sickLeaveBalance',
                              value: String(sl),
                              reason: '',
                            })
                          }
                          className="p-1 rounded-lg bg-slate-700/60 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          style={{ opacity: 1 }}
                          title="Edit SL"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Casual Leave */}
                  <div className="flex items-center lg:block">
                    <span className="lg:hidden text-xs text-slate-500 w-28 flex-shrink-0">Casual Leave:</span>
                    {isEditingCL ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={editingLeave.value}
                          onChange={(e) =>
                            setEditingLeave((prev) =>
                              prev ? { ...prev, value: e.target.value } : null
                            )
                          }
                          className="w-16 px-2 py-1 bg-slate-800 border border-cyan-500/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveLeave}
                          disabled={saving}
                          className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditingLeave(null)}
                          className="p-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${cl > 0 ? 'text-cyan-400' : 'text-slate-400'}`}>
                          {cl}
                        </span>
                        <button
                          onClick={() =>
                            setEditingLeave({
                              empId: emp.id,
                              field: 'casualLeaveBalance',
                              value: String(cl),
                              reason: '',
                            })
                          }
                          className="p-1 rounded-lg bg-slate-700/60 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                          style={{ opacity: 1 }}
                          title="Edit CL"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* WFH (Monthly) */}
                  <div className="flex items-center lg:block">
                    <span className="lg:hidden text-xs text-slate-500 w-28 flex-shrink-0">WFH Allowance:</span>
                    {isEditingWfhRow ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={editingWfh.allowance}
                            onChange={(e) =>
                              setEditingWfh((prev) =>
                                prev ? { ...prev, allowance: e.target.value } : null
                              )
                            }
                            className="w-16 px-2 py-1 bg-slate-800 border border-sky-500/50 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveWfh}
                            disabled={saving}
                            className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                          >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setEditingWfh(null)}
                            className="p-1 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={editingWfh.reason}
                          onChange={(e) =>
                            setEditingWfh((prev) =>
                              prev ? { ...prev, reason: e.target.value } : null
                            )
                          }
                          placeholder="Reason (optional)"
                          className="w-full px-2 py-1 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-base font-black ${wfhAllowance > 0 ? 'text-sky-400' : 'text-slate-500'}`}>
                              {wfhAllowance}
                            </span>
                            <span className="text-slate-500 text-xs">total</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Used: <span className="text-orange-400 font-semibold">{wfhUsed}</span>
                            {' · '}
                            Left: <span className="text-sky-400 font-semibold">{wfhRemaining}</span>
                          </div>
                          {wfhRecord?.updatedAt && (
                            <div className="text-[9px] text-slate-600 mt-0.5">
                              Updated {new Date(wfhRecord.updatedAt).toLocaleDateString('en-IN')}
                              {wfhRecord.updatedByName && ` by ${wfhRecord.updatedByName}`}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            setEditingWfh({
                              empId: emp.id,
                              monthKey: selectedMonth,
                              allowance: String(wfhAllowance),
                              reason: '',
                            })
                          }
                          className="p-1 rounded-lg bg-slate-700/60 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                          style={{ opacity: 1 }}
                          title="Edit WFH allowance"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Last Updated */}
                  <div className="flex items-center">
                    <span className="text-[10px] text-slate-500">
                      {emp.updatedAt
                        ? new Date(emp.updatedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Reason input for leave edit (appears below when editing EL/SL/CL) */}
                {(isEditingEL || isEditingSL || isEditingCL) && editingLeave && (
                  <div className="px-5 pb-3">
                    <input
                      type="text"
                      value={editingLeave.reason}
                      onChange={(e) =>
                        setEditingLeave((prev) =>
                          prev ? { ...prev, reason: e.target.value } : null
                        )
                      }
                      placeholder="Adjustment reason (optional but recommended)"
                      className="w-full max-w-md px-3 py-1.5 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Info box */}
      <div className="flex items-start gap-2 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 text-xs text-slate-400">
        <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-300">Auto-Credit Policy:</strong> +1 Earned Leave is automatically credited to all active employees on the 1st of every month.
          Female employees receive 1 WFH day per month automatically.
          WFH usage only counts fully <strong className="text-slate-300">Approved</strong> requests — Pending, Rejected, and Cancelled requests do not count.
        </div>
      </div>
    </div>
  );
};
