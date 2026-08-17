import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Employee, AttendanceRecord } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  X, 
  UserCheck, 
  UserX, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  FileDown, 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  Coffee
} from 'lucide-react';
import { generateAttendanceReportPdf } from '../../lib/pdfGenerator';

interface EmployeeMonthlyAttendanceModalProps {
  employee: Employee;
  initialSelectedRecord?: AttendanceRecord | null;
  onClose: () => void;
}

export const EmployeeMonthlyAttendanceModal: React.FC<EmployeeMonthlyAttendanceModalProps> = ({ employee, initialSelectedRecord, onClose }) => {
  const { attendance, leaveRequests, settings } = useAuth();

  // Current selected Year-Month (default to initialSelectedRecord month or current month '2026-08')
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => {
    if (initialSelectedRecord?.date) {
      return initialSelectedRecord.date.substring(0, 7);
    }
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedDayRecord, setSelectedDayRecord] = useState<AttendanceRecord | null>(initialSelectedRecord || null);

  const [yearStr, monthStr] = selectedYearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed (1=Jan, 8=Aug)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Number of days in selected month
  const daysInMonth = new Date(year, month, 0).getDate();
  // First day of month (0 = Sun, 1 = Mon, etc.)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  // Filter employee attendance records for this selected year & month
  const empRecords = attendance.filter(rec => {
    const isEmpMatch = rec.employeeId === employee.id || rec.employeeCode === employee.employeeId;
    const isMonthMatch = rec.date && rec.date.startsWith(selectedYearMonth);
    return isEmpMatch && isMonthMatch;
  });

  // Filter approved leave/WFH requests for this employee for this month
  const empLeaveRequests = leaveRequests.filter(req => {
    const isEmpMatch = req.employeeId === employee.employeeId || req.employeeName === employee.fullName;
    const isApproved = req.status === 'Approved';
    const isMonthMatch = req.startDate.startsWith(selectedYearMonth) || req.endDate.startsWith(selectedYearMonth);
    return isEmpMatch && isApproved && isMonthMatch;
  });

  // Build Day Map (keyed by 'YYYY-MM-DD')
  const recordsByDate = new Map<string, AttendanceRecord>();
  empRecords.forEach(rec => {
    if (rec.date) recordsByDate.set(rec.date, rec);
  });

  // Monthly Statistics
  let presentDays = 0;
  let lateDays = 0;
  let wfhDays = 0;
  let leaveDays = 0;
  let totalWorkingMinutes = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateFormatted = `${selectedYearMonth}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();

    const rec = recordsByDate.get(dateFormatted);

    if (rec) {
      if (rec.status === 'Present' || rec.checkInAt) presentDays++;
      if (rec.status === 'Late') lateDays++;
      if (rec.isWfh || rec.status === 'Work From Home') wfhDays++;
      if (rec.workingMinutes) totalWorkingMinutes += rec.workingMinutes;
    } else {
      // Check if approved leave
      const hasLeave = empLeaveRequests.some(l => dateFormatted >= l.startDate && dateFormatted <= l.endDate);
      if (hasLeave) leaveDays++;
    }
  }

  const workingHoursFormatted = `${Math.floor(totalWorkingMinutes / 60)}h ${totalWorkingMinutes % 60}m`;

  const handlePrevMonth = () => {
    let newYear = year;
    let newMonth = month - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setSelectedYearMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    let newYear = year;
    let newMonth = month + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setSelectedYearMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  // Calculate detailed activity & break time breakdown for selected day
  const computeActivityBreakdown = (record: AttendanceRecord) => {
    const breaks = record.breaks || [];
    
    let workingMins = record.workingMinutes || 0;
    let teaBreakMins = 0;
    let mealBreakMins = 0;
    let teamHuddleMins = 0;
    let teamMeetingMins = 0;
    let trainingMins = 0;
    let activityMins = 0;
    let otherBreakMins = 0;

    breaks.forEach(b => {
      const breakEndTime = b.endAt ? new Date(b.endAt).getTime() : Date.now();
      const duration = b.durationMinutes || (b.startAt ? Math.max(1, Math.floor((breakEndTime - new Date(b.startAt).getTime()) / 60000)) : 0);
      const type = b.type;

      if (type === 'Tea Break') teaBreakMins += duration;
      else if (type === 'Meal Break' || (type as string) === 'Lunch Break') mealBreakMins += duration;
      else if (type === 'Team Huddle') teamHuddleMins += duration;
      else if (type === 'Team Meeting') teamMeetingMins += duration;
      else if (type === 'Attainment / Training') trainingMins += duration;
      else if (type === 'Activity') activityMins += duration;
      else otherBreakMins += duration;
    });

    const totalBreakMins = teaBreakMins + mealBreakMins + teamHuddleMins + teamMeetingMins + trainingMins + activityMins + otherBreakMins;
    
    if (workingMins === 0 && record.checkInAt) {
      const shiftEndTime = record.checkOutAt ? new Date(record.checkOutAt).getTime() : Date.now();
      const totalShiftMs = shiftEndTime - new Date(record.checkInAt).getTime();
      const totalShiftMins = Math.max(0, Math.floor(totalShiftMs / 60000));
      workingMins = Math.max(0, totalShiftMins - totalBreakMins);
    }

    const grandTotalMins = workingMins + totalBreakMins;

    return {
      workingMins,
      teaBreakMins,
      mealBreakMins,
      teamHuddleMins,
      teamMeetingMins,
      trainingMins,
      activityMins,
      otherBreakMins,
      totalBreakMins,
      grandTotalMins
    };
  };

  const renderDoughnutChart = (record: AttendanceRecord) => {
    const breakdown = computeActivityBreakdown(record);
    const { grandTotalMins } = breakdown;
    if (grandTotalMins === 0) return null;

    const categories = [
      { label: 'Working Time', mins: breakdown.workingMins, color: '#10b981' },
      { label: 'Tea Break', mins: breakdown.teaBreakMins, color: '#f59e0b' },
      { label: 'Meal Break', mins: breakdown.mealBreakMins, color: '#f43f5e' },
      { label: 'Team Huddle', mins: breakdown.teamHuddleMins, color: '#3b82f6' },
      { label: 'Team Meeting', mins: breakdown.teamMeetingMins, color: '#a855f7' },
      { label: 'Training', mins: breakdown.trainingMins, color: '#06b6d4' },
      { label: 'Activity', mins: breakdown.activityMins, color: '#eab308' },
      { label: 'Other Breaks', mins: breakdown.otherBreakMins, color: '#64748b' },
    ].filter(c => c.mins > 0);

    const radius = 65;
    const strokeWidth = 22;
    const circumference = 2 * Math.PI * radius;

    let currentAngle = 0;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-900 p-5 rounded-2xl border border-slate-800">
        {/* SVG Donut Chart (Matches Screenshot Donut Design) */}
        <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
            <circle cx="80" cy="80" r={radius} fill="transparent" stroke="#1e293b" strokeWidth={strokeWidth} />
            {categories.map((cat, idx) => {
              const strokeDasharray = `${(cat.mins / grandTotalMins) * circumference} ${circumference}`;
              const strokeDashoffset = -currentAngle;
              currentAngle += (cat.mins / grandTotalMins) * circumference;

              return (
                <circle
                  key={idx}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke={cat.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-500 hover:opacity-80"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Shift</span>
            <span className="text-base font-black text-white font-mono">
              {Math.floor(grandTotalMins / 60)}h {grandTotalMins % 60}m
            </span>
          </div>
        </div>

        {/* Legend Breakdown */}
        <div className="flex-1 grid grid-cols-2 gap-2 text-xs w-full">
          {categories.map((cat, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-slate-300 font-semibold truncate">{cat.label}</span>
              </div>
              <span className="font-mono font-bold text-white shrink-0 ml-2">
                {cat.mins >= 60 ? `${Math.floor(cat.mins / 60)}h ${cat.mins % 60}m` : `${cat.mins}m`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderChronologicalTimeline = (record: AttendanceRecord) => {
    const events: { time: string; title: string; subtitle?: string; color: string; icon: string }[] = [];

    if (record.checkInAt) {
      events.push({
        time: new Date(record.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: 'Checked In',
        subtitle: record.isWfh ? 'Work From Home' : record.locationVerified ? 'Office GPS Verified' : 'Standard Check-In',
        color: 'bg-emerald-400',
        icon: '🏢'
      });
    }

    if (record.breaks) {
      record.breaks.forEach((b) => {
        const typeIcons: Record<string, string> = {
          'Tea Break': '🍵',
          'Meal Break': '🍱',
          'Lunch Break': '🍽️',
          'Team Huddle': '👥',
          'Team Meeting': '📅',
          'Attainment / Training': '🎓',
          'Activity': '⚡',
          'Geo-Fence Auto Break': '📍'
        };
        const icon = typeIcons[b.type] || '☕';

        if (b.startAt) {
          events.push({
            time: new Date(b.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: `${b.type} Started`,
            subtitle: 'Employee initiated shift activity',
            color: 'bg-amber-400',
            icon
          });
        }
        if (b.endAt) {
          events.push({
            time: new Date(b.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: `${b.type} Ended`,
            subtitle: `Completed in ${b.durationMinutes || 0} minutes`,
            color: 'bg-blue-400',
            icon
          });
        } else {
          events.push({
            time: 'Active Now',
            title: `${b.type} In Progress`,
            subtitle: 'Ongoing shift activity',
            color: 'bg-amber-400',
            icon
          });
        }
      });
    }

    if (record.checkOutAt) {
      events.push({
        time: new Date(record.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: 'Checked Out',
        subtitle: `Shift completed. Total Worked: ${Math.floor((record.workingMinutes || 0) / 60)}h ${(record.workingMinutes || 0) % 60}m`,
        color: 'bg-purple-400',
        icon: '🚪'
      });
    }

    return (
      <div className="space-y-3 pt-2">
        <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Shift Timeline & Activities Log ("What Happened in the Office")
        </h5>

        {events.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs font-medium">No recorded events for this day.</div>
        ) : (
          <div className="space-y-2 relative border-l-2 border-slate-800 ml-3 pl-4 pt-1">
            {events.map((ev, idx) => (
              <div key={idx} className="relative bg-slate-900 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                <span className={`absolute -left-[23px] w-3 h-3 rounded-full ${ev.color} border-2 border-slate-950`} />
                <div className="flex items-center gap-3">
                  <span className="text-base">{ev.icon}</span>
                  <div>
                    <div className="font-bold text-white">{ev.title}</div>
                    <div className="text-[10px] text-slate-400">{ev.subtitle}</div>
                  </div>
                </div>
                <span className="font-mono text-slate-300 font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">{ev.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-slate-950 p-3.5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <img
                src={employee.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(employee.fullName)}&background=1e293b&color=fff`}
                alt={employee.fullName}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-blue-500/50 shadow-md shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-white truncate max-w-[180px] sm:max-w-none">{employee.fullName}</h2>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20 shrink-0">
                    {employee.employeeId}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate">
                  {employee.designation} • <span className="text-slate-300">{employee.department}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5">
              {/* Export Monthly Report */}
              <button
                onClick={() => generateAttendanceReportPdf(empRecords, settings, `Monthly Attendance Statement — ${employee.fullName} (${selectedYearMonth})`)}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-900/40"
              >
                <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">

            {/* Month Switcher & Monthly Stats Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-slate-950/70 p-3 sm:p-4 rounded-2xl border border-slate-800">
              {/* Month Selector Controls */}
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 sm:p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="text-center min-w-28 sm:min-w-36">
                  <h3 className="text-sm sm:text-base font-black text-white">{monthNames[month - 1]} {year}</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono">Monthly Ledger Summary</p>
                </div>

                <button
                  onClick={handleNextMonth}
                  className="p-1.5 sm:p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 w-full lg:w-auto">
                <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800/80 text-center">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present</span>
                  <span className="text-sm sm:text-lg font-black text-emerald-400 tabular-nums">{presentDays} Days</span>
                </div>
                <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800/80 text-center">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Late</span>
                  <span className="text-sm sm:text-lg font-black text-amber-400 tabular-nums">{lateDays} Days</span>
                </div>
                <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800/80 text-center">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WFH</span>
                  <span className="text-sm sm:text-lg font-black text-blue-400 tabular-nums">{wfhDays} Days</span>
                </div>
                <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800/80 text-center">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Leave</span>
                  <span className="text-sm sm:text-lg font-black text-purple-400 tabular-nums">{leaveDays} Days</span>
                </div>
                <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800/80 text-center col-span-2 sm:col-span-1">
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Hours</span>
                  <span className="text-sm sm:text-lg font-black text-white tabular-nums">{workingHoursFormatted}</span>
                </div>
              </div>
            </div>

            {/* 30/31-Day Attendance Calendar Grid */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1">
                <h4 className="text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
                  <span>Monthly Attendance Calendar Grid ({daysInMonth} Days)</span>
                </h4>
                <div className="flex items-center flex-wrap gap-2 text-[9px] sm:text-[10px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400" /> Present</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400" /> Late</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-400" /> WFH</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-400" /> Leave</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-rose-400" /> Absent</span>
                </div>
              </div>

              {/* Day Headers (Sun - Sat) */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-950 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-slate-800">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Empty Offset Slots for first week */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[48px] sm:min-h-[85px] bg-slate-950/20 border border-slate-900 rounded-xl sm:rounded-2xl opacity-30 pointer-events-none" />
                ))}

                {/* Days of Month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateFormatted = `${selectedYearMonth}-${String(dayNum).padStart(2, '0')}`;
                  const dateObj = new Date(year, month - 1, dayNum);
                  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                  const rec = recordsByDate.get(dateFormatted);
                  const isApprovedLeave = empLeaveRequests.some(l => dateFormatted >= l.startDate && dateFormatted <= l.endDate);

                  let statusBg = 'bg-slate-950 border-slate-800 text-slate-400';
                  let statusLabel = isWeekend ? 'Weekend' : 'Absent';
                  let statusDot = 'bg-slate-700';

                  if (rec) {
                    if (rec.status === 'Present') {
                      statusBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
                      statusLabel = 'Present';
                      statusDot = 'bg-emerald-400';
                    } else if (rec.status === 'Late') {
                      statusBg = 'bg-amber-500/10 border-amber-500/30 text-amber-300';
                      statusLabel = 'Late';
                      statusDot = 'bg-amber-400';
                    } else if (rec.isWfh || rec.status === 'Work From Home') {
                      statusBg = 'bg-blue-500/10 border-blue-500/30 text-blue-300';
                      statusLabel = 'WFH';
                      statusDot = 'bg-blue-400';
                    } else if (rec.status === 'Half Day') {
                      statusBg = 'bg-sky-500/10 border-sky-500/30 text-sky-300';
                      statusLabel = 'Half Day';
                      statusDot = 'bg-sky-400';
                    }
                  } else if (isApprovedLeave) {
                    statusBg = 'bg-purple-500/10 border-purple-500/30 text-purple-300';
                    statusLabel = 'Leave';
                    statusDot = 'bg-purple-400';
                  } else if (isWeekend) {
                    statusBg = 'bg-slate-950/40 border-slate-800/60 text-slate-600';
                  }

                  const isSelected = selectedDayRecord?.date === dateFormatted;

                  return (
                    <div
                      key={dayNum}
                      onClick={() => rec && setSelectedDayRecord(rec)}
                      className={`p-1 sm:p-2.5 min-h-[48px] sm:min-h-[85px] rounded-xl sm:rounded-2xl border flex flex-col justify-between transition-all ${statusBg} ${
                        isSelected ? 'ring-2 ring-blue-500 border-blue-400 shadow-lg scale-[1.02]' : ''
                      } ${
                        rec ? 'hover:scale-[1.02] cursor-pointer shadow-md' : 'opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-xs font-black text-white">{dayNum}</span>
                        <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${statusDot}`} />
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[8px] sm:text-[10px] font-bold block truncate">{statusLabel}</span>
                        {rec?.checkInAt && (
                          <span className="text-[7.5px] sm:text-[9px] font-mono text-slate-300 block truncate leading-none">
                            {new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {rec?.workingMinutes ? (
                          <span className="text-[7.5px] sm:text-[9px] font-mono text-slate-400 block truncate leading-none">
                            {Math.floor(rec.workingMinutes / 60)}h {rec.workingMinutes % 60}m
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Shift Activity & Breakdown Dashboard (Triggers when HR clicks a day!) */}
            {selectedDayRecord && (
              <div className="bg-slate-950 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-blue-500/40 shadow-2xl space-y-4 sm:space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                      Shift Activity Dashboard — {selectedDayRecord.date}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Comprehensive timeline & break breakdown for {employee.fullName}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDayRecord(null)}
                    className="self-end sm:self-auto px-2.5 py-1 sm:px-3 sm:py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 cursor-pointer transition-colors"
                  >
                    Close Log ✕
                  </button>
                </div>

                {/* Top KPI Cards Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                  <div className="bg-slate-900 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Check-In Time</span>
                    <span className="font-mono text-xs sm:text-sm font-black text-emerald-400 block mt-0.5 sm:mt-1">
                      {selectedDayRecord.checkInAt ? new Date(selectedDayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Checked In'}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Check-Out Time</span>
                    <span className="font-mono text-xs sm:text-sm font-black text-rose-400 block mt-0.5 sm:mt-1">
                      {selectedDayRecord.checkOutAt ? new Date(selectedDayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Working Duration</span>
                    <span className="font-mono text-xs sm:text-sm font-black text-white block mt-0.5 sm:mt-1">
                      {selectedDayRecord.workingMinutes ? `${Math.floor(selectedDayRecord.workingMinutes / 60)}h ${selectedDayRecord.workingMinutes % 60}m` : '--'}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-800">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Location Verification</span>
                    <span className="font-bold text-blue-400 text-[11px] sm:text-xs flex items-center gap-1.5 mt-0.5 sm:mt-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{selectedDayRecord.isWfh ? 'Work From Home' : selectedDayRecord.locationVerified ? 'Office GPS Verified' : 'Standard Check-In'}</span>
                    </span>
                  </div>
                </div>

                {/* Donut Chart Dashboard (Matching User Screenshot 2!) */}
                {renderDoughnutChart(selectedDayRecord)}

                {/* Chronological Event Timeline */}
                {renderChronologicalTimeline(selectedDayRecord)}
              </div>
            )}

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
