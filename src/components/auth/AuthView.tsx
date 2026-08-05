import React, { useState, useEffect } from 'react';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import { animations } from '../../lib/animations';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Lock, 
  Mail, 
  User, 
  ShieldCheck, 
  Sparkles, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Briefcase,
  KeyRound,
  X,
  ScanFace
} from 'lucide-react';
import { UserRole } from '../../types';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface AuthViewProps {
  onBackToLanding?: () => void;
}

const TypewriterText = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(text.substring(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [text]);

  return <span className="inline-block min-w-[120px]">{displayText}<span className="animate-pulse">|</span></span>;
};

export const AuthView: React.FC<AuthViewProps> = ({ onBackToLanding }) => {
  const { loginWithEmail, signUpUser, isLoading, settings } = useAuth();
  const { triggerHaptic } = useHaptic();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Sign Up state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpRole, setSignUpRole] = useState<UserRole>('EMPLOYEE');
  const [signUpDept, setSignUpDept] = useState('Engineering');
  const [signUpDesignation, setSignUpDesignation] = useState('Software Engineer');
  const [signUpPass, setSignUpPass] = useState('');
  const [signUpConfirmPass, setSignUpConfirmPass] = useState('');

  const handleSignUpRoleChange = (newRole: UserRole) => {
    triggerHaptic('light');
    setSignUpRole(newRole);
  };

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    setFeedback(null);
    if (!loginEmail || !loginPassword) {
      triggerHaptic('error');
      setFeedback({ type: 'error', message: 'Please provide both email and password.' });
      return;
    }

    const res = await loginWithEmail(loginEmail, loginPassword);
    if (!res.success) {
      triggerHaptic('error');
      setFeedback({ type: 'error', message: res.message });
    } else {
      triggerHaptic('success');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    setFeedback(null);
    if (!signUpName || !signUpEmail || !signUpPass) {
      triggerHaptic('error');
      setFeedback({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }
    if (signUpPass.length < 6) {
      triggerHaptic('error');
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters long for security.' });
      return;
    }
    if (signUpPass !== signUpConfirmPass) {
      triggerHaptic('error');
      setFeedback({ type: 'error', message: 'Passwords do not match. Please re-enter your password.' });
      return;
    }

    const res = await signUpUser({
      fullName: signUpName,
      email: signUpEmail,
      role: signUpRole,
      department: signUpDept,
      designation: signUpDesignation || (signUpRole === 'SUPER_ADMIN' ? 'System Administrator' : signUpRole === 'HR_ADMIN' ? 'HR Manager' : 'Software Engineer'),
      password: signUpPass
    });

    if (!res.success) {
      triggerHaptic('error');
      setFeedback({ type: 'error', message: res.message });
    } else {
      triggerHaptic('success');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    if (!resetEmail) return;
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      triggerHaptic('success');
      setResetSent(true);
    } catch (err: any) {
      triggerHaptic('success'); // Show confirmation regardless for security
      setResetSent(true); 
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-[var(--accent-blue)] selection:text-white font-sans antialiased relative overflow-hidden">
      
      {/* Subtle animated gradient mesh background */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--accent-blue)] rounded-full blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[var(--accent-violet)] rounded-full blur-[150px] opacity-20" />
      </div>

      {/* Top Header Branding Bar */}
      <header className={`px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/80 backdrop-blur-xl flex items-center justify-between relative z-10`}>
        <div className="flex items-center gap-3">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-10 h-10 rounded-xl overflow-hidden shadow-[var(--shadow-glow-blue)] shrink-0 border border-[var(--border-subtle)]"
          >
            <img src={kalpanaLogo} alt="Kalpanaaa Logo" className="w-full h-full object-cover" />
          </motion.div>
          <div>
            <motion.h1 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base font-bold tracking-tight flex items-center gap-2 text-[var(--text-primary)]"
            >
              <span className="hidden sm:inline">Kalpanaaa Software Solutions</span>
              <span className="sm:hidden">KSS</span>
            </motion.h1>
            <p className="text-xs text-[var(--text-tertiary)] font-medium hidden sm:block">
              <TypewriterText text="Empowering Teams" />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onBackToLanding && (
            <button
              onClick={() => { triggerHaptic('light'); onBackToLanding(); }}
              className={`px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-white bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-subtle)] transition-colors cursor-pointer ${animations.tap}`}
            >
              ← Back
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-tertiary)] font-mono">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-emerald)]" />
            <span>Secure Access</span>
          </div>
        </div>
      </header>

      {/* Main Form Center Box - Slides up from bottom */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative z-10 perspective-1000">
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="w-full max-w-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-xl)] overflow-hidden backdrop-blur-xl"
        >
          {/* Form Tab Switcher */}
          <div className="grid grid-cols-2 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 p-1.5 gap-1 text-xs font-semibold">
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('signin'); setFeedback(null); }}
              className={`py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signin'
                  ? 'bg-[var(--accent-blue)] text-white shadow-[var(--shadow-glow-blue)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Employee Login</span>
            </button>

            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('signup'); setFeedback(null); }}
              className={`py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-[var(--shadow-md)] border border-[var(--border-subtle)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Register</span>
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Feedback Notification Banner */}
            {feedback && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border text-xs font-medium flex items-center gap-3 ${
                feedback.type === 'success' 
                  ? 'bg-[var(--accent-emerald)]/10 border-[var(--accent-emerald)]/20 text-[var(--accent-emerald)]' 
                  : 'bg-[var(--accent-rose)]/10 border-[var(--accent-rose)]/20 text-[var(--accent-rose)]'
              }`}>
                {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <span>{feedback.message}</span>
              </motion.div>
            )}

            {/* TAB 1: EMPLOYEE SIGN IN */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Employee Portal Sign In</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Enter your company email address and password to access your workspace.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">Company Email Address</label>
                    <div className="relative">
                      <Mail className="w-5 h-5 text-[var(--text-tertiary)] absolute left-4 top-4" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="employee@kalpanaaa.in"
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-2xl pl-12 pr-4 h-[52px] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">Password</label>
                      <button
                        type="button"
                        onClick={() => setIsForgotModalOpen(true)}
                        className="text-xs font-medium text-[var(--accent-blue)] hover:text-blue-300 cursor-pointer transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-5 h-5 text-[var(--text-tertiary)] absolute left-4 top-4" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-2xl pl-12 pr-12 h-[52px] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none transition-all shadow-inner"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-4 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-[52px] bg-[var(--accent-blue)] hover:bg-blue-500 text-white font-bold text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[var(--shadow-glow-blue)] disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isLoading ? 'Authenticating...' : 'Sign In'}
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-2 mt-2 cursor-pointer opacity-70 hover:opacity-100 transition-opacity" onClick={() => triggerHaptic('light')}>
                    <ScanFace className="w-6 h-6 text-[var(--accent-blue)] animate-pulse" />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">Face ID / Touch ID Login</span>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 2: REGISTER */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Create your Kalpanaaa account</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Requires official Kalpanaaa Software Solutions team membership verification.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={signUpName}
                      onChange={e => setSignUpName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-xl px-4 h-[44px] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Company Email *</label>
                    <input
                      type="email"
                      required
                      value={signUpEmail}
                      onChange={e => setSignUpEmail(e.target.value)}
                      placeholder="name@kalpanaaa.in"
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-xl px-4 h-[44px] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Requested Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSignUpRoleChange('EMPLOYEE')}
                      className={`py-2 px-2 text-[10px] font-bold rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        signUpRole === 'EMPLOYEE' 
                          ? 'bg-[var(--accent-blue)]/10 border-[var(--accent-blue)] text-[var(--accent-blue)] shadow-[var(--shadow-sm)]' 
                          : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <User className="w-4 h-4" /> Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSignUpRoleChange('HR_ADMIN')}
                      className={`py-2 px-2 text-[10px] font-bold rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        signUpRole === 'HR_ADMIN' 
                          ? 'bg-[var(--accent-violet)]/10 border-[var(--accent-violet)] text-[var(--accent-violet)] shadow-[var(--shadow-sm)]' 
                          : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <Briefcase className="w-4 h-4" /> HR Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSignUpRoleChange('SUPER_ADMIN')}
                      className={`py-2 px-2 text-[10px] font-bold rounded-lg border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                        signUpRole === 'SUPER_ADMIN' 
                          ? 'bg-[var(--accent-emerald)]/10 border-[var(--accent-emerald)] text-[var(--accent-emerald)] shadow-[var(--shadow-sm)]' 
                          : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:border-[var(--text-muted)]'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" /> Admin
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Department</label>
                    <input
                      type="text"
                      value={signUpDept}
                      onChange={e => setSignUpDept(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-xl px-4 h-[44px] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Designation</label>
                    <input
                      type="text"
                      value={signUpDesignation}
                      onChange={e => setSignUpDesignation(e.target.value)}
                      placeholder="e.g. Developer"
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-xl px-4 h-[44px] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={signUpPass}
                        onChange={e => setSignUpPass(e.target.value)}
                        placeholder="Min 6 chars"
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-xl pl-4 pr-10 h-[44px] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={signUpConfirmPass}
                      onChange={e => setSignUpConfirmPass(e.target.value)}
                      placeholder="Match password"
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-xl px-4 h-[44px] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 h-[52px] bg-[var(--text-primary)] hover:bg-white text-black font-bold text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[var(--shadow-md)] disabled:opacity-50 active:scale-[0.98]"
                >
                  {isLoading ? 'Creating Account...' : 'Register Account'}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-3xl shadow-[var(--shadow-xl)] overflow-hidden"
          >
            <div className="flex justify-between items-center p-4 border-b border-[var(--border-subtle)]">
              <h3 className="font-bold text-[var(--text-primary)]">Reset Password</h3>
              <button 
                onClick={() => { setIsForgotModalOpen(false); setResetSent(false); setResetEmail(''); }}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-[var(--accent-emerald)]/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-[var(--accent-emerald)]/20">
                    <CheckCircle2 className="w-8 h-8 text-[var(--accent-emerald)]" />
                  </div>
                  <h4 className="font-bold text-lg text-[var(--text-primary)]">Link Sent!</h4>
                  <p className="text-sm text-[var(--text-secondary)]">If {resetEmail} exists in our system, you will receive a password reset email shortly.</p>
                  <button
                    onClick={() => { setIsForgotModalOpen(false); setResetSent(false); setResetEmail(''); }}
                    className="w-full h-[44px] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-bold text-sm rounded-xl transition-all cursor-pointer mt-2"
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-sm text-[var(--text-secondary)] mb-4">Enter your email address and we'll send you a link to reset your password.</p>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={e => setResetEmail(e.target.value)}
                      placeholder="name@kalpanaaa.in"
                      className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] focus:border-[var(--accent-blue)] rounded-xl px-4 h-[44px] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full h-[44px] bg-[var(--accent-blue)] hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    Send Reset Link
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-6 flex items-center justify-between text-[10px] text-[var(--text-tertiary)] relative z-10 font-medium">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          <span>© {new Date().getFullYear()} KSS Hub</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Terms</a>
        </div>
      </footer>
    </div>
  );
};
