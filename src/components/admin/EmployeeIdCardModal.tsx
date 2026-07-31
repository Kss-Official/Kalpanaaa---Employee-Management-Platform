import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import { X, Printer, Download, Share2, Mail, MessageSquare, ShieldCheck, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { generateEmployeeQrToken } from '../../lib/attendanceEngine';
import { downloadElementAsPdf, openWhatsAppShare, openEmailShare } from '../../lib/pdfGenerator';

interface EmployeeIdCardModalProps {
  employee: Employee;
  onClose: () => void;
}

export const EmployeeIdCardModal: React.FC<EmployeeIdCardModalProps> = ({ employee, onClose }) => {
  const { settings } = useAuth();
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    const payload = generateEmployeeQrToken(employee, settings.qrTokenLifetimeMinutes);
    QRCode.toDataURL(payload, { 
      width: 320, 
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' }
    }, (err, url) => {
      if (!err && url) setQrUrl(url);
    });
  }, [employee, settings.qrTokenLifetimeMinutes]);

  const handlePrintCard = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    downloadElementAsPdf('printable-id-card-element', `ID_CARD_${employee.employeeId}_${employee.fullName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleShareWhatsApp = () => {
    openWhatsAppShare(
      `Employee ID Badge: ${employee.fullName} (${employee.employeeId})`,
      `Designation: ${employee.designation}\nDepartment: ${employee.department}\nCompany: ${settings.companyName}`
    );
  };

  const handleShareEmail = () => {
    openEmailShare(
      employee.email,
      `Official Employee ID Badge Details - ${employee.fullName}`,
      `Dear ${employee.fullName},\n\nYour official corporate ID badge record has been generated.\n\nEmployee ID: ${employee.employeeId}\nDesignation: ${employee.designation}\nDepartment: ${employee.department}\nCompany: ${settings.companyName}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden my-8 text-white">
        
        {/* Modal Controls Header */}
        <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">Printable ID Badge Card</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Canvas Container */}
        <div className="p-8 bg-slate-950 flex flex-col items-center justify-center border-b border-slate-800">
          
          {/* Real ID Card Element */}
          <div
            id="printable-id-card-element"
            className="w-[320px] bg-white rounded-2xl shadow-2xl border-2 border-slate-300 overflow-hidden text-slate-900 relative print:shadow-none print:border"
          >
            {/* Card Header */}
            <div className="bg-slate-900 text-white p-4 text-center relative border-b-2 border-blue-500">
              <div className="text-[10px] font-bold text-blue-400 tracking-widest uppercase">
                {settings.companyName}
              </div>
              <h2 className="text-xs font-semibold text-slate-200 tracking-wider">OFFICIAL IDENTITY CARD</h2>
            </div>

            {/* Photo & Main Details */}
            <div className="p-5 text-center">
              <div className="relative inline-block mb-3">
                <img
                  src={employee.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={employee.fullName}
                  className="w-24 h-24 rounded-2xl object-cover border-4 border-slate-100 shadow-md mx-auto"
                />
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" title="Active Employee" />
              </div>

              <h3 className="font-extrabold text-base text-slate-900">{employee.fullName}</h3>
              <p className="text-xs text-blue-600 font-extrabold uppercase tracking-wider mt-0.5">{employee.designation}</p>
              <p className="text-xs text-slate-500 font-semibold">{employee.department}</p>

              <div className="my-2 py-1 px-3 bg-slate-900 text-white rounded-xl inline-block font-mono font-extrabold text-xs tracking-wider shadow-sm">
                ID: {employee.employeeId}
              </div>

              {/* Scannable High-Res QR Code Box */}
              <div className="my-2 p-3 bg-white rounded-2xl border-2 border-slate-200 inline-block shadow-sm text-center">
                <div className="text-[9px] font-extrabold text-slate-700 tracking-wider uppercase mb-1 flex items-center justify-center gap-1">
                  <QrCode className="w-3 h-3 text-blue-600" />
                  <span>Optical Scannable Pass</span>
                </div>

                <div className="bg-white p-1.5 rounded-xl border border-slate-100 inline-block">
                  {qrUrl ? (
                    <img src={qrUrl} alt="ID Pass QR Code" className="w-32 h-32 mx-auto object-contain image-render-crisp" />
                  ) : (
                    <div className="w-32 h-32 bg-slate-100 animate-pulse rounded-lg" />
                  )}
                </div>

                <div className="text-[9px] font-mono font-bold text-slate-500 mt-1 tracking-tight">
                  TOKEN: {employee.qrToken.substring(0, 16)}...
                </div>
              </div>

              <div className="text-[10px] text-slate-600 space-y-0.5 border-t border-slate-100 pt-2 font-sans">
                <p><span className="font-bold text-slate-900">Joining Date:</span> {employee.joiningDate}</p>
                <p><span className="font-bold text-slate-900">Emergency Contact:</span> {employee.emergencyContact}</p>
                <p className="text-[9px] text-slate-400 mt-1">Authorized Official Identity Card • {settings.officeName}</p>
              </div>
            </div>

            {/* Card Footer Stripe */}
            <div className="bg-slate-900 h-3 w-full" />
          </div>
        </div>

        {/* Share & Export Controls */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintCard}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-700"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>

            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Share via WhatsApp"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </button>

            <button
              onClick={handleShareEmail}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              title="Share via Email"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
