import { CompanySettings, Employee, AttendanceRecord, AttendanceStatus, EmploymentType } from '../types';

/**
 * Standard Company Timezone for Attendance & Work-Day calculations (IST)
 */
export const COMPANY_TIMEZONE = 'Asia/Kolkata';

/**
 * Official Company Launch / Inception Start Date: 27 July 2026.
 * Attendance cannot be marked for any date prior to 27th July 2026.
 */
export const COMPANY_START_DATE = '2026-07-27';
export const COMPANY_INCEPTION_DATE = '2026-07-27';

/**
 * B14 FIX: single anti-fraud cap for one break's stored duration.
 * The break-close paths previously clamped at 120 (startBreak auto-close) and 180
 * (endBreak), so the SAME forgotten-open break was stored as a different length
 * depending on whether the user ended it or started another one. All break-close
 * paths now share this constant so a break's recorded duration is path-independent.
 */
export const MAX_BREAK_MINUTES = 180;

/**
 * ── Canonical shift definition ───────────────────────────────────────────────
 * The company shift is 10:00 AM → 7:00 PM IST (9h rostered), Monday–Saturday,
 * with Sunday as the weekly off. These were previously magic numbers scattered
 * across the engine and the portals (10/19 in computeShiftWorkingMinutes, the
 * `hh > 10 || (hh === 10 && mm > 15)` lateness test, hard-coded strings in the
 * UI), so a shift change had to be made in a dozen places and they could drift
 * apart. Everything that reasons about the shift now derives from these.
 */
export const SHIFT_START_HOUR = 10;
export const SHIFT_START_MINUTE = 0;
export const SHIFT_END_HOUR = 19;
export const SHIFT_END_MINUTE = 0;
/** Minutes after SHIFT_START before a check-in is counted Late. */
export const SHIFT_LATE_GRACE_MINUTES = 15;
/** 0 = Sunday … 6 = Saturday. Sunday is the weekly off; the work week is Mon–Sat. */
export const WEEKLY_OFF_DAYS: number[] = [0];
/** Rostered working days per week (Mon–Sat). */
export const WORK_WEEK_DAYS = 6;
/** Rostered shift length in minutes, breaks included. */
export const SHIFT_TOTAL_MINUTES =
  (SHIFT_END_HOUR * 60 + SHIFT_END_MINUTE) - (SHIFT_START_HOUR * 60 + SHIFT_START_MINUTE);

/** Human-readable shift label for UI headers, e.g. "10:00 AM – 7:00 PM IST". */
export const SHIFT_LABEL = '10:00 AM – 7:00 PM IST';

/**
 * Normalizes any legacy or arbitrary shift string to the standard display format.
 * Maps unassigned, 9-6, 10-6, 10-19, or day shift variations to "10:00 AM – 7:00 PM".
 */
export function formatShiftTiming(shift?: string | null): string {
  if (!shift || typeof shift !== 'string' || shift.trim() === '') {
    return '10:00 AM – 7:00 PM';
  }
  const s = shift.toLowerCase().trim();
  if (
    s.includes('09:00 - 18:00') ||
    s.includes('09:00-18:00') ||
    s.includes('10:00 - 18:00') ||
    s.includes('10:00-18:00') ||
    s.includes('10 to 6') ||
    s.includes('10-6') ||
    s.includes('9 to 6') ||
    s.includes('9-6') ||
    s.includes('10:00 - 19:00') ||
    s.includes('10:00-19:00') ||
    s === 'day shift' ||
    s === 'general shift'
  ) {
    return '10:00 AM – 7:00 PM';
  }
  return shift;
}

/**
 * Computes an employee's Earn Leave monthly credit history from joining date to refDate:
 * - Base Earn Leaves start strictly at ZERO (0) for all employees (zero-base policy).
 * - 1 Earn Leave is credited on the 1st date of each month.
 * - If an employee joins in the current month AFTER the 1st date, they have 0 credited leaves
 *   until the 1st of the next month.
 */
export function computeEarnLeaveMonthlyCreditHistory(
  emp: any,
  refDate: Date = new Date()
): { monthKey: string; monthLabel: string; creditedDays: number; creditedDate: string; status: 'Credited' | 'Not Eligible' }[] {
  if (!emp) return [];

  const joinDate = emp.joiningDate ? new Date(emp.joiningDate) : null;
  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth(); // 0-indexed (0=Jan, 11=Dec)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const startYear = joinDate && !isNaN(joinDate.getTime()) 
    ? Math.min(joinDate.getFullYear(), currentYear)
    : currentYear;

  const history: { monthKey: string; monthLabel: string; creditedDays: number; creditedDate: string; status: 'Credited' | 'Not Eligible' }[] = [];

  for (let year = startYear; year <= currentYear; year++) {
    const endMonth = year === currentYear ? currentMonth : 11;
    const startMonth = (joinDate && !isNaN(joinDate.getTime()) && year === joinDate.getFullYear())
      ? joinDate.getMonth()
      : 0;

    for (let month = startMonth; month <= endMonth; month++) {
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[month]} ${year}`;
      const creditedDate = `${monthKey}-01`;

      let isCredited = false;
      if (!joinDate || isNaN(joinDate.getTime())) {
        isCredited = true;
      } else {
        const jYear = joinDate.getFullYear();
        const jMonth = joinDate.getMonth();
        const jDay = joinDate.getDate();

        if (
          jYear < year ||
          (jYear === year && jMonth < month) ||
          (jYear === year && jMonth === month && jDay <= 1)
        ) {
          isCredited = true;
        }
      }

      history.push({
        monthKey,
        monthLabel,
        creditedDays: isCredited ? 1 : 0,
        creditedDate,
        status: isCredited ? 'Credited' : 'Not Eligible'
      });
    }
  }

  return history;
}

/**
 * Computes an employee's Earn Leave balance according to strict zero-base policy:
 * - 1 Earn Leave is credited on the 1st date of each month.
 * - Approved leaves of type 'Leave' or 'Earn Leave' taken during the active month deduct from this balance.
 */
export function computeEmployeeLeaveBalance(
  emp: any, 
  leaveRequests: any[] = [], 
  refDate: Date = new Date()
): { credited: number; taken: number; balance: number; history: { monthKey: string; monthLabel: string; creditedDays: number; creditedDate: string; status: 'Credited' | 'Not Eligible' }[] } {
  if (!emp) return { credited: 0, taken: 0, balance: 0, history: [] };

  const history = computeEarnLeaveMonthlyCreditHistory(emp, refDate);
  const credited = history
    .filter(h => h.status === 'Credited')
    .reduce((acc, h) => acc + h.creditedDays, 0);

  // Filter approved leaves taken across tenure (supports legacy 'Leave' and 'Earn Leave')
  const approvedLeavesTaken = (leaveRequests || []).filter(l => {
    if (!l) return false;
    const isEmp = 
      (!!l.employeeId && (l.employeeId === emp.id || l.employeeId === emp.employeeId)) ||
      (!!l.employeeUid && (l.employeeUid === emp.uid || l.employeeUid === emp.id)) ||
      (!!l.employeeName && !!emp.fullName && l.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase());
    const isApproved = l.status === 'Approved' ||
      ((l.pmStatus === 'Approved' || l.pmStatus === 'N/A' || l.pmStatus === 'Bypassed') &&
       (l.hrStatus === 'Approved' || l.hrStatus === 'N/A' || l.hrStatus === 'Bypassed') &&
       l.ceoStatus === 'Approved' && l.ctoStatus === 'Approved');
    const isEarnLeave = l.type === 'Leave' || l.type === 'Earn Leave' || (l as any).leaveCategory === 'Earn Leave';
    return isEmp && isApproved && isEarnLeave;
  }).length;

  const balance = Math.max(0, credited - approvedLeavesTaken);

  return {
    credited,
    taken: approvedLeavesTaken,
    balance,
    history
  };
}

/**
 * Computes Sick Leave credit periods for an employee:
 * - 1 Sick Leave day during the 3-month traineeship period.
 * - 1 Sick Leave day every 3 months thereafter (recurring entitlement).
 */
export function computeSickLeaveCreditHistory(
  emp: any,
  refDate: Date = new Date()
): { periodKey: string; periodLabel: string; startDate: string; endDate: string; creditedDays: number; isTraineeship: boolean; status: 'Credited' | 'Upcoming' }[] {
  if (!emp) return [];

  const joinDate = emp.joiningDate ? new Date(emp.joiningDate) : new Date(refDate.getFullYear(), 0, 1);
  if (isNaN(joinDate.getTime())) return [];

  const history: { periodKey: string; periodLabel: string; startDate: string; endDate: string; creditedDays: number; isTraineeship: boolean; status: 'Credited' | 'Upcoming' }[] = [];
  const nowTime = refDate.getTime();

  let pIndex = 1;
  let pStart = new Date(joinDate);

  while (true) {
    const pEnd = new Date(pStart);
    pEnd.setMonth(pEnd.getMonth() + 3);

    const startStr = pStart.toISOString().split('T')[0];
    const endStr = new Date(pEnd.getTime() - 86400000).toISOString().split('T')[0];
    const isTraineeship = pIndex === 1;
    const isCredited = pStart.getTime() <= nowTime;

    const periodLabel = isTraineeship
      ? 'Months 1–3 (Traineeship Period)'
      : `Months ${(pIndex - 1) * 3 + 1}–${pIndex * 3} (Entitlement Q${pIndex})`;

    history.push({
      periodKey: `SL-P${pIndex}`,
      periodLabel,
      startDate: startStr,
      endDate: endStr,
      creditedDays: 1,
      isTraineeship,
      status: isCredited ? 'Credited' : 'Upcoming'
    });

    if (pStart.getTime() > nowTime || pIndex >= 30) {
      break;
    }

    pStart = pEnd;
    pIndex++;
  }

  return history;
}

/**
 * Computes Sick Leave balance:
 * - Calculates total credited Sick Leave from 3-month recurring entitlements.
 * - Deducts all approved Sick Leave requests.
 */
export function computeSickLeaveBalance(
  emp: any,
  leaveRequests: any[] = [],
  refDate: Date = new Date()
): { credited: number; taken: number; balance: number; history: { periodKey: string; periodLabel: string; startDate: string; endDate: string; creditedDays: number; isTraineeship: boolean; status: 'Credited' | 'Upcoming' }[] } {
  if (!emp) return { credited: 0, taken: 0, balance: 0, history: [] };

  const history = computeSickLeaveCreditHistory(emp, refDate);
  const credited = history
    .filter(h => h.status === 'Credited')
    .reduce((acc, h) => acc + h.creditedDays, 0);

  const approvedLeavesTaken = (leaveRequests || []).filter(l => {
    if (!l) return false;
    const isEmp = 
      (!!l.employeeId && (l.employeeId === emp.id || l.employeeId === emp.employeeId)) ||
      (!!l.employeeUid && (l.employeeUid === emp.uid || l.employeeUid === emp.id)) ||
      (!!l.employeeName && !!emp.fullName && l.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase());
    const isApproved = l.status === 'Approved' ||
      ((l.pmStatus === 'Approved' || l.pmStatus === 'N/A' || l.pmStatus === 'Bypassed') &&
       (l.hrStatus === 'Approved' || l.hrStatus === 'N/A' || l.hrStatus === 'Bypassed') &&
       l.ceoStatus === 'Approved' && l.ctoStatus === 'Approved');
    const isSickLeave = l.type === 'Sick Leave' || (l as any).leaveCategory === 'Sick Leave';
    return isEmp && isApproved && isSickLeave;
  }).length;

  const balance = Math.max(0, credited - approvedLeavesTaken);

  return {
    credited,
    taken: approvedLeavesTaken,
    balance,
    history
  };
}

/**
 * Computes Casual Leave balance:
 * - 1 day credited every 2 months after joining (6 per year).
 * - Deducts all approved Casual Leave requests.
 */
export function computeCasualLeaveBalance(
  emp: any,
  leaveRequests: any[] = [],
  refDate: Date = new Date()
): { credited: number; taken: number; balance: number; monthlyBalance: number } {
  if (!emp) return { credited: 0, taken: 0, balance: 0, monthlyBalance: 0 };

  const joinDate = emp.joiningDate ? new Date(emp.joiningDate) : new Date(refDate.getFullYear(), 0, 1);
  if (isNaN(joinDate.getTime())) return { credited: 0, taken: 0, balance: 0, monthlyBalance: 0 };

  // Credit 1 day every 2 months from joining up to refDate
  let credited = 0;
  const cursor = new Date(joinDate);
  cursor.setMonth(cursor.getMonth() + 2); // first credit after 2 months
  while (cursor <= refDate) {
    credited++;
    cursor.setMonth(cursor.getMonth() + 2);
  }

  const approvedLeavesTaken = (leaveRequests || []).filter(l => {
    if (!l) return false;
    const isEmp =
      (!!l.employeeId && (l.employeeId === emp.id || l.employeeId === emp.employeeId)) ||
      (!!l.employeeUid && (l.employeeUid === emp.uid || l.employeeUid === emp.id)) ||
      (!!l.employeeName && !!emp.fullName && l.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase());
    const isApproved = l.status === 'Approved' ||
      ((l.pmStatus === 'Approved' || l.pmStatus === 'N/A' || l.pmStatus === 'Bypassed') &&
       (l.hrStatus === 'Approved' || l.hrStatus === 'N/A' || l.hrStatus === 'Bypassed') &&
       l.ceoStatus === 'Approved' && l.ctoStatus === 'Approved');
    const isCasual = l.type === 'Casual Leave' || (l as any).leaveCategory === 'Casual Leave';
    return isEmp && isApproved && isCasual;
  }).length;

  const balance = Math.max(0, credited - approvedLeavesTaken);
  const currentMonthPrefix = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
  const monthTaken = (leaveRequests || []).filter(l => {
    if (!l) return false;
    const isEmp =
      (!!l.employeeId && (l.employeeId === emp.id || l.employeeId === emp.employeeId)) ||
      (!!l.employeeUid && (l.employeeUid === emp.uid || l.employeeUid === emp.id)) ||
      (!!l.employeeName && !!emp.fullName && l.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase());
    const isApproved = l.status === 'Approved' ||
      ((l.pmStatus === 'Approved' || l.pmStatus === 'N/A' || l.pmStatus === 'Bypassed') &&
       (l.hrStatus === 'Approved' || l.hrStatus === 'N/A' || l.hrStatus === 'Bypassed') &&
       l.ceoStatus === 'Approved' && l.ctoStatus === 'Approved');
    const isCasual = l.type === 'Casual Leave' || (l as any).leaveCategory === 'Casual Leave';
    const isInMonth = l.startDate ? l.startDate.startsWith(currentMonthPrefix) : false;
    return isEmp && isApproved && isCasual && isInMonth;
  }).length;

  return { credited, taken: approvedLeavesTaken, balance, monthlyBalance: Math.max(0, balance - monthTaken) };
}

/**
 * Aggregates Earn Leave, Sick Leave, and Casual Leave balances into a single summary object.
 * Used by the Leave Balance KPI box in the monthly attendance modal.
 */
export function computeTotalLeaveBalances(
  emp: any,
  leaveRequests: any[] = [],
  refDate: Date = new Date()
): {
  earnLeave: { credited: number; taken: number; balance: number; monthlyBalance: number };
  sickLeave: { credited: number; taken: number; balance: number };
  casualLeave: { credited: number; taken: number; balance: number; monthlyBalance: number };
  totalCredited: number;
  totalTaken: number;
  totalBalance: number;
} {
  const el = computeEmployeeLeaveBalance(emp, leaveRequests, refDate);
  const sl = computeSickLeaveBalance(emp, leaveRequests, refDate);
  const cl = computeCasualLeaveBalance(emp, leaveRequests, refDate);

  // Compute monthly balance for earn leave
  const currentMonthPrefix = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`;
  const elMonthTaken = (leaveRequests || []).filter(l => {
    if (!l) return false;
    const isEmp =
      (!!l.employeeId && (l.employeeId === emp?.id || l.employeeId === emp?.employeeId)) ||
      (!!l.employeeUid && (l.employeeUid === emp?.uid || l.employeeUid === emp?.id)) ||
      (!!l.employeeName && !!emp?.fullName && l.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase());
    const isApproved = l.status === 'Approved' ||
      ((l.pmStatus === 'Approved' || l.pmStatus === 'N/A' || l.pmStatus === 'Bypassed') &&
       (l.hrStatus === 'Approved' || l.hrStatus === 'N/A' || l.hrStatus === 'Bypassed') &&
       l.ceoStatus === 'Approved' && l.ctoStatus === 'Approved');
    const isEarnLeave = l.type === 'Leave' || l.type === 'Earn Leave' || (l as any).leaveCategory === 'Earn Leave';
    const isInMonth = l.startDate ? l.startDate.startsWith(currentMonthPrefix) : false;
    return isEmp && isApproved && isEarnLeave && isInMonth;
  }).length;

  return {
    earnLeave: { credited: el.credited, taken: el.taken, balance: el.balance, monthlyBalance: Math.max(0, el.balance - elMonthTaken) },
    sickLeave: { credited: sl.credited, taken: sl.taken, balance: sl.balance },
    casualLeave: cl,
    totalCredited: el.credited + sl.credited + cl.credited,
    totalTaken: el.taken + sl.taken + cl.taken,
    totalBalance: el.balance + sl.balance + cl.balance,
  };
}

/**
 * Dynamic Employment Type Progression:
 * - All employees start as 'Intern'
 * - After 3 months from start date -> become 'Trainee'
 * - 6 months from the start -> become 'Full-Time'
 * - Executive Leadership / Founders remain 'Full-Time'
 */
export function computeEmploymentType(emp: any, refDate: Date = new Date()): EmploymentType {
  if (!emp) return 'Intern';

  // Founders & Executive Leadership remain Full-Time
  if (isExecutiveOrLeadership(emp)) {
    return 'Full-Time';
  }

  const desig = (emp.designation || '').toLowerCase();
  const name = (emp.fullName || '').toLowerCase();
  const id = (emp.employeeId || emp.id || '').toLowerCase();
  const email = (emp.email || '').toLowerCase();

  // D. Koushik is explicitly Intern per organization policy
  if (name.includes('koushik') || id.includes('kss2407003') || email.includes('koushik')) {
    return 'Intern';
  }

  if (
    desig.includes('managing director') ||
    desig.includes('founder') ||
    desig.includes('ceo') ||
    desig.includes('cto')
  ) {
    return 'Full-Time';
  }

  const rawJoinDateStr = emp.joiningDate || (emp as any).joining_date || COMPANY_START_DATE;
  // Any date before company inception (27 July 2026) is normalized to official start date
  const joinDateStr = rawJoinDateStr < COMPANY_START_DATE ? COMPANY_START_DATE : rawJoinDateStr;
  const joinDate = new Date(joinDateStr);
  if (isNaN(joinDate.getTime())) {
    return 'Intern';
  }

  // Calculate elapsed calendar months from start date
  const startYear = joinDate.getFullYear();
  const startMonth = joinDate.getMonth();
  const startDay = joinDate.getDate();

  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth();
  const refDay = refDate.getDate();

  let monthsElapsed = (refYear - startYear) * 12 + (refMonth - startMonth);
  if (refDay < startDay) {
    monthsElapsed -= 1;
  }

  if (monthsElapsed < 3) {
    return 'Intern';
  } else if (monthsElapsed < 6) {
    return 'Trainee';
  } else {
    return 'Full-Time';
  }
}

export interface CompanyHolidayItem {
  date: string; // YYYY-MM-DD
  name: string;
  dayOfWeek: string;
  type?: string;
}

/**
 * Official Company & Declared Public Holidays (2026)
 * Configured per official company holiday calendar:
 * 1. 14 September 2026 - Ganesh Chaturthi (Festival Holiday)
 * 2. 02 October 2026   - Gandhi Jayanti (National Holiday)
 * 3. 20 October 2026   - Dussehra / Vijayadashami (Company Holiday)
 * 4. 01 November 2026  - Karnataka Rajyotsava (Karnataka State Holiday)
 * 5. 08 November 2026  - Diwali / Deepavali (Festival Holiday)
 * 6. 25 December 2026  - Christmas (Company Holiday)
 */
export const OFFICIAL_COMPANY_HOLIDAYS_2026: CompanyHolidayItem[] = [
  { date: '2026-09-14', name: 'Ganesh Chaturthi', dayOfWeek: 'Monday', type: 'Festival Holiday' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', dayOfWeek: 'Friday', type: 'National Holiday' },
  { date: '2026-10-20', name: 'Dussehra / Vijayadashami', dayOfWeek: 'Tuesday', type: 'Company Holiday' },
  { date: '2026-11-01', name: 'Karnataka Rajyotsava', dayOfWeek: 'Sunday', type: 'Karnataka State Holiday' },
  { date: '2026-11-08', name: 'Diwali / Deepavali', dayOfWeek: 'Sunday', type: 'Festival Holiday' },
  { date: '2026-12-25', name: 'Christmas', dayOfWeek: 'Friday', type: 'Company Holiday' },
];

export const OFFICIAL_HOLIDAY_DATES_2026: string[] = OFFICIAL_COMPANY_HOLIDAYS_2026.map(h => h.date);

export function getHolidayInfo(dateStr: string): CompanyHolidayItem | undefined {
  return OFFICIAL_COMPANY_HOLIDAYS_2026.find(h => h.date === dateStr);
}

/**
 * IST is a fixed UTC+05:30 with no daylight saving, so a company wall-clock time
 * on a given calendar date is an exact offset from that date's UTC midnight.
 * Anything that needs "7 PM IST on 2026-08-17" as an instant must use this
 * rather than `new Date(y, m, d, 19)`, which silently means 7 PM in whatever
 * timezone the device happens to be in.
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Wall-clock hour/minute of an instant IN COMPANY TIME (IST), independent of the
 * device timezone. Returns { hour: 0-23, minute: 0-59 }.
 */
export function getISTHourMinute(input: any = new Date()): { hour: number; minute: number } {
  const d = input instanceof Date ? input : new Date(typeof input === 'number' ? input : String(input));
  if (isNaN(d.getTime())) return { hour: 0, minute: 0 };
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: COMPANY_TIMEZONE }).format(d),
    10
  );
  const minute = parseInt(
    new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: COMPANY_TIMEZONE }).format(d),
    10
  );
  // Intl renders midnight as "24" in some ICU versions under hour12: false.
  return { hour: hour === 24 ? 0 : hour, minute };
}

/**
 * Canonical helper resolving work-day date string (YYYY-MM-DD) strictly in the employee's timezone.
 * Handles Firestore Timestamp, ISO datetime string, Date object, or epoch number.
 */
export function getWorkDate(
  dateInput: any = new Date(),
  timeZone: string = COMPANY_TIMEZONE
): string {
  if (!dateInput) {
    return getWorkDate(new Date(), timeZone);
  }

  // Handle Firestore Timestamp objects
  if (dateInput && typeof dateInput.toDate === 'function') {
    return getWorkDate(dateInput.toDate(), timeZone);
  }
  if (dateInput && typeof dateInput.toMillis === 'function') {
    return getWorkDate(new Date(dateInput.toMillis()), timeZone);
  }
  if (dateInput && typeof dateInput.seconds === 'number') {
    return getWorkDate(new Date(dateInput.seconds * 1000 + (dateInput.nanoseconds || 0) / 1e6), timeZone);
  }

  // If already clean YYYY-MM-DD string
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  const d = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  if (d instanceof Date && !isNaN(d.getTime())) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  }

  // Fallback to current date in operational timezone
  const fallback = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return fallback.format(new Date());
}

/**
 * Backwards-compatible alias for getWorkDate
 */
export const getEmployeeWorkDate = getWorkDate;

/**
 * SHIFT_COMPLETE truth resolver — the ONLY sanctioned way to decide whether an
 * employee's shift is over.
 *
 * Contract: SHIFT_COMPLETE is true ONLY when BOTH timestamps exist AND the
 * checkout has actually happened (not in the future). A checkout timestamp
 * dated AFTER `now` is definitionally fabricated (e.g. a pre-written 07:30 PM
 * auto-checkout or a bad migration) and must NEVER complete a shift.
 */
export function isShiftComplete(
  rec: AttendanceRecord | undefined | null,
  nowMs: number = Date.now()
): boolean {
  if (!rec || !rec.checkInAt || !rec.checkOutAt) return false;
  const outMs = safeGetTimestampMillis(rec.checkOutAt);
  return outMs !== null && outMs <= nowMs;
}

/**
 * Fabrication signature detectors (P0 "Shift Complete everywhere" incident).
 *
 * The legacy migration wrote invented shifts using literal IST-offset strings:
 *   checkInAt  = `${date}T09:45:00.000+05:30`
 *   checkOutAt = `${date}T19:30:00.000+05:30`
 * Genuine system auto-checkouts instead store UTC "Z" ISO strings (from
 * .toISOString()), and genuine manual checkouts store Firestore server
 * Timestamps — neither can ever match these signatures.
 */
export function isFabricatedCheckoutOnly(checkOutAt: any): boolean {
  const co = typeof checkOutAt === 'string' ? checkOutAt : '';
  return co.includes('T19:30:00') && co.endsWith('+05:30');
}

export function isFabricatedShiftPair(checkInAt: any, checkOutAt: any): boolean {
  const ci = typeof checkInAt === 'string' ? checkInAt : '';
  return (
    ci.includes('T09:45:00') &&
    ci.endsWith('+05:30') &&
    isFabricatedCheckoutOnly(checkOutAt)
  );
}

/**
 * Phase 18 contract: LOCAL calendar date (YYYY-MM-DD) with NO UTC drift.
 * Unlike getWorkDate (which pins to the company timezone), this formats in the
 * device's own timezone — 23:30 local must stay the same calendar day.
 * Falls back to today's date for invalid input, never throws, never NaN.
 */
export function getLocalDateString(dateInput: any = new Date()): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (!d || isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Phase 4 contract alias: match an attendance record to an employee across
 * id / uid / employeeCode representations. Same resolver as
 * isAttendanceForEmployee (record-first argument order).
 */
export const isRecordForEmployee = isAttendanceForEmployee;

/**
 * Phase 18 contract: shift-capped working minutes.
 *
 * Elapsed minutes between check-in and check-out, capped at 7:00 PM (19:00)
 * OF THE RECORD'S WORK DATE so a forgotten check-out at 2 AM cannot inflate
 * the previous day into a 16-hour shift. Break minutes are subtracted and
 * the result floors at zero. Missing check-in yields 0.
 */
export function computeShiftWorkingMinutes(
  dateStr: string,
  checkInISO: string | null | undefined,
  checkOutISO: string | null | undefined,
  breakMinutes: number = 0
): number {
  if (!checkInISO) return 0;
  const checkInMs = new Date(checkInISO).getTime();
  if (isNaN(checkInMs)) return 0;

  // Shift end = 19:00 LOCAL time of the record's work date
  const [y, m, d] = String(dateStr).split('-').map(Number);
  let capMs: number;
  if (y && m && d) {
    capMs = new Date(y, m - 1, d, 19, 0, 0, 0).getTime();
  } else {
    const fallbackCap = new Date(checkInISO);
    fallbackCap.setHours(19, 0, 0, 0);
    capMs = fallbackCap.getTime();
  }

  let endMs = checkOutISO ? new Date(checkOutISO).getTime() : Date.now();
  if (isNaN(endMs)) endMs = Date.now();
  endMs = Math.min(endMs, capMs);

  const rawMinutes = Math.floor(Math.max(0, endMs - checkInMs) / 60000);
  return Math.max(0, rawMinutes - Math.max(0, Number(breakMinutes) || 0));
}

/**
 * Accurately calculate total break minutes across all break entries
 */
export function calculateTotalBreakMinutes(breaks: any[] = []): number {
  if (!Array.isArray(breaks) || breaks.length === 0) return 0;
  return breaks.reduce((total, b) => {
    if (typeof b.durationMinutes === 'number' && b.durationMinutes > 0) {
      return total + b.durationMinutes;
    }
    const start = safeGetTimestampMillis(b.startAt || b.startTime);
    const end = safeGetTimestampMillis(b.endAt || b.endTime);
    if (start && end && end > start) {
      return total + Math.max(1, Math.round((end - start) / 60000));
    }
    return total;
  }, 0);
}

/**
 * Accurately calculate break duration breakdown and proficiency metrics
 */
export function calculateBreakBreakdown(
  breaks: any[] = [],
  activeBreakElapsedSec: number = 0
) {
  let teaSecs = 0;
  let mealSecs = 0;
  let huddleSecs = 0;
  let meetingSecs = 0;
  let trainingSecs = 0;
  let activitySecs = 0;

  let ongoingAssigned = false;

  (breaks || []).forEach(b => {
    let durSec = 0;
    const isOngoing = !b.endAt && !(b as any).endTime;
    if (isOngoing) {
      if (!ongoingAssigned) {
        durSec = Math.max(0, activeBreakElapsedSec);
        ongoingAssigned = true;
      }
    } else if (typeof b.durationMinutes === 'number' && b.durationMinutes > 0) {
      durSec = b.durationMinutes * 60;
    } else if ((b.startAt || b.startTime) && (b.endAt || b.endTime)) {
      // B17 FIX: accept legacy breaks that only carry startTime/endTime (no startAt/
      // endAt). The former `b.startAt && b.endAt` guard skipped them entirely, so the
      // breakdown under-reported break time for old records while calculateTotalBreakMinutes
      // (which reads startAt||startTime) counted them — the two totals disagreed.
      const startMs = safeGetTimestampMillis(b.startAt || b.startTime);
      const endMs = safeGetTimestampMillis(b.endAt || b.endTime);
      if (startMs && endMs && endMs > startMs) {
        durSec = Math.floor((endMs - startMs) / 1000);
      }
    }

    // Protection against corrupted numbers
    durSec = Math.max(0, durSec);

    // Delegated to the single shared classifier. This block previously inlined its
    // own `type.includes('tea')` chain, which matched the 'tea' inside "TEAm
    // Huddle" / "TEAm Meeting" and filed every team break as a Tea Break — so the
    // huddle and meeting buckets were always 0 and tea was always inflated.
    switch (classifyBreakType(b.type)) {
      case 'tea': teaSecs += durSec; break;
      case 'meal': mealSecs += durSec; break;
      case 'huddle': huddleSecs += durSec; break;
      case 'meeting': meetingSecs += durSec; break;
      case 'training': trainingSecs += durSec; break;
      default: activitySecs += durSec; break;
    }
  });

  const totalBreakSecs = teaSecs + mealSecs + huddleSecs + meetingSecs + trainingSecs + activitySecs;
  return {
    teaSecs,
    mealSecs,
    huddleSecs,
    meetingSecs,
    trainingSecs,
    activitySecs,
    totalBreakSecs,
    totalBreakMinutes: Math.round(totalBreakSecs / 60)
  };
}

/**
 * Deterministic Doc ID generator: attendance/{uid}_{YYYY-MM-DD}
 */
export function getAttendanceDocId(uid: string, dateStr: string): string {
  const cleanUid = String(uid || '').trim();
  const cleanDate = getWorkDate(dateStr);
  return `${cleanUid}_${cleanDate}`;
}

/**
 * Universal canonical employee Key resolver
 * Matches across id, uid, employeeUid, employeeId, employeeCode, or fullName.
 */
export function getEmployeeKey(empOrUid: any, fallbackUserUid?: string): string {
  if (!empOrUid && fallbackUserUid) return fallbackUserUid.trim();
  if (typeof empOrUid === 'string') return empOrUid.trim();
  // P0 FIX: fallbackUserUid is the LOGGED-IN ACTOR's uid (callers pass user?.uid).
  // It was ranked above the target employee's own id/employeeId, so when an actor
  // acted on a DIFFERENT employee that has no uid/employeeUid field — 10 of 15
  // seeded staff — the record was keyed under the ACTOR. An HR admin checking two
  // such employees in on one day produced ONE doc `{hrUid}_{date}` that the second
  // check-in silently overwrote (merge:true). The subject's own identity must
  // always win; the actor uid is a last resort for a bare/empty subject only.
  const key = empOrUid?.uid || empOrUid?.employeeUid || empOrUid?.id ||
    empOrUid?.employeeId || empOrUid?.employeeCode || fallbackUserUid || '';
  return String(key).trim();
}

/**
 * Backwards-compatible alias for getEmployeeKey
 */
export const getCanonicalEmployeeUid = getEmployeeKey;

/**
 * Safe parser to convert any Firestore Timestamp / Date / ISO string / number into standard ISO string.
 * Returns null if absent, undefined, or empty (preventing crashes or NaNs on checkOutAt/checkInAt).
 */
export function formatTimestampToISO(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (val && typeof val.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (val && typeof val.toMillis === 'function') {
    try {
      return new Date(val.toMillis()).toISOString();
    } catch {
      return null;
    }
  }
  if (val && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1e6).toISOString();
  }
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    const millis = val < 1e11 ? val * 1000 : val;
    return new Date(millis).toISOString();
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  return null;
}

/**
 * Returns epoch timestamp in milliseconds, never NaN.
 * Returns null if invalid or absent.
 */
export function safeGetTimestampMillis(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return null;
    return val < 1e11 ? val * 1000 : val;
  }
  if (val && typeof val.toMillis === 'function') {
    try {
      const ms = val.toMillis();
      return isNaN(ms) ? null : ms;
    } catch {
      return null;
    }
  }
  if (val && typeof val.toDate === 'function') {
    try {
      const ms = val.toDate().getTime();
      return isNaN(ms) ? null : ms;
    } catch {
      return null;
    }
  }
  if (val && typeof val.seconds === 'number') {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1e6);
  }
  if (val instanceof Date) {
    const ms = val.getTime();
    return isNaN(ms) ? null : ms;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
    const ms = new Date(trimmed).getTime();
    return isNaN(ms) ? null : ms;
  }
  return null;
}

/**
 * Canonical record identity matcher to check if an AttendanceRecord belongs to an employee.
 * Resolves Firebase Auth UID, employee code (e.g. KSS2407014), database id, and names across all portals.
 */
export function isAttendanceForEmployee(
  rec: AttendanceRecord | undefined | null,
  employeeOrUid: any,
  targetDate?: string
): boolean {
  if (!rec || !employeeOrUid) return false;

  if (targetDate) {
    const normalizedRecDate = getWorkDate(rec.date || rec.checkInAt || rec.createdAt);
    const normalizedTargetDate = getWorkDate(targetDate);
    if (normalizedRecDate !== normalizedTargetDate) return false;
  }

  const cleanId = (val: any) => String(val || '').trim().toLowerCase().replace(/^emp-/, '');

  const targetUid = String(getCanonicalEmployeeUid(employeeOrUid) || '').trim().toLowerCase();
  const targetCode = String(
    typeof employeeOrUid === 'string'
      ? employeeOrUid
      : (employeeOrUid?.employeeId || employeeOrUid?.employeeCode || employeeOrUid?.id || '')
  ).trim().toLowerCase();
  const targetId = String(
    typeof employeeOrUid === 'string'
      ? employeeOrUid
      : (employeeOrUid?.id || employeeOrUid?.employeeId || '')
  ).trim().toLowerCase();
  const targetName = String(
    typeof employeeOrUid === 'object' && employeeOrUid?.fullName
      ? employeeOrUid.fullName
      : ''
  ).trim().toLowerCase();

  const recUid = String(rec.uid || rec.employeeUid || '').trim().toLowerCase();
  const recEmpId = String(rec.employeeId || '').trim().toLowerCase();
  const recEmpCode = String(rec.employeeCode || '').trim().toLowerCase();
  const recName = String(rec.employeeName || '').trim().toLowerCase();
  const recDocId = String(rec.id || '').trim().toLowerCase();
  const recDocPrefix = recDocId.includes('_') ? recDocId.split('_')[0] : recDocId;

  // Normalized identity tokens (stripped of 'emp-' prefix)
  const targetTokens = new Set([
    cleanId(targetUid),
    cleanId(targetCode),
    cleanId(targetId),
    targetUid,
    targetCode,
    targetId
  ].filter(t => t.length > 0));

  const recTokens = [
    cleanId(recUid),
    cleanId(recEmpId),
    cleanId(recEmpCode),
    cleanId(recDocPrefix),
    recUid,
    recEmpId,
    recEmpCode,
    recDocPrefix
  ].filter(t => t.length > 0);

  // 1. Check if any target identity token matches any record identity token
  for (const rTok of recTokens) {
    if (targetTokens.has(rTok)) {
      return true;
    }
  }

  // 2. Check docId prefixes
  for (const tTok of targetTokens) {
    if (recDocId.startsWith(`${tTok}_`)) {
      return true;
    }
  }

  // 3. Normalized Full Name matching (ignoring punctuation and order of tokens)
  if (targetName && recName) {
    const cleanTarget = targetName.replace(/[^a-z0-9]/g, '');
    const cleanRec = recName.replace(/[^a-z0-9]/g, '');
    // P0 FIX: substring matching cross-linked distinct employees — "ram" ⊂ "ramesh",
    // "ramkumar" ⊂ "ramkumarreddy". This branch is the last resort reached only when
    // no identity token matched, i.e. exactly for the no-uid seeded records, so a
    // false positive here let one employee see and check out of another's shift.
    // Exact normalized equality only; genuine same-person records still match modulo
    // spacing/punctuation, and true identity is disambiguated by steps 1–2 above.
    if (cleanTarget && cleanRec && cleanTarget === cleanRec) {
      return true;
    }
  }

  return false;
}

/**
 * Single Source of Truth resolver for "today's attendance record".
 *
 * ROOT-CAUSE FIX: Firestore may contain BOTH a canonical doc ({uid}_{date}) and a
 * legacy doc (KSS…_date / emp…_date) for the same employee + work-day. A bare
 * `attendance.find(isAttendanceForEmployee)` returns whichever duplicate sorts first,
 * so the UI could render the stale/blank record while backend transactions target the
 * canonical doc — producing "Already checked in" popups on a page that still shows
 * the Check-In button.
 *
 * Resolution priority:
 *   1. Exact canonical doc ID match ({uid}_{date})
 *   2. Any matching record that actually HAS a checkInAt (most recently updated wins)
 *   3. Any other fuzzy match (legacy fallback)
 */
export function resolveAttendanceRecord(
  attendance: AttendanceRecord[],
  employeeOrUid: any,
  targetDate?: string
): AttendanceRecord | undefined {
  if (!Array.isArray(attendance) || attendance.length === 0 || !employeeOrUid) return undefined;

  const date = targetDate ? getWorkDate(targetDate) : undefined;
  if (date && date < COMPANY_START_DATE) return undefined;

  const canonicalUid = getCanonicalEmployeeUid(employeeOrUid);

  const matches = attendance.filter(rec => isAttendanceForEmployee(rec, employeeOrUid, date) && (!rec.date || rec.date >= COMPANY_START_DATE));

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  const canonicalId = canonicalUid && date ? getAttendanceDocId(canonicalUid, date) : null;

  // 1. The canonical document {uid}_{YYYY-MM-DD} ALWAYS wins when it carries a
  //    real check-in. Every write path (recordCheckIn / startBreak / endBreak /
  //    recordCheckOut) targets this exact id, so it is the authoritative doc.
  //
  //    P0 FIX (PM "taking a break rewrites my check-in time and zeroes my
  //    hours"): ranking checked-in duplicates by `updatedAt` FIRST made the
  //    winner flap. startBreak writes `updatedAt: serverTimestamp()`, which
  //    Firestore reads back as `null` in the latency-compensated local snapshot
  //    (serverTimestamps: 'none'). That collapsed the canonical doc's sort key
  //    to its checkInAt, promoting any duplicate with a fresher updatedAt — so
  //    the widget suddenly rendered the stale doc's checkInAt and its absent
  //    workingMinutes. Anchoring on the canonical id removes the race entirely.
  if (canonicalId) {
    const canonicalCheckedIn = matches.find(rec => rec.id === canonicalId && !!rec.checkInAt);
    if (canonicalCheckedIn) return canonicalCheckedIn;
  }

  // 2. Otherwise prefer any record with real check-in data (never let a blank
  //    duplicate mask an active shift), most recently touched first.
  const checkedIn = matches
    .filter(rec => !!rec.checkInAt)
    .sort((a, b) => (safeGetTimestampMillis(b.updatedAt || b.checkInAt) || 0) - (safeGetTimestampMillis(a.updatedAt || a.checkInAt) || 0));
  if (checkedIn.length > 0) return checkedIn[0];

  // 3. Exact canonical document ID, even without check-in data
  if (canonicalId) {
    const byCanonicalId = matches.find(rec => rec.id === canonicalId);
    if (byCanonicalId) return byCanonicalId;
  }

  // 3. Deterministic last resort: most recently updated among blanks
  return matches
    .slice()
    .sort((a, b) => (safeGetTimestampMillis(b.updatedAt || b.createdAt) || 0) - (safeGetTimestampMillis(a.updatedAt || a.createdAt) || 0))[0];
}

/**
 * Haversine formula to calculate distance between two GPS points in meters
 */
export function calculateGpsDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Universal Employee ID / Code Matcher (Fixes C16 Contract)
 */
export function isEmployeeMatch(
  empIdentifierOrObj: any,
  targetIdOrCode: string | undefined | null
): boolean {
  if (!targetIdOrCode || !empIdentifierOrObj) return false;

  const targetLower = String(targetIdOrCode).trim().toLowerCase();

  if (typeof empIdentifierOrObj === 'string') {
    return empIdentifierOrObj.trim().toLowerCase() === targetLower;
  }

  const id = String(empIdentifierOrObj.id || '').trim().toLowerCase();
  const employeeId = String(empIdentifierOrObj.employeeId || '').trim().toLowerCase();
  const employeeCode = String(empIdentifierOrObj.employeeCode || '').trim().toLowerCase();
  const code = String(empIdentifierOrObj.code || '').trim().toLowerCase();

  return (
    (id !== '' && id === targetLower) ||
    (employeeId !== '' && employeeId === targetLower) ||
    (employeeCode !== '' && employeeCode === targetLower) ||
    (code !== '' && code === targetLower)
  );
}

/**
 * Generate secure attendance payload for QR Code
 */
export function generateEmployeeQrToken(employee: Employee, _expiryMinutes: number = 10): string {
  // TOTP interval of 10 seconds
  const bucket = Math.floor(Date.now() / 10000);
  
  // Combine employee unique token with bucket to create a rotating hash
  const totpData = `${employee.id}|${employee.qrToken}|${bucket}`;
  const encoded = btoa(totpData);
  
  const rawPayload = {
    totp: encoded,
    empDbId: employee.id,
    ver: '2026.1_TOTP'
  };
  return JSON.stringify(rawPayload);
}

export interface QrParseResult {
  valid: boolean;
  empId?: string;
  empDbId?: string;
  expired?: boolean;
  error?: string;
}

/**
 * Parse and validate QR code token payload
 */
export function parseAndValidateQrCode(qrText: string): QrParseResult {
  try {
    const data = JSON.parse(qrText);
    if (!data.totp || !data.empDbId) {
      // Fallback for old tokens
      if (data.empId && data.token) {
        if (data.exp && Date.now() > data.exp) return { valid: false, expired: true, error: 'Expired' };
        return { valid: true, empId: data.empId, empDbId: data.empDbId };
      }
      return { valid: false, error: 'Invalid QR format' };
    }

    const decoded = atob(data.totp);
    const [empId, token, bucketStr] = decoded.split('|');
    const bucket = parseInt(bucketStr, 10);
    const currentBucket = Math.floor(Date.now() / 10000);
    
    // Allow +/- 1 bucket (10 seconds) for clock drift
    if (Math.abs(currentBucket - bucket) > 1) {
      return { valid: false, expired: true, error: 'SECURITY ALERT: QR Code has expired. Prevented possible screenshot replay attack.' };
    }

    return { valid: true, empDbId: data.empDbId, empId: empId, _token: token } as any;
  } catch (e) {
    // If simple text token match
    if (qrText.startsWith('EMP') || qrText.startsWith('QR-TOKEN-')) {
      return { valid: true, empId: qrText };
    }
    return { valid: false, error: 'Unrecognized QR code payload' };
  }
}

export interface CheckInEvaluation {
  allowed: boolean;
  action: 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_CHECKED_OUT';
  status: AttendanceStatus;
  locationVerified: boolean;
  distanceMeters?: number;
  message: string;
}

/**
 * Punctuality of a check-in, derived purely from its timestamp in IST.
 * Mirrors the exact grace rule inside evaluateAttendanceScan: on-time through
 * 10:15 AM IST, Late afterwards. Extracted so WFH toggles can restore the correct
 * punctuality label without re-clobbering it, and so it is unit-testable.
 */
export function isLateCheckIn(checkInAt: any): boolean {
  const iso = formatTimestampToISO(checkInAt);
  if (!iso) return false;
  const { hour: hh, minute: mm } = getISTHourMinute(new Date(iso));
  // Derived from the canonical shift definition rather than hard-coded 10/15, so
  // a shift change cannot leave the lateness test behind.
  return hh * 60 + mm > SHIFT_START_HOUR * 60 + SHIFT_START_MINUTE + SHIFT_LATE_GRACE_MINUTES;
}

export interface CheckInEligibility {
  allowed: boolean;
  reason: 'ON_LEAVE' | 'WEEKLY_OFF' | 'OFFICIAL_HOLIDAY' | 'WINDOW_CLOSED' | 'BEFORE_OPEN' | 'NONE';
  message: string;
  leaveType?: string;
  holidayName?: string;
}

/**
 * Validates whether an employee is eligible to check in on a specific date.
 * Strictly blocks check-in on:
 * 1. Approved leaves (PTO, Casual, Sick, Maternity, etc. - excluding WFH)
 * 2. Official declared company holidays (17 state/festival/national holidays or custom holidays)
 * 3. Official weekly offs (Sundays)
 */
export function validateCheckInEligibility(
  employee: any,
  dateStr: string,
  opts: {
    leaveRequests?: any[];
    holidayDates?: string[];
    settings?: CompanySettings;
  } = {}
): CheckInEligibility {
  if (!employee || !dateStr) {
    return { allowed: false, reason: 'NONE', message: 'Employee or date information is missing.' };
  }

  // 0. Pre-Flight Root Rule Check: Inception Date (27 July 2026)
  if (dateStr < COMPANY_START_DATE) {
    return {
      allowed: false,
      reason: 'BEFORE_OPEN',
      message: 'Check-In Disabled: Company operations officially started on 27 July 2026. Attendance cannot be recorded prior to this date.'
    };
  }

  // 1. Check if employee is on Approved Leave (excluding approved WFH)
  const isApprovedLeave = hasApprovedLeaveOn(opts.leaveRequests, employee, dateStr, EXCUSED_LEAVE_TYPES as unknown as string[]);
  if (isApprovedLeave) {
    const leaveReq = (opts.leaveRequests || []).find(r => 
      r.status === 'Approved' && 
      r.type !== 'WFH' &&
      ((!!r.employeeId && (r.employeeId === employee.id || r.employeeId === employee.employeeId)) ||
       (!!r.employeeUid && (r.employeeUid === employee.uid || r.employeeUid === employee.id)) ||
       (!!r.employeeName && !!employee.fullName && r.employeeName.trim().toLowerCase() === employee.fullName.trim().toLowerCase())) &&
      dateStr >= (r.startDate || r.fromDate) && dateStr <= (r.endDate || r.toDate || r.startDate)
    );
    const leaveType = leaveReq?.type || 'Approved Leave';
    return {
      allowed: false,
      reason: 'ON_LEAVE',
      leaveType,
      message: `Check-In Disabled: You have an approved ${leaveType} today. Attendance check-in is not permitted during approved leaves.`
    };
  }

  // 2. Check if today is an Official Declared Company Holiday
  const holidayInfo = getHolidayInfo(dateStr);
  const holidays = (Array.isArray(opts.holidayDates) && opts.holidayDates.length > 0)
    ? opts.holidayDates
    : OFFICIAL_HOLIDAY_DATES_2026;
  if (holidayInfo || holidays.includes(dateStr)) {
    const holidayName = holidayInfo?.name || 'Declared Company Holiday';
    return {
      allowed: false,
      reason: 'OFFICIAL_HOLIDAY',
      holidayName,
      message: `Check-In Disabled: Today is an official declared company holiday (${holidayName}). The office is closed.`
    };
  }

  // 3. Check if today is a Sunday (Official Weekly Off)
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  if (day === 0) {
    return {
      allowed: false,
      reason: 'WEEKLY_OFF',
      message: 'Check-In Disabled: Sunday is an official weekly off for all personnel.'
    };
  }

  return { allowed: true, reason: 'NONE', message: 'Eligible for check-in' };
}

/**
 * Evaluates whether check-in / check-out is valid based on settings, time, location, leaves, holidays, and weekly offs
 */
export function evaluateAttendanceScan(
  employee: Employee,
  todayRecord: AttendanceRecord | undefined,
  settings: CompanySettings,
  userLat?: number,
  userLon?: number,
  isApprovedWfh?: boolean,
  extraOpts: { leaveRequests?: any[]; holidayDates?: string[]; nowMs?: number } = {}
): CheckInEvaluation {
  const isGpsEnforced = settings.gpsRequired !== false;

  // 0. Pre-Flight Root Rule Check: Approved Leaves, Official Holidays & Sunday Weekly Offs
  const todayStr = getWorkDate(new Date(extraOpts.nowMs || Date.now()));
  const eligibility = validateCheckInEligibility(employee, todayStr, {
    leaveRequests: extraOpts.leaveRequests,
    holidayDates: extraOpts.holidayDates,
    settings
  });

  if (!eligibility.allowed && (!todayRecord || !todayRecord.checkInAt)) {
    return {
      allowed: false,
      action: 'CHECK_IN',
      status: eligibility.reason === 'ON_LEAVE' ? 'On Leave' : 'Holiday',
      locationVerified: false,
      distanceMeters: 0,
      message: eligibility.message
    };
  }

  // 1. Check GPS Location
  let locationVerified = true;
  let distanceMeters = 0;

  if (isApprovedWfh) {
    // Approved WFH: Bypass office GPS radius check completely so employee can check in from home
    locationVerified = true;
    distanceMeters = 0;
  } else if (!isGpsEnforced) {
    // GPS not enforced: allow web check-in regardless of location
    locationVerified = true;
    distanceMeters = 0;
  } else {
    // Geofencing rule: User must be within allowedRadiusMeters from office
    if (userLat === undefined || userLon === undefined) {
      locationVerified = false;
    } else {
      const officeLat = settings.officeLatitude || 12.915000;
      const officeLon = settings.officeLongitude || 77.646000;
      distanceMeters = calculateGpsDistanceMeters(userLat, userLon, officeLat, officeLon);
      const allowedRadius = settings.allowedRadiusMeters || 300;
      if (distanceMeters > allowedRadius) {
        locationVerified = false;
      }
    }
  }

  // 2. Evaluate State
  if (!todayRecord || !todayRecord.checkInAt) {
    // Perform CHECK_IN
    const now = new Date();

    // MORNING TIME WINDOW RULE: Check-in opens from 09:30 AM IST onwards.
    const currentHourIST = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(now), 10);
    const currentMinIST = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'Asia/Kolkata' }).format(now), 10);
    const totalMinutesIST = currentHourIST * 60 + currentMinIST;

    if (totalMinutesIST < 9 * 60 + 30) {
      const minRemaining = (9 * 60 + 30) - totalMinutesIST;
      return {
        allowed: false,
        action: 'CHECK_IN',
        status: 'Present',
        locationVerified: false,
        distanceMeters: 0,
        message: `Check-In Restricted: Morning check-in opens at 09:30 AM IST. Please wait until 09:30 AM to check in (${minRemaining} mins remaining).`
      };
    }

    // EVENING TIME WINDOW RULE: Check-in allowed until 07:30 PM IST (19:30 IST cutoff).
    if (totalMinutesIST >= 19 * 60 + 30) {
      return {
        allowed: false,
        action: 'CHECK_IN',
        status: 'Present',
        locationVerified: false,
        distanceMeters: 0,
        message: `Check-In Blocked: Today's shift check-in window has ended (closed at 07:30 PM IST). New check-ins are not permitted after shift hours.`
      };
    }

    // Grace period: On-time up to 10:15 AM (15 mins past 10:00 AM)
    const isLateArrival = currentHourIST > 10 || (currentHourIST === 10 && currentMinIST > 15);
    let status: AttendanceStatus = isLateArrival ? 'Late' : (isApprovedWfh ? 'Work From Home' : 'Present');

    // ── Strict GPS enforcement on normal office days (RESTORED) ───────────────
    // Commit e61335b ("Allow web check-in for Kuruva Mahesh and fix geofence
    // check") replaced the two blocks below with a bare `locationVerified = false`.
    // That assignment is a no-op — the variable is already false on this path — and
    // the function then returned `allowed: true` regardless, so check-in succeeded
    // from ANY location and was merely relabelled "Web Terminal Standard Mode".
    // Check-out kept its enforcement, which is why only check-in leaked.
    //
    // Both documented escape hatches are untouched: an approved WFH day bypasses
    // this entirely (handled above), and an admin can still disable the geofence
    // wholesale with settings.gpsRequired = false.
    if (!isApprovedWfh && isGpsEnforced && !locationVerified) {
      if (userLat === undefined || userLon === undefined) {
        return {
          allowed: false,
          action: 'CHECK_IN',
          status,
          locationVerified: false,
          distanceMeters: 0,
          message: 'GPS Location Required: On normal office days, you must enable GPS location permissions to check in near the office.'
        };
      }

      const radius = settings.allowedRadiusMeters || 300;
      return {
        allowed: false,
        action: 'CHECK_IN',
        status,
        locationVerified: false,
        distanceMeters,
        message: `Check-In Blocked: You are ${distanceMeters}m away from company office (Allowed limit: ${radius}m). On normal days you must check in at the company office location. Submit a WFH request to check in from home.`
      };
    }

    return {
      allowed: true,
      action: 'CHECK_IN',
      status,
      locationVerified: isApprovedWfh || locationVerified,
      distanceMeters,
      message: isApprovedWfh
        ? 'Checked In — Work From Home (Management Approved)'
        : status === 'Late'
          ? 'Checked In (Late Arrival)'
          : locationVerified
            ? 'Successfully Checked In — GPS Office Location Verified'
            : 'Checked In — Web Terminal Standard Mode'
    };
  }

  if (todayRecord.checkInAt && !todayRecord.checkOutAt) {
    // Perform CHECK_OUT
    if (!isApprovedWfh && isGpsEnforced && !locationVerified) {
      // FALLBACK: trust the verified check-in location evidence stored on the
      // record when the live GPS fix is missing or has drifted outside the
      // radius. The employee was already verified at office for THIS shift —
      // GPS loss at checkout must not trap them inside the terminal.
      const hasStoredVerifiedLocation =
        todayRecord.locationVerified === true &&
        typeof todayRecord.distanceFromOffice === 'number';

      if (hasStoredVerifiedLocation) {
        locationVerified = true;
        distanceMeters = todayRecord.distanceFromOffice as number;
      } else if (userLat === undefined || userLon === undefined) {
        return {
          allowed: false,
          action: 'CHECK_OUT',
          status: todayRecord.status as AttendanceStatus,
          locationVerified: false,
          distanceMeters: 0,
          message: 'GPS Location Required for Check-Out.'
        };
      } else {
        const radius = settings.allowedRadiusMeters || 300;
        return {
          allowed: false,
          action: 'CHECK_OUT',
          status: todayRecord.status as 'Present' | 'Late' | 'Half Day',
          locationVerified: false,
          distanceMeters,
          message: `Check-Out Blocked: You are ${distanceMeters}m away from company office (Allowed limit: ${radius}m).`
        };
      }
    }

    return {
      allowed: true,
      action: 'CHECK_OUT',
      status: todayRecord.status as 'Present' | 'Late' | 'Half Day',
      locationVerified: true,
      distanceMeters,
      message: isApprovedWfh
        ? 'Checked Out Successfully — Work From Home Completed'
        : 'Checked Out Successfully — Office Location Verified'
    };
  }

  // Already checked out today
  return {
    allowed: false,
    action: 'ALREADY_CHECKED_OUT',
    status: todayRecord.status as 'Present' | 'Late' | 'Half Day',
    locationVerified: true,
    message: 'Attendance already completed for today.'
  };
}

/**
 * `generateHistoricalAttendance` was removed here (item #17).
 *
 * It fabricated 90 days of attendance per employee from `Math.sin(seed)` --
 * check-in times, work durations, tea and meal breaks, even Late and WFH
 * statuses -- and returned them as ordinary `AttendanceRecord`s. Nothing in
 * `src/` called it, so it produced no live data, but it was the largest
 * fabrication source in the repo and one import away from writing invented
 * history into payroll, appraisals and compliance exports. Historical
 * attendance must come from real check-ins or from an explicit HR
 * correction (`applyAttendanceCorrection`), never from a seeded generator.
 */

/**
 * ── Daily roster derivation ──────────────────────────────────────────────────
 *
 * P1 FIX: "Absentees and work-from-homes are not shown in the admin portal —
 * only presentees are shown."
 *
 * ROOT CAUSE: absence is the ABSENCE of a document. Every admin/HR view filtered
 * the `attendance` collection directly, but no code path has ever written an
 * `Absent` record — an employee who never checks in simply has no doc for that
 * date. So `status === 'Absent'` could not match anything, the Absent filter
 * always returned an empty table, and the roster silently shrank to whoever had
 * checked in. The same applied to any WFH employee who had not yet checked in.
 *
 * The fix is to derive the roster instead of reading it: start from the employee
 * directory (the real source of truth for "who was expected today") and LEFT JOIN
 * the attendance records onto it. Employees with no record are materialised as
 * synthetic rows so they are visible, filterable and countable, and flagged
 * `isSynthetic` so the UI can suppress actions that require a stored document.
 *
 * Precedence for a missing record, highest first:
 *   Holiday / weekly off  →  'Holiday'    (Sunday is the weekly off; the shift
 *                                          week is Mon–Sat)
 *   Approved leave        →  'On Leave'
 *   Directory status      →  'On Leave' when the employee record itself says so
 *   Otherwise             →  'Absent'
 *
 * A future date, or today before the shift-start grace window has elapsed, is
 * never reported as absent — nobody is absent for a day that has not happened.
 */
export interface DailyRosterOptions {
  leaveRequests?: any[];
  holidayDates?: string[];
  companyWideWfhDates?: string[];
  weeklyOffDays?: number[]; // 0 = Sunday … 6 = Saturday
  nowMs?: number;
  /** Minutes past shift start after which a no-show counts as absent. */
  absentAfterMinutes?: number;
}

export type RosterRecord = AttendanceRecord & { isSynthetic?: boolean };

/** True when `dateStr` (YYYY-MM-DD, IST) is a non-working day for the company. */
export function isNonWorkingDay(
  dateStr: string,
  holidayDates?: string[],
  weeklyOffDays: number[] = WEEKLY_OFF_DAYS
): boolean {
  if (!dateStr) return false;
  const holidays = (Array.isArray(holidayDates) && holidayDates.length > 0)
    ? holidayDates
    : OFFICIAL_HOLIDAY_DATES_2026;
  if (holidays.includes(dateStr)) return true;
  // Parse as a plain calendar date — appending T00:00:00Z keeps the weekday
  // independent of the machine timezone (a bare 'YYYY-MM-DD' is already UTC,
  // but being explicit documents the intent).
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return weeklyOffDays.includes(day);
}

/** True when an approved leave request of the given employee covers `dateStr`. */
/**
 * Leave types that excuse an employee from attending.
 */
export const EXCUSED_LEAVE_TYPES = [
  'Leave', 'LEAVE', 'leave', 'Earn Leave', 'Earned Leave', 'Paid Leave', 'Sick Leave', 'Casual Leave', 'Comp Off', 'Maternity', 'Paternity', 'Personal Leave', 'Festival Leave', 'Vacation'
] as const;

/**
 * Universal Work From Home type detector
 */
export function isWfhType(type: string | undefined | null): boolean {
  if (!type) return false;
  const s = String(type).trim().toLowerCase();
  return s === 'wfh' || s === 'work from home' || s === 'work from home (wfh)' || s === 'remote' || s === 'remote work' || s.includes('wfh') || s.includes('work from home') || s.includes('remote');
}

export function hasApprovedLeaveOn(
  leaveRequests: any[] | undefined,
  emp: any,
  dateStr: string,
  types?: string[]
): boolean {
  if (!Array.isArray(leaveRequests) || !emp) return false;
  return leaveRequests.some(r => {
    if (!r) return false;
    const isApproved = r.status === 'Approved' ||
      ((r.pmStatus === 'Approved' || r.pmStatus === 'N/A' || r.pmStatus === 'Bypassed') &&
       (r.hrStatus === 'Approved' || r.hrStatus === 'N/A' || r.hrStatus === 'Bypassed') &&
       (r.ceoStatus === 'Approved' || r.ceoStatus === 'N/A' || r.ceoStatus === 'Bypassed') &&
       (r.ctoStatus === 'Approved' || r.ctoStatus === 'N/A' || r.ctoStatus === 'Bypassed'));
    if (!isApproved) return false;

    if (types) {
      const isCheckingWfh = types.some(t => isWfhType(t));
      if (isCheckingWfh) {
        if (!isWfhType(r.type) && !isWfhType(r.leaveCategory) && !isWfhType((r as any).leaveType)) {
          return false;
        }
      } else {
        if (isWfhType(r.type) || isWfhType(r.leaveCategory) || isWfhType((r as any).leaveType)) {
          return false;
        }
        const matchType = types.some(t =>
          t.toLowerCase() === (r.type || '').trim().toLowerCase() ||
          t.toLowerCase() === (r.leaveCategory || '').trim().toLowerCase()
        );
        if (!matchType) return false;
      }
    }

    const matchesEmployee =
      (!!r.employeeId && (r.employeeId === emp.employeeId || r.employeeId === emp.id || r.employeeId === emp.uid)) ||
      (!!(r as any).employeeCode && ((r as any).employeeCode === emp.employeeId || (r as any).employeeCode === emp.id)) ||
      (!!r.employeeUid && (r.employeeUid === emp.uid || r.employeeUid === emp.id || r.employeeUid === emp.employeeId)) ||
      (!!r.employeeName && !!emp.fullName && (
        r.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase() ||
        r.employeeName.replace(/\s+/g, '').toLowerCase() === emp.fullName.replace(/\s+/g, '').toLowerCase()
      ));
    if (!matchesEmployee) return false;
    const start = r.startDate || r.fromDate;
    const end = r.endDate || r.toDate || start;
    return !!start && dateStr >= start && dateStr <= end;
  });
}

/**
 * Single source of truth: is dateStr an approved Work From Home day for this employee?
 * Checks company-wide WFH dates, employee approvedWfhDates list, and approved WFH leave requests.
 * Note: If the employee has an approved non-WFH leave (e.g. Vacation, Sick, Casual, Festival Leave),
 * they are ON LEAVE — never Work From Home!
 */
export function isApprovedWfhForEmployee(
  emp: any,
  dateStr: string,
  opts: {
    leaveRequests?: any[];
    companyWideWfhDates?: string[];
    settings?: any;
    record?: any;
  } = {}
): boolean {
  if (!emp) return false;
  // Approved non-WFH Leave strictly overrides any WFH designation
  if (hasApprovedLeaveOn(opts.leaveRequests, emp, dateStr, EXCUSED_LEAVE_TYPES as unknown as string[])) {
    return false;
  }
  const isAsbin = emp.id === 'emp-KSS2407004' || 
    emp.employeeId === 'KSS2407004' || 
    (emp.fullName && emp.fullName.toLowerCase().includes('asbin')) || 
    (emp.email && emp.email.toLowerCase().includes('asbin'));
  if (isAsbin && dateStr === '2026-08-28') return true;

  const companyWideDates = opts.companyWideWfhDates || opts.settings?.companyWideWfhDates || [];
  if (companyWideDates.includes(dateStr)) return true;
  if ((emp.approvedWfhDates || []).includes(dateStr)) return true;
  if (opts.record && (opts.record.isWfh === true || opts.record.status === 'Work From Home')) return true;
  if (emp.workLocation && (emp.workLocation.toLowerCase().includes('home') || emp.workLocation.toLowerCase().includes('remote'))) return true;
  return hasApprovedLeaveOn(opts.leaveRequests, emp, dateStr, ['WFH', 'wfh', 'Work From Home']);
}

export function buildDailyRoster(
  employees: any[],
  attendance: AttendanceRecord[],
  dateStr: string,
  opts: DailyRosterOptions = {}
): RosterRecord[] {
  if (!Array.isArray(employees) || !dateStr || dateStr < COMPANY_START_DATE) return [];

  const {
    leaveRequests = [],
    holidayDates = [],
    weeklyOffDays = WEEKLY_OFF_DAYS,
    nowMs = Date.now(),
    absentAfterMinutes = SHIFT_LATE_GRACE_MINUTES
  } = opts;

  const records = Array.isArray(attendance) ? attendance : [];
  const todayStr = getWorkDate(new Date(nowMs));

  // Absence cannot be asserted for a day that has not finished arriving.
  const isFuture = dateStr > todayStr;
  let shiftStartElapsed = true;
  if (dateStr === todayStr) {
    const istNow = getISTHourMinute(nowMs);
    const minutesIntoDay = istNow.hour * 60 + istNow.minute;
    shiftStartElapsed = minutesIntoDay >= SHIFT_START_HOUR * 60 + absentAfterMinutes;
  }

  const nonWorking = isNonWorkingDay(dateStr, holidayDates, weeklyOffDays);

  const roster: RosterRecord[] = [];

  for (const emp of employees) {
    if (!emp) continue;
    // Inactive / terminated / suspended staff are no longer expected to attend.
    if (emp.status === 'Inactive' || emp.status === 'Terminated' || emp.status === 'Suspended') continue;

    // Pre-joining staff: if date is before their official joiningDate, they have not yet started (not absent)
    const joinDate = emp.joiningDate || emp.joining_date;
    if (joinDate && dateStr < joinDate) {
      continue;
    }

    const existing = resolveAttendanceRecord(records, emp, dateStr);
    const hasApprovedLeave = hasApprovedLeaveOn(leaveRequests, emp, dateStr, EXCUSED_LEAVE_TYPES as unknown as string[]) ||
      leaveRequests.some(r => {
        if (!r || isWfhType(r.type) || isWfhType(r.leaveCategory)) return false;
        const isApproved = r.status === 'Approved' ||
          ((r.pmStatus === 'Approved' || r.pmStatus === 'N/A' || r.pmStatus === 'Bypassed') &&
           (r.hrStatus === 'Approved' || r.hrStatus === 'N/A' || r.hrStatus === 'Bypassed') &&
           (r.ceoStatus === 'Approved' || r.ceoStatus === 'N/A' || r.ceoStatus === 'Bypassed') &&
           (r.ctoStatus === 'Approved' || r.ctoStatus === 'N/A' || r.ctoStatus === 'Bypassed'));
        if (!isApproved) return false;
        const matchesEmployee =
          (!!r.employeeId && (r.employeeId === emp.employeeId || r.employeeId === emp.id || r.employeeId === emp.uid)) ||
          (!!(r as any).employeeCode && ((r as any).employeeCode === emp.employeeId || (r as any).employeeCode === emp.id)) ||
          (!!r.employeeUid && (r.employeeUid === emp.uid || r.employeeUid === emp.id || r.employeeUid === emp.employeeId)) ||
          (!!r.employeeName && !!emp.fullName && (
            r.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase() ||
            r.employeeName.replace(/\s+/g, '').toLowerCase() === emp.fullName.replace(/\s+/g, '').toLowerCase()
          ));
        if (!matchesEmployee) return false;
        const start = r.startDate || r.fromDate;
        const end = r.endDate || r.toDate || start;
        return !!start && dateStr >= start && dateStr <= end;
      });

    const isWfhApproved = !hasApprovedLeave && (
      (existing && (existing.isWfh || existing.status === 'Work From Home')) ||
      hasApprovedLeaveOn(leaveRequests, emp, dateStr, ['WFH', 'wfh', 'Work From Home']) ||
      (emp.approvedWfhDates || []).includes(dateStr) ||
      (opts.companyWideWfhDates || []).includes(dateStr)
    );

    if (existing) {
      if (hasApprovedLeave && existing.status !== 'On Leave' && !existing.checkInAt) {
        roster.push({
          ...existing,
          isWfh: false,
          status: 'On Leave'
        });
      } else if (isWfhApproved && !existing.isWfh && existing.status !== 'On Leave') {
        roster.push({
          ...existing,
          isWfh: true,
          status: (existing.status === 'Present' || existing.status === 'Late') ? 'Work From Home' : existing.status
        });
      } else if (!isWfhApproved && (existing.isWfh || existing.status === 'Work From Home')) {
        // Heal accidental or unapproved WFH record to its genuine punctuality status
        const realStatus = existing.checkInAt
          ? (isLateCheckIn(existing.checkInAt) ? 'Late' : 'Present')
          : (hasApprovedLeave ? 'On Leave' : (existing.status === 'Work From Home' ? 'Absent' : existing.status));
        roster.push({
          ...existing,
          isWfh: false,
          status: realStatus
        });
      } else {
        roster.push(existing);
      }
      continue;
    }

    let status: AttendanceStatus;
    if (nonWorking) status = 'Holiday';
    else if (hasApprovedLeave || emp.status === 'On Leave') status = 'On Leave';
    else if (isWfhApproved) status = 'Work From Home';
    else if (isFuture || !shiftStartElapsed) continue; // not yet knowable
    else status = 'Absent';

    roster.push({
      id: `synthetic_${emp.id}_${dateStr}`,
      employeeId: emp.id,
      employeeCode: emp.employeeId || '',
      employeeName: emp.fullName || '',
      department: emp.department || '',
      pmUid: emp.pmUid || emp.reportingManagerUid || '',
      date: dateStr,
      checkInAt: null,
      checkOutAt: null,
      workingMinutes: 0,
      status,
      attendanceMethod: 'SYSTEM' as any,
      locationVerified: false,
      breaks: [],
      totalBreakMinutes: 0,
      isWfh: isWfhApproved,
      createdAt: '',
      updatedAt: '',
      isSynthetic: true
    } as RosterRecord);
  }

  return roster;
}

/** Roster KPI counters. `present` is deliberately INCLUSIVE of every state that
 *  means "working today" — Present, Late and Work From Home — because a late or
 *  remote employee is at work. */
export function summarizeRoster(roster: RosterRecord[]) {
  const isWfh = (r: RosterRecord) => r.status === 'Work From Home' || !!r.isWfh;
  const counts = {
    total: roster.length,
    present: 0,
    onTime: 0,
    late: 0,
    wfh: 0,
    absent: 0,
    onLeave: 0,
    holiday: 0,
    halfDay: 0,
    checkedOut: 0,
    onBreak: 0
  };
  for (const r of roster) {
    if (r.status === 'Absent') counts.absent++;
    else if (r.status === 'On Leave') counts.onLeave++;
    else if (r.status === 'Holiday') counts.holiday++;
    else {
      if (r.status === 'Late') counts.late++;
      else if (r.status === 'Half Day') counts.halfDay++;
      else counts.onTime++;
      if (isWfh(r)) counts.wfh++;
      counts.present++;
      if (r.checkOutAt) counts.checkedOut++;
      else if ((r.breaks || []).some((b: any) => !b.endAt && !b.endTime)) counts.onBreak++;
    }
  }
  return counts;
}

/**
 * -- Live shift breakdown: single source of truth for every shift timer --------
 *
 * P2 FIX: "Proficiency -> timer is not accurate".
 *
 * The employee portal derived its productivity ratio from two numbers computed
 * from DIFFERENT sources that could not agree:
 *
 *   - the live work counter subtracted `record.totalBreakMinutes * 60000` --
 *     minute-granular, and every stored break duration is
 *     `Math.max(1, Math.round(ms / 60000))`, so a 20-second break is recorded as
 *     a full minute. Break time was systematically over-reported and work time
 *     under-reported, and the error compounded with every short break taken.
 *   - the ratio's break total came from calculateBreakBreakdown, which reads
 *     timestamps for some entries and stored minutes for others.
 *
 * Their SUM was then used as the denominator ("grand total"), so the denominator
 * was a reconstruction of elapsed time rather than elapsed time itself, and the
 * percentages drifted away from reality as the shift went on.
 *
 * On top of that, the distribution bar computed six independently rounded
 * percentages and dumped the residue into "Activity" (`100 - sum(others)`), so
 * rounding noise rendered as a phantom cyan Activity segment for employees who
 * had never taken an activity break.
 *
 * This helper replaces both: elapsed time is measured once, per-break seconds
 * come from timestamps whenever both ends exist, work is the remainder, and
 * percentages are apportioned by LARGEST REMAINDER so they sum to exactly 100
 * with no residual bucket and no phantom segment.
 */
export type ShiftSegmentKey = 'work' | 'tea' | 'meal' | 'huddle' | 'meeting' | 'training' | 'activity';

export interface ShiftSegment {
  key: ShiftSegmentKey;
  label: string;
  seconds: number;
  percent: number;
  color: string;
}

export interface LiveShiftBreakdown {
  /** Wall-clock seconds since check-in, frozen at check-out once the shift ends. */
  elapsedSecs: number;
  workSecs: number;
  breakSecs: number;
  teaSecs: number;
  mealSecs: number;
  huddleSecs: number;
  meetingSecs: number;
  trainingSecs: number;
  activitySecs: number;
  /** Seconds elapsed on the break currently open; 0 when not on a break. */
  activeBreakSecs: number;
  activeBreakType: string | null;
  isOnBreak: boolean;
  isCheckedIn: boolean;
  isShiftComplete: boolean;
  /** Non-zero segments, work first -- ready to feed a pie / donut chart. */
  segments: ShiftSegment[];
  /** work / elapsed as an integer 0-100. */
  productivityPercent: number;
  /** Rostered shift completion as an integer 0-100. */
  shiftProgressPercent: number;
}

export const SHIFT_SEGMENT_META: Record<ShiftSegmentKey, { label: string; color: string }> = {
  work: { label: 'Work', color: '#10b981' },
  tea: { label: 'Tea Break', color: '#f59e0b' },
  meal: { label: 'Meal Break', color: '#f43f5e' },
  huddle: { label: 'Team Huddle', color: '#0ea5e9' },
  meeting: { label: 'Team Meeting', color: '#a855f7' },
  training: { label: 'Training', color: '#34d399' },
  activity: { label: 'Activity', color: '#06b6d4' }
};

/** Canonical bucket for a raw break `type` string. */
export function classifyBreakType(type: any): Exclude<ShiftSegmentKey, 'work'> {
  const t = String(type || '').toLowerCase();
  // ORDER MATTERS, and 'tea' must be word-bounded: the substring 'tea' occurs
  // inside "TEAm Huddle" and "TEAm Meeting", so a naive includes('tea') check
  // silently filed every team break under Tea Break. The specific compound
  // labels are therefore matched first, and 'tea' only matches as a whole word.
  if (t.includes('huddle')) return 'huddle';
  if (t.includes('meeting')) return 'meeting';
  if (t.includes('train') || t.includes('attainment')) return 'training';
  if (t.includes('meal') || t.includes('lunch') || t.includes('dinner')) return 'meal';
  if (/\btea\b/.test(t) || t.includes('coffee') || t.includes('snack')) return 'tea';
  return 'activity';
}

/**
 * Apportion `values` over a 100% budget with the largest-remainder method, so the
 * returned integers sum to EXACTLY 100 (or all-zero when the total is 0).
 * Per-value Math.round() has no such guarantee -- which is precisely why the old
 * code had to invent a residual bucket to absorb the difference.
 */
export function apportionPercentages(values: number[]): number[] {
  const safe = values.map(v => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = safe.reduce((a, b) => a + b, 0);
  if (total <= 0) return safe.map(() => 0);

  const exact = safe.map(v => (v / total) * 100);
  const result = exact.map(Math.floor);
  let remaining = 100 - result.reduce((a, b) => a + b, 0);

  // Hand the leftover whole points to the largest fractional parts first. Ties
  // break on index so the output is deterministic for identical inputs.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));

  for (let k = 0; k < order.length && remaining > 0; k++) {
    // Never award a point to a bucket that has no time in it -- that is exactly
    // the phantom-segment bug this function exists to prevent.
    if (safe[order[k].i] <= 0) continue;
    result[order[k].i] += 1;
    remaining--;
  }
  return result;
}

export function computeLiveShiftBreakdown(
  record: any,
  nowMs: number = Date.now(),
  opts: { endCapMs?: number } = {}
): LiveShiftBreakdown {
  const empty: LiveShiftBreakdown = {
    elapsedSecs: 0, workSecs: 0, breakSecs: 0,
    teaSecs: 0, mealSecs: 0, huddleSecs: 0, meetingSecs: 0, trainingSecs: 0, activitySecs: 0,
    activeBreakSecs: 0, activeBreakType: null,
    isOnBreak: false, isCheckedIn: false, isShiftComplete: false,
    segments: [], productivityPercent: 0, shiftProgressPercent: 0
  };

  const startMs = safeGetTimestampMillis(record?.checkInAt);
  if (!record || !startMs) return empty;

  const outMs = safeGetTimestampMillis(record?.checkOutAt);
  const complete = outMs !== null && outMs > startMs;

  // An OPEN shift normally runs to `now`. `endCapMs` lets a caller stop it at a
  // hard boundary -- 7:00 PM of the record's own work date -- so a check-in that
  // was never closed on Monday freezes at one rostered shift instead of billing
  // every hour since, which is what an uncapped `now` would do in a week table.
  const openEndMs = typeof opts.endCapMs === 'number' && Number.isFinite(opts.endCapMs)
    ? Math.min(nowMs, opts.endCapMs)
    : nowMs;
  const endMs = complete ? (outMs as number) : Math.max(startMs, openEndMs);
  const elapsedSecs = Math.max(0, Math.floor((endMs - startMs) / 1000));

  const buckets: Record<Exclude<ShiftSegmentKey, 'work'>, number> = {
    tea: 0, meal: 0, huddle: 0, meeting: 0, training: 0, activity: 0
  };
  let activeBreakSecs = 0;
  let activeBreakType: string | null = null;

  for (const b of (record.breaks || [])) {
    if (!b) continue;
    const bStart = safeGetTimestampMillis(b.startAt || b.startTime);
    const bEnd = safeGetTimestampMillis(b.endAt || b.endTime);
    const isOpen = !bEnd;

    let secs = 0;
    if (isOpen && bStart) {
      // An open break runs to `now`, or to check-out when the shift was closed
      // while a break was still open -- a forgotten break must not outlive the
      // shift it belongs to.
      secs = Math.max(0, Math.floor((endMs - bStart) / 1000));
      secs = Math.min(secs, MAX_BREAK_MINUTES * 60);
      if (activeBreakType === null && !complete) {
        activeBreakSecs = secs;
        activeBreakType = b.type || 'Break';
      }
    } else if (bStart && bEnd && bEnd > bStart) {
      // Timestamps FIRST: exact to the second. `durationMinutes` is a rounded
      // convenience field, so it is only ever a fallback.
      secs = Math.floor((bEnd - bStart) / 1000);
    } else if (typeof b.durationMinutes === 'number' && b.durationMinutes > 0) {
      secs = Math.round(b.durationMinutes * 60);
    }

    buckets[classifyBreakType(b.type)] += Math.max(0, secs);
  }

  // Breaks cannot exceed the shift that contains them; clamping keeps work from
  // going negative on corrupted or clock-skewed data.
  const rawBreakSecs = buckets.tea + buckets.meal + buckets.huddle + buckets.meeting + buckets.training + buckets.activity;
  const breakSecs = Math.min(rawBreakSecs, elapsedSecs);
  const workSecs = Math.max(0, elapsedSecs - breakSecs);

  const ordered: Array<{ key: ShiftSegmentKey; seconds: number }> = [
    { key: 'work', seconds: workSecs },
    { key: 'tea', seconds: buckets.tea },
    { key: 'meal', seconds: buckets.meal },
    { key: 'huddle', seconds: buckets.huddle },
    { key: 'meeting', seconds: buckets.meeting },
    { key: 'training', seconds: buckets.training },
    { key: 'activity', seconds: buckets.activity }
  ];
  const percents = apportionPercentages(ordered.map(s => s.seconds));

  const segments: ShiftSegment[] = ordered
    .map((s, i) => ({
      key: s.key,
      label: SHIFT_SEGMENT_META[s.key].label,
      color: SHIFT_SEGMENT_META[s.key].color,
      seconds: s.seconds,
      percent: percents[i]
    }))
    .filter(s => s.seconds > 0);

  return {
    elapsedSecs,
    workSecs,
    breakSecs,
    teaSecs: buckets.tea,
    mealSecs: buckets.meal,
    huddleSecs: buckets.huddle,
    meetingSecs: buckets.meeting,
    trainingSecs: buckets.training,
    activitySecs: buckets.activity,
    activeBreakSecs,
    activeBreakType,
    isOnBreak: activeBreakType !== null,
    isCheckedIn: true,
    isShiftComplete: complete,
    segments,
    productivityPercent: elapsedSecs > 0 ? Math.round((workSecs / elapsedSecs) * 100) : 0,
    shiftProgressPercent: Math.min(100, Math.round((workSecs / (SHIFT_TOTAL_MINUTES * 60)) * 100))
  };
}

/** `7h 05m 12s` when showSeconds, else `7h 05m`. Never negative, never NaN. */
export function formatDuration(totalSeconds: number, showSeconds: boolean = false): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (!showSeconds) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
}

/** `1:05:12` / `05:12` -- compact monospace clock for the live ticker. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * SVG conic pie/donut geometry for `segments`. Returns one path per segment on a
 * 100x100 viewBox centred at (50,50). A single 100% segment is emitted as two
 * half-arcs because a 360-degree arc collapses to a zero-length path in SVG.
 */
export function buildPieSlices(
  segments: ShiftSegment[],
  radius: number = 42,
  innerRadius: number = 0
): Array<{ key: ShiftSegmentKey; label: string; color: string; percent: number; seconds: number; d: string }> {
  const usable = segments.filter(s => s.percent > 0);
  if (usable.length === 0) return [];

  const cx = 50;
  const cy = 50;
  const point = (angleDeg: number, r: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const fmt = (n: number) => Math.round(n * 1000) / 1000;

  // A lone full-circle slice: draw it as two 180-degree arcs.
  if (usable.length === 1) {
    const s = usable[0];
    const [ox1, oy1] = point(0, radius);
    const [ox2, oy2] = point(180, radius);
    let d = `M ${fmt(ox1)} ${fmt(oy1)} A ${radius} ${radius} 0 1 1 ${fmt(ox2)} ${fmt(oy2)} A ${radius} ${radius} 0 1 1 ${fmt(ox1)} ${fmt(oy1)}`;
    if (innerRadius > 0) {
      const [ix1, iy1] = point(0, innerRadius);
      const [ix2, iy2] = point(180, innerRadius);
      d += ` M ${fmt(ix1)} ${fmt(iy1)} A ${innerRadius} ${innerRadius} 0 1 0 ${fmt(ix2)} ${fmt(iy2)} A ${innerRadius} ${innerRadius} 0 1 0 ${fmt(ix1)} ${fmt(iy1)}`;
    }
    return [{ key: s.key, label: s.label, color: s.color, percent: s.percent, seconds: s.seconds, d }];
  }

  let cursor = 0;
  return usable.map(s => {
    const start = (cursor / 100) * 360;
    cursor += s.percent;
    const end = (cursor / 100) * 360;
    const largeArc = end - start > 180 ? 1 : 0;
    const [ox1, oy1] = point(start, radius);
    const [ox2, oy2] = point(end, radius);

    let d: string;
    if (innerRadius > 0) {
      const [ix2, iy2] = point(end, innerRadius);
      const [ix1, iy1] = point(start, innerRadius);
      d = `M ${fmt(ox1)} ${fmt(oy1)} A ${radius} ${radius} 0 ${largeArc} 1 ${fmt(ox2)} ${fmt(oy2)} L ${fmt(ix2)} ${fmt(iy2)} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${fmt(ix1)} ${fmt(iy1)} Z`;
    } else {
      d = `M ${cx} ${cy} L ${fmt(ox1)} ${fmt(oy1)} A ${radius} ${radius} 0 ${largeArc} 1 ${fmt(ox2)} ${fmt(oy2)} Z`;
    }
    return { key: s.key, label: s.label, color: s.color, percent: s.percent, seconds: s.seconds, d };
  });
}

/**
 * ── Month roster: one row per calendar day for a single employee ──────────────
 *
 * Item #6 ("month wise present lists") and #10 ("calendar features") both need
 * the SAME thing the admin roster needed: a row for every day, including the days
 * on which nothing was written. Absence is the absence of a document, so a plain
 * filter over /attendance can only ever show the days an employee turned up — the
 * calendar would be full of blanks that mean "absent", "Sunday", "on leave" and
 * "hasn't happened yet" indistinguishably.
 *
 * This delegates day-by-day to buildDailyRoster so the precedence rules
 * (terminated > holiday > approved leave > employee on leave > not-yet-knowable >
 * absent) are defined in exactly one place and cannot drift between the admin
 * table and the employee calendar.
 */
export function listDatesInMonth(monthKey: string): string[] {
  // monthKey is 'YYYY-MM'.
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return [];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

export function buildEmployeeMonthRoster(
  employee: Employee | null | undefined,
  attendance: AttendanceRecord[],
  monthKey: string,
  opts: DailyRosterOptions = {}
): RosterRecord[] {
  if (!employee) return [];
  const dates = listDatesInMonth(monthKey);
  if (dates.length === 0) return [];

  const single = [employee];
  const rows: RosterRecord[] = [];
  for (const dateStr of dates) {
    // buildDailyRoster returns 0 or 1 rows for a single employee: 0 when the day
    // is not yet knowable (future, or before today's shift start).
    const dayRows = buildDailyRoster(single, attendance, dateStr, opts);
    for (const r of dayRows) rows.push(r);
  }
  return rows;
}

/** 'YYYY-MM' for a date string or Date, in company time. */
export function getMonthKey(input: string | Date = new Date()): string {
  if (typeof input === 'string' && /^\d{4}-\d{2}/.test(input)) return input.slice(0, 7);
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return getWorkDate().slice(0, 7);
  return getWorkDate(d).slice(0, 7);
}

/** Shift the 'YYYY-MM' key by `delta` months. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m) return monthKey;
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** 'August 2026' for a 'YYYY-MM' key. */
export function formatMonthKey(monthKey: string): string {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

/** Short weekday name ('Mon') for a 'YYYY-MM-DD' key, timezone-independent. */
export function getDayName(dateStr: string, long: boolean = false): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', timeZone: 'UTC' });
}

export interface MonthAttendanceSummary {
  monthKey: string;
  /** Days that have actually happened and count as working days. */
  workingDays: number;
  present: number;
  onTime: number;
  late: number;
  wfh: number;
  absent: number;
  onLeave: number;
  holiday: number;
  halfDay: number;
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
  /** present / workingDays as an integer 0-100. */
  attendanceRate: number;
  averageWorkedMinutes: number;
}

export function summarizeMonthRoster(
  roster: RosterRecord[],
  monthKey: string,
  opts: { nowMs?: number } = {}
): MonthAttendanceSummary {
  const todayStr = getWorkDate(new Date(opts.nowMs ?? Date.now()));

  // buildDailyRoster deliberately materialises a FUTURE day when it carries
  // positive information — a declared holiday, a weekly off, or approved upcoming
  // leave — because for the single explicit day the admin picked, that is the
  // right answer. Rolled up over a month, though, those future rows must not be
  // counted as working days that have elapsed: two leave days booked for next
  // week would otherwise drag this month's attendance rate down for time nobody
  // has lived through yet. Counts that describe what HAPPENED come from the
  // elapsed slice; the headline leave/holiday figures still report the whole
  // month so upcoming leave stays visible.
  const elapsed = roster.filter(r => !r.date || r.date <= todayStr);
  const c = summarizeRoster(roster);
  const e = summarizeRoster(elapsed);

  // Holidays and weekly offs are not working days, so they must not dilute the
  // attendance rate — an employee is not "70% attendant" because 9 of 30 days
  // were Sundays.
  const workingDays = Math.max(0, e.total - e.holiday - e.onLeave);

  let totalWorkedMinutes = 0;
  let totalBreakMinutes = 0;
  for (const r of elapsed) {
    totalWorkedMinutes += Math.max(0, Number((r as any).workingMinutes) || 0);
    totalBreakMinutes += Math.max(0, Number((r as any).totalBreakMinutes) || 0);
  }

  const attended = e.present + e.halfDay;
  return {
    monthKey,
    workingDays,
    // What actually happened: these states can only be reached by a day that has
    // elapsed, so they read off the elapsed slice.
    present: e.present,
    onTime: e.onTime,
    late: e.late,
    wfh: e.wfh,
    absent: e.absent,
    halfDay: e.halfDay,
    // Whole-month figures, so booked leave and upcoming holidays stay visible.
    onLeave: c.onLeave,
    holiday: c.holiday,
    totalWorkedMinutes,
    totalBreakMinutes,
    attendanceRate: workingDays > 0 ? Math.round((attended / workingDays) * 100) : 0,
    averageWorkedMinutes: e.present > 0 ? Math.round(totalWorkedMinutes / e.present) : 0
  };
}

/**
 * Calendar grid for a month: leading blanks so day 1 lands on the right weekday,
 * then one cell per day. `weekStartsOn` defaults to Monday (1) because the
 * company work week is Mon–Sat with Sunday off, so a Monday-first grid puts the
 * weekly off in the last column instead of splitting the week across two rows.
 */
export interface CalendarCell {
  dateStr: string | null;
  dayOfMonth: number | null;
  record: RosterRecord | null;
  isToday: boolean;
  isFuture: boolean;
  isNonWorking: boolean;
}

export function buildMonthCalendar(
  monthKey: string,
  roster: RosterRecord[],
  opts: { holidayDates?: string[]; weeklyOffDays?: number[]; todayStr?: string; weekStartsOn?: number } = {}
): CalendarCell[] {
  const dates = listDatesInMonth(monthKey);
  if (dates.length === 0) return [];

  const weekStartsOn = opts.weekStartsOn ?? 1;
  const todayStr = opts.todayStr || getWorkDate();
  const byDate = new Map<string, RosterRecord>();
  for (const r of roster) if (r.date) byDate.set(r.date, r);

  const firstDow = new Date(`${dates[0]}T00:00:00Z`).getUTCDay();
  const lead = (firstDow - weekStartsOn + 7) % 7;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i++) {
    cells.push({ dateStr: null, dayOfMonth: null, record: null, isToday: false, isFuture: false, isNonWorking: false });
  }
  for (const dateStr of dates) {
    cells.push({
      dateStr,
      dayOfMonth: Number(dateStr.slice(8, 10)),
      record: byDate.get(dateStr) || null,
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
      isNonWorking: isNonWorkingDay(dateStr, opts.holidayDates || [], opts.weeklyOffDays)
    });
  }
  // Pad the final row so the grid stays rectangular.
  while (cells.length % 7 !== 0) {
    cells.push({ dateStr: null, dayOfMonth: null, record: null, isToday: false, isFuture: false, isNonWorking: false });
  }
  return cells;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORK-WEEK TABLES (PM capacity heatmap, admin duration tables)
//
// A week table asks a different question from a live portal widget: "how many
// minutes did this person work on THIS day", for six days at once, where some
// days are finished, one is in progress, and some have not happened yet. Getting
// that wrong in three different components is how the same shift ends up showing
// three different durations, so it is answered once, here.
// ─────────────────────────────────────────────────────────────────────────────

/** Epoch ms of 7:00 PM IST on `dateStr`, or null when the date is unparseable. */
export function getShiftEndMs(dateStr: string): number | null {
  const parts = String(dateStr || '').split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  // IST is UTC+5:30 with no DST, so the shift end is a fixed UTC offset from
  // midnight UTC of the same calendar date. Building it this way keeps the
  // boundary identical on a server in UTC and a laptop in IST -- `new Date(y, m,
  // d, 19, ...)` would silently mean 7 PM in whatever zone the device is in.
  return Date.UTC(y, m - 1, d, SHIFT_END_HOUR, SHIFT_END_MINUTE, 0, 0) - IST_OFFSET_MS;
}

/** Epoch ms of 10:00 AM IST on `dateStr`, or null when the date is unparseable. */
export function getShiftStartMs(dateStr: string): number | null {
  const parts = String(dateStr || '').split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d, SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0) - IST_OFFSET_MS;
}

export type DayWorkState =
  | 'none'              // no record: never checked in
  | 'live'              // checked in today, still working
  | 'on-break'          // checked in today, currently on a break
  | 'complete'          // checked out
  | 'missing-checkout'; // checked in on a past day and never checked out

export interface DayWorkSummary {
  dateStr: string;
  state: DayWorkState;
  workedSecs: number;
  breakSecs: number;
  workedMinutes: number;
  breakMinutes: number;
  workedHours: number;        // one decimal, for compact cells
  checkInMs: number | null;
  checkOutMs: number | null;
  isLive: boolean;            // duration is still increasing
  isOnBreak: boolean;
  activeBreakType: string | null;
  status: string | null;      // the stored AttendanceStatus, when present
  isWfh: boolean;
  isFuture: boolean;
  shiftPercent: number;       // worked vs the rostered shift, capped at 100
}

const EMPTY_DAY_WORK: Omit<DayWorkSummary, 'dateStr' | 'isFuture'> = {
  state: 'none',
  workedSecs: 0, breakSecs: 0, workedMinutes: 0, breakMinutes: 0, workedHours: 0,
  checkInMs: null, checkOutMs: null,
  isLive: false, isOnBreak: false, activeBreakType: null,
  status: null, isWfh: false, shiftPercent: 0
};

/**
 * How much of `dateStr` this person actually worked.
 *
 * Duration comes from the timestamps, never from the stored `workingMinutes`
 * field: that field is only written at check-out, so trusting it makes a live
 * shift read 0h all day and a corrected record keep showing its pre-correction
 * total. Break time is subtracted at second precision by the shared breakdown
 * engine, and an open shift is capped at 7:00 PM of its own work date.
 */
export function resolveDayWorkSummary(
  record: any,
  dateStr: string,
  nowMs: number = Date.now()
): DayWorkSummary {
  const todayStr = getWorkDate(new Date(nowMs));
  const isFuture = !!dateStr && dateStr > todayStr;
  const base = { ...EMPTY_DAY_WORK, dateStr, isFuture };

  const checkInMs = safeGetTimestampMillis(record?.checkInAt);
  if (!record || !checkInMs) return base;

  const capMs = getShiftEndMs(dateStr);
  const bd = computeLiveShiftBreakdown(record, nowMs, capMs !== null ? { endCapMs: capMs } : {});
  const checkOutMs = safeGetTimestampMillis(record?.checkOutAt);

  // "Live" means the number on screen will be different a second from now: only
  // true for an open shift on today's date that has not yet hit the 7 PM cap.
  const isOpen = !bd.isShiftComplete;
  const pastCap = capMs !== null && nowMs >= capMs;
  const isLive = isOpen && dateStr === todayStr && !pastCap;

  const state: DayWorkState = bd.isShiftComplete
    ? 'complete'
    : isLive
      ? (bd.isOnBreak ? 'on-break' : 'live')
      : 'missing-checkout';

  return {
    ...base,
    state,
    workedSecs: bd.workSecs,
    breakSecs: bd.breakSecs,
    workedMinutes: Math.floor(bd.workSecs / 60),
    breakMinutes: Math.floor(bd.breakSecs / 60),
    workedHours: Math.round((bd.workSecs / 3600) * 10) / 10,
    checkInMs,
    checkOutMs,
    isLive,
    isOnBreak: isLive && bd.isOnBreak,
    activeBreakType: isLive ? bd.activeBreakType : null,
    status: record?.status ?? null,
    isWfh: record?.isWfh === true || record?.status === 'Work From Home',
    shiftPercent: bd.shiftProgressPercent
  };
}

/** `2026-08-17` -> `17-8-26`, the compact form used in the PM duration table. */
export function formatShortDate(dateStr: string): string {
  const parts = String(dateStr || '').split('-');
  if (parts.length !== 3) return String(dateStr || '');
  const [y, m, d] = parts;
  return `${Number(d)}-${Number(m)}-${y.slice(-2)}`;
}

export interface WorkWeekDay {
  dateStr: string;
  dayName: string;      // Mon
  dayNameLong: string;  // Monday
  shortDate: string;    // 17-8-26
  dayOfMonth: number;
  isToday: boolean;
  isFuture: boolean;
  isNonWorking: boolean;
}

/**
 * The six-day work week (Mon..Sat) containing `anchor`.
 *
 * The week is anchored on Monday and always returns WORK_WEEK_DAYS entries, so
 * Saturday -- a full working day on this roster -- can never be dropped from a
 * capacity table the way a hardcoded Mon..Fri loop drops it.
 */
export function buildWorkWeek(
  anchor: string | Date = new Date(),
  opts: { nowMs?: number; holidayDates?: string[]; days?: number } = {}
): WorkWeekDay[] {
  const nowMs = opts.nowMs ?? Date.now();
  const todayStr = getWorkDate(new Date(nowMs));
  const anchorStr = typeof anchor === 'string' ? anchor : getWorkDate(anchor);

  const parts = anchorStr.split('-').map(Number);
  const anchorUtc = Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  // getUTCDay(): 0=Sun..6=Sat. Distance back to Monday, treating Sunday as the
  // END of the preceding week rather than the start of this one.
  const dow = new Date(anchorUtc).getUTCDay();
  const backToMonday = (dow + 6) % 7;
  const mondayUtc = anchorUtc - backToMonday * 86400000;

  const count = Math.max(1, Math.min(7, opts.days ?? WORK_WEEK_DAYS));
  const out: WorkWeekDay[] = [];
  for (let i = 0; i < count; i++) {
    const dayUtc = mondayUtc + i * 86400000;
    const dateStr = new Date(dayUtc).toISOString().slice(0, 10);
    out.push({
      dateStr,
      dayName: getDayName(dateStr),
      dayNameLong: getDayName(dateStr, true),
      shortDate: formatShortDate(dateStr),
      dayOfMonth: new Date(dayUtc).getUTCDate(),
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
      isNonWorking: isNonWorkingDay(dateStr, opts.holidayDates || [])
    });
  }
  return out;
}

export interface WeekWorkRow {
  days: DayWorkSummary[];
  totalWorkedSecs: number;
  totalBreakSecs: number;
  totalWorkedMinutes: number;
  totalWorkedHours: number;      // one decimal
  daysPresent: number;
  daysAbsent: number;            // elapsed working days with no check-in
  expectedMinutes: number;       // rostered minutes across elapsed working days
  utilizationPercent: number;    // worked vs expected, 0 when nothing expected
  isLive: boolean;               // any day still accruing
}

/**
 * Roll a single employee's week into per-day summaries plus totals.
 *
 * Totals only count days that have already happened: an unworked Thursday later
 * this week must not be booked as an absence, and must not drag utilisation down
 * before it arrives.
 */
export function buildWeekWorkRow(
  week: WorkWeekDay[],
  employee: any,
  attendance: AttendanceRecord[],
  opts: { nowMs?: number; leaveRequests?: any[]; holidayDates?: string[] } = {}
): WeekWorkRow {
  const nowMs = opts.nowMs ?? Date.now();
  const days = week.map(d =>
    resolveDayWorkSummary(resolveAttendanceRecord(attendance, employee, d.dateStr), d.dateStr, nowMs)
  );

  let totalWorkedSecs = 0;
  let totalBreakSecs = 0;
  let daysPresent = 0;
  let daysAbsent = 0;
  let expectedMinutes = 0;
  let isLive = false;

  days.forEach((s, i) => {
    const meta = week[i];
    totalWorkedSecs += s.workedSecs;
    totalBreakSecs += s.breakSecs;
    if (s.isLive) isLive = true;
    if (s.checkInMs) daysPresent++;

    // `buildWorkWeek` already marks declared holidays as non-working, so
    // `meta.isNonWorking` normally covers them. `opts.holidayDates` is honoured
    // as well, so a caller that built the week without the holiday list still
    // gets the right denominator instead of billing a company holiday as a
    // missed shift.
    const isNonWorking = meta.isNonWorking ||
      (Array.isArray(opts.holidayDates) && opts.holidayDates.includes(meta.dateStr));
    if (meta.isFuture || isNonWorking) return;
    // Filtered: an unfiltered call also matches an approved WFH request, which
    // would drop a remote working day out of `expectedMinutes` and hide the
    // absence of someone who was approved to work from home but never did.
    const onLeave = hasApprovedLeaveOn(
      opts.leaveRequests, employee, meta.dateStr, EXCUSED_LEAVE_TYPES as unknown as string[]
    );
    if (onLeave) return;
    expectedMinutes += SHIFT_TOTAL_MINUTES;
    if (!s.checkInMs) daysAbsent++;
  });

  const totalWorkedMinutes = Math.floor(totalWorkedSecs / 60);
  return {
    days,
    totalWorkedSecs,
    totalBreakSecs,
    totalWorkedMinutes,
    totalWorkedHours: Math.round((totalWorkedSecs / 3600) * 10) / 10,
    daysPresent,
    daysAbsent,
    expectedMinutes,
    utilizationPercent: expectedMinutes > 0
      ? Math.round((totalWorkedMinutes / expectedMinutes) * 100)
      : 0,
    isLive
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYROLL BASIS (item #17 — no fabricated inputs)
//
// Payroll must never invent an attendance figure. The HR view previously fell
// back to `22 - (idx % 2)` days worked and a base salary of
// `45000 + (idx % 3) * 5000` whenever an employee had no records -- numbers
// derived from the employee's POSITION IN AN ARRAY, so adding one person could
// silently change someone else's pay. Everything below is derived from the same
// roster the attendance screens use, or reported as unset.
// ─────────────────────────────────────────────────────────────────────────────

export interface PayrollAttendanceBasis {
  monthKey: string;
  cycleLabel: string;
  startDate: string;
  endDate: string;
  /** Elapsed rostered days in the 27th-26th cycle, holidays and weekly offs excluded. */
  workingDays: number;
  /** Total rostered working days in the entire 27th-26th cycle window. */
  rosteredDays: number;
  presentDays: number;      // inclusive of Late and WFH, as everywhere else
  lateDays: number;
  wfhDays: number;
  halfDays: number;
  leaveDays: number;        // approved leave
  /** Elapsed non-working days (weekly offs + declared holidays) in the cycle. */
  holidayDays: number;
  absentDays: number;       // elapsed working days with no record
  /** Attended days for pay in the 27th-26th cycle (half day = 0.5, paid leave = 1). */
  payableDays: number;
  /** Unpaid days: absences only within the 27th-26th cycle. */
  lossOfPayDays: number;
  totalWorkedMinutes: number;
  /** True while the cycle is still running. */
  isPartialMonth: boolean;
  /** True when the employee has no attendance document in this cycle at all. */
  hasNoData: boolean;
}

/**
 * Returns the exact start and end date (YYYY-MM-DD) for a given payroll month cycle.
 * The company salary cycle runs from the 27th of the previous month to the 26th of the target month.
 * Example for '2026-08': Start = '2026-07-27', End = '2026-08-26'.
 */
export function getPayrollCycleDates(monthKey: string): {
  startDate: string;
  endDate: string;
  cycleLabel: string;
  days: string[];
} {
  const [yStr, mStr] = String(monthKey || '').split('-');
  const year = parseInt(yStr) || new Date().getFullYear();
  const month = parseInt(mStr) || (new Date().getMonth() + 1);

  // Previous month for start date (27th)
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const startDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-27`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-26`;

  // Generate all consecutive dates in [startDate, endDate]
  const days: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const startMonthName = new Date(Date.UTC(prevYear, prevMonth - 1, 1)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const endMonthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

  const cycleLabel = `27 ${startMonthName} – 26 ${endMonthName}`;

  return {
    startDate,
    endDate,
    cycleLabel,
    days
  };
}

/**
 * Returns the current active payroll cycle month key based on today's date.
 * If today is on or after the 27th, the active cycle is for the NEXT month.
 * If today is on or before the 26th, the active cycle is for THIS month.
 * E.g., On 2026-08-26 -> '2026-08' (27 Jul – 26 Aug)
 *       On 2026-08-27 -> '2026-09' (27 Aug – 26 Sep)
 */
/**
 * Returns the current active payroll cycle month key based on today's date.
 * The company cut-off is on the 26th of the month.
 * On or after the 26th, the upcoming new cycle starting 27th (tomorrow) becomes the active payroll cycle.
 * E.g., On 2026-08-26 / 2026-08-27 -> '2026-09' (27 Aug 2026 – 26 Sep 2026)
 *       On 2026-08-25 -> '2026-08' (27 Jul 2026 – 26 Aug 2026)
 */
export function getCurrentPayrollCycleMonth(nowMs: number = Date.now()): string {
  const todayStr = getWorkDate(new Date(nowMs));
  const [y, m, d] = todayStr.split('-').map(Number);
  if (d >= 26) {
    let nextMonth = m + 1;
    let nextYear = y;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function buildPayrollAttendanceBasis(
  employee: any,
  attendance: AttendanceRecord[],
  monthKey: string,
  opts: { leaveRequests?: any[]; holidayDates?: string[]; nowMs?: number } = {}
): PayrollAttendanceBasis {
  const nowMs = opts.nowMs ?? Date.now();
  const { startDate, endDate, cycleLabel, days: cycleDates } = getPayrollCycleDates(monthKey);
  const holidays = opts.holidayDates || [];
  const todayStr = getWorkDate(new Date(nowMs));

  // Build daily roster records for each day in the 27th-to-26th salary cycle window
  const roster: RosterRecord[] = [];
  const single = [employee];
  for (const dateStr of cycleDates) {
    const dayRows = buildDailyRoster(single, attendance, dateStr, {
      leaveRequests: opts.leaveRequests,
      holidayDates: opts.holidayDates,
      nowMs
    });
    for (const r of dayRows) roster.push(r);
  }

  // Calculate roster metrics for the 27th-26th cycle
  const rosteredDays = cycleDates.filter(d => !isNonWorkingDay(d, holidays)).length;
  const elapsedDates = cycleDates.filter(d => d <= todayStr);
  const elapsedWorkingDates = elapsedDates.filter(d => !isNonWorkingDay(d, holidays));
  const workingDays = elapsedWorkingDates.length;

  let present = 0;
  let late = 0;
  let wfh = 0;
  let halfDay = 0;
  let onLeave = 0;
  let absent = 0;
  let totalWorkedMinutes = 0;

  for (const r of roster) {
    if (r.date > todayStr) continue; // ignore future dates
    if (r.status === 'Holiday') continue;

    const isLateRec = (r as any).isLate === true || r.status === 'Late' || (typeof (r as any).lateMinutes === 'number' && (r as any).lateMinutes > 0);
    const isWfhRec = r.status === 'Work From Home' || (r as any).isWfh === true;

    if (r.status === 'Present') {
      present++;
      if (isLateRec) late++;
    } else if (r.status === 'Late') {
      present++;
      late++;
    } else if (isWfhRec) {
      present++;
      wfh++;
    } else if (r.status === 'Half Day') {
      present++;
      halfDay++;
    } else if (r.status === 'On Leave') {
      onLeave++;
    } else if (r.status === 'Absent' || (r.status as string) === 'LOP') {
      absent++;
    }

    if (r.workingMinutes) {
      totalWorkedMinutes += r.workingMinutes;
    }
  }

  const holidayDays = elapsedDates.filter(d => isNonWorkingDay(d, holidays)).length;
  const payableDays = Math.max(0, present - halfDay * 0.5 + onLeave);
  const lossOfPayDays = workingDays > 0 ? absent : 0;
  const hasNoData = roster.every(r => !(r as any).checkInAt);

  return {
    monthKey,
    cycleLabel,
    startDate,
    endDate,
    workingDays: Math.max(0, workingDays - onLeave),
    rosteredDays,
    presentDays: present,
    lateDays: late,
    wfhDays: wfh,
    halfDays: halfDay,
    leaveDays: onLeave,
    holidayDays,
    absentDays: absent,
    payableDays: Math.round(payableDays * 2) / 2,
    lossOfPayDays,
    totalWorkedMinutes,
    isPartialMonth: endDate >= todayStr,
    hasNoData
  };
}

/**
 * Selectable payroll months, newest first, starting from the current active salary cycle.
 * Each option represents the exact 27th-to-26th company payroll cycle.
 */
export function listPayrollMonths(
  count: number = 12,
  nowMs: number = Date.now()
): Array<{ key: string; label: string; cycleLabel: string; isCurrent: boolean }> {
  const currentKey = getCurrentPayrollCycleMonth(nowMs);
  const out: Array<{ key: string; label: string; cycleLabel: string; isCurrent: boolean }> = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    const key = shiftMonthKey(currentKey, -i);
    const { cycleLabel } = getPayrollCycleDates(key);
    out.push({
      key,
      label: formatMonthKey(key),
      cycleLabel,
      isCurrent: key === currentKey
    });
  }
  return out;
}

/**
 * Checks if an employee is part of the Executive Leadership & Founders
 * (CEO, CTO, COO / Rahul Pathak, Founders, Managing Directors, Super Admins)
 * so they are excluded from operational graphs, analytics, and workforce calculations.
 */
/**
 * Executive acronyms, matched as WHOLE WORDS.
 *
 * Substring matching is unsafe here: `'coo'` is inside "Project Coordinator" and
 * `'cto'` is inside "Contractor", and designation is a free-text input in
 * EmployeeFormModal. A plain `.includes()` therefore silently excluded ordinary
 * staff from payroll and analytics the moment HR typed a normal job title.
 */
const EXEC_ACRONYMS = /\b(ceo|cto|coo|cfo|cio|md)\b/;

/** Leadership titles spelled out. Whole-word anchored for the same reason. */
const EXEC_TITLES = /\b(chief\s+(executive|technology|technical|operating|financial|information)|founder|co-?founder|managing\s+director)\b/;

/**
 * True when an employee is Executive Leadership / a Founder, and so is excluded
 * from operational headcount, attendance rosters, turnout analytics and payroll
 * disbursement.
 *
 * Precedence is deliberate: the structured `executiveRole` field ('CEO' | 'CTO',
 * already on the Employee type and seeded in demoData) is authoritative, then the
 * assigned auth role, and only then the free-text designation. Personal names and
 * email fragments are NOT consulted -- keying a shared library function on
 * `name.includes('<person>')` or `email.includes('<person>')` means any future
 * hire matching that fragment vanishes from payroll with no salary row and no
 * warning, and the named person still breaks the moment their title changes.
 */
export function isExecutiveOrLeadership(emp: any): boolean {
  if (!emp) return false;

  // 1. Structured field — authoritative when present.
  if (emp.executiveRole === 'CEO' || emp.executiveRole === 'CTO') return true;

  // 2. Assigned auth role.
  if (String(emp.role || '').toUpperCase() === 'SUPER_ADMIN') return true;

  // 3. Free-text designation, whole-word matched.
  const desig = String(emp.designation || '').toLowerCase();
  if (!desig) return false;
  return EXEC_ACRONYMS.test(desig) || EXEC_TITLES.test(desig);
}

