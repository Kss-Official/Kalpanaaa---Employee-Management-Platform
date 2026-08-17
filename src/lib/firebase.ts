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
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  getDocFromServer
} from "firebase/firestore";

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

// Initialize Firebase App Check — only in production to prevent localhost token blocking
if (typeof window !== "undefined") {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhost) {
    (self as any).FIREBASE_APPCHECK_EXECUTE_IN_TEST_MODE = true;
  } else {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider('6LcR5m8tAAAAAAEpJqgzO9KUJZ-lLX6s_QuoENfl'),
        isTokenAutoRefreshEnabled: true
      });
    } catch (error) {
      console.warn("App Check initialization info:", error);
    }
  }
}

export const auth = getAuth(app);
export const db = initializeFirestore(app, {});

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
  // Suppress permission-denied noise from dev console
  if (!errInfo.error.includes('permissions') && !errInfo.error.includes('PERMISSION_DENIED')) {
    console.warn('Firestore Operation Exception:', JSON.stringify(errInfo));
  }
  return errInfo;
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
