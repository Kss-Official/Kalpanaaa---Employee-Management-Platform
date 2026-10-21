import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  Eye,
  Calendar,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  UserX,
  Sparkles
} from 'lucide-react';
import { EmployeeLeaveMetric } from '../../../lib/leaveAnalyticsService';

interface EmployeeLeaveTableProps {
  metrics: EmployeeLeaveMetric[];
  onSelectEmployee: (emp: EmployeeLeaveMetric) => void;
}

type SortField = 'fullName' | 'department' | 'lopDays' | 'elDays' | 'slDays' | 'wfhDays' | 'totalLeaveDays' | 'qualifyingRequestsCount' | 'lastLeaveDate';
type SortDirection = 'asc' | 'desc';

export const EmployeeLeaveTable: React.FC<EmployeeLeaveTableProps> = ({
  metrics,
  onSelectEmployee
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<'ALL' | 'LOP' | 'EL' | 'SL' | 'WFH' | 'ANY_LEAVE'>('ALL');
  
  const [sortField, setSortField] = useState<SortField>('totalLeaveDays');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Extract unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    metrics.forEach(m => {
      if (m.department) set.add(m.department);
    });
    return Array.from(set).sort();
  }, [metrics]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filtered and Sorted list
  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => {
      // Search filter
      const searchMatch = !searchTerm ||
        m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!searchMatch) return false;

      // Department filter
      if (departmentFilter !== 'ALL' && m.department !== departmentFilter) {
        return false;
      }

      // Leave Type Filter
      if (leaveTypeFilter === 'LOP' && m.lopDays <= 0) return false;
      if (leaveTypeFilter === 'EL' && m.elDays <= 0) return false;
      if (leaveTypeFilter === 'SL' && m.slDays <= 0) return false;
      if (leaveTypeFilter === 'WFH' && m.wfhDays <= 0) return false;
      if (leaveTypeFilter === 'ANY_LEAVE' && m.totalLeaveDays <= 0) return false;

      return true;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [metrics, searchTerm, departmentFilter, leaveTypeFilter, sortField, sortDirection]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredMetrics.length / pageSize));
  const paginatedMetrics = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMetrics.slice(start, start + pageSize);
  }, [filteredMetrics, currentPage, pageSize]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden space-y-4">
      {/* Table Header & Search/Filters Toolbar */}
      <div className="p-5 sm:p-6 pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <span>Employee-Wise Leave &amp; LOP Breakdown</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold font-mono">
              {filteredMetrics.length} staff
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Search, sort, and inspect employee leave days taken during the selected reporting period.
          </p>
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={departmentFilter}
              onChange={e => { setDepartmentFilter(e.target.value); setCurrentPage(1); }}
              className="pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-blue-500 appearance-none font-medium cursor-pointer"
            >
              <option value="ALL">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Leave Type Filter */}
          <div className="relative">
            <select
              value={leaveTypeFilter}
              onChange={e => { setLeaveTypeFilter(e.target.value as any); setCurrentPage(1); }}
              className="pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-blue-500 appearance-none font-medium cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ANY_LEAVE">Any Leave Taken (&gt;0)</option>
              <option value="LOP">Has Loss of Pay (LOP)</option>
              <option value="EL">Has Earned Leave (EL)</option>
              <option value="SL">Has Sick Leave (SL)</option>
              <option value="WFH">Has WFH (Remote)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-950/80 border-y border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
            <tr>
              <th 
                onClick={() => handleSort('fullName')}
                className="py-3 px-4 sm:px-6 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Employee</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('department')}
                className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Department</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('lopDays')}
                className="py-3 px-3 cursor-pointer hover:text-rose-400 transition-colors text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-rose-400">LOP Days</span>
                  <ArrowUpDown className="w-3 h-3 text-rose-500/70" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('elDays')}
                className="py-3 px-3 cursor-pointer hover:text-blue-400 transition-colors text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-blue-400">EL Days</span>
                  <ArrowUpDown className="w-3 h-3 text-blue-500/70" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('slDays')}
                className="py-3 px-3 cursor-pointer hover:text-amber-400 transition-colors text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-amber-400">SL Days</span>
                  <ArrowUpDown className="w-3 h-3 text-amber-500/70" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('wfhDays')}
                className="py-3 px-3 cursor-pointer hover:text-cyan-400 transition-colors text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-cyan-400">WFH Days</span>
                  <ArrowUpDown className="w-3 h-3 text-cyan-500/70" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('totalLeaveDays')}
                className="py-3 px-4 cursor-pointer hover:text-purple-400 transition-colors text-right"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-purple-400">Total Leave</span>
                  <ArrowUpDown className="w-3 h-3 text-purple-500/70" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('qualifyingRequestsCount')}
                className="py-3 px-3 cursor-pointer hover:text-white transition-colors text-center"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Requests</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th 
                onClick={() => handleSort('lastLeaveDate')}
                className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Last Leave Date</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>

              <th className="py-3 px-4 sm:px-6 text-center">
                <span>Actions</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-sans">
            {paginatedMetrics.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <UserX className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-white">No Employees Match the Active Filters</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Try adjusting the search query, department, or date range.
                  </p>
                </td>
              </tr>
            ) : (
              paginatedMetrics.map(emp => (
                <tr 
                  key={emp.employeeId}
                  onClick={() => onSelectEmployee(emp)}
                  className="hover:bg-slate-850/50 transition-colors cursor-pointer group"
                >
                  {/* Employee Name & Code */}
                  <td className="py-3 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      {emp.avatarUrl ? (
                        <img src={emp.avatarUrl} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center shrink-0">
                          {emp.fullName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white group-hover:text-blue-400 transition-colors">
                          {emp.fullName}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {emp.employeeCode || emp.employeeId}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Department */}
                  <td className="py-3 px-3 text-slate-300">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px]">
                      {emp.department}
                    </span>
                  </td>

                  {/* LOP Days */}
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {emp.lopDays > 0 ? (
                      <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                        {emp.lopDays}d
                      </span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>

                  {/* EL Days */}
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {emp.elDays > 0 ? (
                      <span className="text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                        {emp.elDays}d
                      </span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>

                  {/* SL Days */}
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {emp.slDays > 0 ? (
                      <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {emp.slDays}d
                      </span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>

                  {/* WFH Days */}
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {emp.wfhDays > 0 ? (
                      <span className="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                        {emp.wfhDays}d
                      </span>
                    ) : (
                      <span className="text-slate-600">0</span>
                    )}
                  </td>

                  {/* Total Leave Days (LOP + EL + SL) */}
                  <td className="py-3 px-4 text-right font-mono font-extrabold text-sm">
                    {emp.totalLeaveDays > 0 ? (
                      <span className="text-purple-300">
                        {emp.totalLeaveDays} <span className="text-[10px] font-normal text-slate-500">days</span>
                      </span>
                    ) : (
                      <span className="text-slate-600 font-normal">0</span>
                    )}
                  </td>

                  {/* Leave Requests Count */}
                  <td className="py-3 px-3 text-center font-mono text-slate-300">
                    {emp.qualifyingRequestsCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px]">
                        {emp.qualifyingRequestsCount}
                      </span>
                    ) : (
                      <span className="text-slate-600">--</span>
                    )}
                  </td>

                  {/* Last Leave Date */}
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                    {emp.lastLeaveDate ? (
                      <span>{emp.lastLeaveDate}</span>
                    ) : (
                      <span className="text-slate-600">None in period</span>
                    )}
                  </td>

                  {/* Action Button */}
                  <td className="py-3 px-4 sm:px-6 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEmployee(emp);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>History</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 px-6 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Showing</span>
          <strong className="text-white font-mono">
            {filteredMetrics.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          </strong>
          <span>to</span>
          <strong className="text-white font-mono">
            {Math.min(currentPage * pageSize, filteredMetrics.length)}
          </strong>
          <span>of</span>
          <strong className="text-white font-mono">{filteredMetrics.length}</strong>
          <span>employees</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono font-bold text-white">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
