import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Kanban, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  User, 
  AlertCircle,
  Calendar,
  Layers,
  Edit2,
  Trash2,
  X,
  Save,
  Tag,
  Briefcase,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { ProjectTask, TaskStatus, TaskPriority } from '../../types';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, setDoc, doc, deleteDoc } from 'firebase/firestore';

const DEFAULT_TASKS: ProjectTask[] = [
  {
    id: 'task-1',
    projectId: 'proj-1',
    projectName: 'Core API Engine',
    title: 'Optimize Firestore sub-100ms indexes',
    description: 'Add composite indexes for attendance date queries.',
    assigneeId: 'emp-KSS2407004',
    assigneeName: 'Asbin T S',
    status: 'In Progress',
    priority: 'High',
    dueDate: '2026-08-20',
    createdAt: '2026-08-01',
    updatedAt: '2026-08-05'
  },
  {
    id: 'task-2',
    projectId: 'proj-2',
    projectName: 'PWA Biometric',
    title: 'Integrate MediaPipe 468 landmark mesh overlay',
    description: 'Draw green facial mesh over video stream.',
    assigneeId: 'emp-KSS2407005',
    assigneeName: 'Thabeethal Asnath I',
    status: 'In Review',
    priority: 'Urgent',
    dueDate: '2026-08-22',
    createdAt: '2026-08-02',
    updatedAt: '2026-08-06'
  },
  {
    id: 'task-3',
    projectId: 'proj-1',
    projectName: 'Core API Engine',
    title: 'Add device fingerprinting for anti-spoofing',
    description: 'Generate base64 device fingerprint hash.',
    assigneeId: 'emp-KSS2407006',
    assigneeName: 'Kuruva Mahesh',
    status: 'Done',
    priority: 'Medium',
    dueDate: '2026-08-15',
    createdAt: '2026-08-01',
    updatedAt: '2026-08-05'
  },
  {
    id: 'task-4',
    projectId: 'proj-3',
    projectName: 'Executive Dashboard',
    title: 'Design Stripe-style KPI summary cards with SVG sparklines',
    description: 'Implement delta badges (+2 ▲) and sparklines.',
    assigneeId: 'emp-KSS2407008',
    assigneeName: 'Pratiksha Harode',
    status: 'To Do',
    priority: 'High',
    dueDate: '2026-08-25',
    createdAt: '2026-08-05',
    updatedAt: '2026-08-05'
  }
];

export const PMProjectsView: React.FC = () => {
  const { employees, activeEmployee } = useAuth();
  const [activeView, setActiveView] = useState<'kanban' | 'roadmap'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');

  // Persisted Firestore & LocalStorage Tasks State
  const [tasks, setTasks] = useState<ProjectTask[]>(() => {
    const saved = localStorage.getItem('kss_pm_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TASKS;
      } catch (e) {
        console.warn('[PMProjectsView] Failed to parse PM tasks', e);
      }
    }
    return DEFAULT_TASKS;
  });

  // Real-time Firestore Sync for Project Tasks (Addresses Test P14 Contract)
  useEffect(() => {
    const unsubTasks = onSnapshot(collection(db, 'projectTasks'), (snapshot) => {
      if (!snapshot.empty) {
        const fetchedTasks: ProjectTask[] = [];
        snapshot.forEach(d => fetchedTasks.push(d.data() as ProjectTask));
        setTasks(fetchedTasks);
        localStorage.setItem('kss_pm_tasks', JSON.stringify(fetchedTasks));
      } else {
        // Seed Firestore with DEFAULT_TASKS if collection is empty
        DEFAULT_TASKS.forEach(t => {
          setDoc(doc(db, 'projectTasks', t.id), t).catch(console.error);
        });
      }
    }, (err) => console.warn('[PMProjectsView] Firestore projectTasks listener error', err));

    return () => unsubTasks();
  }, []);

  useEffect(() => {
    localStorage.setItem('kss_pm_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [projectName, setProjectName] = useState('Core API Engine');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(employees[0]?.id || '');
  const [status, setStatus] = useState<TaskStatus>('To Do');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

  const columns: TaskStatus[] = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];

  const moveTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    const today = new Date().toISOString().split('T')[0];
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, status: newStatus, updatedAt: today } : t);
      const target = updated.find(t => t.id === taskId);
      if (target) {
        setDoc(doc(db, 'projectTasks', target.id), target).catch(err => console.error('[PMProjectsView] Firestore setDoc error:', err));
      }
      return updated;
    });
  };

  const handleOpenCreateModal = () => {
    setEditingTask(null);
    setTitle('');
    setProjectName('Core API Engine');
    setDescription('');
    setAssigneeId(employees[0]?.id || '');
    setStatus('To Do');
    setPriority('Medium');
    setDueDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: ProjectTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setProjectName(task.projectName);
    setDescription(task.description);
    setAssigneeId(task.assigneeId);
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.dueDate);
    setIsModalOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      deleteDoc(doc(db, 'projectTasks', taskId)).catch(err => console.error('[PMProjectsView] Firestore deleteDoc error:', err));
    }
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const assignedEmp = employees.find(e => e.id === assigneeId || e.employeeId === assigneeId) || employees[0];
    const assigneeName = assignedEmp ? assignedEmp.fullName : 'Unassigned';
    const today = new Date().toISOString().split('T')[0];

    if (editingTask) {
      const updated: ProjectTask = {
        ...editingTask,
        title,
        projectName,
        description,
        assigneeId,
        assigneeName,
        status,
        priority,
        dueDate,
        updatedAt: today
      };
      setTasks(prev => prev.map(t => t.id === editingTask.id ? updated : t));
      setDoc(doc(db, 'projectTasks', updated.id), updated).catch(err => console.error('[PMProjectsView] Firestore setDoc error:', err));
    } else {
      const newTask: ProjectTask = {
        id: `task-${Date.now()}`,
        projectId: `proj-${Date.now()}`,
        projectName,
        title,
        description,
        assigneeId,
        assigneeName,
        status,
        priority,
        dueDate,
        createdAt: today,
        updatedAt: today
      };
      setTasks(prev => [newTask, ...prev]);
      setDoc(doc(db, 'projectTasks', newTask.id), newTask).catch(err => console.error('[PMProjectsView] Firestore setDoc error:', err));
    }

    setIsModalOpen(false);
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch =
      (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.assigneeName || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Kanban className="w-5 h-5 text-blue-400" />
            Project Kanban Board &amp; Task Manager
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Track deliverables, assign tasks, edit details, and monitor sprint progress.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center flex-wrap gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl w-full sm:w-auto justify-center">
            <button
              onClick={() => setActiveView('kanban')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === 'kanban' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Kanban Board
            </button>
            <button
              onClick={() => setActiveView('roadmap')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeView === 'roadmap' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Roadmap Timeline
            </button>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {activeView === 'kanban' ? (
        /* Kanban Board Columns */
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          {columns.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col);
            const colBadgeColor = col === 'Backlog' ? 'text-slate-400 bg-slate-500/10 border-slate-500/20' :
              col === 'To Do' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
              col === 'In Progress' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
              col === 'In Review' ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' :
              'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

            return (
              <div key={col} className="flex-1 min-w-[270px] max-w-[320px] bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between min-h-[520px]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">{col}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${colBadgeColor}`}>
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {colTasks.map(task => (
                      <div
                        key={task.id}
                        className="bg-slate-950 border border-slate-800/90 hover:border-slate-700 p-4 rounded-xl shadow-md space-y-3 transition-all group flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md truncate max-w-[110px] whitespace-nowrap" title={task.projectName}>
                            {task.projectName}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border tracking-wide whitespace-nowrap ${
                              task.priority === 'Urgent' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                              task.priority === 'High' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                              'bg-slate-800 border-slate-700 text-slate-400'
                            }`}>
                              {task.priority}
                            </span>
                            <button
                              onClick={() => handleOpenEditModal(task)}
                              className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                              title="Edit Task"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded transition-colors cursor-pointer"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-100 group-hover:text-blue-300 transition-colors leading-snug">{task.title}</h4>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">{task.description}</p>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1.5 font-medium text-slate-300">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span>{task.assigneeName.split(' ')[0]}</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800/80 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {task.dueDate}
                            </span>
                          </div>

                          {/* Move action buttons */}
                          <div className="flex items-center justify-between pt-1 gap-2">
                            {col !== 'Backlog' ? (
                              <button
                                onClick={() => {
                                  const idx = columns.indexOf(col);
                                  if (idx > 0) moveTaskStatus(task.id, columns[idx - 1]);
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[10px] font-semibold flex items-center gap-1 transition-all border border-slate-800 cursor-pointer"
                              >
                                <ChevronLeft className="w-3 h-3" /> Back
                              </button>
                            ) : <div />}
                            {col !== 'Done' && (
                              <button
                                onClick={() => {
                                  const idx = columns.indexOf(col);
                                  if (idx < columns.length - 1) moveTaskStatus(task.id, columns[idx + 1]);
                                }}
                                className="px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 text-[10px] font-bold flex items-center gap-1 transition-all border border-blue-500/30 ml-auto cursor-pointer"
                              >
                                Advance <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Gantt Timeline View */
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Layers className="w-4 h-4 text-blue-400" /> Roadmap & Deliverables Gantt Timeline
          </h3>

          <div className="space-y-4">
            {filteredTasks.map(t => (
              <div key={t.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <div className="flex items-center gap-2">
                    <span>{t.title} ({t.projectName})</span>
                    <button onClick={() => handleOpenEditModal(t)} className="text-slate-500 hover:text-blue-400">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDeleteTask(t.id)} className="text-slate-500 hover:text-rose-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="font-mono text-slate-400">Due: {t.dueDate}</span>
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" 
                    style={{ width: t.status === 'Done' ? '100%' : t.status === 'In Progress' ? '65%' : '20%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-slate-950 shrink-0">
              <h3 className="font-bold text-white text-base">
                {editingTask ? 'Edit Task' : 'Create New Sprint Task'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Task Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Refactor Firestore Query Indexes"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 h-11 text-xs text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Project Name</label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder="Project Name"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 h-11 text-xs text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Assignee</label>
                  <select
                    value={assigneeId}
                    onChange={e => setAssigneeId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 h-11 text-xs text-white focus:outline-hidden font-medium"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as TaskStatus)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-2 h-10 text-[11px] text-white focus:outline-hidden font-medium"
                  >
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as TaskPriority)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-2 h-10 text-[11px] text-white focus:outline-hidden font-medium"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-2 h-10 text-[11px] text-white focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Description & Deliverables</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide task specification details..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Task
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

