import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ShieldCheck, Clock, Shirt, Palmtree, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Save, X, Calendar, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { OFFICIAL_COMPANY_HOLIDAYS_2026 } from '../../lib/attendanceEngine';

export interface CompanyRuleItem {
  id: string;
  category: 'Company Rules' | 'Employee Rules';
  title: string;
  description: string;
  effectiveDate: string;
  isMandatory: boolean;
}

const DEFAULT_RULES: CompanyRuleItem[] = [
  {
    id: 'rule-1',
    category: 'Company Rules',
    title: 'Core Office Hours & GPS Verification',
    description: 'Standard work hours are 10:00 AM to 07:00 PM IST (Mon–Sat). All employees checking in at Kalpanaaa Headquarters must be within the 500m GPS radius.',
    effectiveDate: '2026-01-01',
    isMandatory: true
  },
  {
    id: 'rule-2',
    category: 'Employee Rules',
    title: 'Work From Home (WFH) Approval Flow',
    description: 'WFH requests must be submitted in advance and approved by HR/Manager before taking remote work.',
    effectiveDate: '2026-01-01',
    isMandatory: true
  },
  {
    id: 'rule-3',
    category: 'Employee Rules',
    title: 'Grace Period & Late Check-in Penalty',
    description: 'A 15-minute grace period (up to 10:15 AM) is granted. Beyond this threshold, check-in is logged as Late.',
    effectiveDate: '2026-01-01',
    isMandatory: false
  },
  {
    id: 'rule-4',
    category: 'Employee Rules',
    title: 'Professional Business Casual Etiquette',
    description: 'Smart business casual attire is expected Monday through Thursday. Neat casual wear is permitted on Fridays and Saturdays.',
    effectiveDate: '2026-01-01',
    isMandatory: false
  },
  {
    id: 'rule-5',
    category: 'Employee Rules',
    title: 'Paid Time Off (PTO), Holidays & Weekly Offs',
    description: 'Every Sunday is an official Weekly Off. In addition, 17 declared Indian National, State (Karnataka Rajyotsava), and Festival Holidays are recognized as paid non-working days. Attendance check-in is strictly disabled on Sundays, official holidays, and during approved employee leaves.',
    effectiveDate: '2026-01-01',
    isMandatory: true
  },
  {
    id: 'rule-6',
    category: 'Company Rules',
    title: 'Monthly Salary Calculation Cycle (27th to 26th)',
    description: 'The company salary calculation cycle runs from the 27th of the previous month to the 26th of the current month (30-day accounting period). The 26th is the monthly payroll cut-off date. All working days, attendance, paid leaves, and Loss of Pay (LOP) are calculated on this cycle. A new cycle begins on the 27th of every month.',
    effectiveDate: '2026-01-01',
    isMandatory: true
  }
];

export const CompanyRulesView: React.FC = () => {
  const { role, activeEmployee } = useAuth();
  const isHR = activeEmployee?.role === 'SUPER_ADMIN' ||
    activeEmployee?.role === 'HR_ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'HR_ADMIN' ||
    (activeEmployee?.designation || '').toUpperCase().includes('CEO') ||
    (activeEmployee?.designation || '').toUpperCase().includes('CTO') ||
    (activeEmployee?.designation || '').toUpperCase().includes('FOUNDER') ||
    activeEmployee?.employeeId === 'CEO001' ||
    activeEmployee?.employeeId === 'CTO001';

  const [rules, setRules] = useState<CompanyRuleItem[]>(() => {
    const saved = localStorage.getItem('kss_company_rules');
    if (!saved) return DEFAULT_RULES;
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return DEFAULT_RULES;
      return parsed.map((r: any) => ({
        ...r,
        category: (r.category === 'Company Rules') ? 'Company Rules' : 'Employee Rules'
      }));
    } catch (e) {
      return DEFAULT_RULES;
    }
  });

  const [selectedCategory, setSelectedCategory] = useState<'Company Rules' | 'Employee Rules' | 'Holidays 2026'>('Company Rules');
  const [editingRule, setEditingRule] = useState<CompanyRuleItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Company Rules' | 'Employee Rules'>('Company Rules');
  const [description, setDescription] = useState('');
  const [isMandatory, setIsMandatory] = useState(true);

  useEffect(() => {
    localStorage.setItem('kss_company_rules', JSON.stringify(rules));
  }, [rules]);

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;

    if (editingRule) {
      setRules(prev => prev.map(r => r.id === editingRule.id ? {
        ...r,
        title,
        category,
        description,
        isMandatory
      } : r));
    } else {
      const newRule: CompanyRuleItem = {
        id: `rule-${Date.now()}`,
        title,
        category,
        description,
        effectiveDate: new Date().toISOString().split('T')[0],
        isMandatory
      };
      setRules(prev => [newRule, ...prev]);
    }

    closeModal();
  };

  const handleDeleteRule = (id: string) => {
    if (window.confirm('Are you sure you want to delete this rule?')) {
      setRules(prev => prev.filter(r => r.id !== id));
    }
  };

  const openEditModal = (rule: CompanyRuleItem) => {
    setEditingRule(rule);
    setTitle(rule.title);
    setCategory(rule.category);
    setDescription(rule.description);
    setIsMandatory(rule.isMandatory);
    setIsAddModalOpen(true);
  };

  const closeModal = () => {
    setEditingRule(null);
    setTitle('');
    setDescription('');
    setIsAddModalOpen(false);
  };

  const filteredRules = rules.filter(r => r.category === selectedCategory);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Company Rules': return <ShieldCheck className="w-4 h-4 text-blue-400" />;
      case 'Employee Rules': return <BookOpen className="w-4 h-4 text-emerald-400" />;
      default: return <ShieldCheck className="w-4 h-4 text-slate-400" />;
    }
  };

  const companyRulesCount = rules.filter(r => r.category === 'Company Rules').length;
  const employeeRulesCount = rules.filter(r => r.category === 'Employee Rules').length;
  const holidaysCount = OFFICIAL_COMPANY_HOLIDAYS_2026.length;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Company Policies &amp; Holiday Calendar
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Maintain official organization policies, workplace regulations, and declared 2026 public holidays.</p>
        </div>

        {isHR && selectedCategory !== 'Holidays 2026' && (
          <button
            onClick={() => { closeModal(); setIsAddModalOpen(true); }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Publish New Rule</span>
          </button>
        )}
      </div>

      {/* Category Pills: Company Rules, Employee Rules & Holidays 2026 */}
      <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 w-fit flex-wrap">
        <button
          onClick={() => setSelectedCategory('Company Rules')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedCategory === 'Company Rules' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' 
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Company Rules ({companyRulesCount})</span>
        </button>

        <button
          onClick={() => setSelectedCategory('Employee Rules')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedCategory === 'Employee Rules' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' 
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Employee Rules ({employeeRulesCount})</span>
        </button>

        <button
          onClick={() => setSelectedCategory('Holidays 2026')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedCategory === 'Holidays 2026' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40' 
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>Official Holidays 2026 ({holidaysCount})</span>
        </button>
      </div>

      {/* Holidays Grid */}
      {selectedCategory === 'Holidays 2026' ? (
        <div className="space-y-4">
          <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Kalpanaaa Software Solutions — 2026 Declared Holidays</h3>
                <p className="text-xs text-slate-400">Sundays are standard weekly off days. The following 17 dates are recognized as paid public &amp; state holidays.</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 font-mono text-xs font-bold shrink-0">
              17 Official Holidays
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {OFFICIAL_COMPANY_HOLIDAYS_2026.map((h, index) => {
              const [y, m, d] = h.date.split('-');
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const monthLabel = monthNames[parseInt(m, 10) - 1];

              return (
                <motion.div
                  key={h.date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 hover:border-indigo-500/40 transition-colors shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-indigo-500/30 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-black text-indigo-400 uppercase leading-none">{monthLabel}</span>
                      <span className="text-base font-black text-white font-mono leading-none mt-0.5">{d}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-tight">{h.name}</h4>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-indigo-300/90">{h.dayOfWeek}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-slate-500">{h.date}</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0">
                    Paid Off
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Rules Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRules.map(rule => (
          <motion.div
            key={rule.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs font-bold">
                  {getCategoryIcon(rule.category)}
                  <span className="text-slate-300">{rule.category}</span>
                </div>

                {rule.isMandatory && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    Mandatory Policy
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-white tracking-tight">{rule.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{rule.description}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
              <span>Effective: {rule.effectiveDate}</span>

              {isHR && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(rule)}
                    className="p-1.5 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Edit Rule"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      )}

      {/* Add / Edit Rule Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950">
              <h3 className="font-bold text-white text-base">
                {editingRule ? 'Edit Company Rule' : 'Publish New Company Rule'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Rule Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 h-11 text-xs text-white focus:outline-hidden font-medium"
                >
                  <option value="Company Rules">Company Rules</option>
                  <option value="Employee Rules">Employee Rules</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Rule Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Remote Work Security Guidelines"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 h-11 text-xs text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Full Description & Details</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide complete explanation of the rule..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mandatoryCheck"
                  checked={isMandatory}
                  onChange={e => setIsMandatory(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="mandatoryCheck" className="text-xs text-slate-300 font-semibold cursor-pointer">
                  Mark as Mandatory Compliance Rule
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Rule
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
