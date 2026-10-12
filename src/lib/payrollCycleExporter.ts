import ExcelJS from 'exceljs';
import { Employee, AttendanceRecord, LeaveRequest, CompanySettings } from '../types';
import {
  isNonWorkingDay,
  isAttendanceExempt,
  isExecutiveOrLeadership,
  computeEmploymentType,
  hasApprovedLeaveOn,
  EXCUSED_LEAVE_TYPES,
  resolveAttendanceRecord,
  isWfhType,
  isApprovedWfhForEmployee,
  getWorkDate
} from './attendanceEngine';
import { toISTTimeString } from './absoluteTime';

export interface CycleDateRange {
  id: string;
  label: string;
  startDate: string; // YYYY-MM-DD (e.g. 2026-08-27)
  endDate: string;   // YYYY-MM-DD (e.g. 2026-09-26)
  isCurrent?: boolean;
}

export interface DayStatusDetail {
  date: string;
  dayOfWeek: string;
  dayNumber: number;
  status: string;
  code: 'P' | 'WFH' | 'HD' | 'L' | 'LOP' | 'WO' | 'H' | 'NJ' | 'SCH';
  checkIn?: string;
  checkOut?: string;
  workingMinutes?: number;
  isLate?: boolean;
  notes?: string;
}

export interface EmployeeCycleMetrics {
  employee: Employee;
  employeeId: string;
  fullName: string;
  department: string;
  designation: string;
  employmentType: string;
  joiningDate: string;
  bankAccount: string;
  
  // Attendance Counts
  calendarDays: number;
  rosteredWorkingDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  presentOfficeDays: number;
  wfhDays: number;
  halfDays: number;
  paidLeaveDays: number;
  lossOfPayDays: number;
  payableDays: number;
  attendanceRate: number; // percentage (0 - 100)

  // Salary Disbursement
  baseSalary: number;
  allowances: number;
  grossSalary: number;
  perDayRate: number;
  lopDeduction: number;
  netPayableSalary: number;
  paymentStatus: 'Draft' | 'Approved' | 'Paid';
  remarks: string;

  // Day-by-Day Map
  dailyDetails: Record<string, DayStatusDetail>;
}

export interface CycleExportOptions {
  employees: Employee[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  holidayDates?: string[];
  settings?: CompanySettings;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  cycleLabel?: string;
  preparedBy?: string;
  departmentFilter?: string;
  employmentTypeFilter?: string;
  searchFilter?: string;
  includeInactive?: boolean;
}

/**
 * Generate standard 27th-to-26th cycle presets.
 * Returns cycles covering past 6 months and next 2 months.
 */
export function getCyclePresetList(refDate: Date = new Date()): CycleDateRange[] {
  const currentYear = refDate.getFullYear();
  const currentMonth = refDate.getMonth(); // 0 - 11

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const presets: CycleDateRange[] = [];

  // Generate 8 cycle windows around the reference date
  for (let offset = -4; offset <= 2; offset++) {
    const targetDate = new Date(currentYear, currentMonth + offset, 1);
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth() + 1; // 1 - 12

    let prevY = y;
    let prevM = m - 1;
    if (prevM < 1) {
      prevM = 12;
      prevY -= 1;
    }

    const startDate = `${prevY}-${String(prevM).padStart(2, '0')}-27`;
    const endDate   = `${y}-${String(m).padStart(2, '0')}-26`;

    const startMonthShort = monthNames[prevM - 1].slice(0, 3);
    const endMonthShort   = monthNames[m - 1].slice(0, 3);

    const isCurrent = offset === 0;

    presets.push({
      id: `${y}-${String(m).padStart(2, '0')}`,
      label: `27 ${startMonthShort} ${prevY} – 26 ${endMonthShort} ${y} (${monthNames[m - 1]} Salary Cycle)`,
      startDate,
      endDate,
      isCurrent
    });
  }

  return presets;
}

/**
 * Generates an array of all consecutive ISO date strings [startDate, endDate]
 */
export function generateConsecutiveDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Helper to get benchmark salary if unassigned
 */
export function getBenchmarkSalary(emp: Employee): number {
  if ((emp as any).baseSalary && Number((emp as any).baseSalary) > 0) return Number((emp as any).baseSalary);
  if ((emp as any).salary && Number((emp as any).salary) > 0) return Number((emp as any).salary);
  const title = (emp.designation || '').toLowerCase();
  if (title.includes('project manager')) return 65000;
  if (title.includes('tech lead') || title.includes('technical lead')) return 60000;
  if (title.includes('senior') || title.includes('architect')) return 58000;
  if (title.includes('backend') || title.includes('full stack')) return 48000;
  if (title.includes('frontend') || title.includes('engineer')) return 45000;
  if (title.includes('designer') || title.includes('ui')) return 42000;
  if (title.includes('qa') || title.includes('testing')) return 40000;
  if (title.includes('hr')) return 40000;
  if (title.includes('intern') || title.includes('trainee')) return 20000;
  return 45000;
}

/**
 * Computes cycle metrics for a single employee across [startDate, endDate]
 */
export function computeEmployeeCycleMetrics(
  emp: Employee,
  attendance: AttendanceRecord[],
  leaveRequests: LeaveRequest[],
  startDate: string,
  endDate: string,
  holidayDates: string[] = [],
  companyWideWfhDates: string[] = [],
  nowMs: number = Date.now()
): EmployeeCycleMetrics {
  const todayStr = getWorkDate(new Date(nowMs));
  const dates = generateConsecutiveDates(startDate, endDate);

  const isJigyansha =
    emp.id === '8RxH6z3ZzUTmM26iqta1DhCPa8l1' ||
    emp.employeeId === 'KSS2407016' ||
    emp.employeeId === 'KSS2407014' ||
    (emp.fullName && (emp.fullName.toLowerCase().includes('jigy') || emp.fullName.toLowerCase().includes('jing')));

  const joinDate = isJigyansha ? '2026-09-01' : (emp.joiningDate || (emp as any).joining_date);

  // Effective cycle start for this employee: the later of cycle start or their joining date.
  // This ensures employees who joined mid-cycle (e.g. Sep 1 in an Aug-27→Sep-26 window)
  // are not penalised with LOP or inflated day counts for days before they were employed.
  const effectiveCycleStart = (joinDate && joinDate > startDate) ? joinDate : startDate;
  const effectiveDates = generateConsecutiveDates(effectiveCycleStart, endDate);

  // calendarDays = number of calendar days the employee was active in this cycle.
  // Standard monthly salary cycle is standardized to 30 days total working / cycle days.
  // For full-cycle employees (whose active span is >= 30 days), this equals 30 days.
  // For mid-cycle joiners (e.g. joined Sep 1), it is pro-rated to their actual active days (e.g. 26).
  const rawCalendarDays = effectiveDates.length;
  const calendarDays = rawCalendarDays >= 30 ? 30 : rawCalendarDays;



  // Project Managers / non-shift leadership roles do not use biometric check-in.
  // For these employees, a missing attendance record on a past working day should
  // default to "Present" (no LOP), NOT to "Absent (LOP)".
  const empRole = String(emp.role || '').toUpperCase();
  const empDesig = String(emp.designation || '').toLowerCase();
  const isNonShiftRole =
    empRole === 'PROJECT_MANAGER' ||
    empRole === 'PM' ||
    empDesig.includes('project manager') ||
    empDesig.includes('program manager') ||
    (emp.employeeId === 'KSS2407003') ||
    ((emp.fullName || '').toLowerCase().includes('koushik'));

  // Employees whose joining date falls within this cycle window are in their FIRST cycle.
  // They get benefit-of-doubt: unrecorded past working days are treated as Present (not LOP).
  // This prevents new joiners (e.g. joined Sep 1 in the Aug-27→Sep-26 cycle) from accruing
  // false LOP due to missing biometric records in their onboarding period.
  const isFirstCycleJoiner = !!(joinDate && joinDate >= startDate && joinDate <= endDate);

  const dailyDetails: Record<string, DayStatusDetail> = {};

  let rosteredWorkingDays = 0;
  let weeklyOffDays = 0;
  let holidayDays = 0;
  let presentOfficeDays = 0;
  let wfhDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let lossOfPayDays = 0;

  for (const dateStr of dates) {
    const dObj = new Date(`${dateStr}T00:00:00Z`);
    const dayOfWeek = dObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const dayNumber = dObj.getUTCDate();

    // 1. Check if prior to joining date
    if (joinDate && dateStr < joinDate) {
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: 'Pre-Joining',
        code: 'NJ',
        notes: 'Not yet joined company'
      };
      continue;
    }

    // 2. Check Weekly Off (Sunday) or Official Holiday
    const isSunday = dObj.getUTCDay() === 0;
    const isHoliday = holidayDates.includes(dateStr);

    if (isHoliday) {
      holidayDays++;
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: 'Official Holiday',
        code: 'H',
        notes: 'Public / Gazetted Holiday'
      };
      continue;
    }

    if (isSunday) {
      weeklyOffDays++;
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: 'Weekly Off',
        code: 'WO',
        notes: 'Sunday Weekly Rest'
      };
      continue;
    }

    // Rostered Working Day (Mon - Sat)
    rosteredWorkingDays++;

    // 3. Check Approved Leaves (Earn Leave, Sick Leave, Casual Leave)
    const hasApprovedLeave = hasApprovedLeaveOn(leaveRequests, emp, dateStr, EXCUSED_LEAVE_TYPES as unknown as string[]) ||
      leaveRequests.some(r => {
        if (!r || isWfhType(r.type) || isWfhType(r.leaveCategory)) return false;
        const isApp = r.status === 'Approved' ||
          ((r.pmStatus === 'Approved' || r.pmStatus === 'N/A' || r.pmStatus === 'Bypassed') &&
           (r.hrStatus === 'Approved' || r.hrStatus === 'N/A' || r.hrStatus === 'Bypassed') &&
           (r.ceoStatus === 'Approved' || r.ceoStatus === 'N/A' || r.ceoStatus === 'Bypassed') &&
           (r.ctoStatus === 'Approved' || r.ctoStatus === 'N/A' || r.ctoStatus === 'Bypassed'));
        if (!isApp) return false;
        const matchesEmp =
          (!!r.employeeId && (r.employeeId === emp.employeeId || r.employeeId === emp.id || r.employeeId === emp.uid)) ||
          (!!(r as any).employeeCode && ((r as any).employeeCode === emp.employeeId || (r as any).employeeCode === emp.id)) ||
          (!!r.employeeUid && (r.employeeUid === emp.uid || r.employeeUid === emp.id || r.employeeUid === emp.employeeId)) ||
          (!!r.employeeName && !!emp.fullName && (
            r.employeeName.trim().toLowerCase() === emp.fullName.trim().toLowerCase()
          ));
        if (!matchesEmp) return false;
        const s = r.startDate || (r as any).fromDate;
        const e = r.endDate || (r as any).toDate || s;
        return s && e && dateStr >= s && dateStr <= e;
      });

    if (hasApprovedLeave) {
      paidLeaveDays++;
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: 'Approved Leave',
        code: 'L',
        notes: 'Sanctioned Paid Leave'
      };
      continue;
    }

    // 4. Check Work From Home (WFH)
    const isWfh = isApprovedWfhForEmployee(emp, dateStr, {
      leaveRequests,
      companyWideWfhDates
    });

    // 5. Check Recorded Attendance Log
    const rec = resolveAttendanceRecord(attendance, emp, dateStr);

    if (rec) {
      const inTime = rec.checkInAt ? toISTTimeString(rec.checkInAt) : undefined;
      const outTime = rec.checkOutAt ? toISTTimeString(rec.checkOutAt) : undefined;
      const mins = rec.workingMinutes || 0;
      const isLate = rec.status === 'Late' || (rec as any).isLate === true;

      if ((rec.status as string) === 'Half Day') {
        halfDays++;
        dailyDetails[dateStr] = {
          date: dateStr,
          dayOfWeek,
          dayNumber,
          status: 'Half Day',
          code: 'HD',
          checkIn: inTime,
          checkOut: outTime,
          workingMinutes: mins,
          isLate,
          notes: rec.notes || 'Half Day Session'
        };
        continue;
      }

      if ((rec.status as string) === 'Loss of Pay' || (rec as any).status === 'LOP') {
        lossOfPayDays++;
        dailyDetails[dateStr] = {
          date: dateStr,
          dayOfWeek,
          dayNumber,
          status: 'Loss of Pay',
          code: 'LOP',
          checkIn: inTime,
          checkOut: outTime,
          workingMinutes: mins,
          notes: rec.notes || 'LOP Deducted'
        };
        continue;
      }

      if (isWfh || rec.status === 'Work From Home' || (rec as any).isWfh === true) {
        wfhDays++;
        dailyDetails[dateStr] = {
          date: dateStr,
          dayOfWeek,
          dayNumber,
          status: 'Work From Home',
          code: 'WFH',
          checkIn: inTime,
          checkOut: outTime,
          workingMinutes: mins,
          notes: 'Remote Work Sanctioned'
        };
        continue;
      }

      // Office Present
      presentOfficeDays++;
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: isLate ? 'Late Present' : 'Present',
        code: 'P',
        checkIn: inTime,
        checkOut: outTime,
        workingMinutes: mins,
        isLate,
        notes: isLate ? 'Late Check-in' : 'Full Shift'
      };
      continue;
    }

    // 6. If no attendance record found
    if (isWfh) {
      wfhDays++;
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: 'Work From Home',
        code: 'WFH',
        notes: 'Remote Work Sanctioned'
      };
      continue;
    }

    if (dateStr > todayStr) {
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: 'Scheduled',
        code: 'SCH',
        notes: 'Upcoming Roster Day'
      };
    } else if (isNonShiftRole || isFirstCycleJoiner) {
      // Non-shift leads and first-cycle new joiners: unrecorded past working days → Present.
      // New joiners have no obligation to have complete biometric records in their first
      // payroll cycle, so no LOP penalty is applied.
      presentOfficeDays++;
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: 'Present',
        code: 'P',
        notes: isFirstCycleJoiner ? 'New Joiner — First Cycle Grace' : 'Management — Attendance On Record'
      };
    } else {
      // Past working day with no attendance or leave record = Absent / LOP
      lossOfPayDays++;
      dailyDetails[dateStr] = {
        date: dateStr,
        dayOfWeek,
        dayNumber,
        status: 'Absent (LOP)',
        code: 'LOP',
        notes: 'Unexcused Absence'
      };
    }
  }

  // Calculate Payable Days on a 30-day standard monthly cycle basis:
  // For an employee with full attendance / excused absence, payable days = calendarDays (30).
  // Each day of unexcused Loss of Pay directly deducts 1 payable day, each Half Day deducts 0.5.
  // Unexempt employees with zero attendance/leaves receive 0 payable days.
  const attendedOrExcused = presentOfficeDays + wfhDays + paidLeaveDays + (halfDays * 0.5);
  const payableDays = (attendedOrExcused === 0 && !isNonShiftRole && !isFirstCycleJoiner)
    ? 0
    : Math.max(0, Math.min(calendarDays, calendarDays - lossOfPayDays - (halfDays * 0.5)));

  const attendanceRate = calendarDays > 0 ? Number(((payableDays / calendarDays) * 100).toFixed(1)) : 0;

  // Salary Calculations
  const baseSalary = getBenchmarkSalary(emp);
  const allowances = 2000;
  const grossSalary = baseSalary + allowances;

  // Pro-rate per-day rate based on 30-day standard cycle (or employee's calendar days)
  const perDayRate = calendarDays > 0 ? Math.round(grossSalary / calendarDays) : Math.round(grossSalary / 30);
  const lopDeduction = Math.round(perDayRate * lossOfPayDays);
  const netPayableSalary = Math.max(0, grossSalary - lopDeduction);

  const empType = computeEmploymentType(emp);
  const bankAcc = (emp as any).bankAccountNumber || (emp as any).accountNumber ? `••••${String((emp as any).bankAccountNumber || (emp as any).accountNumber).slice(-4)}` : 'Verified on File';

  let remarks = 'Full Cycle Cleared';
  if (lossOfPayDays > 0) {
    remarks = `${lossOfPayDays} LOP day(s) deducted (-₹${lopDeduction.toLocaleString('en-IN')})`;
  } else if (wfhDays > 0) {
    remarks = `Includes ${wfhDays} approved WFH session(s)`;
  }

  return {
    employee: emp,
    employeeId: emp.employeeId || emp.id,
    fullName: emp.fullName || 'Unnamed Employee',
    department: emp.department || 'IT',
    designation: emp.designation || 'Software Engineer',
    employmentType: empType,
    joiningDate: joinDate || '—',
    bankAccount: bankAcc,
    calendarDays,
    rosteredWorkingDays,
    weeklyOffDays,
    holidayDays,
    presentOfficeDays,
    wfhDays,
    halfDays,
    paidLeaveDays,
    lossOfPayDays,
    payableDays,
    attendanceRate,
    baseSalary,
    allowances,
    grossSalary,
    perDayRate,
    lopDeduction,
    netPayableSalary,
    paymentStatus: 'Approved',
    remarks,
    dailyDetails
  };
}

/**
 * Filter operational employees for export based on criteria
 */
export function filterEmployeesForCycleExport(
  employees: Employee[],
  options: {
    departmentFilter?: string;
    employmentTypeFilter?: string;
    searchFilter?: string;
    includeInactive?: boolean;
  }
): Employee[] {
  const { departmentFilter = 'ALL', employmentTypeFilter = 'ALL', searchFilter = '', includeInactive = false } = options;

  return employees.filter(emp => {
    if (!emp.fullName || emp.fullName.trim() === '') return false;
    
    // Inactive filter
    if (!includeInactive) {
      if (emp.status === 'Terminated' || emp.status === 'Inactive') return false;
    }

    // Exclude Executive Leadership / Founders from standard workforce payroll ledger
    if (
      isAttendanceExempt(emp) ||
      isExecutiveOrLeadership(emp) ||
      (emp.fullName || '').toLowerCase().includes('gaurav') ||
      (emp.designation || '').toLowerCase().includes('managing director') ||
      (emp.designation || '').toLowerCase().includes('founder') ||
      emp.employeeId === 'KSS2407001' ||
      emp.employeeId === 'KSS2407002'
    ) {
      return false;
    }

    // Search filter
    if (searchFilter && searchFilter.trim() !== '') {
      const q = searchFilter.toLowerCase().trim();
      const matchName = (emp.fullName || '').toLowerCase().includes(q);
      const matchId = (emp.employeeId || '').toLowerCase().includes(q);
      const matchDept = (emp.department || '').toLowerCase().includes(q);
      const matchDesig = (emp.designation || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchDept && !matchDesig) return false;
    }

    // Department filter
    if (departmentFilter !== 'ALL') {
      const d = (emp.department || '').trim().toLowerCase();
      if (!d.includes(departmentFilter.toLowerCase())) return false;
    }

    // Employment type filter
    if (employmentTypeFilter !== 'ALL') {
      const effectiveType = computeEmploymentType(emp);
      if (effectiveType !== employmentTypeFilter) return false;
    }

    return true;
  });
}

/**
 * Master Excel Exporter: Generates multi-sheet professional workbook (.xlsx)
 */
export async function generateAndDownloadPayrollCycleExcel(options: CycleExportOptions): Promise<{
  success: boolean;
  fileName: string;
  totalPersonnel: number;
  totalDisbursement: number;
  cycleLabel: string;
}> {
  const {
    employees,
    attendance,
    leaveRequests,
    holidayDates = [],
    startDate,
    endDate,
    cycleLabel = `${startDate} to ${endDate}`,
    preparedBy = 'Project Manager / HR',
    departmentFilter = 'ALL',
    employmentTypeFilter = 'ALL',
    searchFilter = '',
    includeInactive = false
  } = options;

  // 1. Filter employees
  const targetEmployees = filterEmployeesForCycleExport(employees, {
    departmentFilter,
    employmentTypeFilter,
    searchFilter,
    includeInactive
  });

  if (targetEmployees.length === 0) {
    throw new Error('No employees matched the selected filters for export.');
  }

  // 2. Generate date range
  const dates = generateConsecutiveDates(startDate, endDate);

  // 3. Compute metrics for each employee
  const employeeMetricsList: EmployeeCycleMetrics[] = targetEmployees.map(emp =>
    computeEmployeeCycleMetrics(
      emp,
      attendance,
      leaveRequests,
      startDate,
      endDate,
      holidayDates,
      options.settings?.companyWideWfhDates || [],
      Date.now()
    )
  );

  // Sort by Employee ID or Name
  employeeMetricsList.sort((a, b) => (a.employeeId || '').localeCompare(b.employeeId || ''));

  // 4. Create Excel Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Kalpanaaa Software Solutions - HRMS';
  workbook.lastModifiedBy = preparedBy;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Color Palette Constants
  const NAVY_HEADER = '0F172A';
  const BLUE_HEADER = '1E3A8A';
  const SLATE_BG = 'F8FAFC';
  const BORDER_COLOR = 'CBD5E1';

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET 1: Payroll Attendance Summary & Salary Disbursement
  // ─────────────────────────────────────────────────────────────────────────────
  const ws1 = workbook.addWorksheet('Payroll & Salary Disbursement', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 7, activeCell: 'D8' }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  // Top Title Banner
  ws1.mergeCells('A1:Q1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = 'KALPANAAA SOFTWARE SOLUTIONS PVT. LTD.';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };
  ws1.getRow(1).height = 30;

  // Subtitle Banner
  ws1.mergeCells('A2:Q2');
  const subCell = ws1.getCell('A2');
  subCell.value = `OFFICIAL ATTENDANCE ROSTER STATEMENT | FULL CYCLE: ${cycleLabel.toUpperCase()}`;
  subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '93C5FD' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
  ws1.getRow(2).height = 22;

  // Metadata Row
  ws1.mergeCells('A3:Q3');
  const metaCell = ws1.getCell('A3');
  const genDateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
  });
  metaCell.value = `Generated On: ${genDateStr} IST | Prepared By: ${preparedBy} | Filter: Dept=${departmentFilter}, Type=${employmentTypeFilter} | Verified for Executive Board`;
  metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: '64748B' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SLATE_BG } };
  ws1.getRow(3).height = 18;

  // Blank spacer row
  ws1.getRow(4).height = 8;

  // Executive KPI summary boxes (17 columns total: A-Q)
  const totalEmployeesCount = employeeMetricsList.length;
  const totalNetDisbursement = employeeMetricsList.reduce((sum, e) => sum + e.netPayableSalary, 0);
  const totalPayableDaysSum = employeeMetricsList.reduce((sum, e) => sum + e.payableDays, 0);
  const totalLopDaysSum = employeeMetricsList.reduce((sum, e) => sum + e.lossOfPayDays, 0);
  const avgAttendancePercent = (employeeMetricsList.reduce((sum, e) => sum + e.attendanceRate, 0) / (totalEmployeesCount || 1)).toFixed(1);

  ws1.mergeCells('A5:C5');
  ws1.getCell('A5').value = `Total Personnel: ${totalEmployeesCount}`;
  ws1.getCell('A5').font = { bold: true, size: 10, color: { argb: '1E3A8A' } };
  ws1.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };

  ws1.mergeCells('D5:F5');
  ws1.getCell('D5').value = `Cycle Span: 30 Calendar Days (${startDate} to ${endDate})`;
  ws1.getCell('D5').font = { bold: true, size: 10, color: { argb: '0F766E' } };
  ws1.getCell('D5').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getCell('D5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCFBF1' } };

  ws1.mergeCells('G5:J5');
  ws1.getCell('G5').value = `Avg Attendance Compliance: ${avgAttendancePercent}%`;
  ws1.getCell('G5').font = { bold: true, size: 10, color: { argb: '15803D' } };
  ws1.getCell('G5').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getCell('G5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } };

  ws1.mergeCells('K5:M5');
  ws1.getCell('K5').value = `Total LOP / Absent Days: ${totalLopDaysSum}`;
  ws1.getCell('K5').font = { bold: true, size: 10, color: { argb: 'BE123C' } };
  ws1.getCell('K5').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getCell('K5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E6' } };

  ws1.mergeCells('N5:Q5');
  ws1.getCell('N5').value = `Total Payable Days: ${totalPayableDaysSum}`;
  ws1.getCell('N5').font = { bold: true, size: 10, color: { argb: 'FFFFFF' } };
  ws1.getCell('N5').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getCell('N5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
  ws1.getRow(5).height = 24;

  // Spacer
  ws1.getRow(6).height = 8;

  // Table Headers (Row 7)
  const headersSheet1 = [
    'Sl. No',
    'Employee ID',
    'Employee Name',
    'Department',
    'Designation',
    'Employment Type',
    'Joining Date',
    'Cycle Days',
    'Rostered Days',
    'Weekly Offs',
    'Holidays',
    'Office Present',
    'WFH Days',
    'Half Days',
    'Paid Leaves',
    'LOP / Absent',
    'Payable Days'
  ];

  const headerRow1 = ws1.getRow(7);
  headerRow1.values = headersSheet1;
  headerRow1.height = 28;

  headersSheet1.forEach((_, idx) => {
    const cell = headerRow1.getCell(idx + 1);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: NAVY_HEADER } },
      bottom: { style: 'medium', color: { argb: NAVY_HEADER } },
      left: { style: 'thin', color: { argb: '475569' } },
      right: { style: 'thin', color: { argb: '475569' } }
    };
  });

  // Populate Data Rows for Sheet 1
  employeeMetricsList.forEach((m, i) => {
    const rowIdx = 8 + i;
    const row = ws1.getRow(rowIdx);
    const isEven = i % 2 === 0;
    const rowBg = isEven ? 'FFFFFF' : SLATE_BG;

    row.values = [
      i + 1,
      m.employeeId,
      m.fullName,
      m.department,
      m.designation,
      m.employmentType,
      m.joiningDate,
      m.calendarDays,
      m.rosteredWorkingDays,
      m.weeklyOffDays,
      m.holidayDays,
      m.presentOfficeDays,
      m.wfhDays,
      m.halfDays,
      m.paidLeaveDays,
      m.lossOfPayDays,
      m.payableDays
    ];
    row.height = 22;

    headersSheet1.forEach((_, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.font = { name: 'Calibri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } }
      };

      // Specific column alignments & number formats
      if (colIdx === 0 || colIdx === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colIdx === 2 || colIdx === 3 || colIdx === 4) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colIdx >= 7 && colIdx <= 16) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (colIdx === 15 && m.lossOfPayDays > 0) {
          // Highlight LOP in bold red
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'BE123C' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E6' } };
        } else if (colIdx === 16) {
          // Highlight Payable Days in bold teal
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '0F766E' } };
        }
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  // Summary Row at Bottom of Sheet 1
  const lastDataRow = 7 + employeeMetricsList.length;
  const summaryRowIdx = lastDataRow + 1;
  const summaryRow = ws1.getRow(summaryRowIdx);
  summaryRow.height = 26;

  summaryRow.getCell(1).value = 'TOTAL';
  ws1.mergeCells(`A${summaryRowIdx}:G${summaryRowIdx}`);
  const mergedTotal = summaryRow.getCell(1);
  mergedTotal.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  mergedTotal.alignment = { horizontal: 'right', vertical: 'middle' };
  mergedTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };

  // Total formulas
  summaryRow.getCell(8).value = { formula: `SUM(H8:H${lastDataRow})` };
  summaryRow.getCell(9).value = { formula: `SUM(I8:I${lastDataRow})` };
  summaryRow.getCell(10).value = { formula: `SUM(J8:J${lastDataRow})` };
  summaryRow.getCell(11).value = { formula: `SUM(K8:K${lastDataRow})` };
  summaryRow.getCell(12).value = { formula: `SUM(L8:L${lastDataRow})` };
  summaryRow.getCell(13).value = { formula: `SUM(M8:M${lastDataRow})` };
  summaryRow.getCell(14).value = { formula: `SUM(N8:N${lastDataRow})` };
  summaryRow.getCell(15).value = { formula: `SUM(O8:O${lastDataRow})` };
  summaryRow.getCell(16).value = { formula: `SUM(P8:P${lastDataRow})` };
  summaryRow.getCell(17).value = { formula: `SUM(Q8:Q${lastDataRow})` };

  headersSheet1.forEach((_, cIdx) => {
    const cell = summaryRow.getCell(cIdx + 1);
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.border = {
      top: { style: 'medium', color: { argb: NAVY_HEADER } },
      bottom: { style: 'double', color: { argb: NAVY_HEADER } }
    };
    if (cIdx >= 7 && cIdx <= 16) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    }
  });

  // Auto-fit column widths for Sheet 1 (up to Payable Days)
  ws1.columns = [
    { width: 8 },  // Sl. No
    { width: 14 }, // Emp ID
    { width: 24 }, // Name
    { width: 18 }, // Dept
    { width: 24 }, // Designation
    { width: 16 }, // Employment Type
    { width: 13 }, // Joining Date
    { width: 12 }, // Cycle Days
    { width: 13 }, // Rostered Days
    { width: 12 }, // Weekly Offs
    { width: 11 }, // Holidays
    { width: 14 }, // Office Present
    { width: 12 }, // WFH
    { width: 11 }, // Half Days
    { width: 13 }, // Paid Leaves
    { width: 14 }, // LOP / Absent
    { width: 14 }  // Payable Days
  ];

  // Auto-Filter for Sheet 1
  ws1.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7, column: headersSheet1.length }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET 2: Daily Attendance Matrix (26 to 26)
  // ─────────────────────────────────────────────────────────────────────────────
  const ws2 = workbook.addWorksheet('Daily Attendance (26 to 26)', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 6, activeCell: 'D7' }]
  });

  // Top Title Banner
  ws2.mergeCells(1, 1, 1, 5 + dates.length + 7);
  const titleCell2 = ws2.getCell(1, 1);
  titleCell2.value = `KALPANAAA SOFTWARE SOLUTIONS | 26-TO-26 DAY-BY-DAY ATTENDANCE ROSTER MATRIX (${startDate} to ${endDate})`;
  titleCell2.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell2.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };
  ws2.getRow(1).height = 28;

  // Legend Row
  ws2.mergeCells(2, 1, 2, 5 + dates.length + 7);
  const legendCell = ws2.getCell(2, 1);
  legendCell.value = 'LEGEND: [P] Present in Office | [WFH] Work From Home | [HD] Half Day | [L] Approved Paid Leave | [LOP] Loss of Pay / Absent | [WO] Sunday Weekly Off | [H] Company Holiday | [NJ] Not Joined Yet';
  legendCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '1E3A8A' } };
  legendCell.alignment = { horizontal: 'center', vertical: 'middle' };
  legendCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
  ws2.getRow(2).height = 20;

  // Spacer
  ws2.getRow(3).height = 6;

  // Date Headers (Row 4 & 5)
  // Base columns
  const baseHeaders = ['Sl. No', 'Employee ID', 'Employee Name', 'Department', 'Designation'];
  const summaryHeaders2 = ['Total P', 'Total WFH', 'Total HD', 'Total Leave', 'Total LOP', 'Weekly Off', 'Holidays'];

  // Row 4: Day names (e.g. Wed, Thu, Fri...)
  const dayNameRow = ws2.getRow(4);
  baseHeaders.forEach((h, idx) => {
    dayNameRow.getCell(idx + 1).value = '';
  });
  dates.forEach((d, idx) => {
    const dObj = new Date(`${d}T00:00:00Z`);
    const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const cell = dayNameRow.getCell(baseHeaders.length + idx + 1);
    cell.value = dayName;
    cell.font = { size: 8, color: { argb: '64748B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
  });
  dayNameRow.height = 16;

  // Row 5: Column Names + Date Numbers (e.g. 26-Aug, 27-Aug...)
  const headerRow2 = ws2.getRow(5);
  baseHeaders.forEach((h, idx) => {
    const cell = headerRow2.getCell(idx + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  dates.forEach((d, idx) => {
    const dObj = new Date(`${d}T00:00:00Z`);
    const label = `${dObj.getUTCDate()} ${dObj.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}`;
    const cell = headerRow2.getCell(baseHeaders.length + idx + 1);
    cell.value = label;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  summaryHeaders2.forEach((sh, idx) => {
    const cell = headerRow2.getCell(baseHeaders.length + dates.length + idx + 1);
    cell.value = sh;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
  headerRow2.height = 24;

  // Populate Employee Daily Attendance Rows in Sheet 2
  employeeMetricsList.forEach((m, i) => {
    const rowIdx = 6 + i;
    const row = ws2.getRow(rowIdx);
    row.height = 20;

    // Base info
    row.getCell(1).value = i + 1;
    row.getCell(2).value = m.employeeId;
    row.getCell(3).value = m.fullName;
    row.getCell(4).value = m.department;
    row.getCell(5).value = m.designation;

    baseHeaders.forEach((_, idx) => {
      const cell = row.getCell(idx + 1);
      cell.font = { size: 9 };
      cell.border = { top: { style: 'thin', color: { argb: BORDER_COLOR } }, bottom: { style: 'thin', color: { argb: BORDER_COLOR } } };
      if (idx <= 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Date cells
    dates.forEach((d, dIdx) => {
      const colIdx = baseHeaders.length + dIdx + 1;
      const cell = row.getCell(colIdx);
      const detail = m.dailyDetails[d];
      const code = detail ? detail.code : 'LOP';

      cell.value = code;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } }
      };

      // Styling per status code
      if (code === 'P') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '166534' } }; // Dark green
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }; // Light green
      } else if (code === 'WFH') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '0369A1' } }; // Sky blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
      } else if (code === 'HD') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '92400E' } }; // Amber
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      } else if (code === 'L') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '6B21A8' } }; // Purple
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3E8FF' } };
      } else if (code === 'LOP') {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '9F1239' } }; // Dark red
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E6' } };
      } else if (code === 'WO') {
        cell.font = { name: 'Calibri', size: 8, color: { argb: '64748B' } }; // Slate
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      } else if (code === 'H') {
        cell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: '115E59' } }; // Teal
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCFBF1' } };
      } else if (code === 'NJ') {
        cell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: '94A3B8' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
    });

    // Summary counts at right
    const sumStart = baseHeaders.length + dates.length;
    row.getCell(sumStart + 1).value = m.presentOfficeDays;
    row.getCell(sumStart + 2).value = m.wfhDays;
    row.getCell(sumStart + 3).value = m.halfDays;
    row.getCell(sumStart + 4).value = m.paidLeaveDays;
    row.getCell(sumStart + 5).value = m.lossOfPayDays;
    row.getCell(sumStart + 6).value = m.weeklyOffDays;
    row.getCell(sumStart + 7).value = m.holidayDays;

    summaryHeaders2.forEach((_, sIdx) => {
      const cell = row.getCell(sumStart + sIdx + 1);
      cell.font = { name: 'Calibri', size: 9, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin', color: { argb: BORDER_COLOR } }, bottom: { style: 'thin', color: { argb: BORDER_COLOR } } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      if (sIdx === 4 && m.lossOfPayDays > 0) {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'BE123C' } };
      }
    });
  });

  // Widths for Sheet 2
  ws2.getColumn(1).width = 7;
  ws2.getColumn(2).width = 13;
  ws2.getColumn(3).width = 24;
  ws2.getColumn(4).width = 18;
  ws2.getColumn(5).width = 22;
  dates.forEach((_, idx) => {
    ws2.getColumn(baseHeaders.length + idx + 1).width = 8.5;
  });
  summaryHeaders2.forEach((_, idx) => {
    ws2.getColumn(baseHeaders.length + dates.length + idx + 1).width = 11;
  });

  // Auto-Filter for Sheet 2
  ws2.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: baseHeaders.length + dates.length + summaryHeaders2.length }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SHEET 3: Department Analytics & Headcount Summary
  // ─────────────────────────────────────────────────────────────────────────────
  const ws3 = workbook.addWorksheet('Department Analytics');

  ws3.mergeCells('A1:F1');
  const titleCell3 = ws3.getCell('A1');
  titleCell3.value = `DEPARTMENTAL ATTENDANCE PERFORMANCE SUMMARY (${cycleLabel})`;
  titleCell3.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell3.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };
  ws3.getRow(1).height = 28;

  ws3.getRow(2).height = 10;

  const deptHeaders = [
    'Sl. No',
    'Department',
    'Headcount',
    'Avg Attendance %',
    'Total Payable Days',
    'Total LOP Days'
  ];

  const headerRow3 = ws3.getRow(3);
  headerRow3.values = deptHeaders;
  headerRow3.height = 24;

  deptHeaders.forEach((_, idx) => {
    const cell = headerRow3.getCell(idx + 1);
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };
  });

  // Group by department
  const deptMap = new Map<string, EmployeeCycleMetrics[]>();
  employeeMetricsList.forEach(m => {
    const dept = m.department || 'General';
    if (!deptMap.has(dept)) deptMap.set(dept, []);
    deptMap.get(dept)!.push(m);
  });

  let deptRowIdx = 4;
  Array.from(deptMap.entries()).forEach(([deptName, list], idx) => {
    const row = ws3.getRow(deptRowIdx);
    const count = list.length;
    const avgAtt = list.reduce((s, e) => s + e.attendanceRate, 0) / count;
    const totPayable = list.reduce((s, e) => s + e.payableDays, 0);
    const totLop = list.reduce((s, e) => s + e.lossOfPayDays, 0);

    row.values = [
      idx + 1,
      deptName,
      count,
      avgAtt / 100,
      totPayable,
      totLop
    ];
    row.height = 22;

    deptHeaders.forEach((_, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.font = { size: 10 };
      cell.border = { top: { style: 'thin', color: { argb: BORDER_COLOR } }, bottom: { style: 'thin', color: { argb: BORDER_COLOR } } };
      if (cIdx === 0) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (cIdx === 1) cell.alignment = { horizontal: 'left', vertical: 'middle' };
      if (cIdx >= 2) cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (cIdx === 3) cell.numFmt = '0.0%';
    });

    deptRowIdx++;
  });

  // Grand Total Row in Sheet 3
  const summaryRow3 = ws3.getRow(deptRowIdx);
  summaryRow3.height = 24;
  summaryRow3.getCell(1).value = 'TOTAL';
  ws3.mergeCells(`A${deptRowIdx}:B${deptRowIdx}`);
  summaryRow3.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFFFFF' } };
  summaryRow3.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
  summaryRow3.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_HEADER } };

  summaryRow3.getCell(3).value = { formula: `SUM(C4:C${deptRowIdx - 1})` };
  summaryRow3.getCell(4).value = { formula: `AVERAGE(D4:D${deptRowIdx - 1})` };
  summaryRow3.getCell(4).numFmt = '0.0%';
  summaryRow3.getCell(5).value = { formula: `SUM(E4:E${deptRowIdx - 1})` };
  summaryRow3.getCell(6).value = { formula: `SUM(F4:F${deptRowIdx - 1})` };

  deptHeaders.forEach((_, cIdx) => {
    const cell = summaryRow3.getCell(cIdx + 1);
    cell.font = { bold: true, size: 10 };
    cell.border = { top: { style: 'medium', color: { argb: NAVY_HEADER } }, bottom: { style: 'double', color: { argb: NAVY_HEADER } } };
    if (cIdx >= 2) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    }
  });

  ws3.columns = [
    { width: 8 },  // Sl. No
    { width: 24 }, // Dept
    { width: 14 }, // Headcount
    { width: 18 }, // Avg Att
    { width: 20 }, // Total Payable
    { width: 18 }  // Total LOP
  ];

  // 5. Generate Binary Buffer & Trigger Browser Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const sanitizedLabel = cycleLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Kalpanaaa_Attendance_Ledger_${sanitizedLabel}.xlsx`;

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

  return {
    success: true,
    fileName,
    totalPersonnel: employeeMetricsList.length,
    totalDisbursement: totalNetDisbursement,
    cycleLabel
  };
}
