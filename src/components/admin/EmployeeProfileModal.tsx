import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import {
  X, User, Briefcase, MapPin, CreditCard,
  Download, RotateCcw, Shield, Clock, Calendar, PieChart as PieChartIcon
} from 'lucide-react';
import QRCode from 'qrcode';
import { generateEmployeeQrToken } from '../../lib/attendanceEngine';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../hooks/useHaptic';
import { animations } from '../../lib/animations';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';

interface EmployeeProfileModalProps {
  employee: Employee;
  onClose: () => void;
  onOpenEdit: (emp: Employee) => void;
  onOpenIdCard: (emp: Employee) => void;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  employee, onClose, onOpenEdit, onOpenIdCard
}) => {
  const { attendance, auditLogs, regenerateQrToken, settings, updateEmployee } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'qr' | 'attendance' | 'activity'>('details');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);

  const [joiningDateValue, setJoiningDateValue] = useState(employee.joiningDate || '2026-07-27');
  const [isSavingJoiningDate, setIsSavingJoiningDate] = useState(false);
  const [saveJoiningDateToast, setSaveJoiningDateToast] = useState<string | null>(null);

  const handleSaveJoiningDate = async () => {
    if (!joiningDateValue) return;
    setIsSavingJoiningDate(true);
    try {
      await updateEmployee(employee.id, { joiningDate: joiningDateValue });
      setSaveJoiningDateToast('✓ Saved');
      setTimeout(() => setSaveJoiningDateToast(null), 2500);
    } catch (err: any) {
      setSaveJoiningDateToast(`Failed: ${err?.message || 'Error'}`);
    } finally {
      setIsSavingJoiningDate(false);
    }
  };

  const empAttendance = attendance.filter(a => a.employeeId === employee.id || a.employeeCode === employee.employeeId);
  const empLogs = auditLogs.filter(l => l.target.includes(employee.employeeId) || l.actorId === employee.id);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const renderQr = () => {
      const tokenPayload = generateEmployeeQrToken(employee, settings.qrTokenLifetimeMinutes);
      QRCode.toDataURL(tokenPayload, {
        width: 320, margin: 2, errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      }, (err, url) => {
        if (!err && url) setQrDataUrl(url);
      });
    };
    renderQr();
    intervalId = setInterval(renderQr, 5000);
    return () => clearInterval(intervalId);
  }, [employee, settings.qrTokenLifetimeMinutes]);

  const handleRegenerateQr = () => {
    regenerateQrToken(employee.id);
    const newTokenPayload = generateEmployeeQrToken(employee, settings.qrTokenLifetimeMinutes);
    QRCode.toDataURL(newTokenPayload, {
      width: 320, margin: 2, errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' }
    }, (err, url) => {
      if (!err && url) setQrDataUrl(url);
    });
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${employee.employeeId}_${employee.fullName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex flex-col justify-end p-0 sm:p-6 sm:items-center pointer-events-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => { triggerHaptic('light'); onClose(); }}
        />

        {/* Bottom Sheet / Modal Shell */}
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 500 }}
          dragElastic={0.2}
          onDragEnd={(e, info) => {
            if (info.offset.y > 100 || info.velocity.y > 500) {
              triggerHaptic('medium');
              onClose();
            }
          }}
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full sm:max-w-4xl bg-[var(--bg-primary)] rounded-t-3xl sm:rounded-3xl shadow-[var(--shadow-xl)] flex flex-col max-h-[95vh] sm:max-h-[85vh] overflow-hidden border-t sm:border border-[var(--border-subtle)]"
        >
          {/* Mobile Drag Indicator */}
          <div className="w-full flex justify-center py-3 sm:hidden absolute top-0 z-20 touch-none">
            <div className="w-12 h-1.5 bg-[var(--border-strong)] rounded-full"></div>
          </div>

          {/* Sticky Header Hero */}
          <div className="bg-[var(--bg-tertiary)] p-5 sm:p-6 pt-10 sm:pt-6 relative border-b border-[var(--border-subtle)] shrink-0 z-10">

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="relative shrink-0">
                <img
                  src={employee.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.fullName)}&background=111118&color=fff`}
                  alt={employee.fullName}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-[var(--border-subtle)] shadow-[var(--shadow-md)]"
                />
              </div>

              {/* Name + meta — takes remaining space */}
              <div className="text-center sm:text-left flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                  <span className="font-mono text-[11px] font-bold bg-[var(--bg-elevated)] text-[var(--text-secondary)] px-2.5 py-0.5 rounded-lg border border-[var(--border-subtle)]">
                    {employee.employeeId}
                  </span>
                  <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg border flex items-center gap-1 ${
                    (employee.status || 'Active').toLowerCase() === 'active' || (employee.status || '').toLowerCase() === 'check'
                      ? 'bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)] border-[var(--accent-emerald)]/20' 
                      : 'bg-[var(--accent-amber)]/10 text-[var(--accent-amber)] border-[var(--accent-amber)]/20'
                  }`}>
                    {((employee.status || 'Active').toLowerCase() === 'active' || (employee.status || '').toLowerCase() === 'check') && <Shield className="w-3 h-3" />}
                    {(employee.status || '').toLowerCase() === 'check' || (employee.status || '').toLowerCase() === 'checked in' ? 'Active' : (employee.status || 'Active')}
                  </span>
                  <span className="bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-[var(--accent-blue)]/20">
                    {employee.role}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)] truncate">{employee.fullName}</h2>
                <p className="text-sm text-[var(--text-secondary)] font-semibold truncate">{employee.designation} • {employee.department}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1.5 flex items-center justify-center sm:justify-start gap-1 truncate font-medium">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{employee.workLocation}</span>
                </p>
              </div>

              {/* Right column: Close X on top, then ID Badge + Edit Profile */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {/* Close button — top-right */}
                <button
                  onClick={() => { triggerHaptic('light'); onClose(); }}
                  className={`self-end p-2 text-[var(--text-tertiary)] hover:text-white hover:bg-[var(--bg-elevated)] rounded-full transition-colors cursor-pointer outline-none ${animations.tap}`}
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Action Buttons */}
                <button
                  onClick={() => { triggerHaptic('medium'); setIsMonthlyModalOpen(true); }}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 text-purple-300 text-xs font-bold rounded-xl border border-purple-500/40 cursor-pointer outline-none w-full ${animations.tap}`}
                >
                  <Calendar className="w-4 h-4 text-purple-400" />
                  Work Analytics
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); onOpenIdCard(employee); }}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border-subtle)] cursor-pointer outline-none w-full ${animations.tap}`}
                >
                  <CreditCard className="w-4 h-4" />
                  ID Badge
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); onOpenEdit(employee); }}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent-blue)] hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer outline-none shadow-lg shadow-blue-500/20 w-full ${animations.tap}`}
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 mt-5 sm:mt-6 pt-4 border-t border-[var(--border-subtle)] overflow-x-auto text-[11px] font-bold no-scrollbar pb-1">
              {[
                { id: 'details', label: 'Employee Details' },
                { id: 'qr', label: 'QR Pass' },
                { id: 'attendance', label: `Attendance (${empAttendance.length})` },
                { id: 'activity', label: 'Audit Trail' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { triggerHaptic('light'); setActiveTab(tab.id as any); }}
                  className={`px-4 py-2 rounded-xl transition-colors cursor-pointer shrink-0 outline-none ${animations.tap} ${
                    activeTab === tab.id 
                      ? 'bg-[var(--accent-blue)] text-white' 
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto bg-[var(--bg-primary)] flex-1 text-[var(--text-primary)] relative pb-safe">
            {activeTab === 'details' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs">
                {/* Employment Data */}
                <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-subtle)] space-y-3">
                  <h3 className="font-bold text-[var(--text-primary)] text-sm uppercase tracking-wider flex items-center gap-2 text-[var(--accent-blue)]">
                    <Briefcase className="w-4 h-4" />
                    Employment
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">Department</span>
                      <span className="font-semibold text-[var(--text-primary)]">{employee.department}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">Designation</span>
                      <span className="font-semibold text-[var(--text-primary)]">{employee.designation}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">Type</span>
                      <span className="font-semibold text-[var(--text-primary)]">{employee.employmentType}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] flex-wrap gap-2">
                      <span className="text-[var(--text-secondary)]">Official Joined Date</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={joiningDateValue}
                          onChange={e => setJoiningDateValue(e.target.value)}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-blue-500 font-bold"
                        />
                        {joiningDateValue !== (employee.joiningDate || '2026-07-27') && (
                          <button
                            type="button"
                            onClick={handleSaveJoiningDate}
                            disabled={isSavingJoiningDate}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                          >
                            {isSavingJoiningDate ? 'Saving...' : 'Save'}
                          </button>
                        )}
                        {saveJoiningDateToast && (
                          <span className="text-[10px] font-bold text-emerald-400">{saveJoiningDateToast}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">Manager</span>
                      <span className="font-semibold text-[var(--text-primary)]">{employee.reportingManager}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-[var(--text-secondary)]">Shift</span>
                      <span className="font-semibold text-[var(--text-primary)]">{employee.shift}</span>
                    </div>
                  </div>
                </div>

                {/* Personal & Contact */}
                <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 border border-[var(--border-subtle)] space-y-3">
                  <h3 className="font-bold text-[var(--text-primary)] text-sm uppercase tracking-wider flex items-center gap-2 text-[var(--accent-blue)]">
                    <User className="w-4 h-4" />
                    Contact
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">Email</span>
                      <span className="font-semibold text-[var(--text-primary)]">{employee.email}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">Phone</span>
                      <span className="font-semibold text-[var(--text-primary)]">{employee.phone}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">DOB</span>
                      <span className="font-semibold text-[var(--text-primary)]">{employee.dateOfBirth}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">Address</span>
                      <span className="font-semibold text-[var(--text-primary)] text-right max-w-[150px] truncate" title={`${employee.address}, ${employee.city}`}>{employee.city}, {employee.state}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-[var(--text-secondary)]">Emergency</span>
                      <span className="font-semibold text-rose-400">{employee.emergencyContact}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'qr' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-6 sm:py-10 space-y-6 text-center">
                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-[var(--border-strong)]">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Pass" className="w-56 h-56 sm:w-64 sm:h-64 object-contain" />
                  ) : (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center bg-slate-100 text-slate-400 font-semibold rounded-xl">
                      Generating...
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="font-bold text-[var(--text-primary)] text-base">Secure Identity Token</h3>
                  <p className="text-xs text-[var(--text-tertiary)]">Scan at office terminal. Refreshes automatically.</p>
                </div>
                <div className="flex items-center gap-3 w-full max-w-xs mt-2">
                  <button onClick={() => { triggerHaptic('light'); handleRegenerateQr(); }} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border-subtle)] outline-none ${animations.tap}`}>
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>
                  <button onClick={() => { triggerHaptic('medium'); handleDownloadQr(); }} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--accent-blue)] text-white text-xs font-bold rounded-xl outline-none shadow-lg shadow-blue-500/20 ${animations.tap}`}>
                    <Download className="w-4 h-4" /> Save
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'attendance' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border-subtle)]">
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)]">Monthly Attendance &amp; Work Analytics</h4>
                    <p className="text-[10px] text-[var(--text-tertiary)]">Interactive pie charts, task hours, breaks and calendar statement</p>
                  </div>
                  <button
                    onClick={() => { triggerHaptic('medium'); setIsMonthlyModalOpen(true); }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Calendar className="w-4 h-4 text-purple-200" />
                    <PieChartIcon className="w-4 h-4 text-blue-200" />
                    <span>Open Month Calendar &amp; Day Pie</span>
                  </button>
                </div>

                {empAttendance.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">No attendance records found.</div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)] uppercase bg-[var(--bg-elevated)]">
                          <th className="py-3 px-4 font-bold">Date</th>
                          <th className="py-3 px-4 font-bold">Check In</th>
                          <th className="py-3 px-4 font-bold">Check Out</th>
                          <th className="py-3 px-4 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {empAttendance.slice(0, 15).map(rec => (
                          <tr key={rec.id} className="hover:bg-[var(--bg-primary)] transition-colors">
                            <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">{rec.date}</td>
                            <td className="py-3 px-4 text-[var(--text-secondary)]">
                              {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </td>
                            <td className="py-3 px-4 text-[var(--text-secondary)]">
                              {rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                rec.status === 'Present' ? 'bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)] border border-[var(--accent-emerald)]/20' :
                                rec.status === 'Late' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                                'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {rec.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'activity' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                {empLogs.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-tertiary)] text-sm">No audit logs found.</div>
                ) : (
                  empLogs.map(log => (
                    <div key={log.id} className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 rounded-xl flex items-start gap-4">
                      <div className="p-2 bg-[var(--accent-blue)]/10 rounded-lg text-[var(--accent-blue)] shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-[var(--text-primary)] text-xs">{log.action}</span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">{log.details}</p>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Employee Monthly Attendance & Work Analytics Modal */}
      {isMonthlyModalOpen && (
        <EmployeeMonthlyAttendanceModal
          employee={employee}
          onClose={() => setIsMonthlyModalOpen(false)}
        />
      )}
    </AnimatePresence>
  );
};
