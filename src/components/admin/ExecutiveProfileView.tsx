import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import {
  Mail,
  Phone,
  Building2,
  Calendar,
  CreditCard,
  Star,
  Award
} from 'lucide-react';
import { EmployeeMonthlyAttendanceModal } from '../common/EmployeeMonthlyAttendanceModal';

/**
 * ExecutiveProfileView — Profile page for CEO / CTO / MD (SUPER_ADMIN).
 *
 * Intentionally does NOT include:
 *  - Check-In / Check-Out controls
 *  - Live duty / break timer calculations
 *  - WFH / Leave request form or history
 *
 * Shows only:
 *  - Personal identity card
 *  - Role & department info
 *  - ID card viewer shortcut
 */
export const ExecutiveProfileView: React.FC = () => {
  const { activeEmployee } = useAuth();
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  if (!activeEmployee) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading profile...
      </div>
    );
  }

  const roleLabel =
    activeEmployee.role === 'SUPER_ADMIN'
      ? activeEmployee.designation || 'Executive Leadership'
      : activeEmployee.designation || 'Executive';

  const joinDate = activeEmployee.joiningDate
    ? new Date(activeEmployee.joiningDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    : 'N/A';

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">

      {/* ── Profile Identity Card ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden"
      >
        {/* Decorative glow */}
        <div className="absolute -top-12 -right-12 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-purple-600/8 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          {/* Avatar + Info */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <img
                src={
                  activeEmployee.profilePhotoUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(activeEmployee.fullName)}&background=1e1e2e&color=fff&size=128`
                }
                alt={activeEmployee.fullName}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-blue-500/40 shadow-xl shadow-blue-950/50 shrink-0"
              />
              {/* Executive badge */}
              <span className="absolute -bottom-2 -right-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-1 shadow-lg shadow-amber-900/40">
                <Star className="w-3.5 h-3.5 text-white fill-white" />
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-white">{activeEmployee.fullName}</h1>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                  {activeEmployee.employeeId || 'KSS-EXEC'}
                </span>
              </div>
              <p className="text-sm text-slate-300 font-semibold mt-1">
                {roleLabel}
                <span className="text-slate-500 font-normal mx-1.5">•</span>
                <span className="text-slate-400">{activeEmployee.department || 'Executive Office'}</span>
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {activeEmployee.email || 'N/A'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {activeEmployee.phone || 'N/A'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  Kalpanaaa Software Solutions Pvt. Ltd.
                </span>
              </div>
            </div>
          </div>

          {/* Right action buttons */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer shadow-md"
            >
              <Calendar className="w-4 h-4 text-blue-400" />
              <span>Attendance Ledger</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Executive Details + ID Card ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Employment Details */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5"
        >
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Employment Details
          </h2>

          <div className="space-y-3">
            {[
              { label: 'Full Name',       value: activeEmployee.fullName },
              { label: 'Employee ID',     value: activeEmployee.employeeId || 'N/A' },
              { label: 'Designation',     value: activeEmployee.designation || roleLabel },
              { label: 'Department',      value: activeEmployee.department || 'Executive Office' },
              { label: 'Date of Joining', value: joinDate },
              { label: 'Email Address',   value: activeEmployee.email || 'N/A' },
              { label: 'Mobile Number',   value: activeEmployee.phone || 'N/A' },
              { label: 'Role & Access',   value: 'Super Admin — Full Platform Access' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-800/70 last:border-0">
                <span className="text-xs font-semibold text-slate-400 shrink-0 w-36">{label}</span>
                <span className="text-xs font-bold text-white text-right">{value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ID Card Shortcut */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14 }}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6"
        >
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Official ID Card
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your enterprise-grade digital ID card with QR code and barcode, ready to print or share.
            </p>
          </div>

          {/* Card preview placeholder */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-xs bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/40 border border-slate-700/60 rounded-2xl p-6 shadow-2xl text-center space-y-3">
              <img
                src={
                  activeEmployee.profilePhotoUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(activeEmployee.fullName)}&background=1e1e2e&color=fff&size=128`
                }
                alt={activeEmployee.fullName}
                className="w-16 h-16 rounded-xl object-cover border border-blue-500/30 mx-auto shadow-lg"
              />
              <div>
                <p className="text-sm font-black text-white">{activeEmployee.fullName}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{roleLabel}</p>
                <p className="text-[10px] font-mono text-blue-400 mt-1">{activeEmployee.employeeId || 'KSS-EXEC'}</p>
              </div>
              <div className="border-t border-slate-800 pt-3">
                <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Kalpanaaa Software Solutions Pvt. Ltd.</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Use the <span className="text-blue-400 font-bold">"My ID Card"</span> option in the sidebar to open the full printable card.
          </p>
        </motion.div>
      </div>

      {/* ── Attendance History Modal ───────────────────────────── */}
      {showHistoryModal && activeEmployee && (
        <EmployeeMonthlyAttendanceModal
          employee={activeEmployee}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
};
