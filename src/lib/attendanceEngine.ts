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
    } else if (b.startAt && b.endAt) {
      const startMs = safeGetTimestampMillis(b.startAt || b.startTime);
      const endMs = safeGetTimestampMillis(b.endAt || b.endTime);
      if (startMs && endMs && endMs > startMs) {
        durSec = Math.floor((endMs - startMs) / 1000);
      }
    }

    // Protection against corrupted numbers
    durSec = Math.max(0, durSec);

    const type = (b.type || '').toLowerCase();
    if (type.includes('tea') || type.includes('coffee') || type.includes('snack')) teaSecs += durSec;
    else if (type.includes('meal') || type.includes('lunch') || type.includes('dinner')) mealSecs += durSec;
    else if (type.includes('huddle')) huddleSecs += durSec;
    else if (type.includes('meeting')) meetingSecs += durSec;
    else if (type.includes('train') || type.includes('attainment')) trainingSecs += durSec;
    else activitySecs += durSec;
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
    if (cleanTarget && cleanRec && (cleanTarget === cleanRec || cleanTarget.includes(cleanRec) || cleanRec.includes(cleanTarget))) {
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
  const canonicalUid = getCanonicalEmployeeUid(employeeOrUid);

  const matches = attendance.filter(rec => isAttendanceForEmployee(rec, employeeOrUid, date));

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  // 1. ALWAYS prioritize records that have real check-in data (never let a blank duplicate mask an active shift)
  const checkedIn = matches
    .filter(rec => !!rec.checkInAt)
    .sort((a, b) => (safeGetTimestampMillis(b.updatedAt || b.checkInAt) || 0) - (safeGetTimestampMillis(a.updatedAt || a.checkInAt) || 0));
  if (checkedIn.length > 0) return checkedIn[0];

  // 2. Exact canonical document ID: {uid}_{YYYY-MM-DD}
  if (canonicalUid && date) {
    const canonicalId = getAttendanceDocId(canonicalUid, date);
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

    // MORNING TIME WINDOW RULE: Office timing is 10:00 AM - 07:00 PM IST. Check-in opens from 09:30 AM IST (half hour early).
    const currentHourIST = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(now), 10);
    const currentMinIST = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: 'Asia/Kolkata' }).format(now), 10);

    if (currentHourIST < 9 || (currentHourIST === 9 && currentMinIST < 30)) {
      const minRemaining = (9 - currentHourIST) * 60 + (30 - currentMinIST);
      return {
        allowed: false,
        action: 'CHECK_IN',
        status: 'Present',
        locationVerified: false,
        distanceMeters: 0,
        message: `Check-In Restricted: Morning shift check-in opens at 09:30 AM IST. Please wait until 09:30 AM to check in (${minRemaining} mins remaining).`
      };
    }

    // EVENING TIME WINDOW RULE: Office timing is 10:00 AM - 07:00 PM IST with auto-checkout at 07:15 PM.
    if (currentHourIST > 19 || (currentHourIST === 19 && currentMinIST >= 15)) {
      return {
        allowed: false,
        action: 'CHECK_IN',
        status: 'Present',
        locationVerified: false,
        distanceMeters: 0,
        message: `Check-In Blocked: Today's shift ended at 07:00 PM IST (Cutoff 07:15 PM IST). New check-ins are not permitted after shift end.`
      };
    }

    // Grace period: On-time up to 10:15 AM (15 mins past 10:00 AM)
    const isLateArrival = currentHourIST > 10 || (currentHourIST === 10 && currentMinIST > 15);
    let status: 'Present' | 'Late' = isLateArrival ? 'Late' : 'Present';

    // GPS Location Verification on Normal Days
    if (!isApprovedWfh && isGpsEnforced && !locationVerified) {
      locationVerified = false;
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
          status: todayRecord.status as 'Present' | 'Late' | 'Half Day',
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
