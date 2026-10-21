import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Mail, 
  Phone, 
  Building2, 
  Search, 
  Users, 
  ChevronDown, 
  Star, 
  Crown, 
  Shield, 
  Layers, 
  X,
  Copy,
  Check,
  LayoutGrid,
  List,
  Sparkles,
  MapPin,
  Clock,
  Briefcase,
  ExternalLink,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isExecutiveOrLeadership } from '../../lib/attendanceEngine';
import { isAuthorizedTechLead } from '../../lib/hierarchy';
import { Employee } from '../../types';

// ─── Specialization Groups & Helpers (Matching Attendance Ledger & Admin Directory) ────
const SPEC_GROUPS: { color: string; items: string[] }[] = [
  { color: 'blue',   items: ['Frontend Development', 'Backend Development', 'Full Stack Development', 'Web Development', 'App Development'] },
  { color: 'violet', items: ['AI & ML', 'Machine Learning', 'Deep Learning', 'Generative AI', 'NLP', 'Computer Vision', 'AI Automation', 'Chatbot Development'] },
  { color: 'pink',   items: ['UI Design', 'UX Design', 'UI/UX Design', 'Product Design', 'Figma'] },
  { color: 'amber',  items: ['Manual Testing', 'Automation Testing', 'API Testing'] },
  { color: 'cyan',   items: ['Cloud Computing', 'DevOps', 'AWS', 'Azure', 'CI/CD'] },
  { color: 'red',    items: ['Application Security', 'Network Security', 'Cybersecurity'] },
  { color: 'teal',   items: ['IT Consulting', 'Technology Consulting', 'Solution Architecture', 'Application Support'] },
  { color: 'lime',   items: ['SEO', 'Social Media Marketing', 'Content Marketing', 'Digital Marketing'] },
  { color: 'indigo', items: ['Project Management', 'Technical Leadership', 'HR Operations', 'Talent Acquisition', 'Client Management'] },
];

const getDirectorySpecColor = (spec: string): string => {
  if (spec === 'UI/UX Design' || spec === 'UI Design' || spec === 'UX Design')
    return 'bg-pink-500/15 text-pink-300 border-pink-500/30';
  for (const g of SPEC_GROUPS) {
    if (g.items.includes(spec)) {
      const map: Record<string, string> = {
        blue:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
        violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
        pink:   'bg-pink-500/15 text-pink-300 border-pink-500/30',
        amber:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
        cyan:   'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        red:    'bg-red-500/15 text-red-300 border-red-500/30',
        teal:   'bg-teal-500/15 text-teal-300 border-teal-500/30',
        lime:   'bg-lime-500/15 text-lime-300 border-lime-500/30',
        indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      };
      return map[g.color] || 'bg-slate-700/40 text-slate-300 border-slate-600/30';
    }
  }
  if (spec.includes('Development')) return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  if (spec.includes('Design')) return 'bg-pink-500/15 text-pink-300 border-pink-500/30';
  if (spec.includes('Leadership') || spec.includes('Management')) return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
  if (spec.includes('AI')) return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
  return 'bg-slate-700/40 text-slate-300 border-slate-600/30';
};

const getDirectorySpecializations = (skills: string[] = [], emp?: Partial<Employee>): string[] => {
  const designationText = (emp?.designation || '').toLowerCase();
  const name = (emp?.fullName || '').toLowerCase();
  const empId = emp?.employeeId || '';
  const role = emp?.role;

  // Project Manager: strictly Project Management, never Technical Leadership
  if (role === 'PROJECT_MANAGER' || designationText.includes('project manager') || empId === 'KSS2407003' || name.includes('koushik')) {
    return ['Project Management'];
  }

  // Tech Leads: strictly Technical Leadership
  if (isAuthorizedTechLead(emp) || (role as string) === 'TECH_LEAD' || designationText.includes('tech lead') || designationText.includes('technical lead') || empId === 'KSS2407011' || empId === 'KSS2407012' || name.includes('jason kenneth') || name.includes('satya ranjan')) {
    return ['Technical Leadership'];
  }

  // Jigyansha: Generative AI
  if (empId === 'KSS2407014' || empId === 'KSS2407016' || name.includes('jigyansha') || name.includes('jingyasha')) {
    return ['Generative AI'];
  }

  // Known roster mappings
  if (empId === 'KSS2407001' || name.includes('gaurav')) return ['Technical Leadership'];
  if (empId === 'KSS2407002' || name.includes('akshit')) return ['Project Management'];
  if (empId === 'KSS2407004' || name.includes('asbin')) return ['Frontend Development'];
  if (empId === 'KSS2407005' || name.includes('thabeethal')) return ['Backend Development'];
  if (empId === 'KSS2407006' || name.includes('kuruva') || name.includes('mahesh')) return ['UI/UX Design'];
  if (empId === 'KSS2407007' || name.includes('ritish')) return ['UI/UX Design'];
  if (empId === 'KSS2407008' || name.includes('pratiksha')) return ['Full Stack Development'];
  if (empId === 'KSS2407009' || name.includes('priyanka')) return ['Full Stack Development'];
  if (empId === 'KSS2407010' || name.includes('prahlad')) return ['Frontend Development'];
  if (empId === 'KSS2407013' || name.includes('akash')) return ['Backend Development'];
  if (empId === 'KSS2407015' || name.includes('rahul kr pathak') || name.includes('pathak')) return ['Solution Architecture'];
  if (empId === 'KSS2407017' || name.includes('shruti')) return ['Full Stack Development'];
  if (name.includes('hr department') || (emp?.department || '').toLowerCase().includes('hr')) return ['HR Operations'];

  const result: string[] = [];
  let hasDesign = false;

  // 1. Explicit specialization field from employee doc
  if (emp?.specialization && typeof emp.specialization === 'string') {
    const spec = emp.specialization.trim();
    if (spec) {
      const cleanSpec = (spec === 'UI Design' || spec === 'UX Design') ? 'UI/UX Design' : spec;
      result.push(cleanSpec);
      if (cleanSpec.includes('Design')) hasDesign = true;
    }
  }

  // 2. Explicit skills array
  for (const s of skills) {
    if (s === 'UI Design' || s === 'UX Design' || s === 'UI/UX Design') {
      if (!hasDesign) { result.push('UI/UX Design'); hasDesign = true; }
    } else if (SPEC_GROUPS.some(g => g.items.includes(s)) || s.includes('Development') || s.includes('AI') || s.includes('Design') || s.includes('Testing') || s.includes('Architecture') || s.includes('Leadership')) {
      if (!result.includes(s)) result.push(s);
    }
  }

  // 3. Fallback inference by designation / employmentType / department
  if (result.length === 0) {
    const empType = (emp?.employmentType || '').toLowerCase();
    if (designationText.includes('frontend') || empType.includes('frontend')) result.push('Frontend Development');
    else if (designationText.includes('backend') || empType.includes('backend')) result.push('Backend Development');
    else if (designationText.includes('full stack') || designationText.includes('software engineer') || designationText.includes('software developer') || empType.includes('development')) result.push('Full Stack Development');
    else if (designationText.includes('designer') || designationText.includes('ui') || designationText.includes('ux')) result.push('UI/UX Design');
    else if (designationText.includes('ai') || designationText.includes('machine learning')) result.push('Generative AI');
    else if (designationText.includes('hr') || (emp?.department || '').toLowerCase().includes('hr')) result.push('HR Operations');
    else if (isExecutiveOrLeadership(emp) || designationText.includes('architect')) result.push('Solution Architecture');
    else if (designationText.includes('director')) result.push('Project Management');
    else if (emp?.department === 'IT' || emp?.department === 'Engineering') result.push('Full Stack Development');
    else result.push('Full Stack Development');
  }

  return result;
};

const hasTitle = (title: string, ...words: string[]) =>
  new RegExp('\\b(' + words.join('|') + ')\\b').test(title);

const ROLE_FILTERS = [
  { label: 'ALL', key: 'ALL', match: () => true },
  { label: 'CEO', key: 'CEO', match: (e: any) => hasTitle((e.designation || '').toLowerCase(), 'ceo', 'chief executive') },
  { label: 'CTO/MD', key: 'CTO', match: (e: any) => hasTitle((e.designation || '').toLowerCase(), 'cto', 'cio', 'founder', 'co-?founder', 'chief technology', 'chief information') },
  { label: 'HR',  key: 'HR',  match: (e: any) => e.role === 'HR_ADMIN' || (e.department || '').toLowerCase().includes('hr') || hasTitle((e.designation || '').toLowerCase(), 'hr', 'human resources') },
  { label: 'PM',  key: 'PM',  match: (e: any) => e.role === 'PROJECT_MANAGER' || hasTitle((e.designation || '').toLowerCase(), 'project manager', 'program manager') },
  { label: 'Tech Leads', key: 'TL', match: (e: any) => isAuthorizedTechLead(e) || (e.role as string) === 'TECH_LEAD' || hasTitle((e.designation || '').toLowerCase(), 'tech lead', 'technical lead') },
];

export const EmployeeTeamDirectory: React.FC = () => {
  const { employees } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [specializationFilter, setSpecializationFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [selectedColleague, setSelectedColleague] = useState<Employee | null>(null);

  // Extract unique departments
  const rawDepts = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  const isExecutiveLeadership = (emp: any) => isExecutiveOrLeadership(emp);

  const copyToClipboard = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => {
      setCopiedEmail(prev => prev === email ? null : prev);
    }, 2000);
  };

  // Filter logic: role tab takes priority over dept tab
  const allFilteredMembers = useMemo(() => {
    return employees.filter(emp => {
      if (!emp.fullName || emp.fullName.trim() === '') return false;
      if (
        emp.id === 'bf41B0ztyefb6OZzO9NykxA9MSz2' ||
        emp.fullName.includes('GHOST') ||
        emp.fullName.includes('[DELETED]') ||
        emp.employeeId?.includes('GHOST')
      ) {
        return false;
      }
      if (emp.status === 'Terminated' || emp.status === 'Inactive') return false;

      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (emp.fullName?.toLowerCase() || '').includes(q) ||
        (emp.designation?.toLowerCase() || '').includes(q) ||
        (emp.department?.toLowerCase() || '').includes(q) ||
        (emp.email?.toLowerCase() || '').includes(q) ||
        (emp.employeeId?.toLowerCase() || '').includes(q) ||
        (emp.phone?.toLowerCase() || '').includes(q);

      if (specializationFilter !== 'ALL') {
        const specs = getDirectorySpecializations(emp.skills || [], emp);
        if (!specs.includes(specializationFilter)) return false;
      }

      if (selectedRole && selectedRole !== 'ALL') {
        const roleFilter = ROLE_FILTERS.find(r => r.key === selectedRole);
        return matchesSearch && (roleFilter?.match(emp as any) ?? false);
      }

      const matchesDept = selectedDept === 'ALL' || (emp.department?.toLowerCase() || '') === selectedDept.toLowerCase();
      return matchesDept && matchesSearch;
    });
  }, [employees, searchTerm, selectedRole, selectedDept, specializationFilter]);

  // Separate standard workforce from CEO & CTO with robust deduplication
  const standardEmployees = useMemo(() => {
    const raw = allFilteredMembers.filter(emp => !isExecutiveLeadership(emp));
    const deduped: Employee[] = [];
    const seen = new Set<string>();
    for (const emp of raw) {
      const key = emp.employeeId?.trim() || (emp.fullName || '').toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(emp);
    }
    return deduped;
  }, [allFilteredMembers]);

  // Executive Leaders with strict deduplication for Akshit Ujjain & C-Suite
  const executiveLeaders = useMemo(() => {
    const getExecutiveRank = (emp: any): number => {
      const name = (emp?.fullName || '').toLowerCase();
      const id = (emp?.employeeId || '').toLowerCase();
      const execRole = (emp?.executiveRole || '').toUpperCase();

      // 1. Gaurav Sir is FIRST (Left side: CTO / Founder)
      if (name.includes('gaurav') || id === 'kss2407001' || execRole === 'CTO') {
        return 1;
      }

      // 2. Akshit Sir is SECOND (Right side: CEO)
      if (name.includes('akshit') || id === 'kss2407002' || id === 'ceo001' || execRole === 'CEO') {
        return 2;
      }

      const so = Number(emp?.sortOrder);
      if (!isNaN(so) && so > 0) return so + 2;

      return 99;
    };

    const base = (selectedRole === 'ALL' || !selectedRole)
      ? employees.filter(emp => isExecutiveLeadership(emp))
      : allFilteredMembers.filter(emp => isExecutiveLeadership(emp));

    const dedupedExecs: Employee[] = [];
    const seenExecKeys = new Set<string>();

    for (const exec of base) {
      const nameLower = (exec.fullName || '').toLowerCase().trim();
      // Unify any variant of Akshit Ujjain so it can NEVER duplicate
      const key = nameLower.includes('akshit')
        ? 'exec-akshit-ceo'
        : (exec.employeeId?.trim() || nameLower || exec.id);

      if (seenExecKeys.has(key)) {
        if (nameLower.includes('akshit')) {
          const idx = dedupedExecs.findIndex(e => (e.fullName || '').toLowerCase().includes('akshit'));
          // Prefer canonical record
          if (idx !== -1 && (exec.id === 'emp-KSS2407002' || (exec.email || '').includes('akshit.ujjain'))) {
            dedupedExecs[idx] = exec;
          }
        }
        continue;
      }
      seenExecKeys.add(key);
      dedupedExecs.push(exec);
    }

    return dedupedExecs.sort((a, b) => {
      const diff = getExecutiveRank(a) - getExecutiveRank(b);
      if (diff !== 0) return diff;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [employees, allFilteredMembers, selectedRole]);

  const handleRoleClick = (key: string) => {
    if (key === 'ALL') {
      setSelectedRole(null);
      setSelectedDept('ALL');
    } else {
      setSelectedRole(prev => prev === key ? null : key);
      setSelectedDept('ALL');
    }
  };

  const getRoleBadge = (emp: any) => {
    const desig = (emp.designation || '').toLowerCase();
    const dept = (emp.department || '').toLowerCase();

    if (hasTitle(desig, 'ceo', 'chief executive'))
      return { label: 'CEO', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-black' };
    if (hasTitle(desig, 'cto', 'cio', 'founder', 'co-?founder', 'chief technology', 'chief information'))
      return { label: 'CTO / MD / Founder', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-black' };
    if (emp.role === 'HR_ADMIN' || dept.includes('hr') || hasTitle(desig, 'hr', 'human resources'))
      return { label: 'HR Lead', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30 font-bold' };
    if (emp.role === 'PROJECT_MANAGER' || hasTitle(desig, 'project manager'))
      return { label: 'Project Manager', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold' };
    if (isAuthorizedTechLead(emp) || (emp.role as string) === 'TECH_LEAD' || hasTitle(desig, 'tech lead', 'technical lead'))
      return { label: 'Tech Lead', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-bold' };
    return null;
  };

  const activeFiltersCount = (selectedRole ? 1 : 0) + (selectedDept !== 'ALL' ? 1 : 0) + (specializationFilter !== 'ALL' ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedDept('ALL');
    setSelectedRole(null);
    setSpecializationFilter('ALL');
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 pb-16">
      
      {/* ── 1. HERO & TOP METRICS HEADER ──────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-blue-950/40 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Kalpanaaa Corporate Directory</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Users className="w-7 h-7 text-blue-400" />
              <span>Team Directory</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
              Discover, connect, and collaborate with your colleagues across departments, engineering branches, and leadership.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-center min-w-[100px] shadow-inner">
              <div className="text-xl font-black text-white">{employees.length}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Total Members</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-center min-w-[100px] shadow-inner">
              <div className="text-xl font-black text-emerald-400 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {employees.filter(e => e.status !== 'Terminated' && e.status !== 'Inactive').length}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Active Now</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-center min-w-[100px] shadow-inner">
              <div className="text-xl font-black text-blue-400">{rawDepts.length}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Departments</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-center min-w-[100px] shadow-inner">
              <div className="text-xl font-black text-amber-400 flex items-center justify-center gap-1">
                <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                {executiveLeaders.length}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Leadership</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. SEARCH, CONTROLS & FILTER BAR ────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-md space-y-4">
        
        {/* Top Control Row: Search + View Switcher */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search colleagues by name, role, department, email or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all shadow-inner"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-md"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            {/* Clear All Filters button if active */}
            {activeFiltersCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="h-10 px-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Control Row: Role Tabs + Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800/60">
          
          {/* Role Filter Chips */}
          <div className="flex items-center flex-wrap gap-1.5">
            {ROLE_FILTERS.map(rf => {
              const count = rf.key === 'ALL' ? employees.length : employees.filter(rf.match).length;
              const isSelected = (rf.key === 'ALL' && selectedRole === null && selectedDept === 'ALL') || selectedRole === rf.key;

              return (
                <button
                  key={rf.key}
                  onClick={() => handleRoleClick(rf.key)}
                  className={`h-8 px-3 rounded-xl text-xs font-bold border transition-all shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                      : 'bg-slate-950/70 text-slate-400 border-slate-800/80 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <span>{rf.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${isSelected ? 'bg-blue-500/40 text-white' : 'bg-slate-800/80 text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block mx-1" />

          {/* Department Select Dropdown */}
          <div className="relative shrink-0 w-44 sm:w-48 h-8">
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedRole ? 'ALL' : selectedDept}
              onChange={e => {
                setSelectedDept(e.target.value);
                setSelectedRole(null);
              }}
              className="w-full h-full appearance-none bg-slate-950/80 border border-slate-800 text-white text-xs font-bold pl-8 pr-8 rounded-xl cursor-pointer focus:outline-hidden focus:border-blue-500 transition-all shadow-sm truncate leading-none"
            >
              <option value="ALL">All Departments</option>
              {rawDepts.map(dept => (
                <option key={dept} value={dept} className="bg-slate-950 text-slate-200">
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Specialization Select Dropdown */}
          <div className="relative shrink-0 w-48 sm:w-56 h-8">
            <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={specializationFilter}
              onChange={e => setSpecializationFilter(e.target.value)}
              className="w-full h-full appearance-none bg-slate-950/80 border border-slate-800 text-white text-xs font-bold pl-8 pr-8 rounded-xl cursor-pointer focus:outline-hidden focus:border-blue-500 transition-all shadow-sm truncate leading-none"
            >
              <option value="ALL">All Specializations</option>
              {SPEC_GROUPS.map(grp => (
                <optgroup key={grp.color} label={grp.items[0]} className="bg-slate-900 font-bold text-slate-400">
                  {grp.items.map(item => (
                    <option key={item} value={item} className="bg-slate-950 text-white font-medium">
                      {item}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Active Specialization Tag Banner */}
        {specializationFilter !== 'ALL' && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-400 font-medium">Filtered by Domain:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
              <Layers className="w-3 h-3" />
              <span>{specializationFilter}</span>
              <button
                onClick={() => setSpecializationFilter('ALL')}
                className="hover:text-white cursor-pointer ml-1 p-0.5"
                title="Clear Filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* ── 3. MAIN WORKFORCE SECTION ────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Workforce Members
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {standardEmployees.length}
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Click on any member to view full details
          </span>
        </div>

        {/* GRID VIEW */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {standardEmployees.map((member, idx) => {
              const roleBadge = getRoleBadge(member);
              const specs = getDirectorySpecializations(member.skills || [], member);
              const deptDisplay = (member.role === 'PROJECT_MANAGER' || (member.designation || '').toLowerCase().includes('project manager') || member.employeeId === 'KSS2407003' || (member.fullName || '').toLowerCase().includes('koushik'))
                ? 'IT'
                : (member.department || '—');
              const isSatyaMember = member.employeeId === 'KSS2407012' || (member.fullName && (member.fullName.toLowerCase().includes('satya') || member.fullName.toLowerCase().includes('ranjan')));
              const desigDisplay = (member.fullName && (member.fullName.toLowerCase().includes('jigyansha') || member.fullName.toLowerCase().includes('jingyasha')))
                ? 'AI/ML Developer'
                : isSatyaMember
                ? 'Software Engineer'
                : (member.designation || '—');
              const managerDisplay = member.reportingManager || 'D. Koushik';

              return (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.2 }}
                  key={member.id}
                  onClick={() => setSelectedColleague(member)}
                  className="group relative bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-slate-950/90 rounded-2xl border border-slate-800/80 p-5 shadow-lg hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-950/30 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar with Status Pulse */}
                    <div className="relative shrink-0">
                      <img
                        src={member.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName || 'User')}&background=0f172a&color=fff`}
                        alt={member.fullName}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700/80 group-hover:border-blue-500/80 transition-all shadow-md group-hover:scale-105"
                      />
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 absolute -bottom-0.5 -right-0.5 shadow-sm" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-white truncate group-hover:text-blue-300 transition-colors" title={member.fullName}>
                          {member.fullName}
                        </h3>
                        {roleBadge && (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase border shrink-0 ${roleBadge.color}`}>
                            {roleBadge.label}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-300 truncate" title={desigDisplay}>
                        {desigDisplay}
                      </p>

                      <div className="text-[10px] text-slate-400 font-mono">
                        {member.employeeId || 'KSS-EMP'}
                      </div>
                    </div>
                  </div>

                  {/* Specializations Tags */}
                  {specs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {specs.slice(0, 3).map(s => (
                        <span key={s} className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${getDirectorySpecColor(s)}`}>
                          {s}
                        </span>
                      ))}
                      {specs.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          +{specs.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Metadata and Contact Actions */}
                  <div className="space-y-2 text-xs font-medium text-slate-400 border-t border-slate-800/80 pt-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 truncate" title={`Department: ${deptDisplay}`}>
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 group-hover:text-blue-400 transition-colors" />
                        <span className="truncate">{deptDisplay}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 font-semibold truncate max-w-[140px]" title={`Manager: ${managerDisplay}`}>
                        <span className="text-[10px] text-slate-500 uppercase font-mono">Lead:</span>
                        <span className="text-slate-300 truncate">{managerDisplay}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      {/* Email Link & Quick Copy */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0 group-hover:text-blue-400 transition-colors" />
                        <a
                          href={`mailto:${member.email}`}
                          onClick={e => e.stopPropagation()}
                          className="truncate text-[11px] hover:text-blue-300 hover:underline transition-colors"
                          title={member.email}
                        >
                          {member.email}
                        </a>
                        {member.email && (
                          <button
                            onClick={(e) => copyToClipboard(member.email!, e)}
                            className="p-1 text-slate-500 hover:text-white rounded-md hover:bg-slate-800 transition-all cursor-pointer shrink-0"
                            title="Copy Email"
                          >
                            {copiedEmail === member.email ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Phone Link */}
                      {member.phone && (
                        <a
                          href={`tel:${member.phone}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 bg-slate-800/60 hover:bg-blue-600 hover:text-white text-slate-400 rounded-lg transition-all shrink-0"
                          title={`Call ${member.phone}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === 'list' && (
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Member</th>
                    <th className="py-3.5 px-4">Role &amp; Designation</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Reporting Lead</th>
                    <th className="py-3.5 px-4">Specialization</th>
                    <th className="py-3.5 px-4 text-center">Contact</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {standardEmployees.map((member) => {
                    const roleBadge = getRoleBadge(member);
                    const specs = getDirectorySpecializations(member.skills || [], member);
                    const deptDisplay = (member.role === 'PROJECT_MANAGER' || (member.designation || '').toLowerCase().includes('project manager') || member.employeeId === 'KSS2407003' || (member.fullName || '').toLowerCase().includes('koushik'))
                      ? 'IT'
                      : (member.department || '—');
                    const isSatyaMember = member.employeeId === 'KSS2407012' || (member.fullName && (member.fullName.toLowerCase().includes('satya') || member.fullName.toLowerCase().includes('ranjan')));
                    const desigDisplay = (member.fullName && (member.fullName.toLowerCase().includes('jigyansha') || member.fullName.toLowerCase().includes('jingyasha')))
                      ? 'AI/ML Developer'
                      : isSatyaMember
                      ? 'Software Engineer'
                      : (member.designation || '—');
                    const managerDisplay = member.reportingManager || 'D. Koushik';

                    return (
                      <tr
                        key={member.id}
                        onClick={() => setSelectedColleague(member)}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <img
                                src={member.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName || 'User')}&background=0f172a&color=fff`}
                                alt={member.fullName}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                              />
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950 absolute -bottom-0.5 -right-0.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white group-hover:text-blue-300 transition-colors">
                                {member.fullName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {member.employeeId || 'KSS-EMP'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-300">{desigDisplay}</div>
                            {roleBadge && (
                              <span className={`inline-block px-2 py-0.2 rounded text-[9px] font-black uppercase border ${roleBadge.color}`}>
                                {roleBadge.label}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-300 font-medium">
                          {deptDisplay}
                        </td>

                        <td className="py-3 px-4 text-slate-300 font-semibold">
                          {managerDisplay}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {specs.slice(0, 2).map(s => (
                              <span key={s} className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${getDirectorySpecColor(s)}`}>
                                {s}
                              </span>
                            ))}
                            {specs.length > 2 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                                +{specs.length - 2}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {member.email && (
                              <a
                                href={`mailto:${member.email}`}
                                onClick={e => e.stopPropagation()}
                                className="p-1.5 bg-slate-800/80 hover:bg-blue-600 hover:text-white text-slate-400 rounded-lg transition-all"
                                title={`Email: ${member.email}`}
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {member.phone && (
                              <a
                                href={`tel:${member.phone}`}
                                onClick={e => e.stopPropagation()}
                                className="p-1.5 bg-slate-800/80 hover:bg-emerald-600 hover:text-white text-slate-400 rounded-lg transition-all"
                                title={`Call: ${member.phone}`}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedColleague(member);
                            }}
                            className="px-2.5 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-blue-500 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {standardEmployees.length === 0 && (
          <div className="py-14 text-center border-2 border-slate-800 border-dashed rounded-3xl bg-slate-900/40 p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 opacity-70" />
            </div>
            <h3 className="text-base font-bold text-white">No team members found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              We couldn't find any team members matching your current search or filter criteria.
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 4. EXECUTIVE SEPARATION LINE ────────────────────────── */}
      <div className="relative py-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t-2 border-amber-500/20" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-950 px-6 py-1.5 rounded-full border-2 border-amber-500/40 text-xs font-black text-amber-300 uppercase tracking-widest flex items-center gap-2 shadow-2xl shadow-amber-950/60">
            <Crown className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
            <span>Executive Directorate &amp; C-Suite Office</span>
          </span>
        </div>
      </div>

      {/* ── 5. EXECUTIVE DIRECTORATE SECTION (Strictly Deduplicated) ─ */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/30 rounded-3xl border-2 border-amber-500/30 p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Executive Leadership &amp; Board of Directors
              </h2>
              <p className="text-xs text-slate-400">
                Founders, Chief Executive Office, and Strategic Directorate ({executiveLeaders.length} Members)
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full shrink-0 self-start sm:self-auto">
            Official Leadership Roster
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {executiveLeaders.map((exec) => (
            <div
              key={exec.id}
              onClick={() => setSelectedColleague(exec)}
              className="bg-slate-950/90 rounded-2xl border-2 border-amber-500/30 p-5 shadow-xl flex items-start gap-4 hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-950/30 transition-all duration-300 group relative overflow-hidden cursor-pointer"
            >
              <div className="relative shrink-0">
                <img
                  src={exec.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(exec.fullName)}&background=1e1e2e&color=fff`}
                  alt={exec.fullName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/60 shadow-lg shadow-amber-950/50 group-hover:scale-105 transition-all"
                />
                <span className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-1 shadow-md">
                  <Star className="w-3 h-3 text-white fill-white" />
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-black text-white group-hover:text-amber-300 transition-colors truncate">
                      {exec.fullName}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                      {exec.designation || 'Executive Leadership'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5 font-mono">
                    {exec.employeeId || 'KSS-EXEC'} • {exec.department || 'Executive Office'}
                  </p>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-2 font-medium">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                      <a
                        href={`mailto:${exec.email}`}
                        onClick={e => e.stopPropagation()}
                        className="truncate hover:text-amber-300 hover:underline transition-colors"
                      >
                        {exec.email}
                      </a>
                    </div>
                    {exec.email && (
                      <button
                        onClick={(e) => copyToClipboard(exec.email!, e)}
                        className="p-1 text-slate-500 hover:text-amber-300 rounded-md hover:bg-slate-800 transition-all cursor-pointer shrink-0"
                        title="Copy Email"
                      >
                        {copiedEmail === exec.email ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                    <a
                      href={`tel:${exec.phone || '+919876543210'}`}
                      onClick={e => e.stopPropagation()}
                      className="hover:text-amber-300 hover:underline transition-colors"
                    >
                      {exec.phone || '+91 98765 43210'}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. INTERACTIVE PROFILE DETAILS MODAL ─────────────────── */}
      <AnimatePresence>
        {selectedColleague && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden relative"
            >
              {/* Top Banner */}
              <div className="h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative p-4 flex justify-end">
                <button
                  onClick={() => setSelectedColleague(null)}
                  className="w-8 h-8 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile Card Body */}
              <div className="px-6 pb-6 pt-0 relative space-y-5">
                {/* Avatar Overlap */}
                <div className="flex items-end justify-between -mt-12">
                  <div className="relative">
                    <img
                      src={selectedColleague.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedColleague.fullName || 'User')}&background=0f172a&color=fff`}
                      alt={selectedColleague.fullName}
                      className="w-24 h-24 rounded-2xl object-cover border-4 border-slate-900 shadow-xl"
                    />
                    <span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 absolute bottom-1 right-1" />
                  </div>

                  <div className="space-y-1 text-right">
                    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-800 text-blue-400 border border-slate-700">
                      {selectedColleague.employeeId || 'KSS-EMP'}
                    </span>
                    <div className="text-[11px] text-slate-400 font-semibold">
                      {(selectedColleague.employeeId === 'KSS2407012' || (selectedColleague.fullName && (selectedColleague.fullName.toLowerCase().includes('satya') || selectedColleague.fullName.toLowerCase().includes('ranjan'))))
                        ? 'Software Engineer'
                        : (selectedColleague.employmentType || 'Full-Time')}
                    </div>
                  </div>
                </div>

                {/* Name & Title */}
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <span>{selectedColleague.fullName}</span>
                    {isExecutiveLeadership(selectedColleague) && (
                      <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                    )}
                  </h3>
                  <p className="text-sm font-semibold text-slate-300 mt-0.5">
                    {(selectedColleague.employeeId === 'KSS2407012' || (selectedColleague.fullName && (selectedColleague.fullName.toLowerCase().includes('satya') || selectedColleague.fullName.toLowerCase().includes('ranjan'))))
                      ? 'Software Engineer'
                      : (selectedColleague.designation || 'Staff Member')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedColleague.department || 'Department'} • Reporting to{' '}
                    <strong className="text-slate-200">{selectedColleague.reportingManager || 'D. Koushik'}</strong>
                  </p>
                </div>

                {/* Specializations & Skills */}
                <div className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Domain Specializations &amp; Skills</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {getDirectorySpecializations(selectedColleague.skills || [], selectedColleague).map(spec => (
                      <span key={spec} className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getDirectorySpecColor(spec)}`}>
                        {spec}
                      </span>
                    ))}
                    {(selectedColleague.skills || []).map(sk => {
                      if (getDirectorySpecializations(selectedColleague.skills || [], selectedColleague).includes(sk)) return null;
                      return (
                        <span key={sk} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {sk}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Contact Grid */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Official Contact Channels
                  </span>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate text-slate-300">
                        <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="truncate">{selectedColleague.email || 'N/A'}</span>
                      </div>
                      {selectedColleague.email && (
                        <button
                          onClick={(e) => copyToClipboard(selectedColleague.email!, e)}
                          className="px-2 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer shrink-0 flex items-center gap-1"
                        >
                          {copiedEmail === selectedColleague.email ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>{selectedColleague.phone || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{selectedColleague.workLocation || 'Kalpanaaa Main Office HQ, Bengaluru'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{selectedColleague.shift || 'Day Shift (10:00 - 19:30)'}</span>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center gap-3 pt-2">
                  {selectedColleague.email && (
                    <a
                      href={`mailto:${selectedColleague.email}`}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-center text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/30"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Send Corporate Email</span>
                    </a>
                  )}
                  {selectedColleague.phone && (
                    <a
                      href={`tel:${selectedColleague.phone}`}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-center text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Call</span>
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
