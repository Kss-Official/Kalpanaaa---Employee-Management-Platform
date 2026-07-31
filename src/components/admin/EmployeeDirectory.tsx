import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, EmployeeStatus } from '../../types';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  QrCode, 
  CreditCard, 
  Mail, 
  Phone, 
  Building2, 
  Edit, 
  Trash2, 
  Eye, 
  LayoutGrid, 
  List,
  Sparkles
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
  const { employees, deleteEmployee, regenerateQrToken } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  const departments = Array.from(new Set(employees.map(e => e.department)));

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = deptFilter === 'ALL' || emp.department === deptFilter;
    const matchesStatus = statusFilter === 'ALL' || emp.status === statusFilter;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const getStatusBadge = (status: EmployeeStatus) => {
    switch (status) {
      case 'Active': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'On Leave': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Terminated': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Employee Directory</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage corporate workforce records, employee IDs, and profiles ({filteredEmployees.length} total)
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
        >
          <Plus className="w-4 h-4" />
          Add New Employee
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, ID, email, designation..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium focus:outline-none focus:border-blue-500"
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
            className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Terminated">Terminated</option>
          </select>

          {/* Grid vs Table View Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No employees match your search</h3>
          <p className="text-xs text-slate-400 mt-1">Try resetting search filters or add a new employee profile.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">ID Code</th>
                  <th className="py-3.5 px-4">Department & Role</th>
                  <th className="py-3.5 px-4">Employment</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={emp.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={emp.fullName}
                          className="w-9 h-9 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <div
                            onClick={() => onSelectEmployee(emp)}
                            className="font-bold text-white hover:text-blue-400 cursor-pointer transition-colors"
                          >
                            {emp.fullName}
                          </div>
                          <div className="text-[11px] text-slate-400">{emp.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-200 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                        {emp.employeeId}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{emp.department}</div>
                      <div className="text-[11px] text-slate-400">{emp.designation}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-medium">{emp.employmentType}</div>
                      <div className="text-[11px] text-slate-500">Shift: {emp.shift.split(' ')[0]}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-md border ${getStatusBadge(emp.status)}`}>
                        {emp.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectEmployee(emp)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                          title="View Full Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenIdCardModal(emp)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg cursor-pointer"
                          title="Print / Export ID Badge Card"
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map(emp => (
            <div key={emp.id} className="bg-slate-900 rounded-3xl border border-slate-800 p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className="font-mono text-xs font-bold bg-slate-950 text-slate-300 px-2 py-0.5 rounded-md border border-slate-800">
                    {emp.employeeId}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getStatusBadge(emp.status)}`}>
                    {emp.status}
                  </span>
                </div>

                <div className="text-center my-2">
                  <img
                    src={emp.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={emp.fullName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-700 mx-auto shadow-md"
                  />
                  <h3
                    onClick={() => onSelectEmployee(emp)}
                    className="font-bold text-white text-sm mt-2 hover:text-blue-400 cursor-pointer transition-colors"
                  >
                    {emp.fullName}
                  </h3>
                  <p className="text-xs text-blue-400 font-semibold">{emp.designation}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{emp.department}</p>
                </div>

                <div className="my-4 pt-3 border-t border-slate-800 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{emp.phone}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectEmployee(emp)}
                  className="flex-1 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition-colors cursor-pointer text-center"
                >
                  View Profile
                </button>
                <button
                  onClick={() => onOpenIdCardModal(emp)}
                  className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors cursor-pointer border border-emerald-500/20"
                  title="ID Card"
                >
                  <CreditCard className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onOpenEditModal(emp)}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors cursor-pointer"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
