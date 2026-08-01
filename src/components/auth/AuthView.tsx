import React, { useState } from 'react';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';
import { useAuth } from '../../context/AuthContext';
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
  X
} from 'lucide-react';
import { UserRole } from '../../types';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface AuthViewProps {
  onBackToLanding?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onBackToLanding }) => {
  const { loginWithEmail, signUpUser, quickDemoLogin, isLoading, settings } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'admin_login' | 'signup'>('signin');
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
    setSignUpRole(newRole);
    // Reset designation to sensible default for the selected role
    if (newRole === 'SUPER_ADMIN') {
      setSignUpDesignation('Chief Executive Officer (CEO)');
    } else {
      setSignUpDesignation('Software Engineer');
    }
  };

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!loginEmail || !loginPassword) {
      setFeedback({ type: 'error', message: 'Please provide both email and password.' });
      return;
    }

    const res = await loginWithEmail(loginEmail, loginPassword);
    if (!res.success) {
      setFeedback({ type: 'error', message: res.message });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!signUpName || !signUpEmail || !signUpPass) {
      setFeedback({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }
    if (signUpPass.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters long for security.' });
      return;
    }
    if (signUpPass !== signUpConfirmPass) {
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
      setFeedback({ type: 'error', message: res.message });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err: any) {
      setResetSent(true); // show confirmation regardless for security
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white font-sans antialiased">
      
      {/* Top Header Branding Bar */}
      <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-blue-600/30 shrink-0 border border-slate-700/60">
            <img src={kalpanaLogo} alt="Kalpana Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Kalpana Software Solutions
              <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Internal Workspace
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">Private Employee & Operations Digital Home</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              ← Back to Workspace Home
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Authenticated Access Only</span>
          </div>
        </div>
      </header>

      {/* Main Form Center Box */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
          
          {/* Form Tab Switcher */}
          <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1 text-xs font-semibold">
            <button
              onClick={() => { setActiveTab('signin'); setFeedback(null); }}
              className={`py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signin'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Employee Login</span>
            </button>

            <button
              onClick={() => { setActiveTab('admin_login'); setFeedback(null); }}
              className={`py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'admin_login'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-purple-300" />
              <span>Admin Login</span>
            </button>

            <button
              onClick={() => { setActiveTab('signup'); setFeedback(null); }}
              className={`py-3 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Register</span>
            </button>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Feedback Notification Banner */}
            {feedback && (
              <div className={`p-4 rounded-2xl border text-xs font-medium flex items-center gap-3 animate-in fade-in duration-200 ${
                feedback.type === 'success' 
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200' 
                  : 'bg-rose-950/60 border-rose-800 text-rose-200'
              }`}>
                {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* TAB 1: EMPLOYEE SIGN IN */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Employee Portal Sign In</h2>
                  <p className="text-xs text-slate-400 mt-1">Enter your company email address and password to access your workspace.</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="employee@kalpanasoftware.com"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">Password</label>
                      <button
                        type="button"
                        onClick={() => setIsForgotModalOpen(true)}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 disabled:opacity-50"
                >
                  {isLoading ? 'Authenticating...' : 'Sign In to Employee Portal'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* TAB 2: ADMIN SIGN IN — CEO & CTO Only */}
            {activeTab === 'admin_login' && (
              <form onSubmit={handleSignIn} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Executive Admin Sign In</h2>
                  <p className="text-xs text-slate-400 mt-1">Restricted to <strong className="text-purple-300">CEO</strong> and <strong className="text-purple-300">CTO</strong> only. Routes directly to the Admin Control Panel.</p>
                </div>

                {/* CEO / CTO Quick Role Selector Chips */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setLoginEmail('akshith@kalpanasoftware.com'); setLoginPassword(''); setFeedback(null); }}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer ${
                      loginEmail.includes('akshith')
                        ? 'bg-purple-600/20 border-purple-500/60 shadow-lg shadow-purple-900/30'
                        : 'bg-slate-950 border-slate-800 hover:border-purple-600/50 hover:bg-purple-950/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base border transition-all ${
                      loginEmail.includes('akshit') ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>A</div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-white">Akshit</p>
                      <p className="text-[10px] text-purple-400 font-semibold">CEO · Super Admin</p>
                    </div>
                    {loginEmail.includes('akshit') && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setLoginEmail('gaurav@kalpanasoftware.com'); setLoginPassword(''); setFeedback(null); }}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all cursor-pointer ${
                      loginEmail.includes('gaurav')
                        ? 'bg-blue-600/20 border-blue-500/60 shadow-lg shadow-blue-900/30'
                        : 'bg-slate-950 border-slate-800 hover:border-blue-600/50 hover:bg-blue-950/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base border transition-all ${
                      loginEmail.includes('gaurav') ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>G</div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-white">Gaurav</p>
                      <p className="text-[10px] text-blue-400 font-semibold">CTO · Super Admin</p>
                    </div>
                    {loginEmail.includes('gaurav') && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400" />
                    )}
                  </button>
                </div>

                {/* Access Scope Notice */}
                <div className="flex items-start gap-2 px-3 py-2.5 bg-purple-950/40 border border-purple-800/50 rounded-xl text-[10px] text-purple-300">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-400" />
                  <span>Authentication routes exclusively to the <strong>Executive Admin Control Panel</strong>. Only CEO &amp; CTO have admin access.</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Executive Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="akshith@kalpanasoftware.com"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">Admin Password</label>
                      <button type="button" onClick={() => setIsForgotModalOpen(true)} className="text-xs font-medium text-purple-400 hover:text-purple-300 cursor-pointer">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 cursor-pointer">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 disabled:opacity-50"
                >
                  {isLoading ? 'Authenticating...' : 'Access Admin Control Panel'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}


            {/* TAB 3: REGISTER */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Create your Kalpana account</h2>
                  <p className="text-xs text-slate-400 mt-1">Requires official Kalpana Software Solutions team membership verification.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={signUpName}
                      onChange={e => setSignUpName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Kalpana Email Address *</label>
                    <input
                      type="email"
                      required
                      value={signUpEmail}
                      onChange={e => setSignUpEmail(e.target.value)}
                      placeholder="sarah@kalpanasoftware.com"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Role Type</label>
                    <select
                      value={signUpRole}
                      onChange={e => handleSignUpRoleChange(e.target.value as UserRole)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                    >
                      <option value="EMPLOYEE">Employee Self-Service</option>
                      <option value="HR_ADMIN">HR Operations Team</option>
                      <option value="SUPER_ADMIN">CEO / CTO — Executive Admin</option>
                    </select>
                    {signUpRole === 'SUPER_ADMIN' && (
                      <p className="text-[10px] text-purple-400 mt-1 font-medium">⚡ CEO/CTO accounts get full Admin Control Panel access.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                    <select
                      value={signUpDept}
                      onChange={e => setSignUpDept(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Product & Design">Product & Design</option>
                      <option value="Project Management">Project Management</option>
                      <option value="Human Resources">Human Resources</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Role / Designation *</label>
                    <select
                      value={signUpDesignation}
                      onChange={e => setSignUpDesignation(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-semibold"
                    >
                      {signUpRole === 'SUPER_ADMIN' ? (
                        <>
                          <option value="Chief Executive Officer (CEO)">Chief Executive Officer (CEO)</option>
                          <option value="Chief Technology Officer (CTO)">Chief Technology Officer (CTO)</option>
                        </>
                      ) : (
                        <>
                          <option value="Software Engineer">Software Engineer</option>
                          <option value="Frontend Developer">Frontend Developer</option>
                          <option value="Backend Developer">Backend Developer</option>
                          <option value="UI/UX Designer">UI/UX Designer</option>
                          <option value="Project Manager">Project Manager</option>
                          <option value="HR Manager">HR Manager</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Password * <span className="text-[10px] text-slate-500 font-normal">(min. 6 chars)</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={signUpPass}
                      onChange={e => setSignUpPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={signUpConfirmPass}
                      onChange={e => setSignUpConfirmPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 disabled:opacity-50"
                >
                  {isLoading ? 'Registering...' : 'Complete Registration'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 relative">
            <button
              onClick={() => { setIsForgotModalOpen(false); setResetSent(false); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white">Reset Password</h3>
            <p className="text-xs text-slate-400">Enter your official registered email address to receive password reset instructions.</p>

            {resetSent ? (
              <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-200 rounded-2xl text-xs space-y-2">
                <p className="font-bold">Reset Email Sent!</p>
                <p>If an account exists for {resetEmail}, a password reset link has been dispatched to your inbox.</p>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="mt-2 text-xs text-white font-bold underline cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-blue-500"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer className="py-4 text-center text-[11px] text-slate-500 border-t border-slate-800/80">
        © {new Date().getFullYear()} {settings.companyName}. Protected by Firebase Cloud Security Rules & Encryption.
      </footer>
    </div>
  );
};
