import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/auth/AuthView';
import { LandingView } from './components/landing/LandingView';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { DashboardView } from './components/admin/DashboardView';
import { EmployeeDirectory } from './components/admin/EmployeeDirectory';
import { EmployeeProfileModal } from './components/admin/EmployeeProfileModal';
import { EmployeeFormModal } from './components/admin/EmployeeFormModal';
import { EmployeeIdCardModal } from './components/admin/EmployeeIdCardModal';
import { AttendanceManagement } from './components/admin/AttendanceManagement';
import { ReportsView } from './components/admin/ReportsView';
import { DocumentGenerator } from './components/admin/DocumentGenerator';
import { SettingsView } from './components/admin/SettingsView';
import { AuditLogsView } from './components/admin/AuditLogsView';
import { LeaveApprovalsView } from './components/admin/LeaveApprovalsView';
import { VerificationView } from './components/public/VerificationView';
import { EmployeePortal } from './components/employee/EmployeePortal';
import { SplashScreen } from './components/common/SplashScreen';
import { PWAInstallPrompt } from './components/common/PWAInstallPrompt';
import { Employee } from './types';
import { ShieldCheck } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { role, isAuthenticated, activeEmployee } = useAuth();
  
  // Showcase Landing Page toggle state
  const [viewMode, setViewMode] = useState<'landing' | 'app' | 'auth'>('landing');

  // Splash Screen auto-shows on every first load
  const [showSplash, setShowSplash] = useState(true);

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals state
  const [selectedEmpProfile, setSelectedEmpProfile] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [idCardEmployee, setIdCardEmployee] = useState<Employee | null>(null);

  // Automatically transition to the app view when authentication succeeds
  useEffect(() => {
    if (isAuthenticated && activeEmployee) {
      setViewMode('app');
      setShowSplash(false); // Immediately dismiss splash on successful login
    }
  }, [isAuthenticated, activeEmployee]);

  // Strict role-based tab routing
  useEffect(() => {
    if (role === 'SUPER_ADMIN' || role === 'HR_ADMIN') {
      // CEO, CTO & HR always land on Admin Control Panel
      if (activeTab.startsWith('emp_')) {
        setActiveTab('dashboard');
      }
    } else {
      // All other roles (EMPLOYEE) go to Employee Portal only
      if (!activeTab.startsWith('emp_')) {
        setActiveTab('emp_dashboard');
      }
    }
  }, [role]);

  // Handle landing view CTA triggers - requires explicit login authentication
  const handleLandingGetStarted = (actionTab?: 'signin' | 'signup' | 'demo') => {
    setViewMode('auth');
  };

  // If user unauthenticated or in landing view mode
  if (viewMode === 'landing' && (!isAuthenticated || !activeEmployee)) {
    return (
      <>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <LandingView 
          onGetStarted={handleLandingGetStarted} 
          onShowSplash={() => setShowSplash(true)}
        />
      </>
    );
  }

  // If user selected Auth login/signup explicitly
  if (viewMode === 'auth' || (!isAuthenticated || !activeEmployee)) {
    return (
      <>
        {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        <AuthView onBackToLanding={() => setViewMode('landing')} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Optional Fullscreen Company Splash Screen */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      {/* Top Header Navigation */}
      <Header 
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onShowLanding={() => setViewMode('landing')}
        onShowSplash={() => setShowSplash(true)}
      />

      {/* Body Area */}
      <div className="flex-1 flex w-full max-w-[1700px] mx-auto relative">
        
        {/* Sidebar Navigation */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Primary Main Workspace View */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          
          {/* Executive & HR Security Check Guard */}
          {!activeTab.startsWith('emp_') && role === 'EMPLOYEE' ? (
            <div className="bg-slate-900 border border-rose-900/50 rounded-3xl p-8 max-w-2xl mx-auto my-12 text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-white">Admin Access Restricted</h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-lg mx-auto">
                The Workspace Admin Dashboard & Management System is strictly restricted to company <strong className="text-white font-black">Executives and HR Administrators</strong> using official corporate credentials at Kalpanaaa Software Solutions.
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
            <>
              {/* Admin Views (Accessible ONLY to CEO & CTO) */}
              {activeTab === 'dashboard' && (
                <DashboardView 
                  onNavigateTab={tab => setActiveTab(tab)}
                  onOpenAddEmployee={() => setIsAddModalOpen(true)}
                />
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

              {/* Employee Self-Service Views */}
              {activeTab.startsWith('emp_') && (
                <EmployeePortal activeTab={activeTab} setActiveTab={setActiveTab} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals Container */}
      {selectedEmpProfile && (
        <EmployeeProfileModal
          employee={selectedEmpProfile}
          onClose={() => setSelectedEmpProfile(null)}
          onOpenEdit={emp => {
            setSelectedEmpProfile(null);
            setEditingEmployee(emp);
          }}
          onOpenIdCard={emp => {
            setSelectedEmpProfile(null);
            setIdCardEmployee(emp);
          }}
        />
      )}

      {(isAddModalOpen || editingEmployee) && (
        <EmployeeFormModal
          employeeToEdit={editingEmployee}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingEmployee(null);
          }}
        />
      )}

      {idCardEmployee && (
        <EmployeeIdCardModal
          employee={idCardEmployee}
          onClose={() => setIdCardEmployee(null)}
        />
      )}

      <PWAInstallPrompt />
    </div>
  );
};

export default function App() {
  const isVerifyRoute = window.location.pathname === '/verify';

  if (isVerifyRoute) {
    return (
      <AuthProvider>
        <VerificationView />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
