import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import { X, Printer, Download, Mail, MessageSquare, ShieldCheck, Globe, Phone, MapPin } from 'lucide-react';
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
            
            {/* FRONT OF CARD */}
            <div className="w-[340px] h-[580px] bg-[#111111] rounded-3xl shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-black flex flex-col">
              {/* Background Texture/Accents */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#2a2a2a_0%,#111111_70%)] opacity-80" />
              
              {/* Swoosh SVG accent bottom right */}
              <svg className="absolute bottom-0 right-0 w-64 h-64 opacity-80" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path fill="#1e3a8a" d="M40.7,-64.6C52.2,-57.4,60.6,-44.6,67.3,-30.9C74.1,-17.2,79.2,-2.6,76.6,10.6C74,23.9,63.6,35.9,51.8,45.4C40,54.9,26.7,62,11.8,67.6C-3.1,73.1,-19.6,77.1,-33.4,72.4C-47.2,67.7,-58.3,54.4,-65.7,40C-73.1,25.6,-76.8,10,-75.4,-5C-74,-20.1,-67.4,-34.5,-57.1,-44.7C-46.8,-54.9,-32.8,-60.9,-19.4,-64.1C-6,-67.3,6.8,-67.6,19.9,-66.1C33.1,-64.7,46.7,-61.4,40.7,-64.6Z" transform="translate(150 150) scale(1.1)" />
                <path fill="#3b82f6" d="M36.1,-55.4C47.8,-48.1,59,-39.3,65.8,-27.6C72.5,-15.9,74.7,-1.4,71.1,11.3C67.5,24,58,35,46.9,43.2C35.8,51.4,23.1,56.8,9.7,60.5C-3.7,64.3,-17.8,66.4,-30.3,61.7C-42.8,56.9,-53.8,45.2,-61.7,31.6C-69.6,18,-74.5,2.4,-72.1,-11.9C-69.8,-26.2,-60.2,-39.2,-48.1,-46.9C-36,-54.6,-21.5,-57,-7.6,-56C6.3,-55,24.4,-62.7,36.1,-55.4Z" transform="translate(170 170) scale(0.9)" />
              </svg>

              {/* Header */}
              <div className="relative z-10 w-full pt-8 px-6 flex items-center justify-center gap-3">
                <img src={kalpanaLogo} alt="Kalpanaaa Logo" className="w-10 h-10 object-contain rounded-md mix-blend-screen" />
                <div className="flex flex-col">
                  <span className="text-white font-black text-lg tracking-[0.2em] leading-tight">KALPANAAA</span>
                  <span className="text-blue-400 font-bold text-[8px] tracking-[0.3em]">SOFTWARE SOLUTIONS</span>
                  <span className="text-slate-400 font-semibold text-[6px] tracking-[0.4em] text-center mt-1">• PVT LTD •</span>
                </div>
              </div>

              {/* Profile Photo in Blue Block */}
              <div className="relative z-10 w-full flex justify-center mt-8 px-6">
                <div className="w-full aspect-[4/5] bg-blue-500 rounded-[2.5rem] p-1 shadow-2xl relative overflow-hidden flex items-end justify-center">
                  <img
                    src={employee.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'}
                    alt={employee.fullName}
                    className="w-[98%] h-[98%] object-cover object-bottom rounded-[2.3rem]"
                  />
                </div>
              </div>

              {/* Employee Name & Title */}
              <div className="relative z-10 px-8 mt-6">
                <h2 className="text-white font-black text-3xl uppercase leading-none tracking-wide">{firstName}</h2>
                <h2 className="text-white font-black text-3xl uppercase leading-none tracking-wide mt-1">{lastName}</h2>
                <p className="text-white font-bold text-xs tracking-widest uppercase mt-3">{employee.designation}</p>
              </div>

              {/* Verification Barcode (Front) */}
              <div className="relative z-10 mt-auto mb-6 px-8">
                <div className="bg-white p-2 rounded-xl inline-block shadow-lg">
                  <div className="flex justify-center overflow-hidden">
                    <Barcode value={employee.employeeId} width={1.5} height={35} displayValue={false} margin={0} background="#ffffff" />
                  </div>
                  <div className="text-[7px] text-center text-slate-800 font-bold mt-1 tracking-widest">{employee.employeeId} · VERIFY</div>
                </div>
              </div>
            </div>

            {/* BACK OF CARD */}
            <div className="w-[340px] h-[580px] bg-[#111111] rounded-3xl shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-black flex flex-col">
              {/* Background Texture/Accents */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#2a2a2a_0%,#111111_70%)] opacity-80" />
              
              {/* Swoosh SVG accent bottom left */}
              <svg className="absolute bottom-0 left-0 w-64 h-64 opacity-80" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'scaleX(-1)' }}>
                <path fill="#1e3a8a" d="M40.7,-64.6C52.2,-57.4,60.6,-44.6,67.3,-30.9C74.1,-17.2,79.2,-2.6,76.6,10.6C74,23.9,63.6,35.9,51.8,45.4C40,54.9,26.7,62,11.8,67.6C-3.1,73.1,-19.6,77.1,-33.4,72.4C-47.2,67.7,-58.3,54.4,-65.7,40C-73.1,25.6,-76.8,10,-75.4,-5C-74,-20.1,-67.4,-34.5,-57.1,-44.7C-46.8,-54.9,-32.8,-60.9,-19.4,-64.1C-6,-67.3,6.8,-67.6,19.9,-66.1C33.1,-64.7,46.7,-61.4,40.7,-64.6Z" transform="translate(150 150) scale(1.1)" />
                <path fill="#3b82f6" d="M36.1,-55.4C47.8,-48.1,59,-39.3,65.8,-27.6C72.5,-15.9,74.7,-1.4,71.1,11.3C67.5,24,58,35,46.9,43.2C35.8,51.4,23.1,56.8,9.7,60.5C-3.7,64.3,-17.8,66.4,-30.3,61.7C-42.8,56.9,-53.8,45.2,-61.7,31.6C-69.6,18,-74.5,2.4,-72.1,-11.9C-69.8,-26.2,-60.2,-39.2,-48.1,-46.9C-36,-54.6,-21.5,-57,-7.6,-56C6.3,-55,24.4,-62.7,36.1,-55.4Z" transform="translate(170 170) scale(0.9)" />
              </svg>

              {/* Top Motto */}
              <div className="relative z-10 w-full pt-14 flex items-center justify-center">
                <span className="text-white font-black text-lg tracking-[0.2em] leading-tight">CODE : INNOVATE : ELEVATE</span>
              </div>

              {/* Website QR Code Center */}
              <div className="relative z-10 w-full flex justify-center mt-12">
                <div className="bg-white p-3 shadow-2xl">
                  {qrUrl ? (
                    <img src={qrUrl} alt="Website QR Code" className="w-48 h-48 object-contain image-render-crisp" />
                  ) : (
                    <div className="w-48 h-48 bg-slate-100 animate-pulse" />
                  )}
                </div>
              </div>

              {/* Contact Footer Details */}
              <div className="relative z-10 mt-auto mb-10 px-8 flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <Mail className="w-6 h-6 text-blue-500 shrink-0" />
                  <span className="text-blue-500 font-bold text-[11px] tracking-wide">info@kalpanaaasoftwaresolutions.in</span>
                </div>
                <div className="flex items-center gap-4">
                  <Globe className="w-6 h-6 text-blue-500 shrink-0" />
                  <span className="text-blue-500 font-bold text-[11px] tracking-wide">https://kalpanaaasoftwaresolutions.in/</span>
                </div>
                <div className="flex items-center gap-4">
                  <Phone className="w-6 h-6 text-blue-500 shrink-0" />
                  <span className="text-blue-500 font-bold text-[11px] tracking-wide">8050483560</span>
                </div>
                <div className="flex items-start gap-4">
                  <MapPin className="w-7 h-7 text-blue-500 shrink-0 mt-0.5" />
                  <span className="text-blue-500 font-bold text-[11px] leading-relaxed tracking-wide">
                    Kalpanaaa Software Solutions Pvt. Ltd.<br/>
                    822, 9th Main, 1st C Cross, 1st Block,<br/>
                    HRBR Layout, Kalyan Nagar, Banaswadi,<br/>
                    Bengaluru – 560043
                  </span>
                </div>
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
