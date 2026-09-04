import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Phone, Building2, Search, Users, ChevronDown, Star, Crown, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { isExecutiveOrLeadership } from '../../lib/attendanceEngine';

/**
 * Whole-word title test. `includes()` cannot be used against `designation`:
 * it is a free-text field, and "Contractor" contains "cto" while
 * "Coordinator" contains "coo" -- both were landing in the CTO/MD tab and
 * wearing an executive badge.
 */
const hasTitle = (desig: string, ...words: string[]) =>
  new RegExp('\\b(' + words.join('|') + ')\\b').test(desig);

const ROLE_FILTERS = [
  { label: 'ALL', key: 'ALL', match: () => true },
  { label: 'CEO', key: 'CEO', match: (e: any) => hasTitle((e.designation || '').toLowerCase(), 'ceo', 'chief executive') },
  { label: 'CTO/MD', key: 'CTO', match: (e: any) => hasTitle((e.designation || '').toLowerCase(), 'cto', 'cio', 'founder', 'co-?founder', 'chief technology', 'chief information') },
  { label: 'HR',  key: 'HR',  match: (e: any) => e.role === 'HR_ADMIN' || (e.department || '').toLowerCase().includes('hr') || hasTitle((e.designation || '').toLowerCase(), 'hr', 'human resources') },
  { label: 'PM',  key: 'PM',  match: (e: any) => e.role === 'PROJECT_MANAGER' || hasTitle((e.designation || '').toLowerCase(), 'project manager', 'program manager') },
];

export const EmployeeTeamDirectory: React.FC = () => {
  const { employees } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Extract unique departments
  const rawDepts = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  // Shared with payroll, the admin directory and every dashboard so all five
  // surfaces agree on who is leadership.
  const isExecutiveLeadership = (emp: any) => isExecutiveOrLeadership(emp);

  // Filter logic: role tab takes priority over dept tab
  const allFilteredMembers = useMemo(() => {
    return employees.filter(emp => {
      if (!emp.fullName || emp.fullName.trim() === '') return false;
      if (emp.status === 'Terminated' || emp.status === 'Inactive') return false;

      const matchesSearch =
        (emp.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (emp.designation?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (emp.department?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (emp.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (emp.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      if (selectedRole && selectedRole !== 'ALL') {
        const roleFilter = ROLE_FILTERS.find(r => r.key === selectedRole);
        return matchesSearch && (roleFilter?.match(emp as any) ?? false);
      }

      const matchesDept = selectedDept === 'ALL' || (emp.department?.toLowerCase() || '') === selectedDept.toLowerCase();
      return matchesDept && matchesSearch;
    });
  }, [employees, searchTerm, selectedRole, selectedDept]);

  // Separate standard workforce from CEO & CTO
  const standardEmployees = useMemo(() => {
    return allFilteredMembers.filter(emp => !isExecutiveLeadership(emp));
  }, [allFilteredMembers]);

  const executiveLeaders = useMemo(() => {
    const getExecutiveRank = (emp: any): number => {
      const name = (emp?.fullName || '').toLowerCase();
      const id = (emp?.employeeId || '').toLowerCase();
      const execRole = (emp?.executiveRole || '').toUpperCase();

      // 1. Gaurav Sir is FIRST (Left side: CTO / Founder)
      if (
        name.includes('gaurav') ||
        id === 'kss2407001' ||
        execRole === 'CTO'
      ) {
        return 1;
      }

      // 2. Akshit Sir is SECOND (Right side: CEO)
      if (
        name.includes('akshit') ||
        id === 'kss2407002' ||
        id === 'ceo001' ||
        execRole === 'CEO'
      ) {
        return 2;
      }

      const so = Number(emp?.sortOrder);
      if (!isNaN(so) && so > 0) return so + 2;

      return 99;
    };

    // When searching or filtering by ALL, keep the executives list in the footer
    const base = (selectedRole === 'ALL' || !selectedRole)
      ? employees.filter(emp => isExecutiveLeadership(emp))
      : allFilteredMembers.filter(emp => isExecutiveLeadership(emp));

    return base.sort((a, b) => {
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
      return { label: 'HR Lead', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' };
    if (emp.role === 'PROJECT_MANAGER' || hasTitle(desig, 'project manager'))
      return { label: 'PM', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Team Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">Connect with your colleagues ({allFilteredMembers.length} team members)</p>
        </div>
        
        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, role, department..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center flex-wrap gap-2.5">
        {ROLE_FILTERS.map(rf => {
          const count = rf.key === 'ALL' ? employees.length : employees.filter(rf.match).length;
          const isSelected = (rf.key === 'ALL' && selectedRole === null && selectedDept === 'ALL') || selectedRole === rf.key;

          return (
            <button
              key={rf.key}
              onClick={() => handleRoleClick(rf.key)}
              className={`h-9 px-4 rounded-xl text-xs font-bold border transition-all shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/30'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800/90'
              }`}
            >
              <span>{rf.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${isSelected ? 'bg-blue-500/40 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}

        {/* Department Select Dropdown */}
        <div className="relative shrink-0 w-48 sm:w-52 h-9">
          <select
            value={selectedRole ? 'ALL' : selectedDept}
            onChange={e => {
              setSelectedDept(e.target.value);
              setSelectedRole(null);
            }}
            className="w-full h-full appearance-none bg-slate-900/80 border border-slate-800 text-white text-xs font-bold pl-4 pr-8 rounded-xl cursor-pointer focus:outline-hidden focus:border-blue-500 transition-all shadow-sm truncate leading-none"
          >
            <option value="ALL">All Departments</option>
            {rawDepts.map(dept => (
              <option key={dept} value={dept} className="bg-slate-950 text-slate-200">
                {dept}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ── 1. MAIN WORKFORCE SECTION (Top to Bottom) ───────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Workforce Members ({standardEmployees.length})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {standardEmployees.map((member, idx) => {
            const roleBadge = getRoleBadge(member);
            return (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02, duration: 0.2 }}
                key={member.id}
                className="bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 rounded-2xl border border-slate-800/80 p-5 shadow-lg flex items-start gap-4 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-950/20 transition-all duration-300 group relative overflow-hidden"
              >
                <div className="relative shrink-0">
                  <img
                    src={member.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName || 'User')}&background=0f172a&color=fff`}
                    alt={member.fullName}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700/80 group-hover:border-blue-500/60 transition-all shadow-md"
                  />
                  <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 absolute -bottom-0.5 -right-0.5" />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 min-h-[22px]">
                      <h3 className="text-sm font-black text-white truncate group-hover:text-blue-300 transition-colors" title={member.fullName}>
                        {member.fullName}
                      </h3>
                      {roleBadge && (
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase border shrink-0 ${roleBadge.color}`}>
                          {roleBadge.label}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-400 truncate mt-0.5" title={member.designation}>
                      {member.designation}
                    </p>
                  </div>

                  <div className="space-y-1.5 text-[11px] font-medium text-slate-400 border-t border-slate-800/60 pt-2">
                    <div className="flex items-center gap-2 truncate" title={member.department}>
                      <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-500 group-hover:text-blue-400 transition-colors" />
                      <span className="truncate">{member.department}</span>
                    </div>

                    <div className="flex items-center gap-2 truncate" title={member.email}>
                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-500 group-hover:text-blue-400 transition-colors" />
                      <a href={`mailto:${member.email}`} className="truncate hover:text-blue-300 hover:underline transition-colors">
                        {member.email}
                      </a>
                    </div>

                    <div className="flex items-center gap-2 truncate" title={member.phone}>
                      <Phone className="w-3.5 h-3.5 shrink-0 text-slate-500 group-hover:text-blue-400 transition-colors" />
                      <a href={member.phone ? `tel:${member.phone}` : undefined} className="truncate hover:text-blue-300 transition-colors">
                        {member.phone || 'N/A'}
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {standardEmployees.length === 0 && (
          <div className="py-12 text-center text-slate-400 border border-slate-800 border-dashed rounded-2xl bg-slate-900/40">
            <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="text-xs font-bold text-slate-300">No workforce personnel match this filter.</p>
          </div>
        )}
      </div>

      {/* ── 2. HIGHLIGHTED SEPARATION LINE ──────────────────────── */}
      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t-2 border-gradient-to-r from-amber-500/20 via-blue-500/50 to-purple-500/20 shadow-lg shadow-blue-500/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-950 px-5 py-1.5 rounded-full border-2 border-blue-500/40 text-xs font-black text-blue-300 uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-950/60">
            <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Executive Leadership &amp; Founders</span>
          </span>
        </div>
      </div>

      {/* ── 3. FIXED CEO & CTO FOOTER SECTION ────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/30 rounded-3xl border-2 border-amber-500/30 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Executive Directorate &amp; C-Suite Office
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-0.5 rounded-full">
            Fixed Executive Section
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {executiveLeaders.map((exec) => (
            <div
              key={exec.id}
              className="bg-slate-950/90 rounded-2xl border-2 border-amber-500/30 p-5 shadow-xl flex items-start gap-4 hover:border-amber-400 transition-all group relative overflow-hidden"
            >
              <div className="relative shrink-0">
                <img
                  src={exec.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(exec.fullName)}&background=1e1e2e&color=fff`}
                  alt={exec.fullName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/60 shadow-lg shadow-amber-950/50"
                />
                <span className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-1 shadow-md">
                  <Star className="w-3 h-3 text-white fill-white" />
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-black text-white group-hover:text-amber-300 transition-colors truncate">
                      {exec.fullName}
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                      {exec.designation || 'Executive Leadership'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5 font-mono">
                    {exec.employeeId || 'KSS-EXEC'} • {exec.department || 'Executive Office'}
                  </p>
                </div>

                <div className="space-y-1 text-xs text-slate-400 border-t border-slate-800/80 pt-2 font-medium">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                    <span className="truncate">{exec.email}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                    <span>{exec.phone || '+91 98765 43210'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
