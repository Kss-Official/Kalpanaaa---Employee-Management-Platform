import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AllEmployeeBarcodesView } from './AllEmployeeBarcodesView';
import { Employee, EmployeeStatus } from '../../types';
import { motion } from 'framer-motion';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';
import { isExecutiveOrLeadership, computeEmploymentType } from '../../lib/attendanceEngine';
import { 
  Search, 
  Plus, 
  CreditCard, 
  Mail, 
  Phone, 
  Building2, 
  Edit, 
  Eye, 
  List,
  Calendar,
  Crown,
  Star
} from 'lucide-react';

interface EmployeeDirectoryProps {
  onSelectEmployee: (emp: Employee) => void;
  onOpenAddModal: () => void;
  onOpenEditModal: (emp: Employee) => void;
  onOpenIdCardModal: (emp: Employee) => void;
}

export const EmployeeDirectory: React.FC<EmployeeDirectoryProps> = ({
  onSelectEmployee,
  onOpenAddModal,
  onOpenEditModal,
  onOpenIdCardModal
}) => {
  const { employees, role } = useAuth();
  const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN';
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showPrintAllBarcodes, setShowPrintAllBarcodes] = useState(false);
  const [attendanceModalEmp, setAttendanceModalEmp] = useState<Employee | null>(null);

  const departments = useMemo(() => Array.from(new Set(employees.map(e => e.department).filter(Boolean))), [employees]);

  // Single source of truth, shared with payroll and every dashboard. The local
  // copy this replaced matched `desig.includes('cto')`, which is also true for
  // "Contractor", and `desig.includes('ceo')`; designation is a free-text input,
  // so ordinary staff were being promoted into the Executive Leadership section
  // and removed from the operational roster below it.
  const isExecutiveLeadership = (emp: any) => isExecutiveOrLeadership(emp);

  const formatEmployeeStatus = (status?: string): EmployeeStatus => {
    if (!status || status.toLowerCase() === 'check' || status.toLowerCase() === 'checked in' || status.toLowerCase() === 'active') {
      return 'Active';
    }
    if (status.toLowerCase() === 'on leave' || status.toLowerCase() === 'leave') {
      return 'On Leave';
    }
    if (status.toLowerCase() === 'terminated' || status.toLowerCase() === 'inactive') {
      return 'Inactive';
    }
    if (status.toLowerCase() === 'suspended') {
      return 'Suspended';
    }
    return 'Active';
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (!emp.fullName || emp.fullName.trim() === '') return false;
      
      const matchesSearch = 
        (emp.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (emp.employeeId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (emp.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (emp.designation?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesDept = deptFilter === 'ALL' || emp.department === deptFilter;
      const empStatus = formatEmployeeStatus(emp.status);
      const matchesStatus = statusFilter === 'ALL' || empStatus === statusFilter;

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [employees, searchTerm, deptFilter, statusFilter]);

  const standardEmployees = useMemo(() => {
    return filteredEmployees.filter(emp => !isExecutiveLeadership(emp));
  }, [filteredEmployees]);

  const executiveLeaders = useMemo(() => {
    const getExecutiveRank = (emp: any): number => {
      const name = (emp?.fullName || '').toLowerCase();
      const id = (emp?.employeeId || '').toLowerCase();
      const email = (emp?.email || '').toLowerCase();
      const desig = (emp?.designation || '').toLowerCase();
      const role = (emp?.executiveRole || '').toLowerCase();

      // 1. Gaurav Sir is FIRST (Left side)
      if (
        name.includes('gaurav') ||
        id === 'kss2407001' ||
        email.includes('founder') ||
        email.includes('gaurav') ||
        desig.includes('managing director') ||
        (desig.includes('cto') && !desig.includes('contractor')) ||
        role === 'cto'
      ) {
        return 1;
      }

      // 2. Akshit Sir is SECOND (Right side)
      if (
        name.includes('akshit') ||
        id === 'kss2407002' ||
        id === 'ceo001' ||
        email.includes('akshit') ||
        desig.includes('ceo') ||
        role === 'ceo'
      ) {
        return 2;
      }

      const so = Number(emp?.sortOrder);
      if (!isNaN(so) && so > 0) return so + 2;

      return 99;
    };

    return employees
      .filter(emp => isExecutiveLeadership(emp))
      .sort((a, b) => {
        const diff = getExecutiveRank(a) - getExecutiveRank(b);
        if (diff !== 0) return diff;
        return (a.fullName || '').localeCompare(b.fullName || '');
      });
  }, [employees]);

  const getStatusIndicator = (status?: string) => {
    const s = formatEmployeeStatus(status);
    switch (s) {
      case 'Active': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
      case 'On Leave': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
      case 'Inactive': return 'bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.5)]';
      case 'Suspended': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
      default: return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    }
  };

  if (showPrintAllBarcodes) {
    return <AllEmployeeBarcodesView onBack={() => setShowPrintAllBarcodes(false)} />;
  }

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">Personnel Directory</h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Manage corporate workforce records, employee IDs, and profiles ({filteredEmployees.length} total)
          </p>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full md:w-auto shrink-0">
            <button
              onClick={() => setShowPrintAllBarcodes(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md w-full"
            >
              <CreditCard className="w-4 h-4" />
              <span>Print All Barcodes</span>
            </button>
            <button
              onClick={onOpenAddModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40 w-full"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Employee</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 backdrop-blur-md">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={2.5} />
          <input
            type="text"
            placeholder="Search name, ID, email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-hidden focus:border-blue-500 text-white placeholder-slate-500 transition-colors"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-bold focus:outline-hidden focus:border-blue-500 cursor-pointer w-full"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-bold focus:outline-hidden focus:border-blue-500 cursor-pointer w-full"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 1. MAIN WORKFORCE TABLE (Top to Bottom) ──────────────── */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800/80 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Workforce Personnel ({standardEmployees.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/40 border-b border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="py-3.5 px-6">Employee</th>
                <th className="py-3.5 px-6">ID Code</th>
                <th className="py-3.5 px-6">Department &amp; Role</th>
                <th className="py-3.5 px-6">Employment</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-[11px]">
              {standardEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    No workforce personnel match your search criteria.
                  </td>
                </tr>
              ) : (
                standardEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3.5">
                        <img
                          src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=0f172a&color=fff`}
                          alt={emp.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700/50"
                        />
                        <div
                          onClick={() => onSelectEmployee(emp)}
                          className="font-bold text-white text-xs hover:text-blue-400 cursor-pointer transition-colors"
                        >
                          {emp.fullName}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-6">
                      <span className="font-mono font-bold text-slate-400">
                        {emp.employeeId}
                      </span>
                    </td>

                    <td className="py-3 px-6">
                      <div className="font-bold text-slate-300">{emp.department}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{emp.designation}</div>
                    </td>

                    <td className="py-3 px-6">
                      {(() => {
                        const effectiveType = computeEmploymentType(emp);
                        return (
                          <div className={`font-bold text-xs ${
                            effectiveType === 'Intern' ? 'text-cyan-400' :
                            effectiveType === 'Trainee' ? 'text-amber-400' :
                            'text-slate-300'
                          }`}>
                            {effectiveType}
                          </div>
                        );
                      })()}
                      <div className="text-[10px] text-slate-500 font-mono">Shift: {emp.shift?.split(' ')[0] || 'General'}</div>
                    </td>

                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusIndicator(emp.status)}`} />
                        <span className="text-slate-300 font-bold">{formatEmployeeStatus(emp.status)}</span>
                      </div>
                    </td>

                    <td className="py-3 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectEmployee(emp)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                          title="View Full Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => setAttendanceModalEmp(emp)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                              title="View Monthly Attendance History"
                            >
                              <Calendar className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              onClick={() => onOpenIdCardModal(emp)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                              title="Print ID Badge Card"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onOpenEditModal(emp)}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                              title="Edit Employee Data"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. HIGHLIGHTED SEPARATION LINE ──────────────────────── */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t-2 border-gradient-to-r from-amber-500/20 via-blue-500/50 to-purple-500/20 shadow-lg shadow-blue-500/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-950 px-5 py-1.5 rounded-full border-2 border-blue-500/40 text-xs font-black text-blue-300 uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-950/60">
            <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Executive Leadership &amp; Founders</span>
          </span>
        </div>
      </div>

      {/* ── 3. FIXED CEO & CTO FOOTER SECTION ────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/30 rounded-3xl border-2 border-amber-500/30 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Executive Directorate &amp; C-Suite Office
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-0.5 rounded-full">
            Fixed Executive Directorate
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {executiveLeaders.map((exec) => (
            <div
              key={exec.id}
              className="bg-slate-950/90 rounded-2xl border-2 border-amber-500/30 p-5 shadow-xl flex items-start justify-between gap-4 hover:border-amber-400 transition-all group"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={exec.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(exec.fullName)}&background=1e1e2e&color=fff`}
                    alt={exec.fullName}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/60 shadow-lg shadow-amber-950/50"
                  />
                  <span className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-1 shadow-md">
                    <Star className="w-3 h-3 text-white fill-white" />
                  </span>
                </div>

                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-black text-white group-hover:text-amber-300 transition-colors truncate">
                      {exec.fullName}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {exec.designation || 'Executive Leadership'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-400 font-mono">
                    {exec.employeeId || 'KSS-EXEC'} • {exec.department || 'Executive Office'}
                  </p>

                  <div className="space-y-1 text-xs text-slate-400 pt-1 font-medium">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                      <span className="truncate">{exec.email}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Phone className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                      <span>{exec.phone || '+91 98765 43210'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <button
                    onClick={() => onSelectEmployee(exec)}
                    className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                    title="View Profile"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onOpenIdCardModal(exec)}
                    className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                    title="ID Badge"
                  >
                    <CreditCard className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onOpenEditModal(exec)}
                    className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                    title="Edit Profile"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Render Employee Monthly Attendance Modal */}
      {attendanceModalEmp && (
        <EmployeeMonthlyAttendanceModal
          employee={attendanceModalEmp}
          onClose={() => setAttendanceModalEmp(null)}
        />
      )}
    </div>
  );
};
