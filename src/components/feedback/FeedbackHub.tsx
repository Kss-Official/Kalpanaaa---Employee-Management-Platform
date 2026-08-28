import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Star, 
  Plus, 
  Search, 
  Filter, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Award, 
  UserCheck, 
  Users, 
  Building2, 
  Calendar, 
  Clock, 
  Trash2, 
  X, 
  Send, 
  ShieldCheck, 
  TrendingUp, 
  ChevronRight,
  HeartHandshake,
  Target,
  ArrowUpRight,
  Code,
  Rocket,
  Trophy,
  Zap,
  Bookmark,
  ClipboardList
} from 'lucide-react';
import { PerformanceFeedback, FeedbackCategory, FeedbackSentiment, Employee } from '../../types';
import {
  getStoredFeedbacks,
  filterFeedbacksByRole,
  savePerformanceFeedback,
  deletePerformanceFeedback,
  subscribeToFeedbacks,
  saveConfidentialNote,
  fetchConfidentialNote
} from '../../lib/feedbackService';
import { FEEDBACK_TEMPLATES } from '../../lib/feedbackTemplates';
import { canReview, tierOf, isAuthorizedTechLead } from '../../lib/hierarchy';
import { useHaptic } from '../../hooks/useHaptic';
import { QuizScheduler } from './QuizScheduler';

const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'Performance & Sprint Delivery',
  'Technical & Code Quality',
  'Behavioral & Teamwork',
  'Appreciation & Recognition'
];

export const FeedbackHub: React.FC = () => {
  const { employees, activeEmployee, role, isAuthenticated } = useAuth();
  const { triggerHaptic } = useHaptic();

  const effectiveRole = activeEmployee?.role || role;
  const isSuperAdmin = effectiveRole === 'SUPER_ADMIN';
  const isHr = effectiveRole === 'HR_ADMIN';
  const isPm = effectiveRole === 'PROJECT_MANAGER';
  const isTechLead = isAuthorizedTechLead(activeEmployee);
  const isExecutive = isSuperAdmin || isHr;

  // Real-time Feedbacks state
  const [allFeedbacks, setAllFeedbacks] = useState<PerformanceFeedback[]>(() => getStoredFeedbacks());

  // Firestore sync, scoped to what this viewer's TIER is allowed to read. A PM's
  // entitlement spans three fields, and a single Firestore query cannot OR across
  // fields, so subscribeToFeedbacks runs one listener per disjunct of the read
  // rule and merges the results by document id.
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeToFeedbacks(
      activeEmployee,
      role,
      setAllFeedbacks,
      (err) => console.warn('[FeedbackHub] Firestore listener error:', err)
    );
  }, [isAuthenticated, activeEmployee, role]);

  // Filtered by RBAC for this logged-in viewer
  const visibleFeedbacks = useMemo(() => {
    return filterFeedbacksByRole(allFeedbacks, activeEmployee, role);
  }, [allFeedbacks, activeEmployee, role]);

  // Tab & Filters
  const [activeViewTab, setActiveViewTab] = useState<'all' | 'sent_by_me' | 'received'>(
    isPm ? 'all' : 'all'
  );
  const [mainTab, setMainTab] = useState<'feedback' | 'quiz'>('feedback');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedTargetRoleFilter, setSelectedTargetRoleFilter] = useState<string>('ALL');

  // New Feedback Modal State
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
  const [privateNotes, setPrivateNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // Who this reviewer may write about at all: strictly below their own tier.
  //
  // P0 FIX: the PM branch was `!isExecutiveOrLeadership(e)`, which excluded the
  // CTO and CEO but still let a PM file a formal appraisal about a PEER PM -- and
  // about HR, whose role is not "executive leadership". canReview() applies the
  // same strictly-below test the create rule now enforces server-side, so the
  // dropdown can no longer offer a target whose write would be rejected.
  const eligibleTargetEmployees = useMemo(() => {
    return employees.filter(e => canReview(activeEmployee, e));
  }, [employees, activeEmployee]);

  // Filtered display feedbacks
  const displayFeedbacks = useMemo(() => {
    return visibleFeedbacks.filter(fb => {
      // Tab filter
      if (activeViewTab === 'sent_by_me' && fb.reviewerId !== activeEmployee?.id) return false;
      if (activeViewTab === 'received' && fb.targetEmployeeId !== activeEmployee?.id && fb.targetEmployeeCode !== activeEmployee?.employeeId) return false;

      // Category filter
      if (selectedCategoryFilter !== 'ALL' && fb.category !== selectedCategoryFilter) return false;

      // Target Role filter
      if (selectedTargetRoleFilter !== 'ALL' && fb.targetEmployeeRole !== selectedTargetRoleFilter) return false;

      // Search filter
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const matchesTarget = fb.targetEmployeeName.toLowerCase().includes(q) || fb.targetEmployeeCode.toLowerCase().includes(q);
        const matchesReviewer = fb.reviewerName.toLowerCase().includes(q);
        const matchesContent = (fb.strengths || '').toLowerCase().includes(q) || (fb.areasForImprovement || '').toLowerCase().includes(q);
        return matchesTarget || matchesReviewer || matchesContent;
      }

      return true;
    });
  }, [visibleFeedbacks, activeViewTab, selectedCategoryFilter, selectedTargetRoleFilter, searchTerm, activeEmployee]);

  // Metrics
  const totalGiven = visibleFeedbacks.length;
  const avgRating = totalGiven > 0 
    ? (visibleFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / totalGiven).toFixed(1)
    : '5.0';
  const acknowledgedCount = visibleFeedbacks.filter(f => Boolean(f.isAcknowledged)).length;
  const ackRate = totalGiven > 0 ? Math.round((acknowledgedCount / totalGiven) * 100) : 100;

  // Add Action Item helper
  const handleAddActionItem = () => {
    if (!actionItemInput.trim()) return;
    setActionItemsList(prev => [...prev, actionItemInput.trim()]);
    setActionItemInput('');
  };

  const handleRemoveActionItem = (idx: number) => {
    setActionItemsList(prev => prev.filter((_, i) => i !== idx));
  };

  // Open Compose Modal for a specific employee
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
    setPrivateNotes('');
    setSubmitFeedback(null);
    setIsComposeModalOpen(true);
  };

  // Submit Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmpId || !activeEmployee) return;

    const targetEmp = employees.find(e => e.id === targetEmpId);
    if (!targetEmp) return;

    setIsSubmitting(true);
    setSubmitFeedback(null);

    const newFeedback: PerformanceFeedback = {
      id: `fb-${Date.now()}`,
      targetEmployeeId: targetEmp.id,
      targetEmployeeCode: targetEmp.employeeId,
      targetEmployeeName: targetEmp.fullName,
      targetEmployeeRole: targetEmp.role,
      targetEmployeeDesignation: targetEmp.designation,
      targetEmployeeDepartment: targetEmp.department,
      // COST FIX: targetEmployeePhotoUrl / reviewerPhotoUrl are deliberately NOT
      // stamped here any more. They copied ~30-50KB of base64 image onto every
      // review document (~80KB per doc for the pair), and that blob was then
      // re-streamed to every reader of the collection. Both render sites now
      // resolve the avatar from the `employees` directory already in context,
      // falling back to the stored field for historical documents. Dropping the
      // copy also fixes a staleness bug: a review used to keep showing whatever
      // photo the person had on the day it was written.

      reviewerId: activeEmployee.id,
      reviewerName: activeEmployee.fullName,
      reviewerRole: activeEmployee.role,
      reviewerDesignation: activeEmployee.designation || (isSuperAdmin ? 'Executive Leadership' : isPm ? 'Project Manager' : 'Reviewer'),

      // Denormalised so firestore.rules can authorise reads without a billed
      // lookup of the subject's role. Stamped from the directory record at write
      // time and immutable afterwards (see the update rule), which is what keeps
      // a review visible to the tier that was entitled to it even after the
      // subject is promoted.
      subjectTier: tierOf(targetEmp),

      category,
      rating,
      sentiment,
      strengths: strengths.trim(),
      areasForImprovement: areasForImprovement.trim(),
      actionItems: actionItemsList.length > 0 ? actionItemsList : (actionItemInput.trim() ? [actionItemInput.trim()] : ['Follow up on sprint goals']),
      isAcknowledged: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // The leadership note goes to a subcollection the subject cannot read, and it
    // goes FIRST so `hasConfidentialNote` can record what actually landed rather
    // than what we hoped would. A flag that claims a note the note store never
    // accepted is worse than no flag.
    const note = privateNotes.trim();
    const noteSaved = note.length > 0 ? await saveConfidentialNote(newFeedback.id, note) : false;
    newFeedback.hasConfidentialNote = noteSaved;

    const res = await savePerformanceFeedback(newFeedback);

    if (res.success) {
      setSubmitFeedback(
        note.length > 0 && !noteSaved
          ? '⚠ Review sent, but the leadership note could not be saved.'
          : '✓ Feedback successfully sent to employee!'
      );
      setTimeout(() => {
        setIsComposeModalOpen(false);
        setIsSubmitting(false);
        setSubmitFeedback(null);
      }, note.length > 0 && !noteSaved ? 3000 : 1200);
    } else {
      setSubmitFeedback(res.message);
      setIsSubmitting(false);
    }
  };

  // Leadership notes are fetched one at a time, on an explicit reveal, because
  // each one is a separate billed read and a confidential note should not be
  // sitting on screen through every scroll and screenshare.
  const [revealedNotes, setRevealedNotes] = useState<Record<string, string>>({});
  const [loadingNoteId, setLoadingNoteId] = useState<string | null>(null);

  const handleRevealNote = async (fbId: string) => {
    triggerHaptic();
    setLoadingNoteId(fbId);
    const text = await fetchConfidentialNote(fbId);
    // A denial and an empty note are indistinguishable here by design.
    setRevealedNotes(prev => ({ ...prev, [fbId]: text || 'No leadership note is stored on this review.' }));
    setLoadingNoteId(null);
  };

  const handleDelete = async (fbId: string) => {
    if (confirm('Are you sure you want to delete this performance review?')) {
      triggerHaptic();
      await deletePerformanceFeedback(fbId);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
              {isExecutive ? 'Executive & Leadership Hub' : isPm ? 'Project Manager Portal' : isTechLead ? 'Tech Lead Performance Hub' : 'Feedback Hub'}
            </span>
            <span className="text-xs text-slate-500 font-mono">Confidential RBAC Active</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-amber-400" />
            Performance &amp; Feedback Hub
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            {isExecutive 
              ? 'Directly submit structured performance appraisals, reviews, and guidance for Project Managers and all employees.'
              : isTechLead
              ? 'Provide 1:1 sprint performance reviews, code quality feedback, work & behavioral guidance for team members across the organization.'
              : 'Provide 1:1 sprint performance feedback, growth milestones, and guidance for your project team members.'}
          </p>
        </div>

        {mainTab === 'feedback' && (
          <button
            onClick={() => handleOpenCompose()}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all hover:scale-105 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Give Performance Feedback</span>
          </button>
        )}
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-2xl text-xs font-bold w-fit">
        <button
          onClick={() => setMainTab('feedback')}
          className={`px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            mainTab === 'feedback' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Performance Feedback
        </button>
        <button
          onClick={() => setMainTab('quiz')}
          className={`px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            mainTab === 'quiz' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Schedule Quiz
          {mainTab !== 'quiz' && (
            <span className="text-[9px] font-black bg-violet-500/20 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-md">NEW</span>
          )}
        </button>
      </div>

      {/* Quiz Tab Content */}
      {mainTab === 'quiz' && <QuizScheduler />}

      {/* Feedback Tab Content */}
      {mainTab === 'feedback' && <>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Reviews</span>
          <span className="text-2xl font-black text-white font-mono mt-1 block">{totalGiven}</span>
          <span className="text-[9px] text-slate-500 mt-0.5 block">Recorded Records</span>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Rating</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-2xl font-black text-amber-400 font-mono">{avgRating}</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <span className="text-[9px] text-slate-500 mt-0.5 block">Out of 5.0 Stars</span>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Acknowledged</span>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">{ackRate}%</span>
          <span className="text-[9px] text-slate-500 mt-0.5 block">{acknowledgedCount} / {totalGiven} Signed Off</span>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Eligible Workforce</span>
          <span className="text-2xl font-black text-blue-400 font-mono mt-1 block">{eligibleTargetEmployees.length}</span>
          <span className="text-[9px] text-slate-500 mt-0.5 block">Members Available</span>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Tab Filters */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => setActiveViewTab('all')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeViewTab === 'all' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Visible Feedbacks ({visibleFeedbacks.length})
          </button>
          <button
            onClick={() => setActiveViewTab('sent_by_me')}
            className={`px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
              activeViewTab === 'sent_by_me' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Given By Me
          </button>
          {isPm && (
            <button
              onClick={() => setActiveViewTab('received')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                activeViewTab === 'received' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Received from Leadership
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee, reviewer, notes..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* Category & Role Quick Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 font-bold text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Category:
        </span>
        <button
          onClick={() => setSelectedCategoryFilter('ALL')}
          className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
            selectedCategoryFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          All Categories
        </button>
        {FEEDBACK_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategoryFilter(cat)}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
              selectedCategoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feedbacks Grid */}
      {displayFeedbacks.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <MessageSquare className="w-12 h-12 text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-white">No performance feedbacks found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm ? 'No reviews match your search query.' : 'Click "Give Performance Feedback" to write the first review.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayFeedbacks.map(fb => {
            const isAuthor = fb.reviewerId === activeEmployee?.id;
            const canDelete = isAuthor || isSuperAdmin;

            return (
              <motion.div
                key={fb.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col justify-between transition-all"
              >
                <div>
                  {/* Top Row: Target Employee + Reviewer Pill + Rating */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={employees.find(e => e.id === fb.targetEmployeeId)?.profilePhotoUrl || fb.targetEmployeePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fb.targetEmployeeName)}&background=0f172a&color=fff`}
                        alt={fb.targetEmployeeName}
                        className="w-11 h-11 rounded-2xl object-cover border-2 border-blue-500/40 shadow-sm shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-black text-white truncate">{fb.targetEmployeeName}</h4>
                          <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20">
                            {fb.targetEmployeeCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          {fb.targetEmployeeDesignation || fb.targetEmployeeRole} • <span className="text-slate-300">{fb.targetEmployeeDepartment}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      {/* Star Rating */}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                        {new Date(fb.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Reviewer Tag & Category Pill */}
                  {/* Reviewer Tag & Category Pill */}
                  {(() => {
                    const tpl = FEEDBACK_TEMPLATES[fb.category] || FEEDBACK_TEMPLATES['Performance & Sprint Delivery'];
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 py-2 flex-wrap text-[10px]">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Review by: <strong className="text-slate-200">{fb.reviewerName}</strong> ({fb.reviewerDesignation || fb.reviewerRole})</span>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider border ${tpl.theme.pillBg}`}>
                            {fb.category}
                          </span>
                        </div>

                        {/* Feedback Content Sections */}
                        <div className="space-y-2.5 text-xs pt-1">
                          {/* Field 1 (Strengths / Deliverables / Kudos) */}
                          {fb.strengths && (
                            <div className="p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 space-y-1">
                              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> {tpl.field1.label}
                              </span>
                              <p className="text-slate-300 text-xs leading-relaxed">{fb.strengths}</p>
                            </div>
                          )}

                          {/* Field 2 (Growth / Improvement / Leadership Opportunities) */}
                          {fb.areasForImprovement && (
                            <div className="p-3 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-1">
                              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                <Target className="w-3 h-3" /> {tpl.field2.label}
                              </span>
                              <p className="text-slate-300 text-xs leading-relaxed">{fb.areasForImprovement}</p>
                            </div>
                          )}

                          {/* Action Items */}
                          {fb.actionItems && fb.actionItems.length > 0 && (
                            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                {tpl.actionItems.label}:
                              </span>
                              <ul className="space-y-1 text-[11px] text-slate-300">
                                {fb.actionItems.map((item, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {/* Leadership note: HR and the board only, revealed on demand.
                      The text is never in this document -- see
                      fetchConfidentialNote and the /confidential rules block. */}
                  {fb.hasConfidentialNote && isExecutive && (
                    <div className="p-2.5 bg-purple-500/5 rounded-xl border border-purple-500/20 text-[11px] mt-2.5">
                      <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider block">
                        🔒 Leadership Private Note:
                      </span>
                      {revealedNotes[fb.id] ? (
                        <p className="text-purple-200 italic mt-0.5">{revealedNotes[fb.id]}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRevealNote(fb.id)}
                          disabled={loadingNoteId === fb.id}
                          className="mt-1 text-[10px] font-bold text-purple-300 hover:text-purple-100 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                        >
                          {loadingNoteId === fb.id ? 'Opening…' : 'Reveal note'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Bar: Acknowledgment Status + Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                  <div>
                    {Boolean(fb.isAcknowledged) ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Acknowledged by Employee
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        <Clock className="w-3 h-3" /> Awaiting Employee Sign-off
                      </span>
                    )}
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => handleDelete(fb.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Delete Feedback"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── COMPOSE PERFORMANCE FEEDBACK MODAL ── */}
      {isComposeModalOpen && (() => {
        const currentTemplate = FEEDBACK_TEMPLATES[category] || FEEDBACK_TEMPLATES['Performance & Sprint Delivery'];

        return (
          <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
              
              {/* Modal Header */}
              <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
                    {isExecutive ? 'Executive / Admin Review' : 'Project Manager Review'}
                  </span>
                  <h3 className="text-base font-black text-white mt-1">
                    {currentTemplate.title}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {currentTemplate.tagline}
                  </p>
                </div>

                <button
                  onClick={() => setIsComposeModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmitFeedback} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                
                {/* Target Employee Selector */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">Select Employee / Project Manager:</label>
                  <select
                    value={targetEmpId}
                    onChange={e => setTargetEmpId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-medium text-xs focus:outline-hidden focus:border-blue-500"
                  >
                    {eligibleTargetEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeId}) — {emp.designation} [{emp.department}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category & Star Rating */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">Feedback Template Type:</label>
                    <select
                      value={category}
                      onChange={e => {
                        const newCat = e.target.value as FeedbackCategory;
                        setCategory(newCat);
                        // If fields are empty, load first preset of selected category
                        const nextTpl = FEEDBACK_TEMPLATES[newCat];
                        if (nextTpl && !strengths) {
                          setStrengths(nextTpl.quickPresets[0]?.strengths || '');
                          setAreasForImprovement(nextTpl.quickPresets[0]?.improvements || '');
                          setActionItemsList(nextTpl.quickPresets[0]?.actions || []);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-xs focus:outline-hidden focus:border-blue-500"
                    >
                      {FEEDBACK_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Rating (Interactive Stars) */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1.5">Performance Rating (1 to 5 Stars):</label>
                    <div className="flex items-center gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(null)}
                            onClick={() => setRating(star)}
                            className="p-1 cursor-pointer transition-transform hover:scale-125"
                          >
                            <Star
                              className={`w-5 h-5 ${
                                star <= (hoverRating || rating)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-700'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <span className="font-mono font-bold text-white text-xs ml-auto">{rating} / 5 Stars</span>
                    </div>
                  </div>
                </div>

                {/* 1-Click Quick Template Presets */}
                <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      1-Click Template Presets for {category}:
                    </span>
                    <span className="text-[10px] text-slate-500">Click to autofill</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentTemplate.quickPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setStrengths(preset.strengths);
                          setAreasForImprovement(preset.improvements);
                          setActionItemsList(preset.actions);
                          triggerHaptic('light');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-blue-600/20 hover:border-blue-500/50 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Bookmark className="w-3 h-3 text-blue-400" />
                        <span>{preset.title}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Field 1 (Strengths / Deliverables / Kudos) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-200 font-bold">
                      {currentTemplate.field1.label}:
                    </label>
                    <span className="text-[10px] text-slate-500">{currentTemplate.field1.helper}</span>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={strengths}
                    onChange={e => setStrengths(e.target.value)}
                    placeholder={currentTemplate.field1.placeholder}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 leading-relaxed"
                  />
                </div>

                {/* Field 2 (Growth / Improvement / Next Level) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-slate-200 font-bold">
                      {currentTemplate.field2.label}:
                    </label>
                    <span className="text-[10px] text-slate-500">{currentTemplate.field2.helper}</span>
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={areasForImprovement}
                    onChange={e => setAreasForImprovement(e.target.value)}
                    placeholder={currentTemplate.field2.placeholder}
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden focus:border-amber-500 leading-relaxed"
                  />
                </div>

                {/* Action Items List */}
                <div>
                  <label className="block text-slate-200 font-bold mb-1.5">
                    {currentTemplate.actionItems.label}:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={currentTemplate.actionItems.placeholder}
                      value={actionItemInput}
                      onChange={e => setActionItemInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddActionItem(); } }}
                      className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddActionItem}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {actionItemsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {actionItemsList.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[11px]"
                        >
                          <span>{item}</span>
                          <X
                            onClick={() => handleRemoveActionItem(idx)}
                            className="w-3 h-3 hover:text-white cursor-pointer"
                          />
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Private Leadership Notes (CEO/CTO only) */}
                {isExecutive && (
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                      🔒 Private Leadership Notes (Optional — only visible to Executive Admins):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Potential candidate for promotion in Q4 review"
                      value={privateNotes}
                      onChange={e => setPrivateNotes(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-purple-500/30 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-hidden focus:border-purple-500"
                    />
                  </div>
                )}

              {submitFeedback && (
                <div className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                  submitFeedback.startsWith('✓') 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitFeedback}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsComposeModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-blue-900/40 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Send Performance Feedback'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    })()}

      </> /* end mainTab === 'feedback' */}

    </div>
  );
};
