// Internal error classification — precise diagnosis, simple user messages.
// Never map every failure to a generic message or a false "not found".

export type AppErrorCategory =
  | 'AUTH_INITIALIZING'
  | 'AUTH_FAILED'
  | 'UNAUTHENTICATED'
  | 'EMPLOYEE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'FIREBASE_ERROR'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'CHUNK_LOAD_ERROR'
  | 'UNKNOWN_ERROR';

export interface ClassifiedError {
  category: AppErrorCategory;
  /** Safe, user-facing message */
  userMessage: string;
  /** Original error for internal logging */
  original: unknown;
}

const NETWORK_FRAGMENTS = [
  'network error',
  'failed to fetch',
  'networkerror',
  'load failed',
  'internet connection',
  'offline',
  'err_internet',
  'err_connection',
  'err_name_not_resolved',
  'fetch_dynamic', // dynamic import over failed network
];

export function classifyError(err: unknown): ClassifiedError {
  const code = (err as any)?.code as string | undefined;
  const message = String((err as any)?.message || err || '').toLowerCase();

  if (code === 'permission-denied' || message.includes('permission denied') || message.includes('insufficient permissions') || message.includes('missing or insufficient permissions')) {
    return { category: 'PERMISSION_DENIED', userMessage: 'Your account does not have access to this data. Contact your administrator if this is unexpected.', original: err };
  }
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'cancelled') {
    return { category: 'NETWORK_ERROR', userMessage: 'Connection issue. Please check your network and try again.', original: err };
  }
  if (code === 'unauthenticated') {
    return { category: 'UNAUTHENTICATED', userMessage: 'Your session has expired. Please sign in again.', original: err };
  }
  if (code?.startsWith('auth/')) {
    return { category: 'AUTH_FAILED', userMessage: 'Authentication problem. Please try signing in again.', original: err };
  }
  if (NETWORK_FRAGMENTS.some(f => message.includes(f))) {
    return { category: 'NETWORK_ERROR', userMessage: 'Network problem. Please check your connection and try again.', original: err };
  }
  if (typeof message === 'string' && (message.includes('timeout') || message.includes('timed out') || message.includes('aborted'))) {
    return { category: 'TIMEOUT', userMessage: 'The request took too long. Please try again.', original: err };
  }
  if (code) {
    return { category: 'FIREBASE_ERROR', userMessage: 'A service error occurred. Please try again.', original: err };
  }
  return { category: 'UNKNOWN_ERROR', userMessage: 'Something went wrong. Please try again.', original: err };
}

/** Detects Vite/webpack dynamic chunk import failures for controlled recovery. */
export function isChunkLoadError(err: unknown): boolean {
  const message = String((err as any)?.message || err || '').toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('dynamically imported module') ||
    (message.includes('loading chunk') && message.includes('failed')) ||
    message.includes('chunkloaderror') ||
    (message.includes('module script') && message.includes('mime'))
  );
}

// ── P0 incident hardening: Firestore listener recovery & auth fallback policy ──

/**
 * Firestore error codes a live listener can recover from by re-subscribing.
 * NOT included: 'permission-denied' and 'unauthenticated' — retrying those with
 * the same identity can never succeed; they are owned by the auth lifecycle
 * (listeners must re-attach only after onAuthStateChanged delivers a user).
 */
const RETRYABLE_LISTENER_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'cancelled',
  'internal',
  'unknown'
]);

export function isRetryableListenerError(err: unknown): boolean {
  const code = (err as any)?.code as string | undefined;
  if (code === 'permission-denied' || code === 'unauthenticated') return false;
  const message = String((err as any)?.message || err || '').toLowerCase();
  if (message.includes('permission') || message.includes('insufficient permissions')) return false;
  if (code) return RETRYABLE_LISTENER_CODES.has(code);
  return NETWORK_FRAGMENTS.some(f => message.includes(f));
}

/** Capped exponential backoff for listener re-subscription: 1s, 2s, 4s … max 30s. */
export function nextBackoffMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(30000, 1000 * Math.pow(2, safeAttempt - 1));
}

/**
 * Auth login codes for which falling back to the local (non-Firebase) credential
 * check is SAFE — i.e. Firebase definitely rejected THIS user's credentials.
 *
 * Config/environment failures (provider disabled, invalid API key, unauthorized
 * domain, network down, disabled account, rate limiting) MUST NOT fall back
 * silently: doing so masked the P0 outage where every portal lost realtime sync
 * while the console showed nothing but identitytoolkit HTTP 400s.
 */
const FALLBACK_SAFE_AUTH_CODES = new Set([
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/invalid-email'
]);

export function shouldFallbackToLocalLogin(fbErrorCode: string | undefined | null): boolean {
  if (!fbErrorCode) return true; // non-Firebase exception — preserve legacy behavior
  return FALLBACK_SAFE_AUTH_CODES.has(fbErrorCode);
}
