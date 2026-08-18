import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ShieldCheck, Clock, Shirt, Palmtree, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Save, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
    description: 'Standard work hours are 10:00 AM to 07:30 PM. All employees checking in at Main Office HQ must be within the 300m GPS radius.',
    effectiveDate: '2024-01-01',
    isMandatory: true
  },
  {
    id: 'rule-2',
    category: 'Employee Rules',
    title: 'Work From Home (WFH) Approval Flow',
    description: 'WFH requests must be submitted at least 24 hours in advance and approved by HR/Manager before taking remote work.',
    effectiveDate: '2024-01-01',
    isMandatory: true
  },
  {
    id: 'rule-3',
    category: 'Employee Rules',
    title: 'Grace Period & Late Check-in Penalty',
    description: 'A 60-minute grace period (up to 11:00 AM) is granted per month. Beyond 60 minutes, check-in is logged as Late.',
    effectiveDate: '2024-01-01',
    isMandatory: false
  },
  {
    id: 'rule-4',
    category: 'Employee Rules',
    title: 'Professional Business Casual Etiquette',
    description: 'Smart business casual attire is expected Monday through Thursday. Casual Fridays permit neat casual wear.',
    effectiveDate: '2024-01-01',
    isMandatory: false
  },
  {
    id: 'rule-5',
    category: 'Employee Rules',
    title: 'Paid Time Off (PTO) & Emergency Leave',
    description: 'Employees accrue 1.5 days of PTO per month. Emergency leaves must be reported to HR by 09:30 AM on the day of absence.',
    effectiveDate: '2024-01-01',
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

  const [selectedCategory, setSelectedCategory] = useState<'Company Rules' | 'Employee Rules'>('Company Rules');
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

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Company & Employee Rules
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Maintain official organization policy rules and employee workplace conduct regulations.</p>
        </div>

        {isHR && (
          <button
            onClick={() => { closeModal(); setIsAddModalOpen(true); }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Publish New Rule</span>
          </button>
        )}
      </div>

      {/* 2 Category Pills Only: Company Rules & Employee Rules */}
      <div className="flex items-center gap-2.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 w-fit">
        <button
          onClick={() => setSelectedCategory('Company Rules')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedCategory === 'Employee Rules' 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' 
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Employee Rules ({employeeRulesCount})</span>
        </button>
      </div>

      {/* Rules Grid */}
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
