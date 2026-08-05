import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck2, 
  QrCode, 
  FileSpreadsheet, 
  FileText, 
  Settings, 
  ShieldCheck,
  UserCheck,
  CreditCard,
  FolderLock,
  LogOut,
  X
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isMobileOpen = false,
  onCloseMobile 
}) => {
  const { role, logout, activeEmployee } = useAuth();

  const isExecutive = role === 'SUPER_ADMIN'; // CEO / CTO
  const isHr = role === 'HR_ADMIN';
  const isAdmin = isExecutive || isHr;

  const executiveNavItems = [
    { id: 'dashboard', label: 'Executive Overview', icon: LayoutDashboard },
    { id: 'employees', label: 'Team Directory', icon: Users },
    { id: 'my_id_card', label: 'My ID Card (QR/Barcode)', icon: CreditCard },
    { id: 'attendance', label: 'Attendance Ledger', icon: CalendarCheck2 },
    { id: 'reports', label: 'Reports & Intelligence', icon: FileSpreadsheet },
    { id: 'leave_approvals', label: 'Leave & WFH Sanctions', icon: FileText },
    { id: 'documents', label: 'Document Generator', icon: FileText },
    { id: 'settings', label: 'Policy & Rules', icon: Settings },
    { id: 'audit_logs', label: 'Audit Trail', icon: ShieldCheck },
  ];

  const hrNavItems = [
    { id: 'dashboard', label: 'Workspace Overview', icon: LayoutDashboard },
    { id: 'employees', label: 'Team Directory', icon: Users },
    { id: 'my_id_card', label: 'My ID Card (QR/Barcode)', icon: CreditCard },
    { id: 'attendance', label: 'Attendance Ledger', icon: CalendarCheck2 },
    { id: 'reports', label: 'Reports & Issuance', icon: FileSpreadsheet },
    { id: 'leave_approvals', label: 'Leave & WFH Sanctions', icon: FileText },
    { id: 'documents', label: 'Document Generator', icon: FileText },
    { id: 'settings', label: 'Policy & Rules', icon: Settings },
    { id: 'audit_logs', label: 'Audit Trail', icon: ShieldCheck },
  ];

  const employeeNavItems = [
    { id: 'emp_dashboard', label: 'My Workspace', icon: LayoutDashboard },
    { id: 'emp_attendance', label: 'My Attendance', icon: UserCheck },
    { id: 'emp_leave', label: 'My Leave & WFH', icon: CalendarCheck2 },
    { id: 'emp_qr', label: 'Barcode & QR Printing', icon: CreditCard },
    { id: 'emp_directory', label: 'Team Directory', icon: Users },
    { id: 'emp_profile', label: 'My Profile', icon: UserCheck },
  ];

  const navItems = isExecutive ? executiveNavItems : isHr ? hrNavItems : employeeNavItems;

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:sticky top-0 left-0 bottom-0 inset-y-0 z-50
        w-72 md:w-64 h-screen h-[100dvh] bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
              {isAdmin ? 'Kalpanaaa Workspace' : 'Employee Workspace'}
            </span>
            <span className="text-xs font-semibold text-white truncate block max-w-[170px]">
              {activeEmployee?.fullName || 'Active Workspace'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {onCloseMobile && (
              <button 
                onClick={onCloseMobile}
                className="md:hidden p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions Area */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Sign Out Button in Sidebar */}
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/30 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Sign Out</span>
            </div>
            <span className="text-[10px] bg-rose-500/10 px-1.5 py-0.5 rounded-md font-mono">Exit</span>
          </button>

          {/* Security Banner */}
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-[11px] leading-relaxed">
            <div className="font-semibold text-slate-200 text-[10px]">Enterprise Rules Active</div>
            <p className="text-[10px] text-slate-500">Firestore & Auth Protected</p>
          </div>
        </div>
      </aside>
    </>
  );
};
