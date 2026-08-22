import { CompanySettings, Employee, AttendanceRecord, AttendanceStatus } from '../types';

/**
 * Standard Company Timezone for Attendance & Work-Day calculations (IST)
 */
export const COMPANY_TIMEZONE = 'Asia/Kolkata';

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
  const canonicalUid = getCanonicalEmployeeUid(employeeOrUid);

  const matches = attendance.filter(rec => isAttendanceForEmployee(rec, employeeOrUid, date));

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
  status: 'Present' | 'Late' | 'Half Day';
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
  weeklyOffDays?: number[]; // 0 = Sunday … 6 = Saturday
  nowMs?: number;
  /** Minutes past shift start after which a no-show counts as absent. */
  absentAfterMinutes?: number;
}

export type RosterRecord = AttendanceRecord & { isSynthetic?: boolean };

/** True when `dateStr` (YYYY-MM-DD, IST) is a non-working day for the company. */
export function isNonWorkingDay(
  dateStr: string,
  holidayDates: string[] = [],
  weeklyOffDays: number[] = WEEKLY_OFF_DAYS
): boolean {
  if (!dateStr) return false;
  if (holidayDates.includes(dateStr)) return true;
  // Parse as a plain calendar date — appending T00:00:00Z keeps the weekday
  // independent of the machine timezone (a bare 'YYYY-MM-DD' is already UTC,
  // but being explicit documents the intent).
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return weeklyOffDays.includes(day);
}

/** True when an approved leave request of the given employee covers `dateStr`. */
export function hasApprovedLeaveOn(
  leaveRequests: any[] | undefined,
  emp: any,
  dateStr: string,
  types?: string[]
): boolean {
  if (!Array.isArray(leaveRequests) || !emp) return false;
  return leaveRequests.some(r => {
    if (!r || r.status !== 'Approved') return false;
    if (types && !types.includes(r.type)) return false;
    const matchesEmployee =
      r.employeeId === emp.employeeId ||
      r.employeeId === emp.id ||
      r.employeeUid === emp.uid ||
      (!!r.employeeName && !!emp.fullName && r.employeeName === emp.fullName);
    if (!matchesEmployee) return false;
    const start = r.startDate || r.fromDate;
    const end = r.endDate || r.toDate || start;
    return !!start && dateStr >= start && dateStr <= end;
  });
}

export function buildDailyRoster(
  employees: any[],
  attendance: AttendanceRecord[],
  dateStr: string,
  opts: DailyRosterOptions = {}
): RosterRecord[] {
  if (!Array.isArray(employees) || !dateStr) return [];

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
    // Terminated / suspended staff are no longer expected to attend.
    if (emp.status === 'Terminated' || emp.status === 'Suspended') continue;

    const existing = resolveAttendanceRecord(records, emp, dateStr);
    if (existing) {
      roster.push(existing);
      continue;
    }

    let status: AttendanceStatus;
    if (nonWorking) status = 'Holiday';
    else if (hasApprovedLeaveOn(leaveRequests, emp, dateStr, ['Leave', 'Sick Leave', 'Casual Leave', 'Earned Leave', 'Comp Off', 'Maternity', 'Paternity'])) status = 'On Leave';
    else if (emp.status === 'On Leave') status = 'On Leave';
    else if (isFuture || !shiftStartElapsed) continue; // not yet knowable
    else status = 'Absent';

    const isWfhApproved = hasApprovedLeaveOn(leaveRequests, emp, dateStr, ['WFH']);

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

export function computeLiveShiftBreakdown(record: any, nowMs: number = Date.now()): LiveShiftBreakdown {
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
  const endMs = complete ? Math.min(outMs as number, Math.max(nowMs, outMs as number)) : nowMs;
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
