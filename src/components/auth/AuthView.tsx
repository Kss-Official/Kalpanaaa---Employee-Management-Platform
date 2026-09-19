import React, { useState } from 'react';
import kalpanaLogo from '../../assets/images/kalpana_logo.jpeg';
import { useAuth } from '../../context/AuthContext';
import { useHaptic } from '../../hooks/useHaptic';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  X,
  Loader2,
  Shield
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface AuthViewProps {
  onBackToLanding?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = () => {
  const { loginWithEmail, isLoading } = useAuth();
  const { triggerHaptic } = useHaptic();

  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sign In state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    setFeedback(null);
    if (!loginEmail.trim() || !loginPassword) {
      triggerHaptic('error');
      setFeedback({ type: 'error', message: 'Please enter both your email address and password.' });
      return;
    }

    const res = await loginWithEmail(loginEmail.trim(), loginPassword);
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
    if (resetLoading) return;

    const email = resetEmail.trim().toLowerCase();
    if (!email) {
      setResetError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      triggerHaptic('error');
      setResetError('Please enter a valid email address.');
      return;
    }

    setResetError(null);
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      triggerHaptic('success');
      setResetEmail(email);
      setResetSent(true);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        triggerHaptic('success');
        setResetEmail(email);
        setResetSent(true);
      } else if (code === 'auth/too-many-requests') {
        triggerHaptic('error');
        setResetError('Too many attempts. Please wait a few minutes and try again.');
      } else if (code === 'auth/network-request-failed') {
        triggerHaptic('error');
        setResetError('Network connection issue. Please check your connection and retry.');
      } else if (code === 'auth/operation-not-allowed' || code === 'auth/unauthorized-continue-uri') {
        triggerHaptic('error');
        setResetError('Password reset is currently unavailable. Please contact system support.');
      } else {
        triggerHaptic('error');
        setResetError(err?.message || 'Could not send reset email. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotModal = () => {
    setIsForgotModalOpen(false);
    setResetSent(false);
    setResetEmail('');
    setResetError(null);
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-white selection:text-black font-sans antialiased relative">
      
      {/* Subtle monochrome ambient depth */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,255,255,0.06),rgba(0,0,0,0))]" />

      {/* Top Header */}
      <header className="px-6 py-4 border-b border-zinc-900 bg-black/60 backdrop-blur-md flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-800 shrink-0">
            <img src={kalpanaLogo} alt="Kalpanaaa" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight text-white">Kalpanaaa Software Solutions</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
          <Shield className="w-3.5 h-3.5 text-zinc-400" />
          <span>Secure Sign-In</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative"
        >
          {/* Logo & Heading */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-zinc-800 mb-3 shadow-inner bg-black">
              <img src={kalpanaLogo} alt="Kalpanaaa Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Sign in to your account</h1>
            <p className="text-xs text-zinc-400 mt-1">Enter your email address and password to continue</p>
          </div>

          {/* Feedback Banner */}
          <AnimatePresence>
            {feedback && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2.5 mb-5 ${
                  feedback.type === 'success' 
                    ? 'bg-zinc-900 border-zinc-700 text-white' 
                    : 'bg-red-950/40 border-red-900/50 text-red-200'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-white mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                )}
                <span>{feedback.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="name@kalpanaaa.in"
                  className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-white focus:ring-1 focus:ring-white rounded-xl pl-10 pr-4 h-11 text-sm text-white placeholder-zinc-500 focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setIsForgotModalOpen(true); }}
                  className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-white focus:ring-1 focus:ring-white rounded-xl pl-10 pr-10 h-11 text-sm text-white placeholder-zinc-500 focus:outline-none transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 p-0.5 text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-white hover:bg-zinc-200 active:scale-[0.99] text-black font-semibold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center p-4 border-b border-zinc-900">
              <h3 className="font-semibold text-sm text-white">Reset Password</h3>
              <button 
                onClick={closeForgotModal}
                className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5">
              {resetSent ? (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center mx-auto text-white">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-white">Check your email</h4>
                    <p className="text-xs text-zinc-400 mt-1">If an account exists for {resetEmail}, we've sent a link to reset your password.</p>
                  </div>
                  <button
                    onClick={closeForgotModal}
                    className="w-full h-10 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-xl transition-all cursor-pointer mt-2"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-xs text-zinc-400">Enter your registered email address and we'll send you instructions to reset your password.</p>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={e => { setResetEmail(e.target.value); setResetError(null); }}
                      disabled={resetLoading}
                      autoComplete="email"
                      placeholder="name@kalpanaaa.in"
                      className="w-full bg-zinc-900/80 border border-zinc-800 focus:border-white focus:ring-1 focus:ring-white rounded-xl px-3.5 h-10 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                  {resetError && (
                    <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/50 text-red-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full h-10 bg-white hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                        <span>Sending link...</span>
                      </>
                    ) : 'Send Reset Link'}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 relative z-10 gap-2 border-t border-zinc-900">
        <div>
          <span>© {new Date().getFullYear()} Kalpanaaa Software Solutions. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-zinc-600">Enterprise Operations Platform</span>
        </div>
      </footer>
    </div>
  );
};
