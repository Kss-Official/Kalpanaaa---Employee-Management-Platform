/**
 * Leave Analytics & Loss of Pay (LOP) Data Processing Service
 * 
 * Provides production-grade calculations for the Admin Leave Analytics Dashboard:
 * - Date intervals in Asia/Kolkata timezone (Today/1d, 7d, 15d, 30d, custom).
 * - Multi-tier approval qualification (PM -> HR -> CEO -> CTO).
 * - Overlap clipping (only days falling within the reporting window are counted).
 * - Deduplication (no double-counting of overlapping requests or attendance).
 * - Weekend (Sunday) & gazetted holiday handling.
 * - Separation of actual taken leave (date <= today) vs future approved leave.
 * - Strict exclusion of WFH from Total Leave Days (LOP + EL + SL).
 * - Separation of current leave balances from period consumption.
 */

import { Employee, LeaveRequest, AttendanceRecord, CompanySettings } from '../types';
import { 
  OFFICIAL_HOLIDAY_DATES_2026, 
  isNonWorkingDay, 
  isWfhType,
  WEEKLY_OFF_DAYS
} from './attendanceEngine';
import { todayInIST } from './absoluteTime';

export type DateRangePreset = '1d' | '7d' | '15d' | '30d' | 'custom';

export interface DateRangeInterval {
  preset: DateRangePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // e.g. "Last 7 Days (15 Oct – 21 Oct 2026)"
  daysCount: number; // total calendar days in window
  dateList: string[]; // sorted chronological list of YYYY-MM-DD
}

export interface QualifyingDayDetail {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  leaveType: 'EL' | 'SL' | 'LOP' | 'WFH';
  daysValue: number; // 1 or 0.5
  isHalfDay: boolean;
  isFuture: boolean;
  source: 'leave_request' | 'attendance_record';
  requestId?: string;
  reason?: string;
  status: string;
  notes?: string;
}

export interface EmployeeLeaveMetric {
  employeeId: string;       // Firestore doc ID
  employeeCode: string;     // Corporate code e.g. KSS2407004
  fullName: string;
  department: string;
  designation: string;
  avatarUrl?: string;
  status: string;
  joiningDate?: string;
  
  // Period Leave Days (Taken)
  lopDays: number;
  elDays: number;
  slDays: number;
  wfhDays: number;
  totalLeaveDays: number; // LOP + EL + SL (strictly excluding WFH)
  
  // Future Approved
  futureApprovedDays: number;
  
  // Counts & Dates
  qualifyingRequestsCount: number;
  lastLeaveDate: string | null;
  
  // Current Live Balances (Maintained separately from period taken)
  currentEarnLeaveBalance: number;
  currentSickLeaveBalance: number;
  currentCasualLeaveBalance: number;
  
  // Detailed audit list of days & requests in period
  qualifyingDays: QualifyingDayDetail[];
  qualifyingRequests: LeaveRequest[];
}

export interface DailyLeaveTrendPoint {
  date: string;       // YYYY-MM-DD
  displayDate: string; // "21 Oct" or "Wed, 21 Oct"
  dayOfWeek: string;  // "Wed"
  elDays: number;
  slDays: number;
  lopDays: number;
  wfhDays: number;
  totalLeaveDays: number; // EL + SL + LOP
  uniqueEmployeesCount: number;
}

export interface LeaveAnalyticsSummary {
  interval: DateRangeInterval;
  
  // High-level KPI Cards
  totalActiveEmployees: number;
  employeesOnLeaveCount: number; // Unique employees with at least 1 leave day taken (LOP/EL/SL)
  
  totalLopDays: number;
  uniqueLopEmployeesCount: number;
  
  totalElDays: number;
  uniqueElEmployeesCount: number;
  
  totalSlDays: number;
  uniqueSlEmployeesCount: number;
  
  totalWfhDays: number;
  uniqueWfhEmployeesCount: number;
  
  totalLeaveDays: number; // LOP + EL + SL
  totalQualifyingRequests: number;
  totalFutureApprovedDays: number;
  
  // Trends & Breakdowns
  dailyTrends: DailyLeaveTrendPoint[];
  employeeMetrics: EmployeeLeaveMetric[];
  
  // Leave Distribution percentages
  distribution: {
    elPercent: number;
    slPercent: number;
    lopPercent: number;
    wfhPercent: number; // For separate comparison
  };
}

/**
 * Normalizes any date string or Date object into a pure YYYY-MM-DD format.
 */
export function normalizeDateStr(d: string | Date | undefined | null): string {
  if (!d) return '';
  if (typeof d === 'string') {
    // If ISO with time, split at T
    const clean = d.trim().split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Generates an array of all YYYY-MM-DD strings between start and end inclusive.
 */
export function generateDateSequence(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  if (!startDate || !endDate) return dates;
  
  const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
  if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) return dates;

  // Use midday UTC to prevent timezone shifts
  const current = new Date(Date.UTC(sYear, sMonth - 1, sDay, 12, 0, 0));
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay, 12, 0, 0));

  if (current > end) return dates;

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Builds the canonical DateRangeInterval for any of the 5 options.
 */
export function buildDateRangeInterval(
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): DateRangeInterval {
  const today = todayInIST();
  
  if (preset === '1d') {
    return {
      preset: '1d',
      startDate: today,
      endDate: today,
      label: `Today / Last 1 Day (${formatDisplayDate(today)})`,
      daysCount: 1,
      dateList: [today]
    };
  }

  if (preset === '7d' || preset === '15d' || preset === '30d') {
    const daysBack = preset === '7d' ? 6 : preset === '15d' ? 14 : 29;
    const [y, m, d] = today.split('-').map(Number);
    const startObj = new Date(Date.UTC(y, m - 1, d - daysBack, 12, 0, 0));
    const startStr = `${startObj.getUTCFullYear()}-${String(startObj.getUTCMonth() + 1).padStart(2, '0')}-${String(startObj.getUTCDate()).padStart(2, '0')}`;
    const dateList = generateDateSequence(startStr, today);
    const labelDays = preset === '7d' ? '7 Days' : preset === '15d' ? '15 Days' : '30 Days';
    
    return {
      preset,
      startDate: startStr,
      endDate: today,
      label: `Last ${labelDays} (${formatDisplayDate(startStr)} – ${formatDisplayDate(today)})`,
      daysCount: dateList.length,
      dateList
    };
  }

  // Custom preset
  let start = normalizeDateStr(customStart) || today;
  let end = normalizeDateStr(customEnd) || today;
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const dateList = generateDateSequence(start, end);
  return {
    preset: 'custom',
    startDate: start,
    endDate: end,
    label: `Custom Range (${formatDisplayDate(start)} – ${formatDisplayDate(end)})`,
    daysCount: dateList.length,
    dateList
  };
}

/**
 * Format date for friendly human reading (e.g. "21 Oct 2026").
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/**
 * Evaluates whether a leave request is officially approved and authoritative.
 * Respects both direct 'Approved' status and multi-tier approval completion.
 */
export function isAuthoritativeApprovedLeave(r: LeaveRequest): boolean {
  if (!r) return false;
  if (r.status === 'Rejected' || r.status === 'Cancelled') return false;
  if (r.status === 'Approved') return true;

  // Check multi-tier approval state
  const pmApproved = r.pmStatus === 'Approved' || r.pmStatus === 'N/A' || r.pmStatus === 'Bypassed';
  const hrApproved = r.hrStatus === 'Approved' || r.hrStatus === 'N/A' || r.hrStatus === 'Bypassed';
  const ceoApproved = r.ceoStatus === 'Approved' || r.ceoStatus === 'N/A' || r.ceoStatus === 'Bypassed';
  const ctoApproved = r.ctoStatus === 'Approved' || r.ctoStatus === 'N/A' || r.ctoStatus === 'Bypassed';

  return pmApproved && hrApproved && ceoApproved && ctoApproved;
}

/**
 * Classifies an approved leave request into one of the four categories:
 * 'WFH' | 'SL' | 'LOP' | 'EL'
 */
export function classifyLeaveRequestType(r: LeaveRequest): 'WFH' | 'SL' | 'LOP' | 'EL' {
  if (isWfhType(r.type) || isWfhType(r.leaveCategory)) {
    return 'WFH';
  }

  const typeStr = (r.type || '').toLowerCase();
  const catStr = (r.leaveCategory || '').toLowerCase();
  const reasonStr = (r.reason || '').toLowerCase();
  const notesStr = (r.reviewNotes || '').toLowerCase();

  // Loss of Pay
  if (
    typeStr.includes('loss of pay') ||
    typeStr === 'lop' ||
    catStr.includes('loss of pay') ||
    catStr === 'lop' ||
    typeStr.includes('unpaid') ||
    reasonStr.includes('loss of pay') ||
    notesStr.includes('loss of pay') ||
    notesStr.includes('lop')
  ) {
    return 'LOP';
  }

  // Sick Leave
  if (
    typeStr === 'sick leave' ||
    catStr === 'sick leave' ||
    typeStr.includes('sick') ||
    catStr.includes('sick') ||
    reasonStr.includes('sick')
  ) {
    return 'SL';
  }

  // Default to Earned Leave (Earn Leave, Leave, Vacation, Casual, etc.)
  return 'EL';
}

/**
 * Checks whether an employee record matches a target request or attendance record.
 */
export function isEmployeeMatch(
  emp: Employee,
  target: {
    employeeId?: string;
    employeeCode?: string;
    employeeUid?: string;
    employeeName?: string;
  }
): boolean {
  if (!emp || !target) return false;

  // Direct ID check
  if (target.employeeId && (
    target.employeeId === emp.id || 
    target.employeeId === emp.employeeId || 
    target.employeeId === emp.uid
  )) {
    return true;
  }

  // Employee Code check
  if (target.employeeCode && (
    target.employeeCode === emp.employeeId || 
    target.employeeCode === emp.id
  )) {
    return true;
  }

  // UID check
  if (target.employeeUid && (
    target.employeeUid === emp.uid || 
    target.employeeUid === emp.id || 
    target.employeeUid === emp.employeeId
  )) {
    return true;
  }

  // Name matching fallback
  if (target.employeeName && emp.fullName) {
    const cleanT = target.employeeName.trim().toLowerCase();
    const cleanE = emp.fullName.trim().toLowerCase();
    if (cleanT === cleanE) return true;
    if (cleanT.replace(/\s+/g, '') === cleanE.replace(/\s+/g, '')) return true;
  }

  return false;
}

/**
 * Core Calculation Engine: Aggregates leave and LOP data across the specified date interval.
 */
export function calculateLeaveAnalytics(
  employees: Employee[],
  leaveRequests: LeaveRequest[],
  attendance: AttendanceRecord[],
  settings: CompanySettings | undefined,
  interval: DateRangeInterval,
  nowMs: number = Date.now()
): LeaveAnalyticsSummary {
  const todayStr = todayInIST();
  const holidays = Array.from(new Set([
    ...OFFICIAL_HOLIDAY_DATES_2026,
    ...(((settings as any)?.holidayDates) || [])
  ]));

  // 1. Filter active operational employees (exclude Inactive / Terminated accounts)
  const activeEmployees = employees.filter(e => 
    e.status !== 'Inactive' && 
    e.status !== 'Terminated'
  );

  // 2. Pre-filter approved leave requests that have at least some date overlapping the window
  const approvedRequests = (leaveRequests || []).filter(r => isAuthoritativeApprovedLeave(r));

  // Initialize tracking containers
  const employeeMetricMap = new Map<string, EmployeeLeaveMetric>();
  const dailyAggregationMap = new Map<string, DailyLeaveTrendPoint>();

  // Initialize trend buckets for all dates in sequence
  for (const dateStr of interval.dateList) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const displayDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

    dailyAggregationMap.set(dateStr, {
      date: dateStr,
      displayDate,
      dayOfWeek,
      elDays: 0,
      slDays: 0,
      lopDays: 0,
      wfhDays: 0,
      totalLeaveDays: 0,
      uniqueEmployeesCount: 0
    });
  }

  const qualifyingRequestIdsSet = new Set<string>();

  // 3. Process each active employee day-by-day across the reporting interval
  for (const emp of activeEmployees) {
    const empJoinDate = emp.joiningDate || (emp as any).joining_date || '';
    const qualifyingDays: QualifyingDayDetail[] = [];
    const empQualifyingRequests = new Set<LeaveRequest>();

    let empLopDays = 0;
    let empElDays = 0;
    let empSlDays = 0;
    let empWfhDays = 0;
    let empFutureApprovedDays = 0;
    let latestLeaveDate: string | null = null;

    // Filter relevant requests for this employee
    const empRequests = approvedRequests.filter(r => isEmployeeMatch(emp, r));
    
    // Filter relevant attendance records for this employee in this window
    const empAttendance = (attendance || []).filter(a => 
      isEmployeeMatch(emp, a) && 
      a.date >= interval.startDate && 
      a.date <= interval.endDate
    );

    for (const dateStr of interval.dateList) {
      // Rule: Pre-joining days are not counted
      if (empJoinDate && dateStr < empJoinDate) {
        continue;
      }

      const isFuture = dateStr > todayStr;
      const isSundayOrHoliday = isNonWorkingDay(dateStr, holidays, WEEKLY_OFF_DAYS);

      // Check for approved LeaveRequest covering this date
      const matchedReq = empRequests.find(r => {
        const s = r.startDate || (r as any).fromDate;
        const e = r.endDate || (r as any).toDate || s;
        return s && e && dateStr >= s && dateStr <= e;
      });

      // Check attendance record for this date
      const matchedAtt = empAttendance.find(a => a.date === dateStr);

      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

      // AUTHORITATIVE SOURCE 1: Approved Leave Request
      if (matchedReq) {
        empQualifyingRequests.add(matchedReq);
        qualifyingRequestIdsSet.add(matchedReq.id);

        const category = classifyLeaveRequestType(matchedReq);
        const isHalf = (matchedReq as any).isHalfDay === true || 
                       (matchedReq.reason && matchedReq.reason.toLowerCase().includes('half day'));
        const dayVal = isHalf ? 0.5 : 1;

        if (isFuture) {
          // Future approved leave is tracked separately and not counted as taken
          empFutureApprovedDays += dayVal;
        } else {
          // Update latest leave date taken
          if (!latestLeaveDate || dateStr > latestLeaveDate) {
            latestLeaveDate = dateStr;
          }

          if (category === 'LOP') {
            empLopDays += dayVal;
          } else if (category === 'SL') {
            empSlDays += dayVal;
          } else if (category === 'WFH') {
            empWfhDays += dayVal;
          } else {
            empElDays += dayVal;
          }

          // Update trend point
          const trend = dailyAggregationMap.get(dateStr);
          if (trend) {
            if (category === 'LOP') trend.lopDays += dayVal;
            else if (category === 'SL') trend.slDays += dayVal;
            else if (category === 'WFH') trend.wfhDays += dayVal;
            else trend.elDays += dayVal;

            if (category !== 'WFH') {
              trend.totalLeaveDays += dayVal;
            }
          }
        }

        qualifyingDays.push({
          date: dateStr,
          dayOfWeek,
          leaveType: category,
          daysValue: dayVal,
          isHalfDay: isHalf,
          isFuture,
          source: 'leave_request',
          requestId: matchedReq.id,
          reason: matchedReq.reason,
          status: matchedReq.status,
          notes: matchedReq.reviewNotes
        });

        continue; // Handled authoritative request; do not double count with attendance
      }

      // AUTHORITATIVE SOURCE 2: Confirmed Loss of Pay in Attendance
      // Sundays/holidays cannot be classified as LOP
      if (matchedAtt && !isSundayOrHoliday) {
        const attStatus = (matchedAtt.status || '') as string;
        const notes = (matchedAtt.notes || '').toLowerCase();
        const isLop = attStatus === 'Loss of Pay' || 
                      attStatus === 'LOP' || 
                      notes.includes('lop') || 
                      notes.includes('loss of pay');
        const isWfh = attStatus === 'Work From Home' || matchedAtt.isWfh === true;
        const isHalf = attStatus === 'Half Day';
        const dayVal = isHalf ? 0.5 : 1;

        if (isLop) {
          if (!isFuture) {
            empLopDays += dayVal;
            if (!latestLeaveDate || dateStr > latestLeaveDate) {
              latestLeaveDate = dateStr;
            }

            const trend = dailyAggregationMap.get(dateStr);
            if (trend) {
              trend.lopDays += dayVal;
              trend.totalLeaveDays += dayVal;
            }

            qualifyingDays.push({
              date: dateStr,
              dayOfWeek,
              leaveType: 'LOP',
              daysValue: dayVal,
              isHalfDay: isHalf,
              isFuture,
              source: 'attendance_record',
              status: attStatus,
              notes: matchedAtt.notes || 'Attendance record marked as Loss of Pay'
            });
          }
        } else if (isWfh) {
          if (!isFuture) {
            empWfhDays += dayVal;
            const trend = dailyAggregationMap.get(dateStr);
            if (trend) {
              trend.wfhDays += dayVal;
            }

            qualifyingDays.push({
              date: dateStr,
              dayOfWeek,
              leaveType: 'WFH',
              daysValue: dayVal,
              isHalfDay: isHalf,
              isFuture,
              source: 'attendance_record',
              status: attStatus,
              notes: matchedAtt.notes || 'Remote work on attendance record'
            });
          }
        }
      }
    }

    const totalLeaveDays = empLopDays + empElDays + empSlDays; // strictly excluding WFH

    employeeMetricMap.set(emp.id, {
      employeeId: emp.id,
      employeeCode: emp.employeeId || '',
      fullName: emp.fullName || 'Unknown Employee',
      department: emp.department || 'General',
      designation: emp.designation || 'Staff',
      avatarUrl: emp.profilePhotoUrl,
      status: emp.status,
      joiningDate: empJoinDate,
      lopDays: empLopDays,
      elDays: empElDays,
      slDays: empSlDays,
      wfhDays: empWfhDays,
      totalLeaveDays,
      futureApprovedDays: empFutureApprovedDays,
      qualifyingRequestsCount: empQualifyingRequests.size,
      lastLeaveDate: latestLeaveDate,
      currentEarnLeaveBalance: typeof emp.earnLeaveBalance === 'number' ? emp.earnLeaveBalance : 0,
      currentSickLeaveBalance: typeof emp.sickLeaveBalance === 'number' ? emp.sickLeaveBalance : 0,
      currentCasualLeaveBalance: typeof emp.casualLeaveBalance === 'number' ? emp.casualLeaveBalance : 0,
      qualifyingDays,
      qualifyingRequests: Array.from(empQualifyingRequests)
    });
  }

  // 4. Calculate unique employee counts on daily trends
  for (const dateStr of interval.dateList) {
    const trend = dailyAggregationMap.get(dateStr);
    if (trend) {
      let uniqueCount = 0;
      for (const m of employeeMetricMap.values()) {
        const hadLeaveOnDate = m.qualifyingDays.some(q => q.date === dateStr && !q.isFuture && q.leaveType !== 'WFH');
        if (hadLeaveOnDate) uniqueCount++;
      }
      trend.uniqueEmployeesCount = uniqueCount;
    }
  }

  const employeeMetrics = Array.from(employeeMetricMap.values());

  // 5. Calculate Global KPI Totals
  const totalLopDays = employeeMetrics.reduce((sum, e) => sum + e.lopDays, 0);
  const totalElDays = employeeMetrics.reduce((sum, e) => sum + e.elDays, 0);
  const totalSlDays = employeeMetrics.reduce((sum, e) => sum + e.slDays, 0);
  const totalWfhDays = employeeMetrics.reduce((sum, e) => sum + e.wfhDays, 0);
  const totalLeaveDays = totalLopDays + totalElDays + totalSlDays;
  const totalFutureApprovedDays = employeeMetrics.reduce((sum, e) => sum + e.futureApprovedDays, 0);

  const uniqueLopEmployeesCount = employeeMetrics.filter(e => e.lopDays > 0).length;
  const uniqueElEmployeesCount = employeeMetrics.filter(e => e.elDays > 0).length;
  const uniqueSlEmployeesCount = employeeMetrics.filter(e => e.slDays > 0).length;
  const uniqueWfhEmployeesCount = employeeMetrics.filter(e => e.wfhDays > 0).length;
  const employeesOnLeaveCount = employeeMetrics.filter(e => e.totalLeaveDays > 0).length;

  const totalLeaveDenominator = totalLeaveDays > 0 ? totalLeaveDays : 1;
  const elPercent = totalLeaveDays > 0 ? Math.round((totalElDays / totalLeaveDenominator) * 100) : 0;
  const slPercent = totalLeaveDays > 0 ? Math.round((totalSlDays / totalLeaveDenominator) * 100) : 0;
  const lopPercent = totalLeaveDays > 0 ? Math.round((totalLopDays / totalLeaveDenominator) * 100) : 0;
  const wfhRatio = totalLeaveDays > 0 ? Math.round((totalWfhDays / totalLeaveDenominator) * 100) : 0;

  return {
    interval,
    totalActiveEmployees: activeEmployees.length,
    employeesOnLeaveCount,
    totalLopDays,
    uniqueLopEmployeesCount,
    totalElDays,
    uniqueElEmployeesCount,
    totalSlDays,
    uniqueSlEmployeesCount,
    totalWfhDays,
    uniqueWfhEmployeesCount,
    totalLeaveDays,
    totalQualifyingRequests: qualifyingRequestIdsSet.size,
    totalFutureApprovedDays,
    dailyTrends: Array.from(dailyAggregationMap.values()),
    employeeMetrics,
    distribution: {
      elPercent,
      slPercent,
      lopPercent,
      wfhPercent: wfhRatio
    }
  };
}
