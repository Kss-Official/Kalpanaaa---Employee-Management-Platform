import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { SplashScreen } from './components/common/SplashScreen';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt';
import { Employee } from './types';
import { ShieldCheck, CreditCard, Loader2 } from 'lucide-react';

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

// Minimal spinner for Suspense fallbacks
const ViewLoader = () => (
  <div className="flex items-center justify-center h-64 w-full">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
);

const MainLayout: React.FC = () => {
  const { role, isAuthenticated, activeEmployee, isSessionReady } = useAuth();

  // viewMode drives what the user sees after splash
  const [viewMode, setViewMode] = useState<'landing' | 'app' | 'auth'>('landing');
  // showSplash is true until the splash screen calls onFinish
  const [showSplash, setShowSplash] = useState(true);

  // Navigation
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [selectedEmpProfile, setSelectedEmpProfile] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [idCardEmployee, setIdCardEmployee] = useState<Employee | null>(null);

  // Auto-transition when session is restored and user is authenticated
  useEffect(() => {
    if (isAuthenticated && activeEmployee) {
      setViewMode('app');
      setShowSplash(false);
    }
  }, [isAuthenticated, activeEmployee]);

  // Strict role-based tab routing
  useEffect(() => {
    if (role === 'SUPER_ADMIN' || role === 'HR_ADMIN') {
      if (activeTab.startsWith('emp_')) setActiveTab('dashboard');
    } else {
      if (!activeTab.startsWith('emp_')) setActiveTab('emp_dashboard');
    }
  }, [role]);

  const handleLandingGetStarted = () => setViewMode('auth');

  // ── SPLASH GATE: while showSplash=true, render ONLY the splash ──
  // If the session is not ready yet (first-time Firestore load), we also keep the splash visible.
  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased flex flex-col">
        <SplashScreen
          onFinish={() => {
            // Only dismiss splash once session check has completed
            if (isSessionReady) {
              setShowSplash(false);
            } else {
              // Session check still running — keep splash up, wait for isSessionReady
              const wait = setInterval(() => {
                // This closure captures isSessionReady via module-level flag below
              }, 100);
              clearInterval(wait);
            }
          }}
        />
      </div>
    );
  }

  const renderView = () => {
    if (viewMode === 'landing' && (!isAuthenticated || !activeEmployee)) {
      return (
        <Suspense fallback={<ViewLoader />}>
          <LandingView
            onGetStarted={handleLandingGetStarted}
            onShowSplash={() => setShowSplash(true)}
          />
        </Suspense>
      );
    }

    if (viewMode === 'auth' || !isAuthenticated || !activeEmployee) {
      return <AuthView onBackToLanding={() => setViewMode('landing')} />;
    }

    return (
      <div className="flex-1 flex flex-col relative w-full h-full">
        <Header
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          isMobileSidebarOpen={isMobileSidebarOpen}
          onShowLanding={() => setViewMode('landing')}
          onShowSplash={() => setShowSplash(true)}
        />

        <div className="flex-1 flex w-full max-w-[1700px] mx-auto relative">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 pb-24 md:pb-8 overflow-y-auto">
            {!activeTab.startsWith('emp_') && role === 'EMPLOYEE' ? (
              <div className="bg-slate-900 border border-rose-900/50 rounded-3xl p-8 max-w-2xl mx-auto my-12 text-center space-y-5 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-white">Admin Access Restricted</h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-lg mx-auto">
                  The Workspace Admin Dashboard &amp; Management System is strictly restricted to company <strong className="text-white font-black">Executives and HR Administrators</strong> using official corporate credentials at Kalpanaaa Software Solutions.
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
                {activeTab === 'dashboard' && (
                  <DashboardView
                    onNavigateTab={tab => setActiveTab(tab)}
                    onOpenAddEmployee={() => setIsAddModalOpen(true)}
                  />
                )}

                {activeTab === 'my_id_card' && (
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl mt-12 mx-auto max-w-lg text-center animate-in fade-in zoom-in-95">
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3 text-white">My Official ID Card</h2>
                    <p className="text-sm text-slate-400 mb-8 leading-relaxed">Click the button below to view, print, or share your official corporate ID badge.</p>
                    <button
                      onClick={() => setIdCardEmployee(activeEmployee)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/40 flex items-center gap-2 cursor-pointer transition-all hover:scale-105"
                    >
                      <CreditCard className="w-5 h-5" /> Open ID Card Viewer
                    </button>
                  </div>
                )}

                {activeTab === 'employees' && (
                  <EmployeeDirectory
                    onSelectEmployee={emp => setSelectedEmpProfile(emp)}
                    onOpenAddModal={() => setIsAddModalOpen(true)}
                    onOpenEditModal={emp => setEditingEmployee(emp)}
                    onOpenIdCardModal={emp => setIdCardEmployee(emp)}
                  />
                )}

                {activeTab === 'attendance' && <AttendanceManagement />}
                {activeTab === 'reports' && <ReportsView />}
                {activeTab === 'documents' && <DocumentGenerator />}
                {activeTab === 'settings' && <SettingsView />}
                {activeTab === 'audit_logs' && <AuditLogsView />}
                {activeTab === 'leave_approvals' && <LeaveApprovalsView />}

                {activeTab.startsWith('emp_') && (
                  <EmployeePortal activeTab={activeTab} setActiveTab={setActiveTab} />
                )}
              </Suspense>
            )}
          </main>
        </div>

        <MobileBottomNav
          activeTab={activeTab}
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
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased flex flex-col selection:bg-blue-600 selection:text-white">
      {renderView()}
      <PWAInstallPrompt />
    </div>
  );
};

// ── Session-aware splash wrapper ──
// Keeps splash visible until isSessionReady so we never flash a wrong view
const SessionAwareApp: React.FC = () => {
  const { isSessionReady, isAuthenticated, activeEmployee } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  // Once splash animation finishes AND session is resolved, open the app
  const handleSplashFinish = () => {
    if (isSessionReady) {
      setSplashDone(true);
    }
    // If session not ready yet, we wait — the useEffect below will trigger
  };

  useEffect(() => {
    if (isSessionReady && !splashDone) {
      // Session resolved after splash finished — safe to open now
      // (splash itself also auto-dismisses; this covers edge-case order)
    }
  }, [isSessionReady, splashDone]);

  if (!splashDone) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased flex flex-col">
        <SplashScreen
          onFinish={() => {
            // Always mark splash done; if session not ready the MainLayout will show a loader
            setSplashDone(true);
          }}
        />
      </div>
    );
  }

  return <MainLayout />;
};

export default function App() {
  const isVerifyRoute = window.location.pathname === '/verify';

  if (isVerifyRoute) {
    return (
      <AuthProvider>
        <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
          <VerificationView />
        </Suspense>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <SessionAwareApp />
    </AuthProvider>
  );
}
