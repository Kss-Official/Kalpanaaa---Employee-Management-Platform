import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Mail, Phone, Building2, Search, Users, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

const ROLE_FILTERS = [
  { label: 'ALL', key: 'ALL', match: () => true },
  { label: 'CEO', key: 'CEO', match: (e: any) => (e.designation || '').toLowerCase().includes('ceo') || (e.designation || '').toLowerCase().includes('chief executive') },
  { label: 'CTO/MD', key: 'CTO', match: (e: any) => (e.designation || '').toLowerCase().includes('cto') || (e.designation || '').toLowerCase().includes('founder') || (e.designation || '').toLowerCase().includes('cio') },
  { label: 'HR',  key: 'HR',  match: (e: any) => e.role === 'HR_ADMIN' || (e.department || '').toLowerCase().includes('hr') || (e.designation || '').toLowerCase().includes('hr') },
  { label: 'PM',  key: 'PM',  match: (e: any) => e.role === 'PROJECT_MANAGER' || (e.designation || '').toLowerCase().includes('project manager') || (e.designation || '').toLowerCase().includes('program manager') },
];

export const EmployeeTeamDirectory: React.FC = () => {
  const { employees } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Extract unique departments
  const rawDepts = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  // Filter logic: role tab takes priority over dept tab
  const teamMembers = employees.filter(emp => {
    if (!emp.fullName || emp.fullName.trim() === '') return false;

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

    if (desig.includes('ceo') || desig.includes('chief executive'))
      return { label: 'CEO', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
    if (desig.includes('cto') || desig.includes('founder') || desig.includes('cio'))
      return { label: 'CTO/MD / Founder', color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' };
    if (emp.role === 'HR_ADMIN' || dept.includes('hr') || desig.includes('hr'))
      return { label: 'HR Lead', color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' };
    if (emp.role === 'PROJECT_MANAGER' || desig.includes('project manager'))
      return { label: 'PM', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Team Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">Find and connect with your colleagues ({teamMembers.length} team members)</p>
        </div>
        
        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, role, department..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all shadow-inner"
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
            className="w-full h-full appearance-none bg-slate-900/80 border border-slate-800 text-white text-xs font-bold pl-4 pr-8 rounded-xl cursor-pointer focus:outline-none focus:border-blue-500 transition-all shadow-sm truncate leading-none"
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

      {/* Grid of Team Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {teamMembers.map((member, idx) => {
          const roleBadge = getRoleBadge(member);
          return (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03, duration: 0.25 }}
              key={member.id}
              className="bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 rounded-2xl border border-slate-800/80 p-5 shadow-lg flex items-start gap-4 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-950/20 transition-all duration-300 group relative overflow-hidden"
            >
              {/* Subtle Ambient Radial Glow */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />

              <div className="relative shrink-0">
                <img
                  src={member.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.fullName || 'User')}&background=0f172a&color=fff`}
                  alt={member.fullName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700/80 group-hover:border-blue-500/60 transition-all shadow-md"
                />
                <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 absolute -bottom-0.5 -right-0.5 shadow-xs" title="Active Workforce Member" />
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
      
      {teamMembers.length === 0 && (
        <div className="py-14 text-center text-slate-400 border border-slate-800 border-dashed rounded-2xl bg-slate-900/40">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-60" />
          <p className="text-sm font-bold text-slate-300">No team members match the search query.</p>
          <p className="text-xs mt-1 text-slate-500">Try adjusting your role or department filter.</p>
        </div>
      )}
    </div>
  );
};
