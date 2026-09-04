import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, AttendanceRecord, AttendanceStatus } from '../../types';
import {
  Search,
  FileDown,
  FileSpreadsheet,
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
  RefreshCw,
  Eye,
  ChevronDown,
  Tag,
  Layers,
  Users,
  Stethoscope,
  Coffee
} from 'lucide-react';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';
import { useHaptic } from '../../hooks/useHaptic';
import { isExecutiveOrLeadership, getWorkDate, formatShiftTiming, computeTotalLeaveBalances, computeEmploymentType, isLateCheckIn, isWfhType } from '../../lib/attendanceEngine';
import { toISTTimeString } from '../../lib/absoluteTime';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeeIdCardModal } from './EmployeeIdCardModal';

// ─── Dropdown Constants ────────────────────────────────────────────────────────

const DEPARTMENTS = [
  'IT', 'HR', 'Management', 'Sales', 'Business Development',
  'Marketing', 'Design', 'Finance', 'Operations',
];

const DESIGNATIONS = [
  'Project Manager', 'Tech Lead',
  'Software Engineer', 'Software Developer', 'Senior Software Engineer',
  'Senior Software Developer',
  'UI/UX Designer', 'Senior UI/UX Designer',
  'QA Engineer', 'Senior QA Engineer',
  'DevOps Engineer', 'Cloud & DevOps Engineer',
  'Cybersecurity Engineer',
  'HR Operations Manager', 'HR Executive',
  'Finance & Accounts Executive',
  'Business Development Executive', 'IT Consultant',
  'Digital Marketing Executive',
];

const EMPLOYMENT_TYPES = [
  'Intern', 'Trainee', 'Full-Time', 'Part-Time', 'Contract',
];

// Specializations grouped for smart UX
const SPECIALIZATION_GROUPS: { label: string; color: string; items: string[] }[] = [
  {
    label: 'Software & Web Dev',
    color: 'blue',
    items: ['Frontend Development', 'Backend Development', 'Full Stack Development', 'Web Development', 'App Development'],
  },
  {
    label: 'AI & Machine Learning',
    color: 'violet',
    items: ['AI & ML', 'Machine Learning', 'Deep Learning', 'Generative AI', 'NLP', 'Computer Vision', 'AI Automation', 'Chatbot Development'],
  },
  {
    label: 'Design',
    color: 'pink',
    items: ['UI Design', 'UX Design', 'Product Design', 'Figma'],
  },
  {
    label: 'QA & Testing',
    color: 'amber',
    items: ['Manual Testing', 'Automation Testing', 'API Testing'],
  },
  {
    label: 'DevOps & Cloud',
    color: 'cyan',
    items: ['Cloud Computing', 'DevOps', 'AWS', 'Azure', 'CI/CD'],
  },
  {
    label: 'Security',
    color: 'red',
    items: ['Application Security', 'Network Security', 'Cybersecurity'],
  },
  {
    label: 'Consulting & Support',
    color: 'teal',
    items: ['IT Consulting', 'Technology Consulting', 'Solution Architecture', 'Application Support'],
  },
  {
    label: 'Marketing',
    color: 'lime',
    items: ['SEO', 'Social Media Marketing', 'Content Marketing', 'Digital Marketing'],
  },
  {
    label: 'Leadership & HR',
    color: 'indigo',
    items: ['Project Management', 'Technical Leadership', 'HR Operations', 'Talent Acquisition', 'Client Management'],
  },
];

const ALL_SPECIALIZATIONS = SPECIALIZATION_GROUPS.flatMap(g => g.items);

// Helper to normalize skills for Attendance Ledger (merges 'UI Design' and 'UX Design' into 'UI/UX Design')
function getAttendanceSpecializations(skills: string[] = []): string[] {
  const result: string[] = [];
  let hasDesign = false;
  for (const s of skills) {
    if (s === 'UI Design' || s === 'UX Design' || s === 'UI/UX Design') {
      if (!hasDesign) {
        result.push('UI/UX Design');
        hasDesign = true;
      }
    } else if (ALL_SPECIALIZATIONS.includes(s) || s.includes('Development') || s.includes('AI') || s.includes('Design')) {
      if (!result.includes(s)) {
        result.push(s);
      }
    }
  }
  return result;
}

// Helper: get colour classes for a specialization tag
function getSpecializationColor(spec: string): string {
  if (spec === 'UI/UX Design' || spec === 'UI Design' || spec === 'UX Design') {
    return 'bg-pink-500/15 text-pink-300 border-pink-500/25';
  }
  for (const group of SPECIALIZATION_GROUPS) {
    if (group.items.includes(spec)) {
      const c = group.color;
      const map: Record<string, string> = {
        blue: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
        violet: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
        pink: 'bg-pink-500/15 text-pink-300 border-pink-500/25',
        amber: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
        cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
        red: 'bg-red-500/15 text-red-300 border-red-500/25',
        teal: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
        orange: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
        lime: 'bg-lime-500/15 text-lime-300 border-lime-500/25',
        indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
      };
      return map[c] || 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  }
  return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
}

// ─── Component ─────────────────────────────────────────────────────────────────

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
  const canForceUndoCheckout = isSuperAdmin || isHr;

  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [designationFilter, setDesignationFilter] = useState('ALL');
  const [empTypeFilter, setEmpTypeFilter] = useState('ALL');
  const [specializationFilter, setSpecializationFilter] = useState('ALL');

  // Shift Editing Modal State
  const [editingShiftEmployee, setEditingShiftEmployee] = useState<Employee | null>(null);
  const [shiftTimingValue, setShiftTimingValue] = useState('');
  const [isSavingShift, setIsSavingShift] = useState(false);

  // State for shift history modal
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);

  // State for profile view modal (eye icon)
  const [profileEmployee, setProfileEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [idCardEmployee, setIdCardEmployee] = useState<Employee | null>(null);

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

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const todayStr = getWorkDate(new Date());

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

  // Compute all leave balances (EL + SL + CL) for a single employee
  const computeAllLeaves = (emp: Employee) => computeTotalLeaveBalances(emp, leaveRequests, new Date());

  // ─── Compute per-employee attendance stats from attendance records ────────────
  const computeEmpAttendanceStats = (emp: Employee) => {
    const empRecs = attendance.filter(rec =>
      rec.employeeId === emp.id ||
      rec.employeeCode === emp.employeeId ||
      (rec.employeeName && emp.fullName &&
        rec.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase())
    );
    let holidays = 0, wfhDays = 0, halfDays = 0, lopDays = 0;
    empRecs.forEach(rec => {
      if (rec.status === 'Holiday') holidays++;
      else if (rec.status === 'Work From Home' || rec.isWfh) wfhDays++;
      else if (rec.status === 'Half Day') halfDays++;
      else if (rec.status === 'Loss of Pay' || rec.status === 'LOP') lopDays++;
    });
    return { holidays, wfhDays, halfDays, lopDays };
  };

  // ─── Excel/CSV Export for Attendance Ledger ──────────────────────────────────
  const handleExportLedgerExcel = () => {
    triggerHaptic();
    const headers = [
      'Employee Name', 'Emp ID', 'DOJ',
      'Holidays (in cycle)', 'WFH Days',
      'EL (Earned Leave)', 'CL (Casual Leave)', 'SL (Sick Leave)',
      'Half Day', 'LOP'
    ];
    const rows = filteredEmployees.map(emp => {
      const leaves = computeAllLeaves(emp);
      const stats = computeEmpAttendanceStats(emp);
      const doj = emp.joiningDate
        ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
      return [
        `"${emp.fullName}"`,
        emp.employeeId || '—',
        doj,
        stats.holidays,
        stats.wfhDays,
        leaves.earnLeave.balance,
        leaves.casualLeave.balance,
        leaves.sickLeave.balance,
        stats.halfDays,
        stats.lopDays
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Attendance_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // Department normalizer for Attendance Ledger: IT for all technical staff & Managing Director, HR separate
  const getAttendanceDepartment = (emp: Employee): string => {
    const raw = (emp.department || '').trim().toLowerCase();
    const desig = (emp.designation || '').toLowerCase();
    const name = (emp.fullName || '').toLowerCase();

    // HR is separate
    if (raw.includes('hr') || desig.includes('hr') || name.includes('hr department')) {
      return 'HR';
    }
    // All engineers / developers / designers / tech staff / Managing Director Gaurav Sir -> IT
    return 'IT';
  };

  // Filtered Employees for the Attendance Ledger (Excludes Executive Leadership / Founders per directive)
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (!emp.fullName || emp.fullName.trim() === '') return false;
      if (emp.status === 'Terminated' || emp.status === 'Inactive') return false;

      // Exclude Executive Leadership / Founders (Gaurav Sir, Akshit Sir, etc.) from attendance ledger
      if (
        isExecutiveOrLeadership(emp) ||
        (emp.fullName || '').toLowerCase().includes('gaurav') ||
        (emp.designation || '').toLowerCase().includes('managing director') ||
        (emp.designation || '').toLowerCase().includes('founder') ||
        emp.employeeId === 'KSS2407001' ||
        emp.employeeId === 'KSS2407002'
      ) {
        return false;
      }

      const empDept = getAttendanceDepartment(emp);

      const matchesSearch =
        (emp.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        empDept.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.designation || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept =
        deptFilter === 'ALL' ||
        empDept.toLowerCase() === deptFilter.toLowerCase() ||
        (emp.department || '').toLowerCase() === deptFilter.toLowerCase();

      const desigLower = (emp.designation || '').toLowerCase();
      const filterDesigLower = designationFilter.toLowerCase();

      const matchesDesignation =
        designationFilter === 'ALL' ||
        desigLower === filterDesigLower ||
        (emp.designation || '').trim() === designationFilter.trim();

      const effectiveEmpType = computeEmploymentType(emp);
      const matchesEmpType = empTypeFilter === 'ALL' || effectiveEmpType === empTypeFilter;

      const normalizedSpecs = getAttendanceSpecializations(emp.skills || []);
      const matchesSpec =
        specializationFilter === 'ALL' ||
        normalizedSpecs.some(s => s.toLowerCase() === specializationFilter.toLowerCase()) ||
        (specializationFilter === 'UI/UX Design' && (
          normalizedSpecs.includes('UI/UX Design') ||
          (emp.skills || []).some(s => s.toLowerCase().includes('ui') || s.toLowerCase().includes('ux')) ||
          desigLower.includes('ui') || desigLower.includes('ux') || desigLower.includes('design')
        )) ||
        (specializationFilter === 'Frontend Development' && (normalizedSpecs.includes('Frontend Development') || desigLower.includes('frontend'))) ||
        (specializationFilter === 'Backend Development' && (normalizedSpecs.includes('Backend Development') || desigLower.includes('backend'))) ||
        (specializationFilter === 'Full Stack Development' && (normalizedSpecs.includes('Full Stack Development') || desigLower.includes('full stack') || desigLower.includes('software'))) ||
        (specializationFilter === 'AI & ML' && (normalizedSpecs.some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('machine learning')) || desigLower.includes('ai') || desigLower.includes('ml')));

      return matchesSearch && matchesDept && matchesDesignation && matchesEmpType && matchesSpec;
    });
  }, [employees, searchTerm, deptFilter, designationFilter, empTypeFilter, specializationFilter]);

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

      await updateAttendanceRecord(record.id, {
        checkOutAt: null as any,
        workingMinutes: 0,
        status: 'Present',
        notes: updatedNotes,
      });

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
        }).catch(() => { });
      }

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
              <span>{isSyncingAll ? 'Updating All...' : 'Sync All Shifts'}</span>
            </button>
          )}
          <button
            onClick={handleExportLedgerExcel}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-900/40 w-full sm:w-auto shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => generateAttendanceReportPdf(attendance, settings, 'Attendance Master Roster Statement')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40 w-full sm:w-auto shrink-0"
          >
            <FileDown className="w-4 h-4" />
            <span>Export PDF</span>
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

      {/* Quick Action Toast */}
      {quickActionToast && (
        <div className="fixed top-5 right-5 z-[300] bg-slate-900 border border-slate-700 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-top-2 duration-300">
          {quickActionToast}
        </div>
      )}

      {/* ── Filters & Search Bar ── */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-xl space-y-3">
        {/* Row 1: Search + Department */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee, ID, department..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-hidden focus:border-blue-500 text-white placeholder-slate-500"
            />
          </div>

          {/* Department */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium focus:outline-hidden focus:border-blue-500 cursor-pointer w-full md:w-auto"
            >
              <option value="ALL">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Designation */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={designationFilter}
              onChange={e => setDesignationFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium focus:outline-hidden focus:border-blue-500 cursor-pointer w-full md:w-auto"
            >
              <option value="ALL">All Designations</option>
              {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Employment Type */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={empTypeFilter}
              onChange={e => setEmpTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium focus:outline-hidden focus:border-blue-500 cursor-pointer w-full md:w-auto"
            >
              <option value="ALL">All Types</option>
              {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Specialization */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={specializationFilter}
              onChange={e => setSpecializationFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium focus:outline-hidden focus:border-blue-500 cursor-pointer w-full md:w-auto"
            >
              <option value="ALL">All Specializations</option>
              {SPECIALIZATION_GROUPS.map(group => (
                <optgroup key={group.label} label={`── ${group.label}`}>
                  {group.items.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {(deptFilter !== 'ALL' || designationFilter !== 'ALL' || empTypeFilter !== 'ALL' || specializationFilter !== 'ALL') && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Active filters:</span>
            {deptFilter !== 'ALL' && (
              <button onClick={() => setDeptFilter('ALL')} className="flex items-center gap-1 px-2.5 py-0.5 bg-blue-500/15 text-blue-300 border border-blue-500/25 rounded-full text-[10px] font-bold hover:bg-blue-500/25 transition-colors cursor-pointer">
                {deptFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {designationFilter !== 'ALL' && (
              <button onClick={() => setDesignationFilter('ALL')} className="flex items-center gap-1 px-2.5 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/25 rounded-full text-[10px] font-bold hover:bg-purple-500/25 transition-colors cursor-pointer">
                {designationFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {empTypeFilter !== 'ALL' && (
              <button onClick={() => setEmpTypeFilter('ALL')} className="flex items-center gap-1 px-2.5 py-0.5 bg-teal-500/15 text-teal-300 border border-teal-500/25 rounded-full text-[10px] font-bold hover:bg-teal-500/25 transition-colors cursor-pointer">
                {empTypeFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
            {specializationFilter !== 'ALL' && (
              <button onClick={() => setSpecializationFilter('ALL')} className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${getSpecializationColor(specializationFilter)}`}>
                {specializationFilter} <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Attendance Ledger Table ── */}
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: '1500px' }}>
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-left whitespace-nowrap">Employee Name</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Employee ID</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Date of Joining</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Department</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Designation</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Employment Type</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Specialization</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Status</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Holidays</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">WFH Days</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Earned Leave</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Casual Leave</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Sick Leave</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Half Day</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Loss of Pay</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-14 text-center text-slate-500 font-medium">
                    No employees match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const leaveInfo = computeAllLeaves(emp);
                  const stats = computeEmpAttendanceStats(emp);

                  // Today's attendance record for this employee
                  const todayRec =
                    todayRecordByEmpId.get(emp.id) ||
                    todayRecordByEmpId.get(emp.employeeId || '') ||
                    null;

                  // Active / Inactive status
                  const isInactive = emp.status === 'Inactive' || emp.status === 'Terminated' || emp.status === 'Suspended';
                  const isActive = !isInactive;
                  const statusLabel = isActive ? 'Active' : 'Inactive';
                  const statusBadge = isActive
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30';

                  // Show Undo Checkout only if employee checked in AND already checked out today
                  const hasUndoableCheckout =
                    canForceUndoCheckout &&
                    todayRec &&
                    !!todayRec.checkInAt &&
                    !!todayRec.checkOutAt;

                  // Specializations: Normalized to merge UI Design + UX Design into UI/UX Design
                  const specializations = getAttendanceSpecializations(emp.skills || []);
                  const shownSpecs = specializations.slice(0, 2);
                  const extraCount = specializations.length - shownSpecs.length;

                  // Format DOJ
                  const dojDisplay = emp.joiningDate
                    ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—';

                  return (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors group align-middle">

                      {/* 1. Employee Name & Avatar */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <img
                            src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=0f172a&color=fff`}
                            alt={emp.fullName}
                            className="w-8 h-8 rounded-xl object-cover border border-slate-700/60 group-hover:border-blue-500/60 transition-all shadow-sm shrink-0"
                          />
                          <span className="font-bold text-white group-hover:text-blue-300 transition-colors whitespace-nowrap">
                            {emp.fullName}
                          </span>
                        </div>
                      </td>

                      {/* 2. Employee ID */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 whitespace-nowrap inline-block">
                          {emp.employeeId || '—'}
                        </span>
                      </td>

                      {/* 3. Date of Joining */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-300 whitespace-nowrap">
                          {dojDisplay}
                        </span>
                      </td>

                      {/* 4. Department */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">
                          {emp.department || '—'}
                        </span>
                      </td>

                      {/* 5. Designation */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="px-2 py-1 bg-slate-800 text-slate-200 border border-slate-700/60 rounded-lg text-[11px] font-semibold whitespace-nowrap inline-block">
                          {emp.designation || '—'}
                        </span>
                      </td>

                      {/* 5. Employment Type */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {(() => {
                          const effectiveEmpType = computeEmploymentType(emp);
                          return (
                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap inline-block ${
                              effectiveEmpType === 'Intern'
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
                                : effectiveEmpType === 'Trainee'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                            }`}>
                              {effectiveEmpType}
                            </span>
                          );
                        })()}
                      </td>

                      {/* 6. Specialization */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                          {shownSpecs.length === 0 ? (
                            <span className="text-slate-600 text-[11px]">—</span>
                          ) : (
                            <>
                              {shownSpecs.map(s => (
                                <span key={s} className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap inline-block ${getSpecializationColor(s)}`}>
                                  {s}
                                </span>
                              ))}
                              {extraCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-700/40 text-slate-400 border border-slate-600/30 whitespace-nowrap inline-block">
                                  +{extraCount}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* 7. Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold whitespace-nowrap ${statusBadge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isActive
                              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                              : 'bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                          }`} />
                          <span className="whitespace-nowrap">{statusLabel}</span>
                        </span>
                      </td>

                      {/* 8. Holidays */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-400 tabular-nums">{stats.holidays}</span>
                      </td>

                      {/* 9. WFH Days */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-xs font-bold text-sky-400 tabular-nums">{stats.wfhDays}</span>
                      </td>

                      {/* 10. EL */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`text-xs font-black tabular-nums ${
                          leaveInfo.earnLeave.balance === 0 ? 'text-rose-400' :
                          leaveInfo.earnLeave.balance >= 2 ? 'text-emerald-400' : 'text-amber-300'
                        }`}>{leaveInfo.earnLeave.balance}</span>
                      </td>

                      {/* 11. CL */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`text-xs font-black tabular-nums ${
                          leaveInfo.casualLeave.balance === 0 ? 'text-rose-400' :
                          leaveInfo.casualLeave.balance >= 2 ? 'text-emerald-400' : 'text-amber-300'
                        }`}>{leaveInfo.casualLeave.balance}</span>
                      </td>

                      {/* 12. SL */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`text-xs font-black tabular-nums ${
                          leaveInfo.sickLeave.balance === 0 ? 'text-rose-400' :
                          leaveInfo.sickLeave.balance >= 2 ? 'text-emerald-400' : 'text-amber-300'
                        }`}>{leaveInfo.sickLeave.balance}</span>
                      </td>

                      {/* 13. Half Day */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-xs font-bold text-orange-400 tabular-nums">{stats.halfDays}</span>
                      </td>

                      {/* 14. LOP */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-xs font-bold text-rose-400 tabular-nums">{stats.lopDays}</span>
                      </td>

                      {/* 15. Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">

                          {/* ── Force Undo Checkout Button ── */}
                          {hasUndoableCheckout && todayRec && (
                            <button
                              onClick={() => handleOpenUndoCheckout(emp, todayRec)}
                              className="group/undo px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 hover:border-amber-400/60 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                              title={`Undo today's checkout for ${emp.fullName}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5 group-hover/undo:-rotate-45 transition-transform duration-200" />
                              <span>Undo</span>
                            </button>
                          )}

                          {/* Eye: View Profile */}
                          <button
                            onClick={() => { triggerHaptic(); setProfileEmployee(emp); }}
                            className="p-2 bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-300 border border-slate-700/60 hover:border-blue-500/40 rounded-xl transition-all cursor-pointer"
                            title={`View ${emp.fullName}'s profile`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Shift Log */}
                          <button
                            onClick={() => setHistoryEmployee(emp)}
                            className="px-2.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                          >
                            <History className="w-3.5 h-3.5 text-blue-400" />
                            <span>Log</span>
                          </button>

                          {/* Edit Shift (pencil) */}
                          {canEditShifts && (
                            <button
                              onClick={() => handleOpenShiftEdit(emp)}
                              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/30 rounded-xl transition-colors cursor-pointer"
                              title="Edit Shift Timing"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                    className={`px-3 py-2 text-xs font-bold rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${shiftTimingValue === preset
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
              <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${undoFeedback.type === 'success'
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

      {/* Employee Profile Modal (eye icon) */}
      {profileEmployee && (
        <EmployeeProfileModal
          employee={profileEmployee}
          onClose={() => setProfileEmployee(null)}
          onOpenEdit={(emp) => { setProfileEmployee(null); setEditEmployee(emp); }}
          onOpenIdCard={(emp) => { setProfileEmployee(null); setIdCardEmployee(emp); }}
        />
      )}

      {/* Edit Employee Modal */}
      {editEmployee && (
        <EmployeeFormModal
          employee={editEmployee}
          onClose={() => setEditEmployee(null)}
        />
      )}

      {/* ID Card Modal */}
      {idCardEmployee && (
        <EmployeeIdCardModal
          employee={idCardEmployee}
          onClose={() => setIdCardEmployee(null)}
        />
      )}

    </div>
  );
};
