import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  User 
} from "firebase/auth";
import { 
  getFirestore, 
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

// Config explicitly provided in prompt
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
export const db = getFirestore(app);

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
  console.warn('Firestore Operation Exception:', JSON.stringify(errInfo));
  return errInfo;
}

// Test Connection
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Firebase client is currently offline or uninitialized.");
    }
    return false;
  }
}
