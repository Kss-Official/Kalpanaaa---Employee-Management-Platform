import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  serverTimestamp,
  getDocFromServer,
  runTransaction,
  Timestamp,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Query,
  type QuerySnapshot,
  type Unsubscribe
} from "firebase/firestore";
import { isRetryableListenerError, nextBackoffMs } from './errors';

export { runTransaction, serverTimestamp, Timestamp };

// Config explicitly targeting kalpanaaa-employees-website
export const firebaseConfig = {
  apiKey: "AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA",
  authDomain: "kalpanaaa-employees-website.firebaseapp.com",
  projectId: "kalpanaaa-employees-website",
  storageBucket: "kalpanaaa-employees-website.firebasestorage.app",
  messagingSenderId: "435677685916",
  appId: "1:435677685916:web:8155146d20e5e90f9ca559",
  measurementId: "G-NW46QRGKE8"
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// BUG 6 FIX: Wrap persistent multi-tab cache in try/catch.
// Safari private browsing and some mobile environments block IndexedDB,
// causing `persistentMultipleTabManager` to fail. Without a fallback the
// local cache is silently left in an inconsistent state, making mobile and
// desktop show divergent data. We fall back to in-memory cache so the
// Firestore real-time listeners always work correctly.
function createFirestore() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch {
    console.warn('[Firebase] Persistent multi-tab cache unavailable (Safari/private mode?), falling back to memory cache.');
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
}

export const db = createFirestore();

// Error Handling Helper as per Firebase skill guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  // P0 INCIDENT FIX: permission-denied used to be silently suppressed here, which
  // hid the outage where every portal stopped receiving realtime updates. A
  // permission-denied is ALWAYS a security-relevant signal (missing users/{uid}
  // mapping, unauthenticated local session, or rule regression) and must be loud.
  if (errInfo.error.includes('permission') || errInfo.error.includes('PERMISSION_DENIED') || errInfo.error.includes('insufficient permissions')) {
    console.error(
      `[Firestore SECURITY] ${operationType} ${path ?? '<no-path>'} denied for uid=${errInfo.authInfo.userId ?? 'NULL (no Firebase session)'} — check firestore.rules and users/{uid} role mapping.`,
      error
    );
  } else {
    console.warn('Firestore Operation Exception:', JSON.stringify(errInfo));
  }
  return errInfo;
}

/**
 * P0 INCIDENT FIX: resilient realtime subscription.
 *
 * Firestore listeners that fail with a transient error (unavailable / network)
 * stay dead unless re-subscribed manually. And after a permission-denied they can
 * NEVER succeed with the same identity — recovery is owned by the auth lifecycle.
 *
 * - Retryable errors → exponential backoff re-subscribe (1s→30s cap).
 * - permission-denied / unauthenticated → reported ONCE to onError; the caller's
 *   auth-gated effect will re-attach when onAuthStateChanged delivers a user.
 * Returns an Unsubscribe that also cancels any pending backoff timer.
 */
export function subscribeWithRecovery(
  q: Query,
  onData: (snapshot: QuerySnapshot) => void,
  onError?: (error: Error) => void,
  maxAttempts: number = 5
): Unsubscribe {
  let unsubCurrent: Unsubscribe = () => {};
  let stopped = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const start = () => {
    if (stopped) return;
    unsubCurrent = onSnapshot(
      q,
      (snapshot) => {
        attempt = 0; // healthy snapshot resets the backoff ladder
        onData(snapshot);
      },
      (err) => {
        if (stopped) return;
        if (isRetryableListenerError(err) && attempt < maxAttempts) {
          attempt += 1;
          const delay = nextBackoffMs(attempt);
          console.warn(`[Firestore] Transient listener error (${err.code}), re-subscribing in ${delay}ms (attempt ${attempt}/${maxAttempts}).`);
          timer = setTimeout(start, delay);
        } else {
          // Permanent for this identity — surfaced loudly instead of suppressed.
          const pathLabel = (() => {
            try {
              const internal = q as unknown as { _query?: { path?: { toString(): string } } };
              return internal._query?.path?.toString() ?? '<unknown-path>';
            } catch {
              return '<unknown-path>';
            }
          })();
          handleFirestoreError(err, OperationType.LIST, pathLabel);
          onError?.(err);
        }
      }
    );
  };

  start();

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    unsubCurrent();
  };
}

// Test Connection reliably
export async function testConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'settings', 'global'));
    return true;
  } catch (error) {
    // If online, return true so real-time listeners operate
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}

// Clean any payload recursively to prevent Firestore undefined / NaN serialization crashes while preserving Firestore Sentinels and Dates
export function cleanFirestorePayload<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  // Preserve Firestore FieldValues (serverTimestamp, deleteField, etc.), Timestamps, and Dates
  if (obj instanceof Date || (obj as any)._methodName || (obj as any).toMillis || (obj.constructor && obj.constructor.name === 'FieldValue')) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => typeof item === 'object' && item !== null ? cleanFirestorePayload(item) : item) as unknown as T;
  }

  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) {
      result[key] = null;
    } else if (typeof val === 'number' && isNaN(val)) {
      result[key] = 0;
    } else if (val !== null && typeof val === 'object') {
      result[key] = cleanFirestorePayload(val);
    } else {
      result[key] = val;
    }
  }
  return result as T;
}
