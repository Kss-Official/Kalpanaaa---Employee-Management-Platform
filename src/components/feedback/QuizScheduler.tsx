import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, X, Clock, CheckCircle2, AlertCircle,
  Calendar, Users, Eye, Trash2, ChevronRight, ChevronLeft,
  Send, BarChart3, Lock, PlayCircle, Timer, Zap, Shield
} from 'lucide-react';
import { FeedbackQuiz, QuizQuestion, QuizResponse } from '../../types';
import {
  canScheduleQuiz, saveQuiz, deleteQuiz, subscribeToQuizzes,
  submitQuizResponse, subscribeToQuizResponses, getQuizLiveStatus,
  quizCountdownSeconds, hasEmployeeResponded
} from '../../lib/quizService';
import { useHaptic } from '../../hooks/useHaptic';

function fmtSeconds(s: number): string {
  if (s <= 0) return '00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

const EMPTY_QUESTION = (): QuizQuestion => ({
  id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  text: '',
  options: ['', '', '', '']
});

const STATUS_CONFIG = {
  scheduled: { label: 'Upcoming', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  active:    { label: 'Live Now', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  closed:    { label: 'Closed',   color: 'text-slate-400 bg-slate-800 border-slate-700' },
  draft:     { label: 'Draft',    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
};

function useCountdown(quiz: FeedbackQuiz) {
  const [cd, setCd] = useState(() => quizCountdownSeconds(quiz));
  useEffect(() => {
    const id = setInterval(() => setCd(quizCountdownSeconds(quiz)), 1000);
    return () => clearInterval(id);
  }, [quiz]);
  return cd;
}

const ResultsPanel: React.FC<{ quiz: FeedbackQuiz; onClose: () => void }> = ({ quiz, onClose }) => {
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToQuizResponses(quiz.id, (data) => {
      setResponses(data);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [quiz.id]);

  const aggregated = useMemo(() => {
    return quiz.questions.map(q => {
      const counts = [0, 0, 0, 0];
      responses.forEach(r => {
        const ans = r.answers.find(a => a.questionId === q.id);
        if (ans && ans.selectedOption >= 0 && ans.selectedOption < 4) counts[ans.selectedOption]++;
      });
      const total = counts.reduce((a, b) => a + b, 0);
      return { question: q, counts, total };
    });
  }, [quiz.questions, responses]);

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-purple-900/60 to-slate-900 p-6 border-b border-slate-800 flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/10 px-2.5 py-0.5 rounded-md border border-purple-500/20">
              Confidential Results — Leadership Only
            </span>
            <h2 className="text-lg font-black text-white mt-2">{quiz.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{responses.length} response{responses.length !== 1 ? 's' : ''} received</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : responses.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <BarChart3 className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="text-slate-400 text-sm font-semibold">No responses yet</p>
            </div>
          ) : aggregated.map((item, idx) => (
            <div key={item.question.id} className="bg-slate-950 rounded-2xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-black flex items-center justify-center">{idx + 1}</span>
                <p className="text-sm font-bold text-white leading-relaxed">{item.question.text}</p>
              </div>
              <div className="space-y-2.5 pl-10">
                {item.question.options.map((opt, oi) => {
                  const count = item.counts[oi];
                  const pct = item.total > 0 ? Math.round((count / item.total) * 100) : 0;
                  const isTop = count === Math.max(...item.counts) && count > 0;
                  return (
                    <div key={oi}>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className={`font-semibold ${isTop ? 'text-emerald-400' : 'text-slate-300'}`}>{String.fromCharCode(65 + oi)}. {opt}</span>
                        <span className="font-mono text-slate-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, delay: oi * 0.1 }} className={`h-full rounded-full ${isTop ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const QuizTaker: React.FC<{
  quiz: FeedbackQuiz;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  onDone: () => void;
  onClose: () => void;
}> = ({ quiz, employeeId, employeeName, employeeRole, onDone, onClose }) => {
  const { triggerHaptic } = useHaptic();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(quiz);
  const total = quiz.questions.length;
  const current = quiz.questions[currentQ];
  const selectedOpt = answers[current?.id];
  const progress = Math.round((Object.keys(answers).length / total) * 100);

  const handleSelect = (optIdx: number) => { if (!current) return; triggerHaptic('light'); setAnswers(prev => ({ ...prev, [current.id]: optIdx })); };
  const handleNext = () => { if (currentQ < total - 1) { setCurrentQ(q => q + 1); triggerHaptic('light'); } };
  const handlePrev = () => { if (currentQ > 0) { setCurrentQ(q => q - 1); triggerHaptic('light'); } };

  const handleSubmit = async () => {
    const unanswered = quiz.questions.filter(q => answers[q.id] === undefined);
    if (unanswered.length > 0) { setError(`Please answer all ${unanswered.length} remaining question(s).`); return; }
    setError(null); setSubmitting(true); triggerHaptic('medium');
    const response: QuizResponse = {
      id: `resp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      quizId: quiz.id, employeeId, employeeName, employeeRole,
      answers: quiz.questions.map(q => ({ questionId: q.id, selectedOption: answers[q.id] ?? -1 })),
      submittedAt: new Date().toISOString()
    };
    const res = await submitQuizResponse(response);
    setSubmitting(false);
    if (res.success) { setSubmitted(true); triggerHaptic('success'); } else { setError(res.message); }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="bg-gradient-to-r from-indigo-900/50 to-slate-900 p-5 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Feedback Quiz</p>
                <h2 className="text-sm font-black text-white leading-tight">{quiz.title}</h2>
              </div>
            </div>
            {!submitted && (
              <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border ${countdown.seconds > 300 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-rose-400 bg-rose-500/10 border-rose-500/30'}`}>
                <Timer className="w-3.5 h-3.5" />{countdown.label}: {fmtSeconds(countdown.seconds)}
              </div>
            )}
          </div>
          {!submitted && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} className="h-full bg-indigo-500 rounded-full" />
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">{Object.keys(answers).length}/{total}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {quiz.questions.map((q, i) => (
                  <button key={q.id} onClick={() => { setCurrentQ(i); triggerHaptic('light'); }} className={`w-6 h-6 rounded-full text-[10px] font-bold transition-all cursor-pointer ${i === currentQ ? 'bg-indigo-600 text-white scale-110' : answers[q.id] !== undefined ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>{i + 1}</button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 px-8 text-center space-y-5">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }} className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-black text-white">Response Recorded!</h3>
                  <p className="text-sm text-slate-400 mt-2 max-w-sm">Thank you for your honest feedback. Your responses are confidential and will only be reviewed by leadership.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                  <Shield className="w-3.5 h-3.5" /><span className="font-semibold">Anonymous submission — your identity is protected</span>
                </div>
                <button onClick={() => { onDone(); onClose(); }} className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl cursor-pointer transition-colors">Done</button>
              </motion.div>
            ) : (
              <motion.div key={currentQ} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }} className="p-6 space-y-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Question {currentQ + 1} of {total}</span>
                  <h3 className="text-base font-bold text-white leading-relaxed">{current?.text}</h3>
                </div>
                <div className="space-y-2.5">
                  {current?.options.map((opt, oi) => {
                    const selected = selectedOpt === oi;
                    return (
                      <motion.button key={oi} onClick={() => handleSelect(oi)} whileTap={{ scale: 0.98 }} className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 text-sm font-semibold ${selected ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800'}`}>
                        <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shrink-0 transition-all ${selected ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900 border-slate-600 text-slate-400'}`}>
                          {selected ? <CheckCircle2 className="w-4 h-4" /> : String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
                {error && <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-400"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!submitted && (
          <div className="p-5 border-t border-slate-800 flex items-center justify-between gap-3">
            <button onClick={handlePrev} disabled={currentQ === 0} className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl disabled:opacity-30 cursor-pointer flex items-center gap-1.5">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <div className="flex items-center gap-2">
              {currentQ < total - 1 ? (
                <button onClick={handleNext} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/40 cursor-pointer disabled:opacity-60">
                  {submitting ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</> : <><Send className="w-3.5 h-3.5" /> Submit Response</>}
                </button>
              )}
            </div>
            <button onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-white rounded-xl cursor-pointer">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
};

const QuizCard: React.FC<{
  quiz: FeedbackQuiz;
  isScheduler: boolean;
  hasResponded: boolean;
  onTake: () => void;
  onViewResults: () => void;
  onDelete: () => void;
}> = ({ quiz, isScheduler, hasResponded, onTake, onViewResults, onDelete }) => {
  const { triggerHaptic } = useHaptic();
  const liveStatus = getQuizLiveStatus(quiz);
  const sc = STATUS_CONFIG[liveStatus];
  const countdown = useCountdown(quiz);

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${liveStatus === 'active' ? 'bg-emerald-500/15 border border-emerald-500/30' : liveStatus === 'scheduled' ? 'bg-blue-500/15 border border-blue-500/30' : 'bg-slate-800 border border-slate-700'}`}>
            {liveStatus === 'active' ? <Zap className="w-5 h-5 text-emerald-400" /> : liveStatus === 'scheduled' ? <Clock className="w-5 h-5 text-blue-400" /> : <ClipboardList className="w-5 h-5 text-slate-500" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-white truncate">{quiz.title}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{quiz.description || `${quiz.questions.length} questions`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${sc.color}`}>
            {liveStatus === 'active' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1 mb-0.5" />}
            {sc.label}
          </span>
          {isScheduler && <button onClick={onDelete} className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-500" />{quiz.repeatDaily ? 'Daily' : quiz.scheduledDate}</span>
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-500" />{quiz.openTime}–{quiz.closeTime} IST</span>
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-500" />{quiz.targetAudience === 'ALL_EMPLOYEES' ? 'All Employees' : quiz.targetAudience}</span>
        <span className="flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5 text-slate-500" />{quiz.questions.length} questions</span>
      </div>

      {liveStatus !== 'closed' && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border ${liveStatus === 'active' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/5 border-blue-500/20 text-blue-400'}`}>
          <Timer className="w-3.5 h-3.5 shrink-0" />
          <span>{countdown.label}: <span className="font-mono">{fmtSeconds(countdown.seconds)}</span></span>
          {quiz.repeatDaily && <span className="ml-auto text-[9px] text-slate-500 font-normal">repeats daily</span>}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
        {isScheduler ? (
          <>
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" />{quiz.responseCount ?? 0} response{quiz.responseCount !== 1 ? 's' : ''}</span>
            <button onClick={onViewResults} className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-white border border-purple-500/30 hover:border-purple-400/50 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all">
              <Eye className="w-3.5 h-3.5" />View Results
            </button>
          </>
        ) : (
          <>
            {liveStatus === 'active' && !hasResponded && <button onClick={onTake} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 cursor-pointer transition-all hover:scale-[1.02]"><PlayCircle className="w-4 h-4" />Take Quiz Now</button>}
            {liveStatus === 'active' && hasResponded && <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400"><CheckCircle2 className="w-4 h-4" />Response submitted!</span>}
            {liveStatus === 'scheduled' && <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Opens at {quiz.openTime} IST</span>}
            {liveStatus === 'closed' && <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />Quiz closed</span>}
          </>
        )}
      </div>
    </motion.div>
  );
};

const ComposeQuizModal: React.FC<{
  departments: string[];
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  onSave: (quiz: FeedbackQuiz) => void;
  onClose: () => void;
}> = ({ departments, createdBy, createdByName, createdByRole, onSave, onClose }) => {
  const { triggerHaptic } = useHaptic();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState<string>('ALL_EMPLOYEES');
  const [scheduledDate, setScheduledDate] = useState(todayIST());
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('10:00');
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([EMPTY_QUESTION()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addQuestion = () => { if (questions.length >= 10) return; setQuestions(prev => [...prev, EMPTY_QUESTION()]); triggerHaptic('light'); };
  const removeQuestion = (idx: number) => { if (questions.length <= 1) return; setQuestions(prev => prev.filter((_, i) => i !== idx)); };
  const updateQuestion = (idx: number, text: string) => setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, text } : q));
  const updateOption = (qIdx: number, oIdx: number, val: string) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options] as [string, string, string, string];
      opts[oIdx] = val;
      return { ...q, options: opts };
    }));
  };

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError('Please enter a quiz title.'); return; }
    if (questions.length < 2) { setError('Add at least 2 questions.'); return; }
    const invalid = questions.find(q => !q.text.trim() || q.options.some(o => !o.trim()));
    if (invalid) { setError('All questions and their 4 options must be filled in.'); return; }
    if (openTime >= closeTime) { setError('Close time must be after open time.'); return; }
    setSaving(true); triggerHaptic('medium');
    const quiz: FeedbackQuiz = {
      id: `quiz-${Date.now()}`, title: title.trim(), description: description.trim(), questions,
      targetAudience, scheduledDate, openTime, closeTime, repeatDaily,
      createdBy, createdByName, createdByRole: createdByRole as any,
      status: 'scheduled', responseCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const res = await saveQuiz(quiz);
    setSaving(false);
    if (res.success) { triggerHaptic('success'); onSave(quiz); } else { setError(res.message); }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="bg-gradient-to-r from-violet-900/50 to-slate-900 p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2.5 py-0.5 rounded-md border border-violet-500/20">Schedule a Feedback Quiz</span>
            <h2 className="text-base font-black text-white mt-1.5">New Quiz</h2>
            <p className="text-xs text-slate-400">Employees will see this quiz during the scheduled window.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Quiz Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Monthly Team Lead Feedback — August 2026" className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Description (optional)</label>
              <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Please rate your team lead's performance this month honestly." className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-violet-500 leading-relaxed resize-none" />
            </div>
          </div>
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">Target Audience *</label>
            <select value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium text-xs focus:outline-none focus:border-violet-500">
              <option value="ALL_EMPLOYEES">All Employees</option>
              {departments.map(dept => <option key={dept} value={dept}>{dept} Department</option>)}
            </select>
          </div>
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-violet-400" />Schedule Window (IST)</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Date</label>
                <input type="date" value={scheduledDate} min={todayIST()} onChange={e => setScheduledDate(e.target.value)} disabled={repeatDaily} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500 disabled:opacity-40" />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Opens At</label>
                <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Closes At</label>
                <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-violet-500" />
              </div>
            </div>
            <div onClick={() => setRepeatDaily(v => !v)} className="flex items-center gap-2.5 cursor-pointer">
              <div className={`w-10 h-5 rounded-full transition-all relative ${repeatDaily ? 'bg-violet-600' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${repeatDaily ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className="text-slate-300 font-semibold text-xs">Repeat daily at this time window</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-violet-400" />Questions ({questions.length}/10)</span>
              <button type="button" onClick={addQuestion} disabled={questions.length >= 10} className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 rounded-xl text-[11px] font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>
            {questions.map((q, qIdx) => (
              <div key={q.id} className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{qIdx + 1}</span>
                  <div className="flex-1">
                    <input type="text" value={q.text} onChange={e => updateQuestion(qIdx, e.target.value)} placeholder={`Question ${qIdx + 1}: e.g. How would you rate communication?`} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-violet-500" />
                  </div>
                  {questions.length > 1 && <button type="button" onClick={() => removeQuestion(qIdx)} className="p-1.5 text-slate-600 hover:text-rose-400 rounded-lg cursor-pointer mt-0.5"><X className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-10">
                  {q.options.map((opt, oIdx) => (
                    <input key={oIdx} type="text" value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-slate-500" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {questions.length < 5 && <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-400 font-semibold"><AlertCircle className="w-4 h-4 shrink-0" />Recommended: 5–10 questions for effective feedback collection.</div>}
          {error && <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-400"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        </div>
        <div className="p-5 border-t border-slate-800 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-violet-900/40 cursor-pointer disabled:opacity-60">
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</> : <><Send className="w-3.5 h-3.5" /> Schedule Quiz</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export const QuizScheduler: React.FC = () => {
  const { activeEmployee, role, employees, isAuthenticated } = useAuth();
  const { triggerHaptic } = useHaptic();
  const effectiveRole = activeEmployee?.role || role;
  const isScheduler = canScheduleQuiz(effectiveRole, activeEmployee);
  const [quizzes, setQuizzes] = useState<FeedbackQuiz[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [takingQuiz, setTakingQuiz] = useState<FeedbackQuiz | null>(null);
  const [viewResultsQuiz, setViewResultsQuiz] = useState<FeedbackQuiz | null>(null);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeToQuizzes(effectiveRole, activeEmployee?.department, setQuizzes, (err) => console.warn('[QuizScheduler]', err), activeEmployee);
  }, [isAuthenticated, effectiveRole, activeEmployee?.department, activeEmployee]);

  useEffect(() => {
    if (!activeEmployee?.id || isScheduler) return;
    const activeIds = quizzes.filter(q => getQuizLiveStatus(q) === 'active').map(q => q.id);
    if (activeIds.length === 0) return;
    Promise.all(activeIds.map(async (qId) => {
      const done = await hasEmployeeResponded(qId, activeEmployee.id);
      return done ? qId : null;
    })).then(results => {
      setRespondedIds(new Set(results.filter(Boolean) as string[]));
    });
  }, [quizzes, activeEmployee?.id, isScheduler]);

  const departments = useMemo(() => {
    const depts = new Set<string>();
    employees.forEach(e => { if (e.department) depts.add(e.department); });
    return Array.from(depts).sort();
  }, [employees]);

  const handleDelete = async (quizId: string) => {
    if (!confirm('Delete this quiz? This cannot be undone.')) return;
    triggerHaptic();
    await deleteQuiz(quizId);
    setQuizzes(prev => prev.filter(q => q.id !== quizId));
  };

  const activeQuizzes = quizzes.filter(q => getQuizLiveStatus(q) === 'active');
  const otherQuizzes = quizzes.filter(q => getQuizLiveStatus(q) !== 'active');

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border ${isScheduler ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'}`}>
              {isScheduler ? 'Quiz Management — Privileged' : 'Feedback Quizzes'}
            </span>
            <span className="text-xs text-slate-500 font-mono">Results Confidential</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-violet-400" />
            {isScheduler ? 'Schedule & Manage Quizzes' : 'Active Feedback Quizzes'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
            {isScheduler
              ? 'Create timed feedback quizzes. Results are confidential and only visible to CEO, CTO, HR, and Project Managers.'
              : 'Participate in scheduled feedback quizzes during the active window. Your responses are anonymous.'}
          </p>
        </div>
        {isScheduler && (
          <button onClick={() => { setComposeOpen(true); triggerHaptic(); }} className="px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-violet-900/40 transition-all hover:scale-105 cursor-pointer shrink-0">
            <Plus className="w-4 h-4" />Schedule a Quiz
          </button>
        )}
      </div>

      {isScheduler && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Quizzes</span>
            <span className="text-2xl font-black text-white font-mono mt-1 block">{quizzes.length}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 block">All Time</span>
          </div>
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Now</span>
            <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">{activeQuizzes.length}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 block">Active Windows</span>
          </div>
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 shadow-md">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Responses</span>
            <span className="text-2xl font-black text-violet-400 font-mono mt-1 block">{quizzes.reduce((sum, q) => sum + (q.responseCount ?? 0), 0)}</span>
            <span className="text-[9px] text-slate-500 mt-0.5 block">Across All Quizzes</span>
          </div>
        </div>
      )}

      {quizzes.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <ClipboardList className="w-12 h-12 text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-white">{isScheduler ? 'No quizzes scheduled yet' : 'No active quizzes right now'}</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {isScheduler ? 'Click "Schedule a Quiz" to create your first feedback quiz.' : 'Your manager will notify you when a new feedback quiz is scheduled. Check back later.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {activeQuizzes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Live Now
                </span>
                <span className="text-xs text-slate-500">({activeQuizzes.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeQuizzes.map(quiz => (
                  <QuizCard key={quiz.id} quiz={quiz} isScheduler={isScheduler} hasResponded={respondedIds.has(quiz.id)}
                    onTake={() => { setTakingQuiz(quiz); triggerHaptic(); }}
                    onViewResults={() => { setViewResultsQuiz(quiz); triggerHaptic(); }}
                    onDelete={() => handleDelete(quiz.id)} />
                ))}
              </div>
            </div>
          )}
          {otherQuizzes.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{isScheduler ? 'All Quizzes' : 'Upcoming & Closed'}</span>
                <span className="text-xs text-slate-600">({otherQuizzes.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherQuizzes.map(quiz => (
                  <QuizCard key={quiz.id} quiz={quiz} isScheduler={isScheduler} hasResponded={respondedIds.has(quiz.id)}
                    onTake={() => { setTakingQuiz(quiz); triggerHaptic(); }}
                    onViewResults={() => { setViewResultsQuiz(quiz); triggerHaptic(); }}
                    onDelete={() => handleDelete(quiz.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {composeOpen && (
          <ComposeQuizModal departments={departments} createdBy={activeEmployee?.id || ''} createdByName={activeEmployee?.fullName || ''} createdByRole={effectiveRole} onSave={() => setComposeOpen(false)} onClose={() => setComposeOpen(false)} />
        )}
      </AnimatePresence>
      {takingQuiz && <QuizTaker quiz={takingQuiz} employeeId={activeEmployee?.id || ''} employeeName={activeEmployee?.fullName || 'Anonymous'} employeeRole={effectiveRole} onDone={() => setRespondedIds(prev => new Set([...prev, takingQuiz!.id]))} onClose={() => setTakingQuiz(null)} />}
      {viewResultsQuiz && <ResultsPanel quiz={viewResultsQuiz} onClose={() => setViewResultsQuiz(null)} />}
    </div>
  );
};
