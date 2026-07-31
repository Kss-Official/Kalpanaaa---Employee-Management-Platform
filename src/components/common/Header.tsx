import React, { useState, useEffect } from 'react';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';
import { useAuth } from '../../context/AuthContext';
import { 
  Building2, 
  ShieldAlert, 
  LogOut, 
  Clock, 
  RotateCcw, 
  User as UserIcon,
  ChevronDown,
  Sparkles,
  QrCode,
  Menu,
  X,
  Globe,
  Home
} from 'lucide-react';
import { UserRole } from '../../types';

interface HeaderProps {
  onOpenScanner?: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
  onShowLanding?: () => void;
  onShowSplash?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onOpenScanner, 
  onToggleMobileSidebar, 
  isMobileSidebarOpen,
  onShowLanding,
  onShowSplash
}) => {
  const { activeEmployee, role, quickDemoLogin, logout, settings, resetToDemoData } = useAuth();
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const getRoleBadgeColor = (r: UserRole) => {
    switch (r) {
      case 'SUPER_ADMIN': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'HR_ADMIN': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'EMPLOYEE': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  const getRoleDisplayName = (r: UserRole, title?: string) => {
    if (r === 'SUPER_ADMIN') {
      return title?.includes('CEO') ? 'CEO' : 'CTO';
    }
    if (r === 'HR_ADMIN') return 'HR Lead';
    return 'Team Member';
  };

  return (
    <header className="h-16 bg-slate-950/90 border-b border-slate-800/90 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl shadow-lg">
      
      {/* Left: Mobile menu toggle + Organization Brand & Live Clock */}
      <div className="flex items-center gap-3">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Toggle Navigation Menu"
          >
            {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-blue-500/20 shrink-0 border border-slate-700/60">
            <img src={kalpanaLogo} alt="Kalpana Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-white leading-tight flex items-center gap-2">
              {settings.companyName}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">{settings.officeName}</p>
          </div>
        </div>

        {/* Home / Internal Workspace Page Button */}
        {onShowLanding && (
          <button
            onClick={onShowLanding}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-blue-300 border border-slate-800 transition-all cursor-pointer font-semibold ml-2"
            title="View Kalpana Internal Home Page"
          >
            <Home className="w-3.5 h-3.5 text-blue-400" />
            <span>Workspace Home</span>
          </button>
        )}

        {/* Company Splash Screen Trigger */}
        {onShowSplash && (
          <button
            onClick={onShowSplash}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-blue-900/60 to-indigo-900/60 hover:from-blue-800/80 hover:to-indigo-800/80 text-xs text-blue-200 border border-blue-700/50 transition-all cursor-pointer font-extrabold shadow-sm"
            title="View Professional Company Splash Screen"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Company Splash</span>
          </button>
        )}

        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{dateStr}</span>
          <span className="font-bold text-white ml-1">{timeStr}</span>
        </div>
      </div>

      {/* Right: Role Switcher, Quick Scanner, Profile & Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* Quick Kiosk Scanner trigger */}
        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-950/40"
            title="Open Live Attendance Terminal"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span className="hidden xl:inline">Terminal Kiosk</span>
          </button>
        )}

        {/* Active Role Indicator Badge */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-900/90 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-800">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Role:</span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${getRoleBadgeColor(role)}`}>
            {getRoleDisplayName(role, activeEmployee?.designation)}
          </span>
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer border border-slate-800"
          >
            <img
              src={activeEmployee?.profilePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={activeEmployee?.fullName || 'User'}
              className="w-8 h-8 rounded-lg object-cover border border-slate-700"
            />
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-xs font-bold text-white truncate max-w-[110px]">
                {activeEmployee?.fullName || 'User Profile'}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                {activeEmployee?.designation || role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 text-slate-200 rounded-2xl shadow-2xl border border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-xs font-bold text-white">{activeEmployee?.fullName || 'Logged In User'}</p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{activeEmployee?.email || 'user@kalpana.com'}</p>
                <span className={`inline-block mt-2 px-2.5 py-0.5 text-[10px] font-bold rounded-md border ${getRoleBadgeColor(role)}`}>
                  {role}
                </span>
              </div>



              {onShowLanding && (
                <button
                  onClick={() => { setShowUserDropdown(false); onShowLanding(); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-blue-400 hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-b border-slate-800"
                >
                  <Globe className="w-4 h-4 text-blue-400" />
                  Product Showcase
                </button>
              )}

              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                Sign Out Account
              </button>
            </div>
          )}
        </div>

        {/* Dedicated Sign Out Button on Large Displays */}
        <button
          onClick={() => logout()}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
          title="Sign out of current account"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-400" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};
