import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee } from '../../types';
import { X, Printer, Download, Mail, MessageSquare, ShieldCheck, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import Barcode from 'react-barcode';
import { downloadElementAsPdf, openWhatsAppShare, openEmailShare } from '../../lib/pdfGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../../hooks/useHaptic';
import { animations } from '../../lib/animations';

interface EmployeeIdCardModalProps {
  employee: Employee;
  onClose: () => void;
}

export const EmployeeIdCardModal: React.FC<EmployeeIdCardModalProps> = ({ employee, onClose }) => {
  const { settings } = useAuth();
  const [qrUrl, setQrUrl] = useState<string>('');
  const [activeCardSide, setActiveCardSide] = useState<'front' | 'back'>('front');

  useEffect(() => {
    const websiteUrl = 'https://www.kalpanaaasoftwaresolutions.in/';
    QRCode.toDataURL(websiteUrl, { 
      width: 400, margin: 1, errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' }
    }, (err, url) => {
      if (!err && url) setQrUrl(url);
    });
  }, []);

  const handlePrintCard = () => { triggerHaptic('light'); window.print(); };
  const handleDownloadPdf = () => { triggerHaptic('medium'); downloadElementAsPdf('printable-id-card-element', `ID_CARD_${employee.employeeId}_${employee.fullName.replace(/\s+/g, '_')}.pdf`); };
  const handleShareWhatsApp = () => { triggerHaptic('light'); openWhatsAppShare(`Employee ID Badge: ${employee.fullName} (${employee.employeeId})`, `Designation: ${employee.designation}\nDepartment: ${employee.department}\nCompany: Kalpanaaa Software Solutions`); };
  const handleShareEmail = () => { triggerHaptic('light'); openEmailShare(employee.email, `Official Employee ID Badge Details - ${employee.fullName}`, `Dear ${employee.fullName},\n\nYour official corporate ID badge record has been generated.\n\nEmployee ID: ${employee.employeeId}\nDesignation: ${employee.designation}\nDepartment: ${employee.department}\nCompany: Kalpanaaa Software Solutions`); };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center p-0 sm:p-6 sm:items-center print:static print:bg-white print:p-0">
        
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm print:hidden"
          onClick={() => { triggerHaptic('light'); onClose(); }}
        />

        {/* Modal Shell */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full sm:max-w-4xl bg-[var(--bg-primary)] rounded-t-3xl sm:rounded-3xl border-t sm:border border-[var(--border-subtle)] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden print:w-full print:h-auto print:border-none print:shadow-none print:max-h-none"
        >
          {/* Mobile Drag Indicator */}
          <div className="w-full flex justify-center py-3 sm:hidden absolute top-0 z-20 print:hidden">
            <div className="w-12 h-1.5 bg-[var(--border-strong)] rounded-full"></div>
          </div>

          {/* Sticky Header */}
          <div className="bg-[var(--bg-elevated)] text-[var(--text-primary)] p-5 sm:p-6 pt-10 sm:pt-6 flex items-center justify-between border-b border-[var(--border-subtle)] shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[var(--accent-emerald)]" />
              <span className="font-bold text-sm sm:text-base tracking-tight">Enterprise ID Badge</span>
            </div>
            <button onClick={() => { triggerHaptic('light'); onClose(); }} className={`p-2 text-[var(--text-tertiary)] hover:text-white hover:bg-[var(--bg-secondary)] rounded-full transition-colors cursor-pointer outline-none ${animations.tap}`}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Card Canvas Container */}
          <div className="p-4 sm:p-8 bg-[var(--bg-primary)] flex flex-col items-center justify-start sm:justify-center overflow-y-auto flex-1 relative print:p-0 print:overflow-visible pb-32 sm:pb-8">
            
            {/* Safe Toggle Switch (Moved from Sticky Top to In-Flow to prevent overlap) */}
            <div className="w-full flex justify-center mb-6 sm:hidden print:hidden">
              <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)] w-full max-w-xs shadow-inner">
                <button
                  onClick={() => { triggerHaptic('light'); setActiveCardSide('front'); }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all outline-none ${animations.tap} ${
                    activeCardSide === 'front' ? 'bg-[var(--accent-blue)] text-white shadow-md' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Front (Barcode)
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); setActiveCardSide('back'); }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all outline-none ${animations.tap} ${
                    activeCardSide === 'back' ? 'bg-[var(--accent-blue)] text-white shadow-md' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Back (QR)
                </button>
              </div>
            </div>

            <div id="printable-id-card-element" className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center justify-center w-full print:flex-row print:justify-start">
              
              {/* FRONT OF CARD */}
              <div className={`w-[300px] sm:w-[340px] h-[480px] sm:h-[540px] bg-white rounded-[32px] shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-slate-300 flex-col mx-auto items-center justify-center p-6 sm:p-8 border-4 border-slate-100 ${
                activeCardSide === 'front' ? 'flex' : 'hidden sm:flex'
              }`}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-white pointer-events-none"></div>
                <div className="relative z-10 w-full flex flex-col items-center justify-center bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-sm gap-4 h-full">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Kalpanaaa Software</div>
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-inner shrink-0 mb-2">
                    <img src={employee.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'} alt={employee.fullName} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-xs sm:text-sm text-center text-slate-500 font-bold uppercase tracking-widest">{employee.fullName}</div>
                  
                  <div className="flex justify-center overflow-hidden w-full bg-white pt-2 border-t border-slate-100 mt-2">
                    <Barcode value={employee.employeeId} width={1.8} height={40} displayValue={false} margin={0} background="#ffffff" />
                  </div>
                  <div className="text-lg text-center text-slate-800 font-black tracking-[0.2em]">{employee.employeeId}</div>
                </div>
              </div>

              {/* BACK OF CARD */}
              <div className={`w-[300px] sm:w-[340px] h-[480px] sm:h-[540px] bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden relative print:shadow-none print:border print:border-slate-300 flex-col mx-auto items-center justify-center p-6 sm:p-8 border-4 border-slate-800 ${
                activeCardSide === 'back' ? 'flex' : 'hidden sm:flex'
              }`}>
                <div className="bg-white p-4 rounded-2xl shadow-xl w-full flex justify-center border-4 border-slate-800">
                  {qrUrl ? (
                    <img src={qrUrl} alt="Website QR Code" className="w-48 h-48 object-contain" />
                  ) : (
                    <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-xl" />
                  )}
                </div>
                <div className="text-xs text-center text-slate-400 font-black mt-8 tracking-widest uppercase flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4" /> Verify Identity
                </div>
                <div className="text-[10px] text-center text-slate-500 mt-4 px-4 leading-relaxed">
                  If found, please return to Kalpanaaa Software Solutions Main Office.
                </div>
              </div>

            </div>
          </div>

          {/* Share & Export Controls - Sticky Bottom */}
          <div className="p-4 sm:p-5 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden absolute sm:relative bottom-0 left-0 right-0 z-30 pb-safe">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={handlePrintCard} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold rounded-xl border border-[var(--border-subtle)] outline-none ${animations.tap}`}>
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={handleDownloadPdf} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent-blue)] text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 outline-none ${animations.tap}`}>
                <Download className="w-4 h-4" /> Save PDF
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={handleShareWhatsApp} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent-emerald)]/10 text-[var(--accent-emerald)] text-xs font-bold rounded-xl outline-none ${animations.tap}`}>
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button onClick={handleShareEmail} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-xs font-bold rounded-xl outline-none ${animations.tap}`}>
                <Mail className="w-4 h-4" /> Email
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
