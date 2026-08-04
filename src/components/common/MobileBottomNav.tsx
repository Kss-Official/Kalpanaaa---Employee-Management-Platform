import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck2, 
  UserCheck, 
  CreditCard, 
  Menu 
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMobileMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenMobileMenu
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'SUPER_ADMIN' || role === 'HR_ADMIN';

  const adminTabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'employees', label: 'Directory', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck2 },
    { id: 'my_id_card', label: 'ID Card', icon: CreditCard },
  ];

  const employeeTabs = [
    { id: 'emp_dashboard', label: 'Workspace', icon: LayoutDashboard },
    { id: 'emp_attendance', label: 'Attendance', icon: UserCheck },
    { id: 'emp_leave', label: 'Leaves', icon: CalendarCheck2 },
    { id: 'emp_qr', label: 'ID Pass', icon: CreditCard },
  ];

  const tabs = isAdmin ? adminTabs : employeeTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-xl px-2 py-1.5 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try { navigator.vibrate(10); } catch (_) {}
                }
                setActiveTab(tab.id);
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-200 cursor-pointer min-w-[60px] relative ${
                isActive
                  ? 'text-blue-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              {isActive && (
                <div className="absolute -top-1.5 w-8 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
              <Icon className={`w-5 h-5 mb-0.5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}

        {/* Menu Drawer Toggle */}
        <button
          onClick={() => {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try { navigator.vibrate(10); } catch (_) {}
            }
            onOpenMobileMenu();
          }}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-400 hover:text-slate-200 font-medium transition-all cursor-pointer min-w-[60px]"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};
