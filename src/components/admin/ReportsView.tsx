import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Mail, 
  MessageSquare, 
  Filter, 
  Calendar, 
  Building2, 
  UserCheck, 
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { generateAttendanceReportPdf, openWhatsAppShare, openEmailShare } from '../../lib/pdfGenerator';

export const ReportsView: React.FC = () => {
  const { employees, attendance, settings } = useAuth();

  const [reportType, setReportType] = useState<'monthly' | 'daily' | 'individual'>('monthly');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedEmpId, setSelectedEmpId] = useState('ALL');
  const [copiedEmail, setCopiedEmail] = useState(false);

  const departments = Array.from(new Set(employees.map(e => e.department)));

  const filteredAttendance = attendance.filter(a => {
    const matchesDept = selectedDept === 'ALL' || a.department === selectedDept;
    const matchesEmp = selectedEmpId === 'ALL' || a.employeeId === selectedEmpId;
    return matchesDept && matchesEmp;
  });

  const handleDownloadPdf = () => {
    const title = reportType === 'monthly' ? 'Monthly Attendance Statement' :
                  reportType === 'daily' ? 'Daily Attendance Audit Log' :
                  'Individual Employee Attendance Report';

    generateAttendanceReportPdf(filteredAttendance, settings, title);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const totalPresent = filteredAttendance.filter(a => a.status === 'Present').length;
    const totalLate = filteredAttendance.filter(a => a.status === 'Late').length;
    const summaryText = `Total Attendance Records: ${filteredAttendance.length}\nPresent: ${totalPresent}\nLate: ${totalLate}\nCompany: ${settings.companyName}`;

    openWhatsAppShare('Corporate HR Attendance Report', summaryText);
  };

  const handleCopyEmailText = () => {
    const emailSubject = `Official Attendance Statement - ${settings.companyName}`;
    const emailBody = `Dear Management,\n\nPlease find attached the official attendance summary statement.\n\nTotal Logged Records: ${filteredAttendance.length}\nPeriod: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}\n\nGenerated securely from Enterprise HRMS Platform.`;

    navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Report Generator & PDF Export</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate print-ready A4 PDF statements, email templates, and WhatsApp shares
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs border border-slate-700"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Report Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Config Panel */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-5 shadow-xl">
          <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2">
            1. Report Parameters
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Report Type</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setReportType('monthly')}
                  className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                    reportType === 'monthly' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-white">Monthly Attendance Statement</div>
                  <div className="text-[11px] text-slate-400 font-normal">Employee-wise summary for the current billing cycle</div>
                </button>

                <button
                  type="button"
                  onClick={() => setReportType('daily')}
                  className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                    reportType === 'daily' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-white">Daily Check-In Audit Log</div>
                  <div className="text-[11px] text-slate-400 font-normal">Detailed list of check-in timestamps and GPS verification</div>
                </button>

                <button
                  type="button"
                  onClick={() => setReportType('individual')}
                  className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                    reportType === 'individual' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-white">Individual Employee Statement</div>
                  <div className="text-[11px] text-slate-400 font-normal">Filtered statement for a specific employee</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Department Filter</label>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {reportType === 'individual' && (
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Select Employee</label>
                <select
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.employeeId} - {emp.fullName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <button
              onClick={handleWhatsAppShare}
              className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Share Summary on WhatsApp
            </button>

            <button
              onClick={handleCopyEmailText}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copiedEmail ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedEmail ? 'Email Template Copied!' : 'Copy Email Body Template'}
            </button>
          </div>
        </div>

        {/* Right Column: Live A4 Printable Preview */}
        <div className="md:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-xl flex flex-col justify-between">
          <div>
            {/* Report Document Header */}
            <div className="bg-slate-950 border border-slate-800 text-white p-6 rounded-2xl mb-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-wider text-white">{settings.companyName}</h2>
                  <p className="text-xs text-slate-400">{settings.companyAddress}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-blue-400 block uppercase">CONFIDENTIAL</span>
                  <span className="text-[10px] text-slate-400">Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <h3 className="text-xl font-extrabold tracking-tight text-white">
                {reportType === 'monthly' ? 'MONTHLY ATTENDANCE STATEMENT' :
                 reportType === 'daily' ? 'DAILY ATTENDANCE AUDIT LOG' :
                 'INDIVIDUAL EMPLOYEE STATEMENT'}
              </h3>
            </div>

            {/* Document Preview Table */}
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <th className="py-2.5 px-3">EMP ID</th>
                    <th className="py-2.5 px-3">Employee Name</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Check In</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredAttendance.slice(0, 10).map(rec => (
                    <tr key={rec.id}>
                      <td className="py-2 px-3 font-mono font-bold text-slate-300">{rec.employeeCode}</td>
                      <td className="py-2 px-3 font-semibold text-white">{rec.employeeName}</td>
                      <td className="py-2 px-3 text-slate-400">{rec.department}</td>
                      <td className="py-2 px-3 text-slate-400">{rec.date}</td>
                      <td className="py-2 px-3 font-mono text-slate-300">
                        {rec.checkInAt ? new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </td>
                      <td className="py-2 px-3 font-bold text-emerald-400">{rec.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredAttendance.length > 10 && (
                <div className="text-center py-3 text-xs text-slate-500 italic">
                  + {filteredAttendance.length - 10} more records included in final PDF export
                </div>
              )}
            </div>
          </div>

          {/* Footer Signature */}
          <div className="mt-8 pt-4 border-t border-slate-800 flex items-end justify-between text-xs text-slate-400">
            <div>
              <p className="font-bold text-white">{settings.authorizedSignatureName}</p>
              <p className="text-[10px] text-slate-400">{settings.authorizedSignatureTitle}</p>
            </div>
            <div className="text-right text-[10px] text-slate-500">
              Verified by Kalpana Enterprise HRMS System
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
