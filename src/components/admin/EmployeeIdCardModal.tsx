import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import { X, Printer, Download, Mail, MessageSquare, ShieldCheck, Globe, Phone, MapPin, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import Barcode from 'react-barcode';
import { downloadElementAsPdf, openWhatsAppShare, openEmailShare } from '../../lib/pdfGenerator';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';

interface EmployeeIdCardModalProps {
  employee: Employee;
  onClose: () => void;
}

export const EmployeeIdCardModal: React.FC<EmployeeIdCardModalProps> = ({ employee, onClose }) => {
  const { settings } = useAuth();
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    // Generate verification URL for QR Code (engraved back)
    const websiteUrl = 'https://www.kalpanaaasoftwaresolutions.in/';
    
    QRCode.toDataURL(websiteUrl, { 
      width: 400, 
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' }
    }, (err, url) => {
      if (!err && url) setQrUrl(url);
    });
  }, []);


  const handlePrintCard = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    downloadElementAsPdf('printable-id-card-element', `ID_CARD_${employee.employeeId}_${employee.fullName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleShareWhatsApp = () => {
    openWhatsAppShare(
      `Employee ID Badge: ${employee.fullName} (${employee.employeeId})`,
      `Designation: ${employee.designation}\nDepartment: ${employee.department}\nCompany: Kalpanaaa Software Solutions`
    );
  };

  const handleShareEmail = () => {
    openEmailShare(
      employee.email,
      `Official Employee ID Badge Details - ${employee.fullName}`,
      `Dear ${employee.fullName},\n\nYour official corporate ID badge record has been generated.\n\nEmployee ID: ${employee.employeeId}\nDesignation: ${employee.designation}\nDepartment: ${employee.department}\nCompany: Kalpanaaa Software Solutions`
    );
  };

  // Splitting full name into first and last for the design
  const nameParts = employee.fullName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden my-8 text-white flex flex-col max-h-[90vh]">
        
        {/* Modal Controls Header */}
        <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">Printable Enterprise ID Badge (Front & Back)</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Canvas Container */}
        <div className="p-8 bg-slate-950 flex flex-col md:flex-row items-center justify-center gap-8 border-b border-slate-800 overflow-y-auto">
          
          <div id="printable-id-card-element" className="flex flex-col md:flex-row gap-8 items-center">
            
            {/* FRONT OF CARD - BARCODE */}
            <div className="w-[340px] h-[580px] bg-white rounded-3xl shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-slate-300 flex flex-col scale-[0.7] origin-top sm:scale-[0.8] md:scale-[0.85] lg:scale-100 mx-auto items-center justify-center p-8">
              <div className="w-full flex flex-col items-center justify-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Scan to Verify Employee</div>
                <div className="flex justify-center overflow-hidden w-full bg-white py-2">
                  <Barcode value={employee.employeeId} width={1.8} height={50} displayValue={false} margin={0} background="#ffffff" />
                </div>
                <div className="text-xl text-center text-slate-800 font-black tracking-[0.2em]">{employee.employeeId}</div>
                <div className="text-sm text-center text-slate-500 font-bold uppercase tracking-widest border-t border-slate-200 pt-3 w-full">{employee.fullName}</div>
              </div>
            </div>

            {/* BACK OF CARD - QR ONLY */}
            <div className="w-[340px] h-[580px] bg-white rounded-3xl shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-slate-300 flex flex-col scale-[0.7] origin-top sm:scale-[0.8] md:scale-[0.85] lg:scale-100 mx-auto items-center justify-center p-8">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                {qrUrl ? (
                  <img src={qrUrl} alt="Website QR Code" className="w-64 h-64 object-contain image-render-crisp" />
                ) : (
                  <div className="w-64 h-64 bg-slate-100 animate-pulse rounded-xl" />
                )}
              </div>
              <div className="text-sm text-center text-slate-400 font-black mt-8 tracking-widest uppercase flex items-center justify-center gap-2">
                <QrCode className="w-4 h-4" /> Company Portal
              </div>
            </div>

          </div>
        </div>

        {/* Share & Export Controls */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintCard}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-700"
            >
              <Printer className="w-4 h-4" />
              Print Format
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
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </button>

            <button
              onClick={handleShareEmail}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
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
