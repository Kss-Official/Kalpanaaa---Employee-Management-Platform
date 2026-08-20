import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { AttendanceRecord, AttendanceStatus, Employee } from '../../types';
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
  RefreshCw,
  History
} from 'lucide-react';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';
import { getEmployeeWorkDate } from '../../lib/attendanceEngine';

interface AttendanceManagementProps {
  initialDateFilter?: 'today' | 'yesterday' | 'all';
  initialStatusFilter?: string;
}

export const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ 
  initialDateFilter = 'today',
  initialStatusFilter = 'ALL'
}) => {
  const { attendance, employees, updateAttendanceRecord, settings } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'all'>(initialDateFilter);

  React.useEffect(() => {
    if (initialDateFilter) setDateFilter(initialDateFilter);
    if (initialStatusFilter) setStatusFilter(initialStatusFilter);
  }, [initialDateFilter, initialStatusFilter]);

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('Present');
  const [editNotes, setEditNotes] = useState('');

  // State for shift history modal
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [historyInitialRecord, setHistoryInitialRecord] = useState<AttendanceRecord | null>(null);

  const todayStr = getEmployeeWorkDate(new Date());
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = getEmployeeWorkDate(yesterdayObj);

  const departments = Array.from(new Set(employees.map(e => e.department)));

  const filteredRecords = attendance.filter(rec => {
    // Omit corrupted or empty records lacking valid employee name, employee code, or date
    if (!rec || !rec.employeeName || rec.employeeName.trim() === '' || rec.employeeName === '.' || !rec.date) {
      return false;
    }

    const matchesSearch = 
      (rec.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.department || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = deptFilter === 'ALL' || rec.department === deptFilter;
    
    const matchesStatus = 
      statusFilter === 'ALL' ? true :
      (statusFilter === 'Work From Home' || statusFilter === 'WFH') ? (rec.status === 'Work From Home' || rec.isWfh) :
      rec.status === statusFilter;

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

  const getDisplayWorkingHours = (rec: AttendanceRecord) => {
    if (rec.workingMinutes && rec.workingMinutes > 0) {
      return `${Math.floor(rec.workingMinutes / 60)}h ${rec.workingMinutes % 60}m`;
    }
    if (rec.checkInAt) {
      const totalBreakMins = (rec.breaks || []).reduce((acc, b) => acc + (b.durationMinutes || 0), 0) || (rec.totalBreakMinutes || 0);
      const endMs = rec.checkOutAt ? new Date(rec.checkOutAt).getTime() : Date.now();
      const startMs = new Date(rec.checkInAt).getTime();
      if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
        const elapsedMins = Math.max(0, Math.floor((endMs - startMs) / 60000) - totalBreakMins);
        if (elapsedMins > 0) {
          return `${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m${!rec.checkOutAt ? ' (Live)' : ''}`;
        }
      }
    }
    return '--';
  };

  const handleSaveCorrection = () => {
    if (!editingRecord) return;
    updateAttendanceRecord(editingRecord.id, {
      status: editStatus,
      notes: editNotes ? `HR Correction: ${editNotes}` : editingRecord.notes
    });
    setEditingRecord(null);
  };

  const handleUndoCheckout = () => {
    if (!editingRecord) return;
    const confirmUndo = window.confirm(
      "Are you sure you want to undo the Check-Out for this employee?\n\n" +
      "This will clear their Check-Out time and allow them to Check-Out again today."
    );
    if (!confirmUndo) return;
    
    updateAttendanceRecord(editingRecord.id, {
      checkOutAt: null,
      notes: editNotes ? `HR Undo Checkout: ${editNotes}` : (editingRecord.notes ? `${editingRecord.notes} | HR Undo Checkout` : 'HR Undo Checkout')
    });
    setEditingRecord(null);
  };

  const handleForceCheckout = () => {
    if (!editingRecord) return;
    
    // Set to standard 7:30 PM checkout time for that date
    const autoCheckOutDate = new Date(`${editingRecord.date}T19:30:00`);
    const forceCheckOutTime = autoCheckOutDate.toISOString();
    
    let totalMins = 0;
    if (editingRecord.checkInAt) {
      totalMins = Math.floor((autoCheckOutDate.getTime() - new Date(editingRecord.checkInAt).getTime()) / 60000);
      if (editingRecord.totalBreakMinutes) {
        totalMins = Math.max(0, totalMins - editingRecord.totalBreakMinutes);
      }
    }
    totalMins = Math.max(0, totalMins);

    updateAttendanceRecord(editingRecord.id, {
      checkOutAt: forceCheckOutTime,
      workingMinutes: totalMins,
      notes: editNotes ? `HR Force Checkout: ${editNotes}` : (editingRecord.notes ? `${editingRecord.notes} | HR Force Checkout at 19:30` : 'HR Force Checkout at 19:30')
    });
    setEditingRecord(null);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight">Attendance Management Master</h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Monitor check-ins, check-outs, GPS verification status, and manual HR corrections ({filteredRecords.length} records)
          </p>
        </div>

        <button
          onClick={() => generateAttendanceReportPdf(filteredRecords, settings, 'Attendance Master Log Report')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40 w-full sm:w-auto shrink-0"
        >
          <FileDown className="w-4 h-4" />
          <span>Export PDF Statement</span>
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

      {/* Attendance Master Table & Cards View */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        {/* Mobile Cards View (sm:hidden) — Test A25 Responsive Viewport Contract */}
        <div 
          data-testid="attendance-mobile-cards-view"
          data-view="mobile-cards" 
          aria-label="Mobile attendance cards view" 
          className="sm:hidden p-3.5 space-y-3"
        >
          {filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-medium">
              No attendance records match your search criteria.
            </div>
          ) : (
            filteredRecords.map(rec => (
              <div key={rec.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                {/* Employee Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{rec.employeeName}</h4>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{rec.employeeCode} • {rec.department}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md border shrink-0 ${getStatusBadge(rec.status)}`}>
                    {rec.status}
                  </span>
                </div>

                {/* Timing Info Grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-900 p-2.5 rounded-xl border border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">Check In</span>
                    <span className="font-bold text-white whitespace-nowrap">
                      {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">Check Out</span>
                    {rec.checkOutAt ? (
                      <span className="font-bold text-white whitespace-nowrap">
                        {new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : rec.checkInAt ? (
                      <span className="text-emerald-400 font-bold text-[10px] whitespace-nowrap">Active Now</span>
                    ) : (
                      <span className="text-slate-500 whitespace-nowrap">--:--</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono block">Hours</span>
                    <span className="font-bold text-slate-200 whitespace-nowrap">
                      {getDisplayWorkingHours(rec)}
                    </span>
                  </div>
                </div>

                {/* Card Footer: Method & Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${rec.locationVerified ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span>{rec.locationVerified ? 'GPS Verified' : 'Standard'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const emp = employees.find(e => 
                          e.id === rec.employeeId || 
                          e.employeeId === rec.employeeCode || 
                          (e.fullName && rec.employeeName && e.fullName.trim().toLowerCase() === rec.employeeName.trim().toLowerCase())
                        );
                        if (emp) {
                          setHistoryEmployee(emp);
                          setHistoryInitialRecord(rec);
                        }
                      }}
                      className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-bold border border-blue-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <History className="w-3 h-3" />
                      <span>Shift Log</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingRecord(rec);
                        setEditStatus(rec.status);
                        setEditNotes(rec.notes || '');
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="HR Manual Correction"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (hidden on sm, flex on sm+) — Test A25 Responsive Viewport Contract */}
        <div 
          data-testid="attendance-desktop-table-view"
          data-view="desktop-table" 
          aria-label="Desktop attendance table view" 
          className="hidden sm:block overflow-x-auto custom-scrollbar"
        >
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-48">Employee</th>
                <th className="py-3.5 px-4 w-28">Date</th>
                <th className="py-3.5 px-4 w-28">Check In</th>
                <th className="py-3.5 px-4 w-32">Check Out</th>
                <th className="py-3.5 px-4 w-28">Working Hours</th>
                <th className="py-3.5 px-4 w-28">Status</th>
                <th className="py-3.5 px-4 w-36">Method &amp; GPS</th>
                <th className="py-3.5 px-4 w-28 text-center">Shift Log</th>
                <th className="py-3.5 px-4 w-20 text-right">Correct</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
                    No attendance records match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-800/50 transition-colors align-middle">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{rec.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{rec.employeeCode} • {rec.department}</div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-300 whitespace-nowrap">
                      {rec.date}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {rec.checkInAt ? (
                        <span className="font-semibold text-white bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 whitespace-nowrap inline-block">
                          {new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">--:--</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {rec.checkOutAt ? (
                        <span className="font-semibold text-white bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 whitespace-nowrap inline-block">
                          {new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : rec.checkInAt ? (
                        <span className="inline-flex items-center font-semibold text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30 animate-pulse whitespace-nowrap">
                          Active Now
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono">--:--</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-200 whitespace-nowrap">
                      {getDisplayWorkingHours(rec)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-md border ${getStatusBadge(rec.status)}`}>
                        {rec.status}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {(() => {
                        const rawMethod = rec.attendanceMethod || (rec as any).method;
                        const isNumeric = rawMethod && !isNaN(Number(rawMethod));
                        const displayMethod = (rawMethod && !isNumeric) ? rawMethod : 'Facial Recognition';
                        return (
                          <>
                            <div className="text-slate-200 font-medium text-[11px]">{displayMethod}</div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${rec.locationVerified ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                              {rec.locationVerified ? 'GPS Verified' : 'Standard'}
                            </div>
                          </>
                        );
                      })()}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          const emp = employees.find(e => 
                            e.id === rec.employeeId || 
                            e.employeeId === rec.employeeCode || 
                            (e.fullName && rec.employeeName && e.fullName.trim().toLowerCase() === rec.employeeName.trim().toLowerCase())
                          );
                          if (emp) {
                            setHistoryEmployee(emp);
                            setHistoryInitialRecord(rec);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        title="View Full Shift Dashboard & Monthly History"
                      >
                        <History className="w-3.5 h-3.5" />
                        Shift Log
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
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
      {editingRecord && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-md p-6 text-white relative z-[101]">
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

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer transition-colors mr-auto"
              >
                Cancel
              </button>
              
              {!editingRecord.checkOutAt && (
                <button
                  type="button"
                  onClick={handleForceCheckout}
                  className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/50 text-xs font-semibold rounded-xl cursor-pointer shadow-md transition-colors"
                >
                  Force 7:30 PM Checkout
                </button>
              )}

              {editingRecord.checkOutAt && (
                <button
                  type="button"
                  onClick={handleUndoCheckout}
                  className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-500 border border-amber-500/50 text-xs font-semibold rounded-xl cursor-pointer shadow-md transition-colors"
                >
                  Undo Check-Out
                </button>
              )}
              
              <button
                type="button"
                onClick={handleSaveCorrection}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-md transition-colors"
              >
                Save Correction
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Employee Shift Dashboard & Monthly Attendance History Modal */}
      {historyEmployee && (
        <EmployeeMonthlyAttendanceModal
          employee={historyEmployee}
          initialSelectedRecord={historyInitialRecord}
          onClose={() => {
            setHistoryEmployee(null);
            setHistoryInitialRecord(null);
          }}
        />
      )}
    </div>
  );
};
