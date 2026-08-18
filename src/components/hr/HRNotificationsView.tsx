import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'framer-motion';
import { 
  Bell, 
  Search, 
  Filter, 
  CheckCheck, 
  Clock, 
  User, 
  ShieldCheck, 
  Megaphone,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { notificationIcon, notificationColor, NotificationEventType } from '../../lib/notifications';

export const HRNotificationsView: React.FC = () => {
  const { notifications, markAllNotificationsRead, role, activeEmployee } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');

  const effectiveRole = activeEmployee?.role || role;
  const isEmployee = effectiveRole === 'EMPLOYEE';
  const categories = isEmployee 
    ? ['ALL', 'ATTENDANCE', 'APPROVALS', 'BROADCASTS'] 
    : ['ALL', 'ATTENDANCE', 'APPROVALS', 'PAYROLL', 'BROADCASTS', 'SYSTEM'];

  const visibleNotifications = notifications.filter(n => {
    if (!n.audience) return false;
    if (n.audience.includes('ALL')) return true;
    if (n.audience.includes(effectiveRole as any) || n.audience.includes(role as any)) return true;
    if (effectiveRole === 'EMPLOYEE') {
      const isMyRecord = n.targetEmployeeId === activeEmployee?.id || n.targetEmployeeId === activeEmployee?.employeeId;
      // Own resolved leave/WFH sanctions
      if ((n as any).isPersonalSanction && isMyRecord) return true;
      // Own attendance events
      if ((n as any).isOwnAttendance && isMyRecord) return true;
    }
    return false;
  });

  const filteredNotifications = visibleNotifications.filter(n => {
    const matchesSearch = 
      (n.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.body || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.actorName || '').toLowerCase().includes(searchTerm.toLowerCase());

    let matchesCategory = true;
    if (selectedCategory === 'ATTENDANCE') {
      matchesCategory = n.type.startsWith('ATTENDANCE');
    } else if (selectedCategory === 'APPROVALS') {
      matchesCategory = n.type.includes('LEAVE') || n.type.includes('WFH');
    } else if (selectedCategory === 'PAYROLL') {
      matchesCategory = n.type === 'PAYROLL_RUN';
    } else if (selectedCategory === 'BROADCASTS') {
      // Real admin broadcasts + Office-Wide WFH announcements (id starts with notif-office-wfh)
      matchesCategory = n.type === 'ADMIN_BROADCAST' || n.type === 'BROADCAST' || (n.id || '').startsWith('notif-office-wfh');
    } else if (selectedCategory === 'SYSTEM') {
      matchesCategory = n.type.includes('SECURITY') || n.type.includes('SYSTEM') || n.type.includes('EMPLOYEE');
    }

    let matchesStatus = true;
    if (statusFilter === 'UNREAD') matchesStatus = !n.isRead;
    if (statusFilter === 'READ') matchesStatus = !!n.isRead;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rose':    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'amber':   return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'blue':    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'purple':  return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 pb-28 md:pb-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400 shrink-0" />
            <span>Complete Notification Feed &amp; Audit Log</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            View full historical feed of operational alerts, check-ins, leave sanctions, and admin broadcasts.
          </p>
        </div>

        <button
          onClick={markAllNotificationsRead}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40 w-full sm:w-auto shrink-0"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Mark All Notifications as Read</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 backdrop-blur-md">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notification title, details, or actor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-slate-500"
          />
        </div>

        {/* Category Filters: Mobile Select Dropdown & Desktop Pills */}
        <div className="w-full sm:w-auto">
          {/* Mobile Select Dropdown (<640px) */}
          <div className="flex sm:hidden items-center gap-2.5 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl shadow-inner w-full">
            <Filter className="w-4 h-4 text-blue-400 shrink-0" />
            <label htmlFor="notif-category-filter" className="text-xs font-bold text-slate-300 shrink-0">Category:</label>
            <select
              id="notif-category-filter"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:border-blue-500 focus:outline-hidden cursor-pointer w-full"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat} Notifications</option>
              ))}
            </select>
          </div>

          {/* Desktop Pills (>=640px) */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold overflow-x-auto custom-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-center ${
                  selectedCategory === cat ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl divide-y divide-slate-800/80 backdrop-blur-md">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Bell className="w-12 h-12 text-slate-700 mx-auto" />
            <h3 className="text-base font-bold text-white">No notifications found</h3>
            <p className="text-xs text-slate-400">There are no notification history records matching your current filter criteria.</p>
          </div>
        ) : (
          filteredNotifications.map((notif, idx) => {
            const icon = notificationIcon(notif.type);
            const color = notificationColor(notif.type);
            const dateStr = notif.createdAt 
              ? new Date(notif.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : 'Just now';

            return (
              <motion.div
                key={notif.id || idx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 sm:p-5 hover:bg-slate-800/40 transition-colors space-y-2.5"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0 border mt-0.5 ${getBadgeColor(color)}`}>
                    {icon}
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Title */}
                    <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-snug break-words">
                      {notif.title}
                    </h4>

                    {/* Meta Row: Type Badge + Timestamp */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 shrink-0">
                        {notif.type}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 shrink-0">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {dateStr}
                      </span>
                    </div>

                    {/* Body text */}
                    <p className="text-xs text-slate-300 leading-relaxed font-medium pt-0.5">
                      {notif.body}
                    </p>

                    {/* Triggered By Actor */}
                    {notif.actorName && (
                      <div className="text-[11px] text-slate-400 font-medium">
                        Triggered by: <span className="text-slate-200 font-semibold">{notif.actorName}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
