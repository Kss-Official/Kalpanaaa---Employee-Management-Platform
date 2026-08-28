import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Star, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Target, 
  ChevronRight, 
  MessageSquare,
  Award,
  Calendar,
  Lock,
  ClipboardList,
  Plus,
  X,
  Send,
  Trash2,
  Users,
  Code,
  Rocket,
  Zap,
  Building2,
  Bookmark
} from 'lucide-react';
import { PerformanceFeedback, FeedbackCategory, FeedbackSentiment, Employee } from '../../types';
import {
  getStoredFeedbacks,
  filterFeedbacksByRole,
  acknowledgePerformanceFeedback,
  subscribeToFeedbacks,
  savePerformanceFeedback,
  deletePerformanceFeedback
} from '../../lib/feedbackService';
import { FEEDBACK_TEMPLATES } from '../../lib/feedbackTemplates';
import { isAuthorizedTechLead, canReview, tierOf } from '../../lib/hierarchy';
import { useHaptic } from '../../hooks/useHaptic';
import { QuizScheduler } from '../feedback/QuizScheduler';

const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'Performance & Sprint Delivery',
  'Technical & Code Quality',
  'Behavioral & Teamwork',
  'Appreciation & Recognition'
];

export const EmployeeFeedbackView: React.FC = () => {
  const { activeEmployee, employees, role, isAuthenticated } = useAuth();
  const { triggerHaptic } = useHaptic();

  const isTechLead = isAuthorizedTechLead(activeEmployee);

  const [mainTab, setMainTab] = useState<'feedback' | 'given' | 'quiz'>('feedback');
  const [allFeedbacks, setAllFeedbacks] = useState<PerformanceFeedback[]>(() => getStoredFeedbacks());
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Compose Modal State for Tech Leads
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [targetEmpId, setTargetEmpId] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('Performance & Sprint Delivery');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [sentiment, setSentiment] = useState<FeedbackSentiment>('EXCELLENT');
  const [strengths, setStrengths] = useState('');
  const [areasForImprovement, setAreasForImprovement] = useState('');
  const [actionItemInput, setActionItemInput] = useState('');
  const [actionItemsList, setActionItemsList] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // Firestore sync
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeToFeedbacks(
      activeEmployee,
      role,
      setAllFeedbacks,
      (err) => console.warn('[EmployeeFeedbackView] Firestore listener error:', err)
    );
  }, [isAuthenticated, activeEmployee, role]);

  // Feedbacks received by this employee
  const myFeedbacks = useMemo(() => {
    return allFeedbacks.filter(fb => 
      fb.targetEmployeeId === activeEmployee?.id ||
      fb.targetEmployeeCode === activeEmployee?.employeeId ||
      (activeEmployee?.uid && fb.targetEmployeeId === activeEmployee.uid)
    );
  }, [allFeedbacks, activeEmployee]);

  // Feedbacks given by this tech lead
  const givenByMe = useMemo(() => {
    return allFeedbacks.filter(fb => 
      fb.reviewerId === activeEmployee?.id ||
      (activeEmployee?.uid && fb.reviewerId === activeEmployee.uid) ||
      (fb.reviewerName && activeEmployee?.fullName && fb.reviewerName.trim().toLowerCase() === activeEmployee.fullName.trim().toLowerCase())
    );
  }, [allFeedbacks, activeEmployee]);

  // Eligible target employees for review (Tech leads can review anyone except themselves)
  const eligibleTargetEmployees = useMemo(() => {
    return employees.filter(e => canReview(activeEmployee, e));
  }, [employees, activeEmployee]);

  const handleAcknowledge = async (fbId: string) => {
    triggerHaptic();
    setAcknowledgingId(fbId);
    const nowIso = new Date().toISOString();
    setAllFeedbacks(prev => prev.map(f => f.id === fbId ? { ...f, isAcknowledged: true, acknowledgedAt: nowIso, updatedAt: nowIso } : f));
    await acknowledgePerformanceFeedback(fbId);
    setAcknowledgingId(null);
  };

  const handleDeleteGiven = async (fbId: string) => {
    if (confirm('Are you sure you want to delete this performance review?')) {
      triggerHaptic();
      await deletePerformanceFeedback(fbId);
    }
  };

  const handleOpenCompose = (emp?: Employee) => {
    triggerHaptic();
    if (emp) {
      setTargetEmpId(emp.id);
    } else if (eligibleTargetEmployees.length > 0) {
      setTargetEmpId(eligibleTargetEmployees[0].id);
    }
    setRating(5);
    setSentiment('EXCELLENT');
    setCategory('Performance & Sprint Delivery');
    setStrengths('');
    setAreasForImprovement('');
    setActionItemsList([]);
    setActionItemInput('');
    setSubmitFeedback(null);
    setIsComposeModalOpen(true);
  };

  const handleAddActionItem = () => {
    if (!actionItemInput.trim()) return;
    setActionItemsList(prev => [...prev, actionItemInput.trim()]);
    setActionItemInput('');
  };

  const handleRemoveActionItem = (idx: number) => {
    setActionItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmpId) return;

    const targetEmp = employees.find(e => e.id === targetEmpId || e.employeeId === targetEmpId);
    if (!targetEmp) return;

    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const finalActionItems = actionItemsList.length > 0 
        ? actionItemsList 
        : (actionItemInput.trim() ? [actionItemInput.trim()] : ['Follow up on sprint goals']);

      const finalStrengths = strengths.trim() || 'Strong technical contribution and team dedication.';
      const finalAreas = areasForImprovement.trim() || 'Continue broadening sprint and architectural ownership.';

      const newFeedback: PerformanceFeedback = {
        id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        targetEmployeeId: targetEmp.id,
        targetEmployeeCode: targetEmp.employeeId || '',
        targetEmployeeName: targetEmp.fullName,
        targetEmployeeRole: targetEmp.role,
        targetEmployeeDesignation: targetEmp.designation,
        targetEmployeeDepartment: targetEmp.department || 'Engineering',
        reviewerId: activeEmployee?.id || activeEmployee?.uid || 'emp-KSS2407012',
        reviewerName: activeEmployee?.fullName || 'Satya Ranjan Das',
        reviewerRole: activeEmployee?.role || 'EMPLOYEE',
        reviewerDesignation: activeEmployee?.designation || 'Technical Lead',
        category,
        rating: Math.min(5, Math.max(1, Number(rating) || 5)),
        sentiment,
        strengths: finalStrengths,
        areasForImprovement: finalAreas,
        actionItems: finalActionItems,
        isAcknowledged: false,
        subjectTier: tierOf(targetEmp),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const res = await savePerformanceFeedback(newFeedback);
      if (res.success) {
        setSubmitFeedback('✓ Performance feedback recorded & published successfully!');
        setTimeout(() => {
          setIsComposeModalOpen(false);
          setSubmitFeedback(null);
          setMainTab('given');
        }, 1200);
      } else {
        setSubmitFeedback(`Error: ${res.message}`);
      }
    } catch (err: any) {
      console.error('Feedback submit error:', err);
      setSubmitFeedback(`Failed: ${err?.message || 'Error saving feedback'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const avgRating = myFeedbacks.length > 0
    ? (myFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / myFeedbacks.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header Banner */}
      <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border flex items-center gap-1 ${
              isTechLead 
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>
              {isTechLead ? <Sparkles className="w-3 h-3 text-amber-400" /> : <Lock className="w-3 h-3" />}
              {isTechLead ? 'Tech Lead Authority Active' : 'Confidential to You'}
            </span>
            <span className="text-xs text-slate-500 font-mono">Performance &amp; Engagement</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            {isTechLead ? 'Team Performance & Feedback Hub' : 'My Feedback & Growth Hub'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
            {isTechLead
              ? 'As a designated Technical Lead, you are authorized to provide 1:1 performance feedback, code quality reviews, and work guidance for all team members.'
              : 'View official performance feedback, growth milestones, and participate in scheduled feedback quizzes.'}
          </p>
        </div>

        {/* Actions & Stats Pill */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {isTechLead && (
            <button
              onClick={() => handleOpenCompose()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all hover:scale-105 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Give Performance Feedback</span>
            </button>
          )}

          {mainTab === 'feedback' && (
            <div className="flex items-center gap-3 bg-slate-950 p-2.5 px-3.5 rounded-2xl border border-slate-800 shrink-0">
              <div className="text-center px-2 border-r border-slate-800">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Received</span>
                <span className="text-lg font-black text-white font-mono">{myFeedbacks.length}</span>
              </div>
              <div className="text-center px-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Rating</span>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-black text-amber-400 font-mono">{avgRating}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-2xl text-xs font-bold w-fit flex-wrap">
        <button
          onClick={() => { setMainTab('feedback'); triggerHaptic(); }}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            mainTab === 'feedback' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>My Received Reviews ({myFeedbacks.length})</span>
        </button>

        {isTechLead && (
          <button
            onClick={() => { setMainTab('given'); triggerHaptic(); }}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              mainTab === 'given' ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reviews Given by Me ({givenByMe.length})</span>
          </button>
        )}

        <button
          onClick={() => { setMainTab('quiz'); triggerHaptic(); }}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            mainTab === 'quiz' ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Active Quizzes</span>
          {mainTab !== 'quiz' && (
            <span className="text-[9px] font-black bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-md">
              NEW
            </span>
          )}
        </button>
      </div>

      {/* Quiz Tab Content */}
      {mainTab === 'quiz' && <QuizScheduler />}

      {/* ── TAB 1: RECEIVED REVIEWS ── */}
      {mainTab === 'feedback' && (
        myFeedbacks.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center space-y-3">
            <MessageSquare className="w-12 h-12 text-slate-700 mx-auto" />
            <h3 className="text-base font-bold text-white">No reviews published for you yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Feedback sent to you by project managers, tech leads, or executive leadership will appear here instantly.
            </p>
          </div>
        ) : (
        <div className="space-y-4">
          {myFeedbacks.map(fb => (
            <motion.div
              key={fb.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={employees.find(e => e.id === fb.reviewerId)?.profilePhotoUrl || fb.reviewerPhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fb.reviewerName)}&background=0284c7&color=fff`}
                    alt={fb.reviewerName}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-blue-500/50 shadow-md shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-white">{fb.reviewerName}</h3>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                        {fb.reviewerDesignation || fb.reviewerRole}
                      </span>
                    </div>
                    {(() => {
                      const tpl = FEEDBACK_TEMPLATES[fb.category] || FEEDBACK_TEMPLATES['Performance & Sprint Delivery'];
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${tpl.theme.pillBg}`}>
                            {fb.category}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex flex-col items-start sm:items-end">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                        }`}
                      />
                    ))}
                    <span className="text-xs font-black text-amber-400 ml-1 font-mono">{fb.rating}.0</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {new Date(fb.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Feedback Content Sections */}
              {(() => {
                const tpl = FEEDBACK_TEMPLATES[fb.category] || FEEDBACK_TEMPLATES['Performance & Sprint Delivery'];
                return (
                  <>
                    {/* Strengths */}
                    {fb.strengths && (
                      <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {tpl.field1.label}
                        </span>
                        <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">{fb.strengths}</p>
                      </div>
                    )}

                    {/* Areas for Improvement */}
                    {fb.areasForImprovement && (
                      <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5" /> {tpl.field2.label}
                        </span>
                        <p className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">{fb.areasForImprovement}</p>
                      </div>
                    )}

                    {/* Action Items */}
                    {fb.actionItems && fb.actionItems.length > 0 && (
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {tpl.actionItems.label}:
                        </span>
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {fb.actionItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Footer / Acknowledge */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                <div>
                  {Boolean(fb.isAcknowledged) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged on {new Date(fb.acknowledgedAt || fb.updatedAt).toLocaleDateString('en-GB')}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(fb.id)}
                      disabled={acknowledgingId === fb.id}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-900/40 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{acknowledgingId === fb.id ? 'Signing off...' : 'Acknowledge Review'}</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ))}

      {/* ── TAB 2: REVIEWS GIVEN BY ME (TECH LEAD) ── */}
      {mainTab === 'given' && isTechLead && (
        givenByMe.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center space-y-4">
            <Sparkles className="w-12 h-12 text-amber-400/50 mx-auto" />
            <h3 className="text-base font-bold text-white">No performance reviews authored yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You haven't written any performance feedback for your colleagues yet. Click below to write the first review.
            </p>
            <button
              onClick={() => handleOpenCompose()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl inline-flex items-center gap-2 shadow-md shadow-blue-900/40 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Give Performance Feedback</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {givenByMe.map(fb => (
              <motion.div
                key={fb.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-6 shadow-xl space-y-4 transition-all"
              >
                {/* Header: Target Info + Rating */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={employees.find(e => e.id === fb.targetEmployeeId || e.employeeId === fb.targetEmployeeCode)?.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fb.targetEmployeeName)}&background=0f172a&color=fff`}
                      alt={fb.targetEmployeeName}
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-500/50 shadow-md shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-white">{fb.targetEmployeeName}</h3>
                        <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                          {fb.targetEmployeeCode}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
                          {fb.targetEmployeeDepartment || 'Engineering'}
                        </span>
                      </div>
                      {(() => {
                        const tpl = FEEDBACK_TEMPLATES[fb.category] || FEEDBACK_TEMPLATES['Performance & Sprint Delivery'];
                        return (
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${tpl.theme.pillBg}`}>
                              {fb.category}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-black text-amber-400 ml-1 font-mono">{fb.rating}.0</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {new Date(fb.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Content */}
                {fb.strengths && (
                  <div className="p-3.5 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Strengths &amp; Technical Delivery
                    </span>
                    <p className="text-slate-200 text-xs leading-relaxed">{fb.strengths}</p>
                  </div>
                )}

                {fb.areasForImprovement && (
                  <div className="p-3.5 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" /> Areas for Improvement &amp; Behaviour
                    </span>
                    <p className="text-slate-200 text-xs leading-relaxed">{fb.areasForImprovement}</p>
                  </div>
                )}

                {fb.actionItems && fb.actionItems.length > 0 && (
                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Action Items:</span>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {fb.actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                  <div>
                    {Boolean(fb.isAcknowledged) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Acknowledged by {fb.targetEmployeeName}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                        <Clock className="w-3 h-3" /> Awaiting Employee Sign-off
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteGiven(fb.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Delete Review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* ── COMPOSE PERFORMANCE FEEDBACK MODAL FOR TECH LEADS ── */}
      {isComposeModalOpen && (() => {
        const currentTemplate = FEEDBACK_TEMPLATES[category] || FEEDBACK_TEMPLATES['Performance & Sprint Delivery'];

        return (
          <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
              
              {/* Modal Header */}
              <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                    Tech Lead Performance Review
                  </span>
                  <h3 className="text-base font-black text-white mt-1">
                    {currentTemplate.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Provide structured 1:1 feedback on sprint output, code quality, teamwork, and growth milestones.
                  </p>
                </div>
                <button
                  onClick={() => setIsComposeModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveFeedback} className="p-6 overflow-y-auto space-y-5 flex-1">
                
                {/* 1. Target Employee Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    Select Team Member to Review <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={targetEmpId}
                    onChange={(e) => setTargetEmpId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="" disabled>-- Select an employee --</option>
                    {eligibleTargetEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeId}) — {emp.designation || emp.role} ({emp.department || 'Engineering'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Review Category Tabs */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Feedback Category <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {FEEDBACK_CATEGORIES.map(cat => {
                      const isSelected = category === cat;
                      const tpl = FEEDBACK_TEMPLATES[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected 
                              ? 'bg-blue-600/15 border-blue-500/60 ring-1 ring-blue-500 text-white' 
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          <span className="text-xs font-bold block truncate">{cat}</span>
                          <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">{tpl?.tagline}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Rating & Sentiment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      Overall Rating (1 - 5 Stars)
                    </label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          className="p-1 text-slate-600 hover:scale-125 transition-transform cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= (hoverRating ?? rating)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-black text-amber-400 font-mono ml-2">
                        {(hoverRating ?? rating)}.0
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      Performance Sentiment
                    </label>
                    <select
                      value={sentiment}
                      onChange={(e) => setSentiment(e.target.value as FeedbackSentiment)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="EXCELLENT">🌟 Excellent — Exceeding Benchmarks</option>
                      <option value="GOOD">👍 Good — Steady &amp; Reliable Delivery</option>
                      <option value="NEEDS_IMPROVEMENT">⚠️ Needs Improvement — Growth Required</option>
                      <option value="CRITICAL">🚨 Critical — Immediate Attention</option>
                    </select>
                  </div>
                </div>

                {/* 4. Strengths & Technical Highlights */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      {currentTemplate.field1.label} <span className="text-rose-400">*</span>
                    </label>
                    {currentTemplate.field1.starters && (
                      <div className="flex items-center gap-1">
                        {currentTemplate.field1.starters.slice(0, 2).map((starter, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setStrengths(prev => prev ? `${prev}\n• ${starter}` : `• ${starter}`)}
                            className="text-[9px] bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 cursor-pointer"
                          >
                            + Add starter
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                    placeholder={currentTemplate.field1.placeholder}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
                  />
                </div>

                {/* 5. Areas for Growth / Improvement */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      {currentTemplate.field2.label}
                    </label>
                    {currentTemplate.field2.starters && (
                      <div className="flex items-center gap-1">
                        {currentTemplate.field2.starters.slice(0, 2).map((starter, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setAreasForImprovement(prev => prev ? `${prev}\n• ${starter}` : `• ${starter}`)}
                            className="text-[9px] bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 cursor-pointer"
                          >
                            + Add starter
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <textarea
                    rows={3}
                    value={areasForImprovement}
                    onChange={(e) => setAreasForImprovement(e.target.value)}
                    placeholder={currentTemplate.field2.placeholder}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors leading-relaxed"
                  />
                </div>

                {/* 6. Action Items Checklist */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-blue-400" />
                    {currentTemplate.actionItems.label} (Action Items / S.M.A.R.T Goals)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={actionItemInput}
                      onChange={(e) => setActionItemInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddActionItem(); } }}
                      placeholder={currentTemplate.actionItems.placeholder}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddActionItem}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {actionItemsList.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {actionItemsList.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
                          <span className="flex items-center gap-2 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                            {item}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveActionItem(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Submit Feedback Notification */}
                {submitFeedback && (
                  <div className="p-3.5 bg-blue-500/15 border border-blue-500/30 rounded-2xl text-blue-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>{submitFeedback}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsComposeModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !targetEmpId || !strengths.trim()}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Publishing Review...' : 'Publish Performance Feedback'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
