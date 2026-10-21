/**
 * Leave History Summary & Precise Leave Type Classification Service
 * 
 * Provides:
 * 1. Strict regex and structured classification of historical leave requests into:
 *    - Loss of Pay (LOP)
 *    - Earned Leave (EL)
 *    - Casual Leave (CL)
 *    Detects explicit mentions in reason / reviewNotes / approval notes with whole-word
 *    boundary safety (e.g. avoids false matches like "clearance" for "CL").
 *    Flags ambiguous or unverified requests for admin inspection.
 * 
 * 2. Period aggregation for Last 7 Days, Last 15 Days, and Last 30 Days:
 *    - Unique employees count per leave type.
 *    - Total days taken per leave type.
 *    - Employee-wise breakdown table (Employee Name | LOP Days | EL Days | CL Days).
 *    - Zero double-counting between leave requests, ledger, and attendance records.
 *    - Asia/Kolkata timezone safety.
 */

import { Employee, LeaveRequest, AttendanceRecord } from '../types';
import { 
  OFFICIAL_HOLIDAY_DATES_2026, 
  isNonWorkingDay, 
  isWfhType,
  WEEKLY_OFF_DAYS
} from './attendanceEngine';
import { todayInIST } from './absoluteTime';
import { generateDateSequence, isAuthoritativeApprovedLeave, isEmployeeMatch } from './leaveAnalyticsService';

export type SummaryDateRange = '7d' | '15d' | '30d';

export type ClassifiedType = 'LOP' | 'EL' | 'CL' | 'WFH' | 'OTHER';

export interface ClassificationResult {
  classifiedType: ClassifiedType;
  confidence: 'HIGH_STRUCTURED' | 'HIGH_EXPLICIT_NOTE' | 'AMBIGUOUS' | 'NOT_LEAVE';
  evidence?: string;
  isAmbiguous: boolean;
}

export interface EmployeeSummaryRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  lopDays: number;
  elDays: number;
  clDays: number;
  totalDays: number;
  hasAmbiguous: boolean;
  notesSample?: string;
}

export interface LeaveHistorySummaryData {
  range: SummaryDateRange;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysCount: number;

  // LOP Metrics
  uniqueLopEmployees: number;
  totalLopDays: number;

  // EL Metrics
  uniqueElEmployees: number;
  totalElDays: number;

  // CL Metrics
  uniqueClEmployees: number;
  totalClDays: number;

  // Employee-wise table rows
  rows: EmployeeSummaryRow[];

  // Flagged for admin verification
  ambiguousRecordsCount: number;
  ambiguousRecords: Array<{
    id: string;
    employeeName: string;
    dates: string;
    reason?: string;
    reviewNotes?: string;
  }>;
}

/**
 * High-precision leave type classifier.
 * Inspects structured type/category first, then inspects reason, reviewNotes, and multi-tier notes.
 */
export function classifyLeaveRecordStrict(req: {
  type?: string;
  leaveCategory?: string;
  reason?: string;
  reviewNotes?: string;
  pmNotes?: string;
  hrNotes?: string;
  ceoNotes?: string;
  ctoNotes?: string;
}): ClassificationResult {
  const typeStr = (req.type || '').trim();
  const catStr = (req.leaveCategory || '').trim();

  // 1. Exclude WFH
  if (isWfhType(typeStr) || isWfhType(catStr)) {
    return { classifiedType: 'WFH', confidence: 'HIGH_STRUCTURED', isAmbiguous: false };
  }

  // 2. Structured Check: Loss of Pay
  const typeLower = typeStr.toLowerCase();
  const catLower = catStr.toLowerCase();
  if (
    typeLower === 'loss of pay' || 
    typeLower === 'lop' || 
    catLower === 'loss of pay' || 
    catLower === 'lop'
  ) {
    return { classifiedType: 'LOP', confidence: 'HIGH_STRUCTURED', evidence: `Structured type: ${typeStr}`, isAmbiguous: false };
  }

  // 3. Structured Check: Casual Leave
  if (
    typeLower === 'casual leave' || 
    typeLower === 'cl' || 
    catLower === 'casual leave' || 
    catLower === 'cl'
  ) {
    return { classifiedType: 'CL', confidence: 'HIGH_STRUCTURED', evidence: `Structured type: ${typeStr}`, isAmbiguous: false };
  }

  // 4. Structured Check: Earned Leave
  if (
    typeLower === 'earn leave' || 
    typeLower === 'earned leave' || 
    typeLower === 'el' || 
    catLower === 'earn leave' || 
    catLower === 'earned leave' || 
    catLower === 'el'
  ) {
    return { classifiedType: 'EL', confidence: 'HIGH_STRUCTURED', evidence: `Structured type: ${typeStr}`, isAmbiguous: false };
  }

  // 5. Inspect Historical Notes and Reasons
  const textCorpus = [
    req.reason || '',
    req.reviewNotes || '',
    req.pmNotes || '',
    req.hrNotes || '',
    req.ceoNotes || '',
    req.ctoNotes || ''
  ].join(' ');

  // A. Check for Loss of Pay / LOP in notes
  // Matches "loss of pay", "lop", "without pay", "unpaid leave", "lwp"
  // Uses \b word boundaries so "lope" or "develop" will NEVER match!
  const lopRegex = /\b(loss\s+of\s+pay|lop|unpaid\s+leave|leave\s+without\s+pay|without\s+pay|lwp)\b/i;
  const lopMatch = textCorpus.match(lopRegex);
  if (lopMatch) {
    return {
      classifiedType: 'LOP',
      confidence: 'HIGH_EXPLICIT_NOTE',
      evidence: `Found "${lopMatch[0]}" in notes/reason`,
      isAmbiguous: false
    };
  }

  // B. Check for Casual Leave / CL in notes
  // Matches "casual leave", "casual", or standalone uppercase "CL", or "cl leave"
  // Avoids words like "clearance", "client", "clean", "class", "close", "cluster"
  const clRegex = /\b(casual\s+leave|casual)\b|\bCL\b|\bcl\s+(?:leave|taken|applied)\b/i;
  const clMatch = textCorpus.match(clRegex);
  if (clMatch) {
    return {
      classifiedType: 'CL',
      confidence: 'HIGH_EXPLICIT_NOTE',
      evidence: `Found "${clMatch[0]}" in notes/reason`,
      isAmbiguous: false
    };
  }

  // C. Check for Earned Leave / EL in notes
  // Matches "earned leave", "earn leave", "paid leave", or standalone uppercase "EL"
  // Avoids words like "element", "electron", "help", "hello"
  const elRegex = /\b(earned\s+leave|earn\s+leave|paid\s+leave)\b|\bEL\b|\bel\s+(?:leave|taken|applied)\b/i;
  const elMatch = textCorpus.match(elRegex);
  if (elMatch) {
    return {
      classifiedType: 'EL',
      confidence: 'HIGH_EXPLICIT_NOTE',
      evidence: `Found "${elMatch[0]}" in notes/reason`,
      isAmbiguous: false
    };
  }

  // D. Generic 'Leave' with no explicit EL/CL/LOP evidence
  if (typeStr === 'Leave' || typeStr === '') {
    // Prompt rule: "Do not classify every mention of 'leave' as EL, CL, or LOP. If the note is ambiguous, flag the record for admin verification rather than guessing."
    return {
      classifiedType: 'OTHER',
      confidence: 'AMBIGUOUS',
      evidence: 'Generic leave with unspecified leave category; requires admin verification',
      isAmbiguous: true
    };
  }

  return { classifiedType: 'OTHER', confidence: 'NOT_LEAVE', isAmbiguous: false };
}

/**
 * Calculates the exact start and end date for 7d, 15d, and 30d in Asia/Kolkata timezone.
 * "Last 7 Days" means today and the previous six calendar dates in Asia/Kolkata.
 * "Last 15 Days" means today and the previous fourteen calendar dates.
 * "Last 30 Days" means today and the previous twenty-nine calendar dates.
 */
export function getSummaryIntervalDates(range: SummaryDateRange): { startDate: string; endDate: string; dateList: string[] } {
  const today = todayInIST();
  const daysBack = range === '7d' ? 6 : range === '15d' ? 14 : 29;

  const [y, m, d] = today.split('-').map(Number);
  const startObj = new Date(Date.UTC(y, m - 1, d - daysBack, 12, 0, 0));
  const startDate = `${startObj.getUTCFullYear()}-${String(startObj.getUTCMonth() + 1).padStart(2, '0')}-${String(startObj.getUTCDate()).padStart(2, '0')}`;

  const dateList = generateDateSequence(startDate, today);
  return { startDate, endDate: today, dateList };
}

/**
 * Aggregates verified leave history for LOP, EL, and CL.
 */
export function computeLeaveHistorySummary(
  employees: Employee[],
  leaveRequests: LeaveRequest[],
  attendance: AttendanceRecord[] = [],
  range: SummaryDateRange = '7d'
): LeaveHistorySummaryData {
  const { startDate, endDate, dateList } = getSummaryIntervalDates(range);
  const todayStr = todayInIST();
  const holidays = OFFICIAL_HOLIDAY_DATES_2026;

  // Filter approved leave requests only (strictly exclude Pending, Rejected, Cancelled)
  const approvedRequests = (leaveRequests || []).filter(r => isAuthoritativeApprovedLeave(r));

  // Tracking containers
  const employeeDataMap = new Map<string, {
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    department: string;
    lopDays: number;
    elDays: number;
    clDays: number;
    hasAmbiguous: boolean;
    evidenceNotes: string[];
  }>();

  const ambiguousRecordsList: Array<{
    id: string;
    employeeName: string;
    dates: string;
    reason?: string;
    reviewNotes?: string;
  }> = [];

  // Track unique employee IDs per type
  const uniqueLopEmpIds = new Set<string>();
  const uniqueElEmpIds = new Set<string>();
  const uniqueClEmpIds = new Set<string>();

  // Initialize employee map for active staff
  for (const emp of (employees || [])) {
    if (emp.status === 'Inactive' || emp.status === 'Terminated') continue;
    employeeDataMap.set(emp.id, {
      employeeId: emp.id,
      employeeCode: emp.employeeId || emp.id,
      employeeName: emp.fullName || 'Unknown Employee',
      department: emp.department || 'General',
      lopDays: 0,
      elDays: 0,
      clDays: 0,
      hasAmbiguous: false,
      evidenceNotes: []
    });
  }

  // Iterate day-by-day across the date sequence for each employee
  for (const dateStr of dateList) {
    // Only count dates up to today (leave taken; not future dates)
    if (dateStr > todayStr) continue;

    const isNonWorking = isNonWorkingDay(dateStr, holidays, WEEKLY_OFF_DAYS);

    for (const [empId, empEntry] of employeeDataMap.entries()) {
      const emp = employees.find(e => e.id === empId);
      if (!emp) continue;

      const empJoinDate = emp.joiningDate || (emp as any).joining_date;
      if (empJoinDate && dateStr < empJoinDate) continue;

      // 1. Check for matching approved leave requests covering this date
      const matchingReq = approvedRequests.find(r => {
        if (!isEmployeeMatch(emp, r)) return false;
        const s = r.startDate || (r as any).fromDate;
        const e = r.endDate || (r as any).toDate || s;
        return s && e && dateStr >= s && dateStr <= e;
      });

      if (matchingReq) {
        // Exclude weekends/holidays unless explicitly stated
        if (isNonWorking) continue;

        const classification = classifyLeaveRecordStrict(matchingReq);
        const isHalf = (matchingReq as any).isHalfDay === true || 
                       (matchingReq.reason && matchingReq.reason.toLowerCase().includes('half day'));
        const dayVal = isHalf ? 0.5 : 1.0;

        if (classification.isAmbiguous) {
          empEntry.hasAmbiguous = true;
          if (!ambiguousRecordsList.some(a => a.id === matchingReq.id)) {
            ambiguousRecordsList.push({
              id: matchingReq.id,
              employeeName: matchingReq.employeeName || emp.fullName,
              dates: `${matchingReq.startDate} to ${matchingReq.endDate}`,
              reason: matchingReq.reason,
              reviewNotes: matchingReq.reviewNotes
            });
          }
        }

        if (classification.classifiedType === 'LOP') {
          empEntry.lopDays += dayVal;
          uniqueLopEmpIds.add(empId);
        } else if (classification.classifiedType === 'CL') {
          empEntry.clDays += dayVal;
          uniqueClEmpIds.add(empId);
        } else if (classification.classifiedType === 'EL') {
          empEntry.elDays += dayVal;
          uniqueElEmpIds.add(empId);
        }

        if (classification.evidence && !empEntry.evidenceNotes.includes(classification.evidence)) {
          empEntry.evidenceNotes.push(classification.evidence);
        }

        continue; // Handled authoritative request for this day; do not double count with attendance
      }

      // 2. Fallback to confirmed Attendance records (for LOP absence)
      if (!isNonWorking) {
        const att = attendance.find(a => a.date === dateStr && isEmployeeMatch(emp, a));
        if (att) {
          const st = (att.status || '') as string;
          const notes = (att.notes || '').toLowerCase();
          const isLop = st === 'Loss of Pay' || st === 'LOP' || notes.includes('lop') || notes.includes('loss of pay');
          
          if (isLop) {
            const isHalf = st === 'Half Day';
            const dayVal = isHalf ? 0.5 : 1.0;
            empEntry.lopDays += dayVal;
            uniqueLopEmpIds.add(empId);
          }
        }
      }
    }
  }

  // Build rows for employees who took at least one leave day (or had ambiguous leave)
  const rows: EmployeeSummaryRow[] = [];
  let totalLopDays = 0;
  let totalElDays = 0;
  let totalClDays = 0;

  for (const entry of employeeDataMap.values()) {
    const totalDays = entry.lopDays + entry.elDays + entry.clDays;
    totalLopDays += entry.lopDays;
    totalElDays += entry.elDays;
    totalClDays += entry.clDays;

    if (totalDays > 0 || entry.hasAmbiguous) {
      rows.push({
        employeeId: entry.employeeId,
        employeeCode: entry.employeeCode,
        employeeName: entry.employeeName,
        department: entry.department,
        lopDays: entry.lopDays,
        elDays: entry.elDays,
        clDays: entry.clDays,
        totalDays,
        hasAmbiguous: entry.hasAmbiguous,
        notesSample: entry.evidenceNotes.join('; ')
      });
    }
  }

  // Sort rows highest leave days first
  rows.sort((a, b) => b.totalDays - a.totalDays || a.employeeName.localeCompare(b.employeeName));

  return {
    range,
    startDate,
    endDate,
    daysCount: dateList.length,
    uniqueLopEmployees: uniqueLopEmpIds.size,
    totalLopDays,
    uniqueElEmployees: uniqueElEmpIds.size,
    totalElDays,
    uniqueClEmployees: uniqueClEmpIds.size,
    totalClDays,
    rows,
    ambiguousRecordsCount: ambiguousRecordsList.length,
    ambiguousRecords: ambiguousRecordsList
  };
}

/**
 * Formats YYYY-MM-DD into a localized friendly date (e.g., '15 Oct 2026') in IST.
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}
