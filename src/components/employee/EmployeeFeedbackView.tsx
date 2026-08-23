import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
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
  Lock
} from 'lucide-react';
import { PerformanceFeedback } from '../../types';
import {
  getStoredFeedbacks,
  filterFeedbacksByRole,
  acknowledgePerformanceFeedback,
  subscribeToFeedbacks
} from '../../lib/feedbackService';
import { FEEDBACK_TEMPLATES } from '../../lib/feedbackTemplates';
import { useHaptic } from '../../hooks/useHaptic';

export const EmployeeFeedbackView: React.FC = () => {
  const { activeEmployee, role, isAuthenticated } = useAuth();
  const { triggerHaptic } = useHaptic();

  const [allFeedbacks, setAllFeedbacks] = useState<PerformanceFeedback[]>(() => getStoredFeedbacks());
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Firestore sync, narrowed to the reviews about THIS employee. A tier-1 account
  // has no readable subset beyond its own reviews, so a collection-wide listen is
  // rejected outright by the rules rather than merely returning less.
  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeToFeedbacks(
      activeEmployee,
      role,
      setAllFeedbacks,
      (err) => console.warn('[EmployeeFeedbackView] Firestore listener error:', err)
    );
  }, [isAuthenticated, activeEmployee, role]);

  // Strictly filter feedbacks meant ONLY for this employee
  const myFeedbacks = useMemo(() => {
    return filterFeedbacksByRole(allFeedbacks, activeEmployee, role);
  }, [allFeedbacks, activeEmployee, role]);

  const handleAcknowledge = async (fbId: string) => {
    triggerHaptic();
    setAcknowledgingId(fbId);
    await acknowledgePerformanceFeedback(fbId);
    setAcknowledgingId(null);
  };

  // No reviews means no rating. The previous fallback displayed a flat 5.0,
  // which read as a perfect score nobody had actually awarded.
  const avgRating = myFeedbacks.length > 0
    ? (myFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) / myFeedbacks.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header Banner */}
      <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Confidential to You
            </span>
            <span className="text-xs text-slate-500 font-mono">Performance Reviews</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" />
            My Performance Feedback &amp; Reviews
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
            Official feedback, mentorship assessments, and sprint growth action items provided by Executive Leadership and Project Management.
          </p>
        </div>

        {/* Stats Pill */}
        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800 shrink-0">
          <div className="text-center px-3 border-r border-slate-800">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Reviews</span>
            <span className="text-xl font-black text-white font-mono">{myFeedbacks.length}</span>
          </div>
          <div className="text-center px-3">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Rating</span>
            <div className="flex items-center gap-1">
              <span className="text-xl font-black text-amber-400 font-mono">{avgRating}</span>
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Feedbacks List */}
      {myFeedbacks.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <MessageSquare className="w-12 h-12 text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-white">No reviews published yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Your manager or executive leadership hasn't published a review for your profile yet. Any feedback sent to you will appear here instantly.
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
              {/* Header: Reviewer Info + Rating */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={fb.reviewerPhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fb.reviewerName)}&background=0284c7&color=fff`}
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
                          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                            • {tpl.title}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                        }`}
                      />
                    ))}
                    <span className="font-mono font-black text-white text-xs ml-1.5">{fb.rating}.0 / 5</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">
                    Date: {new Date(fb.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Sections with Dynamic Template Labels */}
              {(() => {
                const tpl = FEEDBACK_TEMPLATES[fb.category] || FEEDBACK_TEMPLATES['Performance & Sprint Delivery'];
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Field 1 (Strengths / Deliverables / Kudos) */}
                      {fb.strengths && (
                        <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 space-y-1.5">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {tpl.field1.label}
                          </span>
                          <p className="text-slate-300 leading-relaxed">{fb.strengths}</p>
                        </div>
                      )}

                      {/* Field 2 (Growth / Improvement / Opportunities) */}
                      {fb.areasForImprovement && (
                        <div className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/20 space-y-1.5">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5" /> {tpl.field2.label}
                          </span>
                          <p className="text-slate-300 leading-relaxed">{fb.areasForImprovement}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Items List */}
                    {fb.actionItems && fb.actionItems.length > 0 && (
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {tpl.actionItems.label}:
                        </span>
                        <ul className="space-y-1.5 text-slate-300">
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
                  {fb.isAcknowledged ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged on {new Date(fb.acknowledgedAt || fb.updatedAt).toLocaleDateString('en-GB')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                      <Clock className="w-3.5 h-3.5" /> Please review &amp; acknowledge below
                    </span>
                  )}
                </div>

                {!fb.isAcknowledged && (
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
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
};
