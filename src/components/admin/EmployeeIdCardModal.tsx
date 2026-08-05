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
  const [activeCardSide, setActiveCardSide] = useState<'front' | 'back'>('front');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden text-white flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        
        {/* Modal Controls Header */}
        <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-xs sm:text-sm">Printable Enterprise ID Badge</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Canvas Container */}
        <div className="p-4 sm:p-8 bg-slate-950 flex flex-col items-center justify-center border-b border-slate-800 overflow-y-auto flex-1 relative">
          
          {/* Mobile Segmented Side Switcher - Sticky & Unblocked */}
          <div className="sticky top-0 z-30 w-full flex justify-center pb-3 pt-1 bg-slate-950/90 backdrop-blur-md sm:hidden">
            <div className="flex justify-center bg-slate-900 p-1 rounded-xl border border-slate-800 shadow-md w-full max-w-[290px]">
              <button
                onClick={() => setActiveCardSide('front')}
                className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  activeCardSide === 'front' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Front (Barcode)
              </button>
              <button
                onClick={() => setActiveCardSide('back')}
                className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                  activeCardSide === 'back' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Back (QR Code)
              </button>
            </div>
          </div>

          <div id="printable-id-card-element" className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center justify-center w-full my-auto">
            
            {/* FRONT OF CARD - BARCODE */}
            <div className={`w-[290px] sm:w-[340px] min-h-[460px] sm:h-[580px] bg-white rounded-3xl shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-slate-300 flex-col mx-auto items-center justify-center p-6 sm:p-8 ${
              activeCardSide === 'front' ? 'flex' : 'hidden sm:flex'
            }`}>
              <div className="w-full flex flex-col items-center justify-center bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-sm gap-3 sm:gap-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Scan to Verify Employee</div>
                <div className="flex justify-center overflow-hidden w-full bg-white py-2">
                  <Barcode value={employee.employeeId} width={1.5} height={45} displayValue={false} margin={0} background="#ffffff" />
                </div>
                <div className="text-lg sm:text-xl text-center text-slate-800 font-black tracking-[0.2em]">{employee.employeeId}</div>
                <div className="text-xs sm:text-sm text-center text-slate-500 font-bold uppercase tracking-widest border-t border-slate-200 pt-3 w-full">{employee.fullName}</div>
              </div>
            </div>

            {/* BACK OF CARD - QR ONLY */}
            <div className={`w-[290px] sm:w-[340px] min-h-[460px] sm:h-[580px] bg-white rounded-3xl shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-slate-300 flex-col mx-auto items-center justify-center p-6 sm:p-8 ${
              activeCardSide === 'back' ? 'flex' : 'hidden sm:flex'
            }`}>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                {qrUrl ? (
                  <img src={qrUrl} alt="Website QR Code" className="w-48 h-48 sm:w-64 sm:h-64 object-contain image-render-crisp" />
                ) : (
                  <div className="w-48 h-48 sm:w-64 sm:h-64 bg-slate-100 animate-pulse rounded-xl" />
                )}
              </div>
              <div className="text-xs sm:text-sm text-center text-slate-400 font-black mt-6 sm:mt-8 tracking-widest uppercase flex items-center justify-center gap-2">
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
