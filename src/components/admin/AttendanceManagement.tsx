import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, AttendanceRecord, AttendanceStatus } from '../../types';
import { 
  Search, 
  FileDown, 
  Clock, 
  Edit3, 
  History,
  Calendar,
  Save,
  X,
  Palmtree,
  Check,
  Building2,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  LogOut,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';
import { useHaptic } from '../../hooks/useHaptic';
import { isExecutiveOrLeadership, getWorkDate, formatShiftTiming, computeEmployeeLeaveBalance, isLateCheckIn, isWfhType } from '../../lib/attendanceEngine';
import { toISTTimeString } from '../../lib/absoluteTime';

interface AttendanceManagementProps {
  initialDateFilter?: 'today' | 'yesterday' | 'all';
  initialStatusFilter?: string;
}

export const AttendanceManagement: React.FC<AttendanceManagementProps> = () => {
  const { employees, attendance, updateAttendanceRecord, addAuditLog, updateEmployee, settings, leaveRequests, role, activeEmployee, applyAttendanceCorrection } = useAuth();
  const { triggerHaptic } = useHaptic();

  const isSuperAdmin = role === 'SUPER_ADMIN' || activeEmployee?.role === 'SUPER_ADMIN';
  const isHr = role === 'HR_ADMIN' || activeEmployee?.role === 'HR_ADMIN';
  const isPm = role === 'PROJECT_MANAGER' || activeEmployee?.role === 'PROJECT_MANAGER';
  const canEditShifts = isSuperAdmin || isHr || isPm;
  const canForceUndoCheckout = isSuperAdmin || isHr; // Only Super Admin & HR can force undo

  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Shift Editing Modal State
  const [editingShiftEmployee, setEditingShiftEmployee] = useState<Employee | null>(null);
  const [shiftTimingValue, setShiftTimingValue] = useState('');
  const [isSavingShift, setIsSavingShift] = useState(false);

  // State for shift history modal
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);

  // Quick Action State
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [quickActionToast, setQuickActionToast] = useState<string | null>(null);

  // ─── Force Undo Checkout State ─────────────────────────────────────────────
  const [undoCheckoutTarget, setUndoCheckoutTarget] = useState<{
    employee: Employee;
    record: AttendanceRecord;
  } | null>(null);
  const [undoCheckoutReason, setUndoCheckoutReason] = useState('');
  const [isUndoingCheckout, setIsUndoingCheckout] = useState(false);
  const [undoFeedback, setUndoFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const todayStr = getWorkDate(new Date());

  const departments = useMemo(() => Array.from(new Set(employees.map(e => e.department).filter(Boolean))), [employees]);

  // Build a fast lookup map: today's attendance records keyed by employee id / employeeCode
  const todayRecordByEmpId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach(rec => {
      if (rec.date === todayStr) {
        if (rec.employeeId) map.set(rec.employeeId, rec);
        if (rec.employeeCode) map.set(rec.employeeCode, rec);
      }
    });
    return map;
  }, [attendance, todayStr]);

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // 1-Click Quick Status Override for Today
  const handleQuickMarkEmployeeStatus = async (emp: Employee, status: AttendanceStatus) => {
    triggerHaptic();
    setQuickActionLoading(emp.id);
    try {
      const todayRec = todayRecordByEmpId.get(emp.id) || todayRecordByEmpId.get(emp.employeeId || '');
      const targetRecord: any = todayRec || {
        id: `synthetic_${emp.id}_${todayStr}`,
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        department: emp.department,
        date: todayStr,
        isSynthetic: true
      };

      const isLeave = status === 'On Leave';
      const isWfh = status === 'Work From Home';
      const isAbsent = status === 'Absent';
      const isPresent = status === 'Present' || status === 'Late';

      const updates: Partial<AttendanceRecord> = {
        status,
        checkInAt: (isLeave || isAbsent) ? null : (targetRecord.checkInAt || `${todayStr}T09:30:00.000Z`),
        checkOutAt: (isLeave || isAbsent) ? null : (targetRecord.checkOutAt || `${todayStr}T18:30:00.000Z`),
        workingMinutes: (isLeave || isAbsent) ? 0 : (targetRecord.workingMinutes || 540),
        isWfh: isWfh,
        notes: `Marked as ${status} by ${activeEmployee?.fullName || 'Admin'}`
      };

      if ((isLeave || isAbsent || isPresent) && emp.approvedWfhDates && emp.approvedWfhDates.includes(todayStr)) {
        const cleanedDates = emp.approvedWfhDates.filter(d => d !== todayStr);
        updateEmployee(emp.id, { approvedWfhDates: cleanedDates });
      }

      await applyAttendanceCorrection(targetRecord, updates);
      setQuickActionToast(`✓ Successfully updated ${emp.fullName} to "${status}" for today!`);
      setTimeout(() => setQuickActionToast(null), 3500);
    } catch (err: any) {
      console.error('Quick status update failed:', err);
      setQuickActionToast(`Failed: ${err?.message || 'Error updating status'}`);
    } finally {
      setQuickActionLoading(null);
    }
  };

  // Compute Leave Balance with strict rule: Zero base, 1 leave credited every month on 1st date
  const computeLeaveBalance = (emp: Employee) => {
    return computeEmployeeLeaveBalance(emp, leaveRequests);
  };

  const handleSyncAllEmployeeShifts = async () => {
    if (!canEditShifts) return;
    triggerHaptic();
    if (!window.confirm('Update all active employees to standard shift (10:00 AM – 7:00 PM) and verify zero-base leave credit policy?')) return;
    
    setIsSyncingAll(true);
    setSyncFeedback(null);
    try {
      let updatedCount = 0;
      const standardShift = 'Day Shift (10:00 AM – 7:00 PM)';
      for (const emp of employees) {
        if (emp.shift !== standardShift || emp.preferredShift !== standardShift) {
          await updateEmployee(emp.id, {
            shift: standardShift,
            preferredShift: standardShift
          });
          updatedCount++;
        }
      }
      addAuditLog?.('EMPLOYEE_UPDATED', 'Bulk Shift & Policy Sync', `Updated ${updatedCount} employees to 10:00 AM – 7:00 PM shift and verified zero-base leave credit rule.`);
      setSyncFeedback(`Successfully updated ${updatedCount} employees to 10:00 AM – 7:00 PM!`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error syncing employee shifts:', err);
      setSyncFeedback('Failed to sync shifts: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Filtered Employees for the Attendance Ledger (excluding Executive Leadership & Founders)
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (!emp.fullName || emp.fullName.trim() === '') return false;
      if (emp.status === 'Terminated') return false;
      if (isExecutiveOrLeadership(emp)) return false;

      const matchesSearch =
        (emp.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.designation || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = deptFilter === 'ALL' || emp.department === deptFilter;

      return matchesSearch && matchesDept;
    });
  }, [employees, searchTerm, deptFilter]);

  const handleOpenShiftEdit = (emp: Employee) => {
    triggerHaptic();
    setEditingShiftEmployee(emp);
    setShiftTimingValue(formatShiftTiming(emp.shift || emp.preferredShift));
  };

  const handleSaveShift = async () => {
    if (!editingShiftEmployee) return;
    setIsSavingShift(true);
    try {
      await updateEmployee(editingShiftEmployee.id, {
        shift: shiftTimingValue,
        preferredShift: shiftTimingValue
      });
      setEditingShiftEmployee(null);
    } catch (err) {
      console.error('Error updating employee shift:', err);
    } finally {
      setIsSavingShift(false);
    }
  };

  // ─── Open Force Undo Checkout Confirm Modal ─────────────────────────────────
  const handleOpenUndoCheckout = (emp: Employee, rec: AttendanceRecord) => {
    triggerHaptic();
    setUndoCheckoutTarget({ employee: emp, record: rec });
    setUndoCheckoutReason('');
    setUndoFeedback(null);
  };

  // ─── Execute Force Undo Checkout ────────────────────────────────────────────
  const handleConfirmUndoCheckout = async () => {
    if (!undoCheckoutTarget) return;
    const { employee: emp, record } = undoCheckoutTarget;

    setIsUndoingCheckout(true);
    setUndoFeedback(null);

    try {
      const reason = undoCheckoutReason.trim() || 'Admin force-undid accidental checkout';
      const updatedNotes = (record.notes ? record.notes + ' | ' : '') +
        `ADMIN FORCE UNDO: ${reason} (by ${activeEmployee?.fullName || 'Admin'} at ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })})`;

      // Revert checkout: clear checkOutAt and reset workingMinutes (employee is live again)
      await updateAttendanceRecord(record.id, {
        checkOutAt: null as any,
        workingMinutes: 0,
        status: 'Present',
        notes: updatedNotes,
      });

      // Also clean any duplicate doc for today if present in attendance state
      const duplicates = attendance.filter(
        r => r.id !== record.id && r.date === record.date &&
        ((!!r.employeeId && (r.employeeId === emp.id || r.employeeId === emp.employeeId)) ||
         (!!r.employeeCode && r.employeeCode === emp.employeeId) ||
         (!!r.employeeUid && (r.employeeUid === emp.uid || r.employeeUid === emp.id)) ||
         (!!r.uid && (r.uid === emp.uid || r.uid === emp.id)))
      );
      for (const dup of duplicates) {
        updateAttendanceRecord(dup.id, {
          checkOutAt: null as any,
          workingMinutes: 0,
          status: 'Present',
        }).catch(() => {});
      }

      // Explicit audit log for the force undo action
      addAuditLog(
        'ADMIN_FORCE_UNDO_CHECKOUT',
        `${emp.employeeId} (${emp.fullName})`,
        `Force-undid checkout for ${record.date}. Reason: ${reason}`
      );

      setUndoFeedback({ type: 'success', msg: `✓ Checkout undone for ${emp.fullName}. Employee is now active again.` });
      setTimeout(() => {
        setUndoCheckoutTarget(null);
        setUndoFeedback(null);
      }, 1800);
    } catch (err: any) {
      setUndoFeedback({ type: 'error', msg: `Failed: ${err?.message || 'Unknown error'}` });
    } finally {
      setIsUndoingCheckout(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
              Corporate Ledger
            </span>
            <span className="text-xs text-slate-500 font-mono">Live Sync Active</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight mt-1">Attendance Ledger Master</h1>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            Manage assigned shift schedules (10:00 AM – 7:00 PM), monthly leave balance accrual (Zero-base, 1 leave credited on 1st of month), and shift logs for all personnel ({filteredEmployees.length} records).
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {canEditShifts && (
            <button
              onClick={handleSyncAllEmployeeShifts}
              disabled={isSyncingAll}
              className="flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md w-full sm:w-auto shrink-0 disabled:opacity-50"
              title="Update all employees to 10:00 AM – 7:00 PM shift"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{isSyncingAll ? 'Updating All...' : 'Sync All Shifts (10am–7pm)'}</span>
            </button>
          )}
          <button
            onClick={() => generateAttendanceReportPdf(attendance, settings, 'Attendance Master Roster Statement')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40 w-full sm:w-auto shrink-0"
          >
            <FileDown className="w-4 h-4" />
            <span>Export Ledger Statement</span>
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl px-4 py-3 text-xs font-bold">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* ── Admin Force Undo Checkout Info Banner (only visible to SA/HR) ── */}
      {canForceUndoCheckout && (
        <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-300">Admin Override: Force Undo Checkout</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              If an employee was accidentally checked out today, use the{' '}
              <span className="text-amber-300 font-semibold">Undo Checkout</span> button on their row to revert the checkout and restore their active session. This action is audit-logged.
            </p>
          </div>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee, ID, department..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-hidden focus:border-blue-500 text-white placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Department Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-400 font-semibold hidden sm:inline">Department:</span>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium focus:outline-hidden focus:border-blue-500 cursor-pointer w-full md:w-auto"
            >
              <option value="ALL">All Departments ({employees.length})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Attendance Ledger Table */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-5">Employee Name</th>
                <th className="py-4 px-5">Emp ID</th>
                <th className="py-4 px-5">Department</th>
                <th className="py-4 px-5">Shift Timings</th>
                <th className="py-4 px-5">Leave Balance</th>
                <th className="py-4 px-5 text-right">Shift Log / Sync Options</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500 font-medium">
                    No employees match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const leaveInfo = computeLeaveBalance(emp);
                  const shiftDisplay = formatShiftTiming(emp.shift || emp.preferredShift);

                  // Today's attendance record for this employee
                  const todayRec =
                    todayRecordByEmpId.get(emp.id) ||
                    todayRecordByEmpId.get(emp.employeeId || '') ||
                    null;

                  const leaveReq = leaveRequests.find(l => 
                    ((!!l.employeeId && (l.employeeId === emp.id || l.employeeId === emp.employeeId)) ||
                     (!!l.employeeUid && (l.employeeUid === emp.uid || l.employeeUid === emp.id)) ||
                     (!!l.employeeName && !!emp.fullName && (
                       l.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase() ||
                       l.employeeName.replace(/\s+/g, '').toLowerCase() === emp.fullName.replace(/\s+/g, '').toLowerCase()
                     ))) &&
                    (l.status === 'Approved' || ((l.pmStatus === 'Approved' || l.pmStatus === 'N/A' || l.pmStatus === 'Bypassed') && (l.hrStatus === 'Approved' || l.hrStatus === 'N/A' || l.hrStatus === 'Bypassed') && (l.ceoStatus === 'Approved' || l.ceoStatus === 'N/A' || l.ceoStatus === 'Bypassed') && (l.ctoStatus === 'Approved' || l.ctoStatus === 'N/A' || l.ctoStatus === 'Bypassed'))) &&
                    todayStr >= (l.startDate || (l as any).fromDate) && 
                    todayStr <= (l.endDate || (l as any).toDate || l.startDate)
                  );

                  const hasApprovedLeave = !!leaveReq && !isWfhType(leaveReq.type) && !isWfhType(leaveReq.leaveCategory);
                  const isCompanyWfh = ((settings as any)?.companyWideWfhDates || []).includes(todayStr);
                  const isApprovedEmpWfh = !hasApprovedLeave && (
                    (emp.approvedWfhDates || []).includes(todayStr) || 
                    (!!leaveReq && (isWfhType(leaveReq.type) || isWfhType(leaveReq.leaveCategory))) ||
                    (todayRec && (todayRec.isWfh === true || todayRec.status === 'Work From Home'))
                  );

                  let todayStatusLabel: 'Present' | 'Late' | 'WFH' | 'On Leave' | 'Absent' = 'Absent';
                  let todayStatusBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                  if (hasApprovedLeave || todayRec?.status === 'On Leave' || emp.status === 'On Leave') {
                    todayStatusLabel = 'On Leave';
                    todayStatusBadge = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
                  } else if (todayRec?.checkInAt) {
                    if (todayRec.status === 'Late' || isLateCheckIn(todayRec.checkInAt)) {
                      todayStatusLabel = 'Late';
                      todayStatusBadge = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                    } else if (isApprovedEmpWfh || todayRec.isWfh || todayRec.status === 'Work From Home') {
                      todayStatusLabel = 'WFH';
                      todayStatusBadge = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
                    } else {
                      todayStatusLabel = 'Present';
                      todayStatusBadge = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                    }
                  } else if (isApprovedEmpWfh || (isCompanyWfh && !todayRec?.checkInAt)) {
                    todayStatusLabel = 'WFH';
                    todayStatusBadge = 'bg-sky-500/15 text-sky-300 border-sky-500/30';
                  }

                  // Show Undo Checkout only if employee checked in AND already checked out today
                  const hasUndoableCheckout =
                    canForceUndoCheckout &&
                    todayRec &&
                    !!todayRec.checkInAt &&
                    !!todayRec.checkOutAt;

                  const isUpdatingThis = quickActionLoading === emp.id;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors group align-middle">
                      {/* 1. Employee Name & Avatar */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3.5">
                          <img
                            src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=0f172a&color=fff`}
                            alt={emp.fullName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-700/60 group-hover:border-blue-500/60 transition-all shadow-sm"
                          />
                          <div>
                            <div className="font-bold text-white group-hover:text-blue-300 transition-colors">{emp.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{emp.designation || 'Staff Member'}</div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Emp ID */}
                      <td className="py-3.5 px-5">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                          {emp.employeeId}
                        </span>
                      </td>

                      {/* 3. Department */}
                      <td className="py-3.5 px-5 font-semibold text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{emp.department || 'General'}</span>
                        </div>
                      </td>

                      {/* 4. Shift Timings (Editable) */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-200 font-semibold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate max-w-[200px] text-slate-100 font-bold">{shiftDisplay}</span>
                          </div>
                          
                          {canEditShifts && (
                            <button
                              onClick={() => handleOpenShiftEdit(emp)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit Shift Timing"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 5. Today Status & Leave Balance */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${todayStatusBadge}`}>
                            {todayStatusLabel}
                          </span>

                          <div className="inline-flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                            <Palmtree className="w-3 h-3 text-purple-400 shrink-0" />
                            <span className="text-[11px] font-black text-purple-300 font-mono">{leaveInfo.balance} Left</span>
                          </div>
                        </div>
                      </td>

                      {/* 6. Shift Log & Quick Override Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">

                          {/* Quick Mark On Leave Action */}
                          {todayStatusLabel !== 'On Leave' && (
                            <button
                              disabled={isUpdatingThis}
                              onClick={() => handleQuickMarkEmployeeStatus(emp, 'On Leave')}
                              className="px-2.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold rounded-xl flex items-center gap-1 transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                              title={`Set ${emp.fullName} as On Leave for today`}
                            >
                              <Palmtree className="w-3 h-3 text-purple-400" />
                              <span>Set On Leave</span>
                            </button>
                          )}

                          {/* ── Force Undo Checkout Button ── */}
                          {hasUndoableCheckout && todayRec && (
                            <button
                              onClick={() => handleOpenUndoCheckout(emp, todayRec)}
                              className="group/undo px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:border-amber-400/60 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                              title={`Undo today's checkout for ${emp.fullName}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5 group-hover/undo:-rotate-45 transition-transform duration-200" />
                              <span>Undo Checkout</span>
                            </button>
                          )}

                          <button
                            onClick={() => setHistoryEmployee(emp)}
                            className="px-3.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5 text-blue-400" />
                            <span>Shift Log</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shift Timings Edit Modal */}
      {editingShiftEmployee && (
        <div className="fixed inset-0 z-[160] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">Edit Assigned Shift Timings</h3>
                <p className="text-xs text-slate-400">{editingShiftEmployee.fullName} ({editingShiftEmployee.employeeId})</p>
              </div>
              <button
                onClick={() => setEditingShiftEmployee(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">Preset Shift Schedule or Custom Timings:</label>
              
              <div className="grid grid-cols-1 gap-2">
                {[
                  'Day Shift (10:00 AM – 7:00 PM)',
                  'Morning Shift (07:00 AM – 04:00 PM)',
                  'Evening Shift (02:00 PM – 11:00 PM)',
                  'Night Shift (10:00 PM – 07:00 AM)',
                  'Flexible Shift (10:00 AM – 07:00 PM)'
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setShiftTimingValue(preset)}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      shiftTimingValue === preset
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>{preset}</span>
                    {shiftTimingValue === preset && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mt-2 mb-1">Custom Shift Label / Time String:</label>
                <input
                  type="text"
                  value={shiftTimingValue}
                  onChange={e => setShiftTimingValue(e.target.value)}
                  placeholder="e.g. Day Shift (10:00 AM – 7:00 PM)"
                  className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingShiftEmployee(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveShift}
                disabled={isSavingShift}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-900/40"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingShift ? 'Saving...' : 'Save & Live Sync'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Force Undo Checkout Confirmation Modal ─────────────────────────────── */}
      {undoCheckoutTarget && (
        <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Force Undo Checkout</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Admin Override — Audit Logged</p>
                </div>
              </div>
              <button
                onClick={() => { setUndoCheckoutTarget(null); setUndoFeedback(null); }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Employee Info Card */}
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={undoCheckoutTarget.employee.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(undoCheckoutTarget.employee.fullName)}&background=0f172a&color=fff`}
                  alt={undoCheckoutTarget.employee.fullName}
                  className="w-11 h-11 rounded-xl object-cover border border-amber-500/30"
                />
                <div>
                  <div className="font-bold text-white text-sm">{undoCheckoutTarget.employee.fullName}</div>
                  <div className="text-[10px] text-slate-400">{undoCheckoutTarget.employee.employeeId} · {undoCheckoutTarget.employee.department}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800">
                  <div className="text-slate-500 font-medium mb-0.5">Checked In At</div>
                  <div className="text-emerald-400 font-bold font-mono">
                    {undoCheckoutTarget.record.checkInAt ? toISTTimeString(undoCheckoutTarget.record.checkInAt) : '—'}
                  </div>
                </div>
                <div className="bg-slate-900 rounded-xl p-2.5 border border-amber-500/20">
                  <div className="text-slate-500 font-medium mb-0.5">Checked Out At</div>
                  <div className="text-amber-400 font-bold font-mono">
                    {undoCheckoutTarget.record.checkOutAt ? toISTTimeString(undoCheckoutTarget.record.checkOutAt) : '—'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800/60 rounded-xl px-3 py-2">
                <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span>Date: <span className="text-white font-semibold">{undoCheckoutTarget.record.date}</span></span>
                <span className="text-slate-700 mx-1">·</span>
                <LogOut className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>Duration logged: <span className="text-white font-semibold">{Math.floor((undoCheckoutTarget.record.workingMinutes || 0) / 60)}h {(undoCheckoutTarget.record.workingMinutes || 0) % 60}m</span></span>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3.5 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                This will <strong className="text-amber-300">revert the checkout</strong> and restore the employee's session to{' '}
                <strong className="text-emerald-300">Active / Checked In</strong>. The checkout timestamp and duration will be cleared. This action is{' '}
                <span className="text-white font-semibold">permanently audit-logged</span> under your name.
              </p>
            </div>

            {/* Reason Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Reason for Override <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={undoCheckoutReason}
                onChange={e => setUndoCheckoutReason(e.target.value)}
                placeholder="e.g. Employee was accidentally checked out by system / incorrect QR scan..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl text-white placeholder-slate-600 font-medium focus:outline-none resize-none transition-colors"
              />
            </div>

            {/* Feedback */}
            {undoFeedback && (
              <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${
                undoFeedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-300 border-red-500/30'
              }`}>
                {undoFeedback.type === 'success'
                  ? <Check className="w-3.5 h-3.5" />
                  : <AlertTriangle className="w-3.5 h-3.5" />}
                {undoFeedback.msg}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setUndoCheckoutTarget(null); setUndoFeedback(null); }}
                disabled={isUndoingCheckout}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUndoCheckout}
                disabled={isUndoingCheckout || !!undoFeedback}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-amber-900/30 transition-all"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isUndoingCheckout ? 'animate-spin' : ''}`} />
                <span>{isUndoingCheckout ? 'Reverting...' : 'Confirm Undo Checkout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Render Employee Monthly Attendance History Modal */}
      {historyEmployee && (
        <EmployeeMonthlyAttendanceModal
          employee={historyEmployee}
          onClose={() => setHistoryEmployee(null)}
        />
      )}

    </div>
  );
};
