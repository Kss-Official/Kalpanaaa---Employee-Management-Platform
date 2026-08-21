import { classifyError } from './errors';
import { safeGetJson } from './safeStorage';

// Injected at build time via vite.config define
declare const __BUILD_ID__: string;

// ── Production Observability (Phase 22) ─────────────────────────────────────
// Writes structured diagnostics to the Firestore `error_logs` collection so
// field failures are visible without user reports. Design constraints:
//   • FIRE-AND-FORGET: logging must never delay or break the app path that
//     failed. Every await is swallowed.
//   • RATE-LIMITED: max 25 writes/session and identical failures within a
//     60s window are suppressed, keeping cost near-zero even during outages.
//   • SECRET-FREE: passwords, tokens, and full emails are never recorded.
//   • LAZY: firebase/firestore is imported dynamically so this module adds
//     nothing to the critical boot path and cannot create import cycles.

const MAX_LOGS_PER_SESSION = 25;
const DEDUP_WINDOW_MS = 60_000;
const MAX_STACK_LENGTH = 1500;

let sessionLogCount = 0;
const recentSignatures = new Map<string, number>();

export interface ErrorLogEntry {
  category?: string;
  message: string;
  stack?: string;
  route?: string;
  operationType?: string;
  path?: string | null;
}

function collectEnvironment() {
  let browser = 'Unknown';
  let os = 'Unknown';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  const conn = (navigator as any)?.connection;
  const network = conn?.effectiveType || 'unknown';

  return { browser, os, network, userAgent: ua };
}

function getSessionIdentity(): { uid: string | null; employeeId: string | null; role: string | null } {
  try {
    const raw = localStorage.getItem('kss_v1_session');
    if (!raw) return { uid: null, employeeId: null, role: null };
    // Session marker stores the employee document id (plain string or JSON string)
    let empDocId: string | null = raw;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') empDocId = parsed;
      else empDocId = parsed?.id || parsed?.employeeId || String(parsed);
    } catch { /* plain string — already handled */ }
    // Resolve role from the cached employee directory (no extra reads)
    let role: string | null = null;
    const emps = safeGetJson<any[]>('kss_v1_employees', []);
    if (Array.isArray(emps)) {
      const match = emps.find(e => e && (e.id === empDocId || e.employeeId === empDocId));
      role = match?.role || null;
    }
    return { uid: null, employeeId: empDocId, role };
  } catch {
    return { uid: null, employeeId: null, role: null };
  }
}

function shouldSuppress(category: string, message: string): boolean {
  if (sessionLogCount >= MAX_LOGS_PER_SESSION) return true;
  const signature = `${category}::${message.slice(0, 120)}`;
  const now = Date.now();
  const last = recentSignatures.get(signature) || 0;
  if (now - last < DEDUP_WINDOW_MS) return true;
  // Prune stale signatures to keep the map small
  if (recentSignatures.size > 50) {
    for (const [k, t] of recentSignatures) {
      if (now - t > DEDUP_WINDOW_MS) recentSignatures.delete(k);
    }
  }
  recentSignatures.set(signature, now);
  return false;
}

/**
 * Queue one diagnostic record. Resolves immediately; failures are silent by
 * design (an observability failure must never become a user-facing failure).
 */
export function logErrorToFirestore(entry: ErrorLogEntry): void {
  try {
    const classified = classifyError(entry.message);
    const category = entry.category || classified.category;
    if (shouldSuppress(category, entry.message)) return;

    sessionLogCount += 1;
    const { browser, os, network, userAgent } = collectEnvironment();
    const { uid, employeeId, role } = getSessionIdentity();

    let buildId: string = 'unknown';
    try { buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown'; } catch { /* ignore */ }

    const payload = {
      timestamp: new Date().toISOString(),
      timestampMs: Date.now(),
      category,
      message: entry.message.slice(0, 500),
      stack: entry.stack ? entry.stack.slice(0, MAX_STACK_LENGTH) : null,
      uid,
      employeeId,
      role,
      deviceCategory: (() => {
        try { return localStorage.getItem('kss_v1_device_category') || 'unknown'; } catch { return 'unknown'; }
      })(),
      browser,
      os,
      network,
      route: entry.route || (typeof window !== 'undefined' ? window.location.pathname : null),
      appVersion: '2026.1',
      buildVersion: buildId,
      userAgent,
      operationType: entry.operationType || null,
      path: entry.path ?? null
    };

    // Lazy imports: reuses the app's single initialized Firestore instance and
    // keeps this module out of every critical boot path.
    Promise.all([
      import('./firebase'),
      import('firebase/firestore')
    ])
      .then(async ([{ db }, fsMod]) => {
        await fsMod.addDoc(fsMod.collection(db, 'error_logs'), payload);
      })
      .catch(() => { /* observability must stay silent */ });
  } catch {
    /* never propagate */
  }
}
