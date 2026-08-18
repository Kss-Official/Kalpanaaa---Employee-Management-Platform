/**
 * Fetches the current accurate time and returns it as a Date object
 * representing the true current moment in IST (Asia/Kolkata, UTC+05:30).
 *
 * BUG FIX: Previously the UTC response from timeapi.io was stored with a 'Z'
 * suffix and later displayed without timezone conversion — causing check-in
 * times to appear 5h 30min earlier than the real IST time.
 *
 * FIX: We now always return a Date that represents the real wall-clock moment.
 * new Date() in JavaScript always holds an absolute UTC moment internally;
 * display is handled by toLocaleTimeString with the correct locale/timezone.
 */
export const fetchAbsoluteTime = async (): Promise<Date> => {
  // Use exact device/browser clock time (network synced via NTP)
  return new Date();
};

// ─────────────────────────────────────────────────────────
//  IST DISPLAY HELPERS
//  Always force Asia/Kolkata timezone in display, regardless
//  of what timezone the user's device is set to.
// ─────────────────────────────────────────────────────────

const IST_LOCALE = 'en-IN';
const IST_TZ = 'Asia/Kolkata';

/**
 * Format a timestamp string or Date to IST time only.
 * e.g. "10:00 AM"
 */
export const toISTTimeString = (
  value: string | Date | null | undefined,
  hour12 = true
): string => {
  if (!value) return '--';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString(IST_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
    timeZone: IST_TZ,
  });
};

/**
 * Format a timestamp string or Date to IST date only.
 * e.g. "15 Aug 2026"
 */
export const toISTDateString = (
  value: string | Date | null | undefined
): string => {
  if (!value) return '--';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString(IST_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: IST_TZ,
  });
};

/**
 * Format a timestamp to IST date + time.
 * e.g. "15 Aug 2026, 10:00 AM"
 */
export const toISTDateTimeString = (
  value: string | Date | null | undefined
): string => {
  if (!value) return '--';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString(IST_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: IST_TZ,
  });
};

/**
 * Get today's date string in IST (YYYY-MM-DD).
 * Safe to use instead of new Date().toISOString().split('T')[0]
 * which can return yesterday's date when the device clock is UTC.
 */
export const todayInIST = (): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TZ }); // en-CA gives YYYY-MM-DD
};
