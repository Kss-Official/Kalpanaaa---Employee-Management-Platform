import { CompanySettings, Employee, AttendanceRecord } from '../types';

/**
 * Standard Company Timezone for Attendance & Work-Day calculations (IST)
 */
export const COMPANY_TIMEZONE = 'Asia/Kolkata';

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
  const key = empOrUid?.uid || empOrUid?.employeeUid || fallbackUserUid || empOrUid?.id || empOrUid?.employeeId || empOrUid?.employeeCode || '';
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

  const targetUid = getCanonicalEmployeeUid(employeeOrUid);
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

  const recUid = String(rec.uid || rec.employeeUid || '').trim();
  const recEmpId = String(rec.employeeId || '').trim().toLowerCase();
  const recEmpCode = String(rec.employeeCode || '').trim().toLowerCase();
  const recName = String(rec.employeeName || '').trim().toLowerCase();

  if (targetUid && (recUid === targetUid || rec.id === `${targetUid}_${rec.date}` || rec.id.startsWith(`${targetUid}_`))) {
    return true;
  }
  if (targetCode && (recEmpCode === targetCode || recEmpId === targetCode || rec.id.includes(targetCode))) {
    return true;
  }
  if (targetId && (recEmpId === targetId || recEmpCode === targetId || rec.id.includes(targetId))) {
    return true;
  }
  if (targetName && recName && targetName === recName) {
    return true;
  }
  return false;
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
  status: 'Present' | 'Late' | 'Half Day';
  locationVerified: boolean;
  distanceMeters?: number;
  message: string;
}

/**
 * Evaluates whether check-in / check-out is valid based on settings, time, location
 */
export function evaluateAttendanceScan(
  employee: Employee,
  todayRecord: AttendanceRecord | undefined,
  settings: CompanySettings,
  userLat?: number,
  userLon?: number,
  isApprovedWfh?: boolean
): CheckInEvaluation {
  const isGpsEnforced = settings.gpsRequired !== false;

  // 1. Check GPS Location
  let locationVerified = true;
  let distanceMeters = 0;

  if (isApprovedWfh) {
    // Approved WFH: Bypass office GPS radius check completely so employee can check in from home
    locationVerified = true;
    distanceMeters = 0;
  } else if (isGpsEnforced) {
    // Normal Office Days: Employee MUST be near the company office location (set by CEO/CTO)
    if (userLat === undefined || userLon === undefined) {
      locationVerified = false;
    } else {
      const officeLat = settings.officeLatitude || 13.014333;
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

    // MORNING TIME WINDOW RULE: Check-in is strictly restricted until 10:00 AM IST
    const currentHourIST = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(now), 10);
    const currentMinIST = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'Asia/Kolkata' }).format(now), 10);

    if (currentHourIST < 10) {
      const minRemaining = (9 - currentHourIST) * 60 + (60 - currentMinIST);
      return {
        allowed: false,
        action: 'CHECK_IN',
        status: 'Present',
        locationVerified: false,
        distanceMeters: 0,
        message: `Check-In Restricted: Morning shift check-in opens strictly at 10:00 AM IST. Please wait until 10:00 AM to check in (${minRemaining} mins remaining).`
      };
    }

    const lateThreshold = new Date();
    lateThreshold.setHours(10, 30, 0, 0);

    let status: 'Present' | 'Late' = now > lateThreshold ? 'Late' : 'Present';

    // Strict GPS Enforcement on Normal Days
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
          : 'Successfully Checked In — GPS Office Location Verified'
    };
  }

  if (todayRecord.checkInAt && !todayRecord.checkOutAt) {
    // Perform CHECK_OUT
    if (!isApprovedWfh && isGpsEnforced && !locationVerified) {
      if (userLat === undefined || userLon === undefined) {
        return {
          allowed: false,
          action: 'CHECK_OUT',
          status: todayRecord.status as 'Present' | 'Late' | 'Half Day',
          locationVerified: false,
          distanceMeters: 0,
          message: 'GPS Location Required for Check-Out.'
        };
      }

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
 * Generate 90-day realistic historical attendance records for employees
 */
export function generateHistoricalAttendance(employees: Employee[], daysBack: number = 90): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const today = new Date();

  for (let i = 1; i <= daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);

    // Skip weekends (Sunday=0, Saturday=6)
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().split('T')[0];

    employees.forEach((emp, empIdx) => {
      // Deterministic pseudo-random seed per date + employee
      const dateNum = parseInt(dateStr.replace(/-/g, ''), 10);
      const seed = dateNum * 1 + empIdx * 101 + emp.id.length * 13;
      const pseudoRand = (n: number) => Math.abs(Math.sin(seed + n) * 10000) % 1;

      // Status probabilities
      const randVal = pseudoRand(1);
      const isLate = randVal > 0.85 && randVal <= 0.95;
      const isWfh = randVal > 0.95;

      // Realistic Check-In times IST (+05:30)
      // Regular: 09:35 AM to 09:58 AM IST
      // Late: 10:15 AM to 10:45 AM IST
      const minOffset = isLate 
        ? Math.floor(pseudoRand(2) * 30) + 15 
        : Math.floor(pseudoRand(2) * 23) - 25;

      const totalMinIST = 10 * 60 + minOffset;
      const hrIST = Math.floor(totalMinIST / 60);
      const mnIST = Math.abs(totalMinIST % 60);
      const checkInISO = `${dateStr}T${String(hrIST).padStart(2, '0')}:${String(mnIST).padStart(2, '0')}:00+05:30`;

      // Work duration: 8h 15m to 9h 30m
      const durationMins = isLate 
        ? 480 + Math.floor(pseudoRand(3) * 45)
        : 510 + Math.floor(pseudoRand(3) * 60);

      const checkOutTotalMinIST = totalMinIST + durationMins + 45;
      const outHrIST = Math.floor(checkOutTotalMinIST / 60);
      const outMnIST = Math.abs(checkOutTotalMinIST % 60);
      const checkOutISO = `${dateStr}T${String(outHrIST).padStart(2, '0')}:${String(outMnIST).padStart(2, '0')}:00+05:30`;

      const teaStart = `${dateStr}T11:${String(15 + Math.floor(pseudoRand(4) * 20)).padStart(2, '0')}:00+05:30`;
      const teaEnd = `${dateStr}T11:${String(30 + Math.floor(pseudoRand(4) * 15)).padStart(2, '0')}:00+05:30`;
      const mealStart = `${dateStr}T13:${String(15 + Math.floor(pseudoRand(5) * 30)).padStart(2, '0')}:00+05:30`;
      const mealEnd = `${dateStr}T13:${String(45 + Math.floor(pseudoRand(5) * 15)).padStart(2, '0')}:00+05:30`;

      records.push({
        id: `att-hist-${dateStr}-${emp.id}`,
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        department: emp.department || 'Engineering',
        date: dateStr,
        checkInAt: checkInISO,
        checkOutAt: checkOutISO,
        status: isWfh ? 'Work From Home' : isLate ? 'Late' : 'Present',
        attendanceMethod: 'Self Portal',
        locationVerified: !isWfh,
        workingMinutes: durationMins,
        totalBreakMinutes: 45,
        isWfh,
        breaks: [
          { type: 'Tea Break', startAt: teaStart, endAt: teaEnd, durationMinutes: 15 },
          { type: 'Meal Break', startAt: mealStart, endAt: mealEnd, durationMinutes: 30 }
        ],
        createdAt: checkInISO,
        updatedAt: checkOutISO
      });
    });
  }

  return records;
}
