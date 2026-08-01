import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import {
  X,
  User,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  Calendar,
  QrCode,
  CreditCard,
  Download,
  Printer,
  RotateCcw,
  Shield,
  Clock,
  Building,
  Heart
} from 'lucide-react';
import QRCode from 'qrcode';
import { generateEmployeeQrToken } from '../../lib/attendanceEngine';

interface EmployeeProfileModalProps {
  employee: Employee;
  onClose: () => void;
  onOpenEdit: (emp: Employee) => void;
  onOpenIdCard: (emp: Employee) => void;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  employee,
  onClose,
  onOpenEdit,
  onOpenIdCard
}) => {
  const { attendance, auditLogs, regenerateQrToken, settings } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'qr' | 'attendance' | 'activity'>('details');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const empAttendance = attendance.filter(a => a.employeeId === employee.id || a.employeeCode === employee.employeeId);
  const empLogs = auditLogs.filter(l => l.target.includes(employee.employeeId) || l.actorId === employee.id);

  // Generate QR Canvas with TOTP Refresh
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const renderQr = () => {
      const tokenPayload = generateEmployeeQrToken(employee, settings.qrTokenLifetimeMinutes);
      QRCode.toDataURL(tokenPayload, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#000000', light: '#FFFFFF' }
      }, (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      });
    };

    // Initial render
    renderQr();
    
    // Refresh every 5 seconds to ensure TOTP bucket is always fresh on screen
    intervalId = setInterval(renderQr, 5000);

    return () => clearInterval(intervalId);
  }, [employee, settings.qrTokenLifetimeMinutes]);

  const handleRegenerateQr = () => {
    regenerateQrToken(employee.id);
    const newTokenPayload = generateEmployeeQrToken(employee, settings.qrTokenLifetimeMinutes);
    QRCode.toDataURL(newTokenPayload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'H',
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden my-8 text-white">

        {/* Header Hero Banner */}
        <div className="bg-slate-950 text-white p-6 relative border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <img
              src={employee.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
              alt={employee.fullName}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-slate-700 shadow-md"
            />

            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <span className="font-mono text-xs font-bold bg-blue-600/30 text-blue-300 px-2.5 py-0.5 rounded-md border border-blue-500/30">
                  {employee.employeeId}
                </span>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md ${employee.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                  {employee.status}
                </span>
                <span className="bg-slate-800 text-slate-300 text-xs font-medium px-2.5 py-0.5 rounded-md border border-slate-700">
                  {employee.role}
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-white">{employee.fullName}</h2>
              <p className="text-sm text-blue-400 font-medium">{employee.designation} • {employee.department}</p>
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-center sm:justify-start gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {employee.workLocation}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex sm:flex-col items-center gap-2">
              <button
                onClick={() => onOpenIdCard(employee)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <CreditCard className="w-3.5 h-3.5" />
                ID Card Badge
              </button>
              <button
                onClick={() => onOpenEdit(employee)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-700"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Modal Navigation Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800 overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${activeTab === 'details' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              Employee Details
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${activeTab === 'qr' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              QR Attendance Pass
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${activeTab === 'attendance' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              Attendance History ({empAttendance.length})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${activeTab === 'activity' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              Audit Trail
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-900">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Employment Data */}
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-blue-400">
                  <Briefcase className="w-4 h-4" />
                  Employment Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Department</span>
                    <span className="font-semibold text-white">{employee.department}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Designation</span>
                    <span className="font-semibold text-white">{employee.designation}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Employment Type</span>
                    <span className="font-semibold text-white">{employee.employmentType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Joining Date</span>
                    <span className="font-semibold text-white">{employee.joiningDate}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Reporting Manager</span>
                    <span className="font-semibold text-white">{employee.reportingManager}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Shift</span>
                    <span className="font-semibold text-white">{employee.shift}</span>
                  </div>
                </div>
              </div>

              {/* Personal & Contact */}
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-blue-400">
                  <User className="w-4 h-4" />
                  Personal & Contact Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Official Email</span>
                    <span className="font-semibold text-white">{employee.email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Phone Number</span>
                    <span className="font-semibold text-white">{employee.phone}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Gender / DOB</span>
                    <span className="font-semibold text-white">{employee.gender} ({employee.dateOfBirth})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-850">
                    <span className="text-slate-400">Address</span>
                    <span className="font-semibold text-white text-right">{employee.address}, {employee.city}, {employee.state} - {employee.postalCode}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Emergency Contact</span>
                    <span className="font-semibold text-rose-400">{employee.emergencyContact} ({employee.emergencyRelationship})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="bg-white p-5 rounded-3xl border-2 border-slate-700 shadow-xl mb-4">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Employee QR Code" className="w-56 h-56 mx-auto" />
                ) : (
                  <div className="w-56 h-56 bg-slate-100 animate-pulse rounded-2xl flex items-center justify-center text-slate-400">
                    Loading QR...
                  </div>
                )}
              </div>

              <h3 className="text-base font-bold text-white">{employee.fullName}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {employee.employeeId} | Token: {employee.qrToken.substring(0, 18)}...</p>

              <p className="text-xs text-slate-300 max-w-md mt-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                This QR Code token is rotated according to enterprise security rules. Employee can scan this at the company terminal kiosk for check-in.
              </p>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={handleDownloadQr}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </button>

                <button
                  onClick={handleRegenerateQr}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Regenerate QR Token
                </button>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 font-bold text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Check In</th>
                      <th className="py-2.5 px-3">Check Out</th>
                      <th className="py-2.5 px-3">Duration</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {empAttendance.slice(0, 15).map(rec => (
                      <tr key={rec.id}>
                        <td className="py-2.5 px-3 font-semibold text-white">{rec.date}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {rec.checkOutAt ? new Date(rec.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {rec.workingMinutes ? `${Math.floor(rec.workingMinutes / 60)}h ${rec.workingMinutes % 60}m` : '--'}
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] ${rec.status === 'Present' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                              rec.status === 'Late' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-400">
                          {rec.locationVerified ? 'GPS Verified' : 'Standard'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3 text-xs">
              {empLogs.length === 0 ? (
                <p className="text-center py-6 text-slate-500">No specific audit history for this employee.</p>
              ) : (
                empLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between">
                    <div>
                      <span className="font-bold text-white">{log.action}</span>
                      <p className="text-slate-300 mt-0.5">{log.details}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Actor: {log.actorName} ({log.actorRole})</p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
