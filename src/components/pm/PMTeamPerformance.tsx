import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Award, 
  CheckCircle2, 
  Calendar, 
  MessageSquare, 
  BookOpen, 
  Plus,
  TrendingUp,
  Star,
  Search,
  Filter,
  X,
  Save,
  Phone,
  Mail,
  Building2,
  Clock,
  Briefcase
} from 'lucide-react';
import { OneOnOneNote, Employee } from '../../types';
import { db, cleanFirestorePayload, subscribeWithRecovery } from '../../lib/firebase';
import { collection, setDoc, doc, deleteDoc } from 'firebase/firestore';
export const PMTeamPerformance: React.FC = () => {
  const { employees, activeEmployee, isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');

  // 1:1 Notes state with LocalStorage and Firestore persistence
  const [notes, setNotes] = useState<OneOnOneNote[]>(() => {
    const saved = localStorage.getItem('kss_pm_1on1_notes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn('[PMTeamPerformance] Failed to parse 1on1 notes', e);
      }
    }
    return [
      {
        id: 'note-1',
        employeeId: employees[0]?.id || 'emp-KSS2407004',
        managerId: activeEmployee?.id || 'pm-1',
        date: '2026-08-01',
        agenda: 'Q3 Goal alignment & sprint performance review',
        notes: 'Demonstrated exceptional progress on face recognition PWA optimization. Reassigned high-priority tasks.',
        actionItems: ['Complete MediaPipe canvas mesh integration', 'Review PR #4812'],
        createdAt: '2026-08-01'
      }
    ];
  });

  // Real-time Firestore sync for 1:1 Notes
  // P0 FIX: auth-gated + transient-error recovery (see subscribeWithRecovery).
  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubNotes = subscribeWithRecovery(collection(db, 'oneOnOneNotes'), (snapshot) => {
      if (!snapshot.empty) {
        const fetched: OneOnOneNote[] = [];
        snapshot.forEach(d => fetched.push(d.data() as OneOnOneNote));
        setNotes(fetched);
        localStorage.setItem('kss_pm_1on1_notes', JSON.stringify(fetched));
      }
    }, (err) => console.warn('[PMTeamPerformance] Firestore 1on1 notes listener error:', err));

    return () => unsubNotes();
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem('kss_pm_1on1_notes', JSON.stringify(notes));
  }, [notes]);

  // Modal State for 1:1 Meeting Note
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [agenda, setAgenda] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [actionItemInput, setActionItemInput] = useState('');

  // Extract unique departments for filter buttons
  const validEmployees = employees.filter(e => e && e.fullName && e.fullName.trim().length > 0);
  const departments = ['ALL', ...Array.from(new Set(validEmployees.map(e => e.department).filter(Boolean)))];

  const filteredEmployees = validEmployees.filter(emp => {
    const matchesSearch = 
      (emp.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.email || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;

    return matchesSearch && matchesDept;
  });

  const selectedEmp = validEmployees.find(e => e.id === selectedEmpId) || filteredEmployees[0] || validEmployees[0];

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agenda.trim() || !noteContent.trim() || !selectedEmp) return;

    const newNote: OneOnOneNote = {
      id: `note-${Date.now()}`,
      employeeId: selectedEmp.id,
      managerId: activeEmployee?.id || 'pm-1',
      date: new Date().toISOString().split('T')[0],
      agenda: agenda.trim(),
      notes: noteContent.trim(),
      actionItems: actionItemInput ? actionItemInput.split(',').map(s => s.trim()).filter(Boolean) : ['Follow up next sprint'],
      createdAt: new Date().toISOString()
    };

    setNotes(prev => [newNote, ...prev]);
    setDoc(doc(db, 'oneOnOneNotes', newNote.id), cleanFirestorePayload(newNote))
      .catch(err => console.error('[PMTeamPerformance] Firestore setDoc error:', err));

    setAgenda('');
    setNoteContent('');
    setActionItemInput('');
    setIsNoteModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Team Performance & 1:1 Guidance Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Filter by department, review employee profiles, and maintain 1:1 mentorship notes.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            {filteredEmployees.length} / {employees.length} Team Members
          </span>
        </div>
      </div>

      {/* Search Bar &amp; Department Filter Controls */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, ID, title, or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-hidden focus:border-blue-500 text-white placeholder-slate-500"
          />
        </div>

        {/* Department Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 custom-scrollbar">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
          {departments.map(dept => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedDept === dept
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {dept === 'ALL' ? 'All Departments' : dept}
            </button>
          ))}
        </div>
      </div>

      {/* Team Member Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredEmployees.map(emp => (
          <button
            key={emp.id}
            onClick={() => setSelectedEmpId(emp.id)}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col items-center text-center space-y-2 ${
              selectedEmpId === emp.id 
                ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-900/40 ring-1 ring-blue-500' 
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            <img
              src={emp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=1e293b&color=fff`}
              alt={emp.fullName}
              className="w-11 h-11 rounded-2xl object-cover border border-slate-700"
            />
            <div className="w-full min-w-0">
              <span className="block text-xs font-bold text-white truncate">{emp.fullName}</span>
              <span className="block text-[10px] text-slate-400 truncate mt-0.5">{emp.designation}</span>
              <span className="inline-block text-[9px] font-mono text-blue-400 mt-1 bg-blue-500/10 px-1.5 py-0.5 rounded-md">
                {emp.employeeId}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedEmp && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Detailed Performance Summary Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-md lg:col-span-1 space-y-5">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <img
                src={selectedEmp.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmp.fullName)}&background=1e293b&color=fff`}
                alt={selectedEmp.fullName}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-700 shrink-0"
              />
              <div>
                <h3 className="text-base font-bold text-white">{selectedEmp.fullName}</h3>
                <p className="text-xs text-slate-400">{selectedEmp.designation}</p>
                <span className="inline-block mt-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  ● Active Staff Member
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-500" /> Department</span>
                <span className="text-white font-semibold">{selectedEmp.department}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500" /> Email</span>
                <span className="text-blue-300 font-mono text-[11px] truncate max-w-[170px]">{selectedEmp.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /> Mobile</span>
                <span className="text-slate-300 font-mono">{selectedEmp.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-500" /> Assigned Shift</span>
                <span className="text-slate-300 text-[11px]">{selectedEmp.shift || 'Day Shift (10:00 - 19:00)'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Sprint On-Time Score</span>
                <span className="text-emerald-400 font-mono font-bold">96.4%</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Mentorship Score</span>
                <span className="text-yellow-400 font-mono font-bold flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" /> 4.9 / 5.0
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsNoteModalOpen(true)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add 1:1 Meeting Note
            </button>
          </div>

          {/* 1:1 Meeting Notes & Mentorship Feed */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-md lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" /> 1:1 Meeting Notes & Mentorship History
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {notes.filter(n => n.employeeId === selectedEmp.id).length} Session Records
              </span>
            </div>

            <div className="space-y-4">
              {notes.filter(n => n.employeeId === selectedEmp.id).length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No 1:1 meeting notes recorded for {selectedEmp.fullName} yet.
                  <p className="text-[11px] text-slate-600 mt-1">Click "Add 1:1 Meeting Note" to record feedback & action items.</p>
                </div>
              ) : (
                notes.filter(n => n.employeeId === selectedEmp.id).map(note => (
                  <div key={note.id} className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span className="text-blue-300 text-sm">{note.agenda}</span>
                      <span className="font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded-md">{note.date}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{note.notes}</p>
                    {note.actionItems && note.actionItems.length > 0 && (
                      <div className="pt-2 border-t border-slate-900">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Action Items:</span>
                        <ul className="list-disc list-inside text-xs text-emerald-300 space-y-1 font-medium">
                          {note.actionItems.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* 1:1 Note Creation Modal */}
      {isNoteModalOpen && selectedEmp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950 shrink-0">
              <h3 className="font-bold text-white text-base">
                Record 1:1 Meeting for {selectedEmp.fullName}
              </h3>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Meeting Agenda / Topic</label>
                <input
                  type="text"
                  required
                  value={agenda}
                  onChange={e => setAgenda(e.target.value)}
                  placeholder="e.g. Q3 Sprint Goal Alignment & Code Quality"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 h-11 text-xs text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Discussion Notes & Feedback</label>
                <textarea
                  rows={4}
                  required
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder="Document key performance takeaways and mentorship guidance..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Action Items (Comma Separated)</label>
                <input
                  type="text"
                  value={actionItemInput}
                  onChange={e => setActionItemInput(e.target.value)}
                  placeholder="e.g. Complete MediaPipe mesh, Review PR #48"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 h-11 text-xs text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save 1:1 Note
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

