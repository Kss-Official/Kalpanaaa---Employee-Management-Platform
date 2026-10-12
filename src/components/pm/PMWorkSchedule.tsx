/**
 * PM Work Schedule & Break Management Panel
 * Configure per-employee shift times, meal breaks, snacks breaks, and weekly
 * working days directly from the Project Manager portal.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Edit3, Check, X, Loader2, Search, Users,
  Coffee, UtensilsCrossed, Calendar, Info, Save,
  AlertTriangle, CheckCircle2, Settings, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import {
  WorkSchedule,
  DEFAULT_WORK_SCHEDULE,
  saveWorkSchedule,
  bulkSaveWorkSchedules,
  calcScheduledMinutes,
  calcNetRequiredMinutes,
  validateWorkSchedule,
  subscribeToWorkSchedules,
} from '../../lib/workScheduleService';

// ─── Day labels ────────────────────────────────────────────────────────────────
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Default form state ────────────────────────────────────────────────────────
function makeDefaultForm(emp: Employee): Partial<WorkSchedule> {
  return {
    ...DEFAULT_WORK_SCHEDULE,
    employeeId: emp.id,
    employeeCode: emp.employeeId,
    employeeName: emp.fullName,
    updatedBy: '',
    updatedByName: '',
    updatedAt: '',
  };
}

// ─── Schedule Editor Dialog ────────────────────────────────────────────────────
interface ScheduleEditorProps {
  employee: Employee;
  existing: WorkSchedule | null;
  onSave: (schedule: Omit<WorkSchedule, 'updatedBy' | 'updatedByName' | 'updatedAt'>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

const ScheduleEditor: React.FC<ScheduleEditorProps> = ({
  employee, existing, onSave, onClose, saving
}) => {
  const base = existing || makeDefaultForm(employee) as WorkSchedule;
  const [form, setForm] = useState<Partial<WorkSchedule>>(base);
  const [error, setError] = useState<string | null>(null);

  const scheduledMins = useMemo(
    () => calcScheduledMinutes(form.startTime || '10:00', form.endTime || '19:00'),
    [form.startTime, form.endTime]
  );

  const netRequiredMins = useMemo(
    () => calcNetRequiredMinutes({ ...form, scheduledMinutes: scheduledMins }),
    [form, scheduledMins]
  );

  const handleSubmit = async () => {
    const err = validateWorkSchedule(form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    await onSave({
      ...(form as WorkSchedule),
      scheduledMinutes: scheduledMins,
    });
  };

  const toggleDay = (day: number) => {
    setForm(prev => {
      const days = prev.workingDays || [1, 2, 3, 4, 5, 6];
      return {
        ...prev,
        workingDays: days.includes(day)
          ? days.filter(d => d !== day)
          : [...days, day].sort((a, b) => a - b),
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-sky-400 mb-0.5">
              Work Schedule Editor
            </div>
            <h3 className="text-base font-black text-white">{employee.fullName}</h3>
            <p className="text-xs text-slate-400">{employee.employeeId} · {employee.department}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Shift Timing */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Shift Timing
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Start Time</label>
                <input
                  type="time"
                  value={form.startTime || '10:00'}
                  onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">End Time</label>
                <input
                  type="time"
                  value={form.endTime || '19:00'}
                  onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
              <span>Scheduled: <strong className="text-sky-300">{formatMinutes(scheduledMins)}</strong></span>
              <span className="text-slate-600">·</span>
              <span>Net required: <strong className="text-emerald-300">{formatMinutes(netRequiredMins)}</strong></span>
            </div>
          </div>

          {/* Meal Break */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5" /> Meal / Lunch Break
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={form.mealBreakMinutes ?? 60}
                  onChange={e => setForm(p => ({ ...p, mealBreakMinutes: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setForm(p => ({ ...p, mealBreakPaid: !p.mealBreakPaid }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.mealBreakPaid ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.mealBreakPaid ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-xs text-slate-300">
                    {form.mealBreakPaid ? 'Paid (not deducted)' : 'Unpaid (deducted)'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Snacks / Tea Break */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5" /> Snacks / Tea Break
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Duration (min/break)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={form.snacksBreakMinutes ?? 15}
                  onChange={e => setForm(p => ({ ...p, snacksBreakMinutes: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Permitted per day</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.snacksBreakCount ?? 2}
                  onChange={e => setForm(p => ({ ...p, snacksBreakCount: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setForm(p => ({ ...p, snacksBreakPaid: !p.snacksBreakPaid }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.snacksBreakPaid ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.snacksBreakPaid ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-xs text-slate-300">
                    {form.snacksBreakPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Weekly working days */}
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
              Weekly Working Days
            </div>
            <div className="flex gap-2 flex-wrap">
              {DAY_LABELS.map((label, idx) => {
                const isActive = (form.workingDays || [1,2,3,4,5,6]).includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-xl text-xs font-bold border transition-all ${
                      isActive
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                        : 'bg-slate-800/60 border-slate-700/50 text-slate-500 hover:border-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Effective date & status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Effective Date</label>
              <input
                type="date"
                value={form.effectiveDate || '2026-07-27'}
                onChange={e => setForm(p => ({ ...p, effectiveDate: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.active !== false ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-slate-300">
                  Schedule {form.active !== false ? 'Active' : 'Inactive'}
                </span>
              </label>
            </div>
          </div>

          {/* Net required time summary */}
          <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/40 text-xs space-y-1">
            <div className="font-bold text-slate-300 mb-2">Schedule Summary</div>
            <div className="flex justify-between">
              <span className="text-slate-400">Scheduled office duration:</span>
              <span className="text-white font-semibold">{formatMinutes(scheduledMins)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Meal break ({form.mealBreakPaid ? 'paid' : 'unpaid'}):</span>
              <span className={form.mealBreakPaid ? 'text-emerald-400' : 'text-rose-400'}>
                {form.mealBreakPaid ? '+' : '−'}{formatMinutes(form.mealBreakMinutes ?? 60)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                Snacks break ×{form.snacksBreakCount ?? 2} ({form.snacksBreakPaid ? 'paid' : 'unpaid'}):
              </span>
              <span className={form.snacksBreakPaid ? 'text-emerald-400' : 'text-rose-400'}>
                {form.snacksBreakPaid ? '+' : '−'}{formatMinutes((form.snacksBreakMinutes ?? 15) * (form.snacksBreakCount ?? 2))}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
              <span className="font-bold text-slate-300">Net required working time:</span>
              <span className="font-black text-emerald-400">{formatMinutes(netRequiredMins)}</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-sm font-bold text-white shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Schedule
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const PMWorkSchedule: React.FC = () => {
  const { employees, activeEmployee } = useAuth();

  const teamEmployees = useMemo(() =>
    employees.filter(e =>
      e.status !== 'Terminated' &&
      e.status !== 'Inactive' &&
      e.role !== 'SUPER_ADMIN'
    ), [employees]);

  const [schedules, setSchedules] = useState<Record<string, WorkSchedule>>({});
  const [schedulesLoading, setSchedulesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  // Real-time subscription to all work schedules
  useEffect(() => {
    setSchedulesLoading(true);
    const unsub = subscribeToWorkSchedules(
      (all) => {
        const map: Record<string, WorkSchedule> = {};
        all.forEach(s => { map[s.employeeId] = s; });
        setSchedules(map);
        setSchedulesLoading(false);
      },
      () => setSchedulesLoading(false)
    );
    return unsub;
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamEmployees;
    return teamEmployees.filter(e =>
      e.fullName.toLowerCase().includes(q) ||
      (e.employeeId || '').toLowerCase().includes(q) ||
      (e.department || '').toLowerCase().includes(q)
    );
  }, [teamEmployees, search]);

  const handleSave = useCallback(async (
    schedule: Omit<WorkSchedule, 'updatedBy' | 'updatedByName' | 'updatedAt'>
  ) => {
    if (!activeEmployee) return;
    setSaving(true);
    try {
      const result = await saveWorkSchedule({
        ...schedule,
        updatedBy: activeEmployee.id,
        updatedByName: activeEmployee.fullName,
        updatedAt: new Date().toISOString(),
        createdAt: schedules[schedule.employeeId]?.createdAt || new Date().toISOString(),
      });
      if (result.success) {
        toast.success(result.message);
        setEditingEmp(null);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  }, [activeEmployee, schedules]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700/50 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-5 h-5 text-sky-400" />
              <span className="text-xs font-black uppercase tracking-wider text-sky-400">
                Work Schedule & Break Management
              </span>
            </div>
            <h2 className="text-xl font-black text-white">Employee Work Schedules</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure shift times, meal breaks, snacks breaks, and working days per employee. All changes save to Firestore in real time.
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 w-48"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 bg-slate-800/50 border-b border-slate-700/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>Employee</span>
          <span>Shift</span>
          <span>Meal Break</span>
          <span>Snacks Break</span>
          <span>Net Working</span>
          <span>Edit</span>
        </div>

        {schedulesLoading ? (
          <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading schedules…
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">No employees found.</div>
        ) : (
          filteredEmployees.map(emp => {
            const s = schedules[emp.id];
            const startTime = s?.startTime || '10:00';
            const endTime = s?.endTime || '19:00';
            const scheduledMins = s?.scheduledMinutes || calcScheduledMinutes(startTime, endTime);
            const netMins = s ? calcNetRequiredMinutes(s) : scheduledMins;
            const isConfigured = !!s;

            return (
              <div
                key={emp.id}
                className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-5 py-4 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20 transition-colors items-center"
              >
                {/* Employee */}
                <div className="flex items-center gap-3">
                  <img
                    src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=0f172a&color=fff`}
                    alt={emp.fullName}
                    className="w-9 h-9 rounded-xl object-cover border border-slate-700/60 flex-shrink-0"
                  />
                  <div>
                    <div className="text-sm font-bold text-white">{emp.fullName}</div>
                    <div className="text-[10px] text-slate-400">{emp.employeeId} · {emp.department}</div>
                    {!isConfigured && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 mt-0.5 inline-block">
                        Using company default
                      </span>
                    )}
                  </div>
                </div>

                {/* Shift */}
                <div>
                  <div className="text-sm font-bold text-white">{startTime} – {endTime}</div>
                  <div className="text-[10px] text-slate-400">{formatMinutes(scheduledMins)} rostered</div>
                </div>

                {/* Meal Break */}
                <div>
                  <div className="text-sm font-semibold text-white">
                    {formatMinutes(s?.mealBreakMinutes ?? 60)}
                  </div>
                  <div className="text-[10px]">
                    <span className={s?.mealBreakPaid ? 'text-emerald-400' : 'text-rose-400'}>
                      {s?.mealBreakPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>

                {/* Snacks Break */}
                <div>
                  <div className="text-sm font-semibold text-white">
                    {formatMinutes(s?.snacksBreakMinutes ?? 15)} × {s?.snacksBreakCount ?? 2}
                  </div>
                  <div className="text-[10px]">
                    <span className={s?.snacksBreakPaid ? 'text-emerald-400' : 'text-rose-400'}>
                      {s?.snacksBreakPaid !== false ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>

                {/* Net Required */}
                <div>
                  <div className="text-sm font-black text-emerald-400">{formatMinutes(netMins)}</div>
                  <div className="text-[10px] text-slate-500">net required</div>
                  {s?.updatedAt && (
                    <div className="text-[9px] text-slate-600 mt-0.5">
                      {new Date(s.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {s.updatedByName && ` · ${s.updatedByName}`}
                    </div>
                  )}
                </div>

                {/* Edit */}
                <div>
                  <button
                    onClick={() => setEditingEmp(emp)}
                    className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors"
                    title="Edit work schedule"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 text-xs text-slate-400">
        <Info className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-300">Net Required Working Time</strong> = Scheduled office duration − unpaid meal break − unpaid snacks breaks.
          Paid breaks are <strong className="text-emerald-400">not</strong> subtracted — they count as working time per company policy.
          Employees without a saved schedule use the company default (10:00–19:00, 9h rostered, 1h unpaid meal break).
        </div>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {editingEmp && (
          <ScheduleEditor
            employee={editingEmp}
            existing={schedules[editingEmp.id] || null}
            onSave={handleSave}
            onClose={() => setEditingEmp(null)}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
