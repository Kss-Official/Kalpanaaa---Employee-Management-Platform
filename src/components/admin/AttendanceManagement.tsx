import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AttendanceRecord, AttendanceStatus } from '../../types';
import { 
  Search, 
  Filter, 
  Calendar, 
  FileDown, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Edit3, 
  UserCheck,
  Building2,
  RefreshCw
} from 'lucide-react';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';

export const AttendanceManagement: React.FC = () => {
  const { attendance, employees, updateAttendanceRecord, settings } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'all'>('today');

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('Present');
  const [editNotes, setEditNotes] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  const departments = Array.from(new Set(employees.map(e => e.department)));

  const filteredRecords = attendance.filter(rec => {
    const matchesSearch = 
      (rec.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.department || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = deptFilter === 'ALL' || rec.department === deptFilter;
    const matchesStatus = statusFilter === 'ALL' || rec.status === statusFilter;

    let matchesDate = true;
    if (dateFilter === 'today') matchesDate = rec.date === todayStr;
    else if (dateFilter === 'yesterday') matchesDate = rec.date === yesterdayStr;

    return matchesSearch && matchesDept && matchesStatus && matchesDate;
  });

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'Present': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Late': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Absent': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'Half Day': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'On Leave': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Work From Home': return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const handleSaveCorrection = () => {
    if (!editingRecord) return;
    updateAttendanceRecord(editingRecord.id, {
      status: editStatus,
      notes: editNotes || 'HR Manual Correction'
    });
    setEditingRecord(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Attendance Management Master</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor check-ins, check-outs, GPS verification status, and manual HR corrections ({filteredRecords.length} records)
          </p>
        </div>

        <button
          onClick={() => generateAttendanceReportPdf(filteredRecords, settings, 'Attendance Master Log Report')}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
        >
          <FileDown className="w-4 h-4" />
          Export PDF Statement
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee, ID, department..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
          {/* Quick Date Range Filters */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${dateFilter === 'today' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${dateFilter === 'yesterday' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${dateFilter === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              All Records
            </button>
          </div>

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
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="Half Day">Half Day</option>
            <option value="On Leave">On Leave</option>
            <option value="Work From Home">Work From Home</option>
          </select>
        </div>
      </div>

      {/* Attendance Master Table */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Check In</th>
                <th className="py-3.5 px-4">Check Out</th>
                <th className="py-3.5 px-4">Working Hours</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Method & GPS</th>
                <th className="py-3.5 px-4 text-right">Correct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                    No attendance records match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{rec.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{rec.employeeCode} • {rec.department}</div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-300">
                      {rec.date}
                    </td>

                    <td className="py-3 px-4">
                      {rec.checkInAt ? (
                        <span className="font-semibold text-white bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">--:--</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {rec.checkOutAt ? (
                        <span className="font-semibold text-white bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : rec.checkInAt ? (
                        <span className="text-emerald-300 font-semibold text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30 animate-pulse">
                          Active Now
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">--:--</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                      {rec.workingMinutes > 0 ? (
                        `${Math.floor(rec.workingMinutes / 60)}h ${rec.workingMinutes % 60}m`
                      ) : (
                        '--'
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-md border ${getStatusBadge(rec.status)}`}>
                        {rec.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-200 font-medium text-[11px]">{rec.attendanceMethod}</div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${rec.locationVerified ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {rec.locationVerified ? 'GPS Verified' : 'Standard'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditingRecord(rec);
                          setEditStatus(rec.status);
                          setEditNotes(rec.notes || '');
                        }}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="HR Manual Correction"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Correction Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-md p-6 text-white">
            <h3 className="text-base font-bold text-white mb-1">HR Attendance Correction</h3>
            <p className="text-xs text-slate-400 mb-4">
              Updating record for <strong className="text-blue-300">{editingRecord.employeeName}</strong> ({editingRecord.date})
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Attendance Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as AttendanceStatus)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-semibold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                  <option value="Half Day">Half Day</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Work From Home">Work From Home 🏠</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">HR Reason / Notes</label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Reason for manual adjustment..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCorrection}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-md transition-colors"
              >
                Save Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
