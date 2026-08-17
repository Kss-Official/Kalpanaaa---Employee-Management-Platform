import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt';
import { Employee } from './types';
import { ShieldCheck, CreditCard, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { Toaster } from 'sonner';

// ── Eager imports (needed immediately on boot) ──
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileBottomNav } from './components/common/MobileBottomNav';

// ── Lazy imports (code-split: only loaded when user navigates to that view) ──
const LandingView          = lazy(() => import('./components/landing/LandingView').then(m => ({ default: m.LandingView })));
const DashboardView        = lazy(() => import('./components/admin/DashboardView').then(m => ({ default: m.DashboardView })));
const EmployeeDirectory    = lazy(() => import('./components/admin/EmployeeDirectory').then(m => ({ default: m.EmployeeDirectory })));
const EmployeeProfileModal = lazy(() => import('./components/admin/EmployeeProfileModal').then(m => ({ default: m.EmployeeProfileModal })));
const EmployeeFormModal    = lazy(() => import('./components/admin/EmployeeFormModal').then(m => ({ default: m.EmployeeFormModal })));
const EmployeeIdCardModal  = lazy(() => import('./components/admin/EmployeeIdCardModal').then(m => ({ default: m.EmployeeIdCardModal })));
const AttendanceManagement = lazy(() => import('./components/admin/AttendanceManagement').then(m => ({ default: m.AttendanceManagement })));
const ReportsView          = lazy(() => import('./components/admin/ReportsView').then(m => ({ default: m.ReportsView })));
const DocumentGenerator    = lazy(() => import('./components/admin/DocumentGenerator').then(m => ({ default: m.DocumentGenerator })));
const SettingsView         = lazy(() => import('./components/admin/SettingsView').then(m => ({ default: m.SettingsView })));
const AuditLogsView        = lazy(() => import('./components/admin/AuditLogsView').then(m => ({ default: m.AuditLogsView })));
const LeaveApprovalsView   = lazy(() => import('./components/admin/LeaveApprovalsView').then(m => ({ default: m.LeaveApprovalsView })));
const EmployeePortal       = lazy(() => import('./components/employee/EmployeePortal').then(m => ({ default: m.EmployeePortal })));
const VerificationView     = lazy(() => import('./components/public/VerificationView').then(m => ({ default: m.VerificationView })));

const HRDashboard          = lazy(() => import('./components/hr/HRDashboard').then(m => ({ default: m.HRDashboard })));
const HRProfileView        = lazy(() => import('./components/hr/HRProfileView').then(m => ({ default: m.HRProfileView })));
const HRLeaveWfhApprovals  = lazy(() => import('./components/hr/HRLeaveWfhApprovals').then(m => ({ default: m.HRLeaveWfhApprovals })));
const HRPayrollView        = lazy(() => import('./components/hr/HRPayrollView').then(m => ({ default: m.HRPayrollView })));
const CompanyRulesView     = lazy(() => import('./components/hr/CompanyRulesView').then(m => ({ default: m.CompanyRulesView })));
const HRNotificationsView  = lazy(() => import('./components/hr/HRNotificationsView').then(m => ({ default: m.HRNotificationsView })));
const PMDashboard          = lazy(() => import('./components/pm/PMDashboard').then(m => ({ default: m.PMDashboard })));
const PMProjectsView       = lazy(() => import('./components/pm/PMProjectsView').then(m => ({ default: m.PMProjectsView })));
const PMTeamPerformance    = lazy(() => import('./components/pm/PMTeamPerformance').then(m => ({ default: m.PMTeamPerformance })));
const EmployeeTeamDirectory = lazy(() => import('./components/employee/EmployeeTeamDirectory').then(m => ({ default: m.EmployeeTeamDirectory })));
const ExecutiveProfileView  = lazy(() => import('./components/admin/ExecutiveProfileView').then(m => ({ default: m.ExecutiveProfileView })));

// Minimal spinner used as Suspense fallback inside the app (not a splash)
const ViewLoader = () => (
  <div className="flex items-center justify-center h-64 w-full">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
);

// Crash recovery screen shown by ErrorBoundary when an uncaught error occurs
const CrashScreen = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8 text-center">
    <div className="w-16 h-16 bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-6">
      <AlertTriangle className="w-8 h-8 text-rose-400" />
    </div>
    <h1 className="text-2xl font-black text-white mb-2">Something went wrong</h1>
    <p className="text-sm text-slate-400 max-w-md mb-2">An unexpected error occurred in the application.</p>
    <p className="text-xs text-slate-600 font-mono bg-slate-900 px-4 py-2 rounded-xl mb-6 max-w-lg break-all">
      {error?.message || 'Unknown error'}
    </p>
    <div className="flex gap-3">
      <button
        onClick={resetErrorBoundary}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" /> Try Again
      </button>
      <button
        onClick={() => { localStorage.removeItem('kss_v1_session'); window.location.reload(); }}
        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl transition-all cursor-pointer border border-slate-700"
      >
        <RefreshCw className="w-4 h-4" /> Clear & Reload
      </button>
    </div>
  </div>
);

// Dismiss the HTML splash screen defined in index.html
const dismissHtmlSplash = () => {
  if (typeof window !== 'undefined' && typeof (window as any).__hideSplash === 'function') {
    (window as any).__hideSplash();
  }
};

const MainLayout: React.FC = () => {
  const { role, isAuthenticated, activeEmployee, isSessionReady } = useAuth();

  const [viewMode, setViewMode] = useState<'landing' | 'app' | 'auth'>(() => {
    return localStorage.getItem('kss_v1_session') ? 'app' : 'landing';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('kss_active_tab') || 'dashboard';
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [selectedEmpProfile, setSelectedEmpProfile] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [idCardEmployee, setIdCardEmployee] = useState<Employee | null>(null);
  const [attendanceFilters, setAttendanceFilters] = useState<{ dateFilter?: 'today' | 'yesterday' | 'all'; statusFilter?: string }>({ dateFilter: 'today', statusFilter: 'ALL' });

  const handleNavigateTab = (tab: string, filters?: { dateFilter?: 'today' | 'yesterday' | 'all'; statusFilter?: string }) => {
    if (filters) {
      setAttendanceFilters(filters);
    } else if (tab === 'attendance') {
      setAttendanceFilters({ dateFilter: 'today', statusFilter: 'ALL' });
    }
    setActiveTab(tab);
    localStorage.setItem('kss_active_tab', tab);
  };

  // Persist activeTab whenever it changes
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem('kss_active_tab', activeTab);
    }
  }, [activeTab]);

  // Dismiss the HTML splash as soon as component mounts or session state is resolved
  useEffect(() => {
    dismissHtmlSplash();
  }, [isSessionReady]);

  useEffect(() => {
    dismissHtmlSplash();
    const timer = setTimeout(dismissHtmlSplash, 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-transition to app view when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setViewMode('app');
    }
  }, [isAuthenticated]);

  const effectiveRole = activeEmployee?.role || role;

  // Synchronous tab sanitization per role to eliminate flash of wrong content (Fixes C15 Contract)
  const getSanitizedTabForRole = (tab: string, roleToUse: string): string => {
    if (roleToUse === 'EMPLOYEE') {
      if (!tab.startsWith('emp_') && tab !== 'notifications') {
        return 'emp_dashboard';
      }
    } else if (roleToUse === 'PROJECT_MANAGER') {
      const allowedPMTabs = ['pm_dashboard', 'pm_projects', 'pm_team', 'pm_profile', 'notifications', 'dashboard', 'leave_approvals'];
      if (!allowedPMTabs.includes(tab) || tab.startsWith('emp_')) {
        return 'pm_dashboard';
      }
    } else if (roleToUse === 'HR_ADMIN') {
      const allowedHRTabs = ['dashboard', 'hr_dashboard', 'hr_profile', 'employees', 'attendance', 'leave_approvals', 'hr_payroll', 'company_rules', 'notifications', 'reports', 'audit_logs', 'my_id_card', 'documents'];
      if (!allowedHRTabs.includes(tab) && !tab.startsWith('emp_') && !tab.startsWith('hr_')) {
        return 'dashboard';
      }
    }
    return tab;
  };

  const currentTab = getSanitizedTabForRole(activeTab, effectiveRole);

  // Keep activeTab state in sync when effectiveRole changes
  useEffect(() => {
    if (currentTab !== activeTab) {
      setActiveTab(currentTab);
      localStorage.setItem('kss_active_tab', currentTab);
    }
  }, [effectiveRole, activeEmployee?.id, currentTab, activeTab]);

  const handleLandingGetStarted = () => setViewMode('auth');

  const renderView = () => {
    if (viewMode === 'landing' && (!isAuthenticated || !activeEmployee)) {
      return (
        <Suspense fallback={<ViewLoader />}>
          <LandingView
            onGetStarted={handleLandingGetStarted}
            onShowSplash={() => {}}
          />
        </Suspense>
      );
    }

    if (viewMode === 'auth' || !isAuthenticated || !activeEmployee) {
      return <AuthView onBackToLanding={() => setViewMode('landing')} />;
    }

    return (
      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden">
        <Header
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          isMobileSidebarOpen={isMobileSidebarOpen}
          onShowLanding={() => setViewMode('landing')}
          onShowSplash={() => {}}
        />

        <div className="flex-1 flex w-full relative h-full overflow-hidden">
          <Sidebar
            activeTab={currentTab}
            setActiveTab={setActiveTab}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 pb-24 md:pb-8 overflow-y-auto overscroll-y-contain h-full bg-slate-950">
            {!currentTab.startsWith('emp_') && currentTab !== 'notifications' && (role === 'EMPLOYEE' || activeEmployee?.role === 'EMPLOYEE') ? (
              <div className="bg-slate-900 border border-rose-900/50 rounded-3xl p-8 max-w-2xl mx-auto my-12 text-center space-y-5 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-white">Admin Access Restricted</h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-lg mx-auto">
                  The Workspace Admin Dashboard &amp; Management System is strictly restricted to company{' '}
                  <strong className="text-white font-black">Executives and HR Administrators</strong> using official corporate credentials at Kalpanaaa Software Solutions.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('emp_dashboard')}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Return to My Employee Portal
                  </button>
                </div>
              </div>
            ) : (
              <Suspense fallback={<ViewLoader />}>
                {(currentTab === 'dashboard' || currentTab === 'hr_dashboard') && (
                  (role === 'HR_ADMIN' || activeEmployee?.role === 'HR_ADMIN') ? (
                    <HRDashboard onNavigateTab={handleNavigateTab} />
                  ) : (role === 'PROJECT_MANAGER' || activeEmployee?.role === 'PROJECT_MANAGER') ? (
                    <PMDashboard onNavigateTab={handleNavigateTab} />
                  ) : (
                    <DashboardView
                      onNavigateTab={handleNavigateTab}
                      onOpenAddEmployee={() => setIsAddModalOpen(true)}
                    />
                  )
                )}

                {currentTab === 'hr_profile' && <HRProfileView />}
                {currentTab === 'hr_payroll' && <HRPayrollView />}
                {currentTab === 'company_rules' && <CompanyRulesView />}
                {currentTab === 'notifications' && <HRNotificationsView />}
                {currentTab === 'pm_dashboard' && <PMDashboard onNavigateTab={handleNavigateTab} />}
                {currentTab === 'pm_projects' && <PMProjectsView />}
                {currentTab === 'pm_team' && <PMTeamPerformance />}
                {currentTab === 'pm_profile' && <HRProfileView />}
                {currentTab === 'my_profile' && <ExecutiveProfileView />}

                {currentTab === 'my_id_card' && (
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl mt-12 mx-auto max-w-lg text-center animate-in fade-in zoom-in-95">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3 text-white">My Official ID Card</h2>
                    <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                      Click the button below to view, print, or share your official corporate ID badge.
                    </p>
                    <button
                      onClick={() => setIdCardEmployee(activeEmployee)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/40 flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                    >
                      <CreditCard className="w-5 h-5" /> Open ID Card Viewer
                    </button>
                  </div>
                )}

                {currentTab === 'employees' && <EmployeeTeamDirectory />}

                {currentTab === 'attendance' && (
                  <AttendanceManagement 
                    initialDateFilter={attendanceFilters.dateFilter || 'today'}
                    initialStatusFilter={attendanceFilters.statusFilter || 'ALL'}
                  />
                )}
                {currentTab === 'reports' && <ReportsView />}
                {currentTab === 'documents' && <DocumentGenerator />}
                {currentTab === 'settings' && <SettingsView />}
                {currentTab === 'audit_logs' && <AuditLogsView />}
                {currentTab === 'leave_approvals' && (
                  role === 'HR_ADMIN' ? <HRLeaveWfhApprovals /> : <LeaveApprovalsView />
                )}

                {currentTab.startsWith('emp_') && (
                  <EmployeePortal activeTab={currentTab} setActiveTab={setActiveTab} />
                )}
              </Suspense>
            )}
          </main>
        </div>

        <MobileBottomNav
          activeTab={currentTab}
          setActiveTab={setActiveTab}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        {/* Modals */}
        {selectedEmpProfile && (
          <Suspense fallback={null}>
            <EmployeeProfileModal
              employee={selectedEmpProfile}
              onClose={() => setSelectedEmpProfile(null)}
              onOpenEdit={emp => { setSelectedEmpProfile(null); setEditingEmployee(emp); }}
              onOpenIdCard={emp => { setSelectedEmpProfile(null); setIdCardEmployee(emp); }}
            />
          </Suspense>
        )}

        {(isAddModalOpen || editingEmployee) && (
          <Suspense fallback={null}>
            <EmployeeFormModal
              employeeToEdit={editingEmployee}
              onClose={() => { setIsAddModalOpen(false); setEditingEmployee(null); }}
            />
          </Suspense>
        )}

        {idCardEmployee && (
          <Suspense fallback={null}>
            <EmployeeIdCardModal
              employee={idCardEmployee}
              onClose={() => setIdCardEmployee(null)}
            />
          </Suspense>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-screen overflow-hidden overscroll-none bg-slate-950 font-sans text-slate-100 antialiased flex flex-col selection:bg-blue-600 selection:text-white">
      {renderView()}
      <PWAInstallPrompt />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0f172a',
            border: '1px solid #1e293b',
            color: '#f1f5f9',
            fontFamily: 'inherit',
            fontSize: '13px',
            fontWeight: '600',
            borderRadius: '12px',
          },
        }}
        richColors
        closeButton
      />
    </div>
  );
};

export default function App() {
  const isVerifyRoute = window.location.pathname === '/verify';

  if (isVerifyRoute) {
    return (
      <ErrorBoundary FallbackComponent={CrashScreen}>
        <AuthProvider>
          <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
            <VerificationView />
          </Suspense>
        </AuthProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={CrashScreen}>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ErrorBoundary>
  );
}
