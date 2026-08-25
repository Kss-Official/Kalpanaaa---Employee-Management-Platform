import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  orderBy,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, testConnection, handleFirestoreError, OperationType, firebaseConfig, cleanFirestorePayload, subscribeWithRecovery, signInAnonymously } from '../lib/firebase';
import { Employee, EmployeeStatus, AttendanceRecord, AuditLog, CompanySettings, UserRole, AttendanceStatus, WorkZone, LeaveRequest, AttendanceMethod, BreakType, normalizeBreakType } from '../types';
import {
  INITIAL_EMPLOYEES,
  generateInitialAttendance,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_LEAVE_REQUESTS
} from '../lib/demoData';
import { initializeApp } from 'firebase/app';
import { 
  evaluateAttendanceScan, 
  calculateGpsDistanceMeters,
  getWorkDate,
  getEmployeeWorkDate,
  getEmployeeKey,
  getAttendanceDocId,
  getCanonicalEmployeeUid,
  formatTimestampToISO,
  safeGetTimestampMillis,
  resolveAttendanceRecord,
  calculateTotalBreakMinutes,
  MAX_BREAK_MINUTES,
  COMPANY_TIMEZONE
} from '../lib/attendanceEngine';
import { runAttendanceMigration } from '../lib/attendanceMigration';
import { classifyError, shouldFallbackToLocalLogin } from '../lib/errors';
import { fetchAbsoluteTime, toISTTimeString, todayInIST } from '../lib/absoluteTime';
import { sendKssNotification, sendAdminBroadcast, registerFcmToken, unregisterFcmToken, KssNotification } from '../lib/notifications';
import { clearAllFaceEngineState } from '../lib/faceDescriptorStore';
import { writeEmployeeResume, backfillEmployeeResumes } from '../lib/employeeResume';
import { LeaveService } from '../lib/leaveService';

const generateDeviceFingerprint = () => {
  return btoa(`${navigator.userAgent}|${screen.width}x${screen.height}|${navigator.language}|${new Date().getTimezoneOffset()}`);
};

const getDeviceCategory = (): 'desktop' | 'mobile' => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

const sanitizeInput = <T extends any>(data: T): T => {
  if (typeof data === 'string') {
    // Skip sanitization for base64 images to prevent regex corruption of large strings
    if (data.startsWith('data:image/')) return data as any;

    // Strip script tags and common XSS vectors
    return data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/on\w+=\w+/gi, '') as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeInput(item)) as any;
  }
  if (typeof data === 'object' && data !== null) {
    const sanitizedObj: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitizedObj[key] = sanitizeInput((data as any)[key]);
      }
    }
    return sanitizedObj;
  }
  return data;
};

// Helper for allocating specific employee IDs to founders and starting others from 004
const getAssignedEmployeeDetails = (fullName: string, employees: Employee[]) => {
  const name = (fullName || '').toLowerCase().trim();
  
  if (name.includes('gaurav')) {
    return {
      employeeId: 'KSS2407001',
      role: 'SUPER_ADMIN' as UserRole,
      designation: 'CTO And Founder And MD'
    };
  }
  if (name.includes('akshit')) {
    return {
      employeeId: 'KSS2407002',
      role: 'SUPER_ADMIN' as UserRole,
      designation: 'CEO'
    };
  }
  if (name.includes('koushik')) {
    return {
      employeeId: 'KSS2407003',
      role: 'PROJECT_MANAGER' as UserRole,
      designation: 'Project Manager'
    };
  }

  // General employees start from KSS2407004
  let maxSeq = 3; 
  employees.forEach(emp => {
    if (emp.employeeId?.startsWith('KSS2407') || emp.employeeId?.startsWith('KSS2707')) {
      const numStr = emp.employeeId.replace('KSS2407', '').replace('KSS2707', '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return {
    employeeId: `KSS2407${nextSeq}`,
    role: null,
    designation: null
  };
};

interface AuthContextType {
  user: User | null;
  activeEmployee: Employee | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  isFirestoreConnected: boolean;
  isSessionReady: boolean;
  attendanceSyncStatus: 'loading' | 'synced';
  employees: Employee[];
  attendance: AttendanceRecord[];
  auditLogs: AuditLog[];
  settings: CompanySettings;
  companyWorkZone: WorkZone;
  leaveRequests: LeaveRequest[];
  notifications: KssNotification[];
  unreadNotificationCount: number;
  companyWideWfhDates: string[];

  // Actions
  submitLeaveRequest: (data: Omit<LeaveRequest, 'id' | 'status' | 'requestDate' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; id: string; message: string }>;
  updateLeaveRequestStatus: (id: string, status: 'Approved' | 'Rejected', reviewedBy: string, reviewNotes?: string, targetStage?: 'PM' | 'HR' | 'CEO' | 'CTO') => void;
  updateLeaveRequestStage: (id: string, stage: 'PM' | 'HR' | 'CEO' | 'CTO', decision: 'Approved' | 'Rejected', reviewerName: string, notes?: string, employeeId?: string, startDate?: string, endDate?: string) => Promise<void>;
  cancelLeaveRequest: (id: string, employeeId?: string, startDate?: string, endDate?: string) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  quickDemoLogin: (role: UserRole | 'CEO' | 'CTO') => void;
  logout: () => void;
  addEmployee: (emp: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'qrToken'> & { password?: string }) => Promise<{ success: boolean; message?: string } | Employee>;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  recordCheckIn: (employeeId: string, lat?: number, lon?: number, accuracy?: number, method?: AttendanceMethod, customDate?: string) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  recordCheckOut: (employeeId: string, lat?: number, lon?: number, accuracy?: number, customDate?: string) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  checkIn: (employeeId: string, lat?: number, lon?: number, accuracy?: number, method?: AttendanceMethod, customDate?: string) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  checkOut: (employeeId: string, lat?: number, lon?: number, accuracy?: number, customDate?: string) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  startBreak: (employeeId: string, breakType?: string, lat?: number, lon?: number) => Promise<{ success: boolean; message: string }>;
  endBreak: (employeeId: string, lat?: number, lon?: number) => Promise<{ success: boolean; message: string }>;
  updateAttendanceRecord: (recordId: string, updates: Partial<AttendanceRecord>) => Promise<void>;
  applyAttendanceCorrection: (
    record: AttendanceRecord & { isSynthetic?: boolean },
    updates: Partial<AttendanceRecord>
  ) => Promise<{ success: boolean; message: string }>;
  updateSettings: (newSettings: Partial<CompanySettings>) => void;
  saveCompanyWorkZone: (zone: Partial<WorkZone>) => Promise<void>;
  addAuditLog: (action: string, target: string, details: string) => void;
  resetToDemoData: () => void;
  regenerateQrToken: (employeeId: string) => string;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  setEmployeeInitialPassword: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  sendBroadcast: (title: string, message: string) => Promise<void>;
  assignCompanyWideWfh: (date: string) => { success: boolean; message: string };
  removeCompanyWideWfh: (date: string) => { success: boolean; message: string };
  markAllNotificationsRead: () => void;
  updateCurrentEmployeePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
  requestMobilePushPermission: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Initial employees array restored synchronously
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('kss_v1_employees');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Employee[];
        return parsed
          .filter(emp => emp.id !== 'emp-003' && emp.employeeId !== '003' && emp.employeeId !== 'KSS2407003' && !(emp.email || '').toLowerCase().includes('koushik'))
          .map(emp => {
            if (emp.employeeId === 'CEO001') {
              return {
                ...emp,
                fullName: 'Akshit',
                email: 'akshit@kalpanaaa.in',
                department: 'Executive Management'
              };
            }
            if (emp.employeeId && (emp.employeeId.startsWith('KS2407') || emp.employeeId.startsWith('KS2707'))) {
              return {
                ...emp,
                employeeId: emp.employeeId.replace('KS2707', 'KSS2407').replace('KS2407', 'KSS2407')
              };
            }
            return emp;
          });
      } catch (e) {}
    }
    return INITIAL_EMPLOYEES;
  });

  // 24-Hour Token Expiry / Session Timeout Validation (Fixes C20 Contract)
  const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const clearPersistedSessionKeys = () => {
    localStorage.removeItem('kss_v1_session');
    localStorage.removeItem('kss_v1_session_email');
    localStorage.removeItem('kss_v1_session_id');
    localStorage.removeItem('kss_v1_session_timestamp');
  };
  const isSessionValidOnBoot = (): boolean => {
    const savedSessionId = localStorage.getItem('kss_v1_session');
    if (!savedSessionId) return false;
    const timestampStr = localStorage.getItem('kss_v1_session_timestamp');
    // P1 SECURITY FIX: fail CLOSED when the age stamp is missing or unparseable.
    // Previously the whole expiry check sat inside `if (timestampStr)`, so deleting that
    // single localStorage key made a session immortal and bypassed the 24-hour limit
    // entirely. Every login path writes this key, so legitimate sessions are unaffected.
    if (!timestampStr) {
      clearPersistedSessionKeys();
      return false;
    }
    const stamp = parseInt(timestampStr, 10);
    if (!Number.isFinite(stamp) || Date.now() - stamp > SESSION_MAX_AGE_MS) {
      clearPersistedSessionKeys();
      return false;
    }
    return true;
  };

  // Synchronous session restore for activeEmployee
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(() => {
    if (!isSessionValidOnBoot()) return null;
    const savedSessionId = localStorage.getItem('kss_v1_session');
    const savedEmail = localStorage.getItem('kss_v1_session_email');
    const savedEmps = localStorage.getItem('kss_v1_employees');
    if (savedSessionId && savedEmps) {
      try {
        const parsed = JSON.parse(savedEmps) as Employee[];
        // Match by ID first, then by email backup key
        const found = parsed.find(e =>
          e.id === savedSessionId ||
          e.employeeId === savedSessionId ||
          (savedEmail && e.email?.toLowerCase() === savedEmail.toLowerCase())
        );
        if (found) return found;
      } catch (e) {}
    }
    if (savedSessionId || savedEmail) {
      const foundInInitial = INITIAL_EMPLOYEES.find(e =>
        e.id === savedSessionId ||
        e.employeeId === savedSessionId ||
        (savedEmail && e.email?.toLowerCase() === savedEmail.toLowerCase())
      );
      if (foundInInitial) return foundInInitial;
    }
    return null;
  });

  // Synchronous role restore
  // P0 SECURITY FIX: every fallback below previously returned 'SUPER_ADMIN'. A missing,
  // expired, or unparseable session — and any employee record without an explicit `role`
  // — silently booted the app with FULL administrative privileges. The default is now the
  // least-privileged role; the real role is applied once Firebase Auth resolves the
  // identity in onAuthStateChanged.
  const [role, setRole] = useState<UserRole>(() => {
    if (!isSessionValidOnBoot()) return 'EMPLOYEE';
    const savedSessionId = localStorage.getItem('kss_v1_session');
    const savedEmail = localStorage.getItem('kss_v1_session_email');
    const savedEmps = localStorage.getItem('kss_v1_employees');
    if (savedEmps) {
      try {
        const parsed = JSON.parse(savedEmps) as Employee[];
        const found = parsed.find(e =>
          e.id === savedSessionId ||
          e.employeeId === savedSessionId ||
          (savedEmail && e.email?.toLowerCase() === savedEmail.toLowerCase())
        );
        if (found) {
          if (found.employeeId === 'CEO001' || found.employeeId === 'CTO001') return 'SUPER_ADMIN';
          return found.role || 'EMPLOYEE';
        }
      } catch (e) {}
    }
    return 'EMPLOYEE';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return isSessionValidOnBoot();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  
  // Session is always ready immediately — activeEmployee is restored synchronously above
  const [isSessionReady, setIsSessionReady] = useState<boolean>(true);
  const [attendanceSyncStatus, setAttendanceSyncStatus] = useState<'loading' | 'synced'>('loading');

  // P0 INCIDENT FIX: verified Firebase Auth identity driving the Firestore listener
  // lifecycle. Listeners may only attach AFTER onAuthStateChanged has resolved a
  // real user (token validated), and must detach when that identity disappears
  // (sign-out / failed token refresh). Attaching auth-blind at mount caused every
  // listener to die permanently on permission-denied and never recover.
  const [authUid, setAuthUid] = useState<string | null>(null);

  // employeesRef always mirrors the current employees state for use in one-time effects
  const employeesRef = useRef<Employee[]>([]);

  // attendanceRef mirrors live attendance for the auto-checkout effect.
  // Using a ref (instead of a closure over `attendance` state) prevents the
  // effect from being re-registered on every Firestore snapshot, which would
  // create a snapshot → write → snapshot feedback loop.
  const attendanceRef = useRef<AttendanceRecord[]>([]);

  // P1 FIX — WRONG AUDIT ATTRIBUTION: the auto-checkout effect is intentionally
  // stable (it must not re-register on every snapshot), so it captured
  // `addAuditLog` and `activeEmployee` from the FIRST render. Every automatic
  // checkout was therefore attributed to whoever/whatever the actor was at mount —
  // in practice the 'sys-admin' / 'System Admin' placeholder and the first-render
  // role — instead of the real signed-in user. These refs give the stable effect
  // access to live values without re-registering it.
  const activeEmployeeRef = useRef<Employee | null>(null);
  const addAuditLogRef = useRef<(action: string, target: string, details: string) => void>(() => {});

  // Mirrors the live privilege level for the long-lived snapshot handlers, which must
  // know whether this client is allowed to perform data-migration writes.
  const roleRef = useRef<UserRole>('EMPLOYEE');

  // SINGLE SOURCE OF TRUTH: Firestore only. Initial state starts empty; hydrated via real-time onSnapshot
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('kss_v1_audit_logs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : INITIAL_AUDIT_LOGS;
      } catch (e) {
        console.warn('[AuthContext] Failed to parse saved audit logs', e);
      }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [settings, setSettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem('kss_v1_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('[AuthContext] Failed to parse saved settings', e);
      }
    }
    return INITIAL_COMPANY_SETTINGS;
  });

  const [companyWorkZone, setCompanyWorkZone] = useState<WorkZone>(() => {
    const saved = localStorage.getItem('kss_v1_work_zone');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('[AuthContext] Failed to parse saved work zone', e);
      }
    }
    return {
      name: 'Kalpanaaa Software Solutions HQ',
      latitude: INITIAL_COMPANY_SETTINGS.officeLatitude || 13.014316,
      longitude: INITIAL_COMPANY_SETTINGS.officeLongitude || 77.64052,
      radiusMeters: INITIAL_COMPANY_SETTINGS.allowedRadiusMeters || 100,
      active: true,
      updatedBy: 'System Init',
      updatedAt: new Date().toISOString()
    };
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    const saved = localStorage.getItem('kss_v1_leave_requests');
    let base: LeaveRequest[] = INITIAL_LEAVE_REQUESTS;
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          base = parsed;
        }
      } catch (e) {
        console.warn('[AuthContext] Failed to parse saved leave requests', e);
      }
    }
    return base.map((r: any) => {
      const isApplicantPmOrHr = r.employeeRole === 'PROJECT_MANAGER' || r.employeeRole === 'HR_ADMIN' ||
        (r.department || '').toLowerCase().includes('hr') ||
        (r.employeeName || '').toLowerCase().includes('koushik') ||
        (r.employeeName || '').toLowerCase().includes('abhinaya');

      let pmStatus = isApplicantPmOrHr ? 'N/A' : (r.pmStatus || 'Pending');
      let hrStatus = isApplicantPmOrHr ? 'N/A' : (r.hrStatus || (pmStatus === 'Approved' ? 'Pending' : 'Waiting PM'));
      let ceoStatus = r.ceoStatus || (isApplicantPmOrHr ? 'Pending' : (hrStatus === 'Approved' ? 'Pending' : 'Waiting HR'));
      let ctoStatus = r.ctoStatus || (ceoStatus === 'Approved' ? 'Pending' : 'Waiting CEO');
      let status: 'Pending' | 'Approved' | 'Rejected' = r.status || 'Pending';

      const isPmPassed = pmStatus === 'Approved' || pmStatus === 'N/A';
      const isHrPassed = hrStatus === 'Approved' || hrStatus === 'N/A';

      if (pmStatus === 'Rejected' || hrStatus === 'Rejected' || ceoStatus === 'Rejected' || ctoStatus === 'Rejected' || r.status === 'Rejected') {
        status = 'Rejected';
      } else if (isPmPassed && isHrPassed && ceoStatus === 'Approved' && ctoStatus === 'Approved') {
        status = 'Approved';
      } else {
        status = 'Pending';
      }

      return {
        ...r,
        pmStatus,
        hrStatus,
        ceoStatus,
        ctoStatus,
        status
      };
    });
  });

  // Notifications state — real-time feed from Firestore
  const [notifications, setNotifications] = useState<KssNotification[]>([]);

  // ── DEDICATED Company-Wide WFH Dates state ──
  // Initialized from localStorage first (instant), then kept in sync via Firestore real-time listener
  const [companyWideWfhDates, setCompanyWideWfhDates] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kss_v1_company_wfh_dates');
      if (saved) return JSON.parse(saved) as string[];
      // fallback: read from settings if previously stored there
      const settingsSaved = localStorage.getItem('kss_v1_settings');
      if (settingsSaved) {
        const s = JSON.parse(settingsSaved);
        return s.companyWideWfhDates || [];
      }
    } catch { /* ignore */ }
    return [];
  });

  // Dynamically synthesize real-time notifications for Attendance, Leave, and WFH events
  const combinedNotifications = React.useMemo(() => {
    // 1. Leave & WFH Request Notifications
    // Admins see ALL requests; employees only see their OWN sanction result (approved/rejected)
    // PM does NOT see HR employees' requests
    const leaveNotifs: KssNotification[] = leaveRequests.map(r => {
      const isResolved = r.status === 'Approved' || r.status === 'Rejected';
      const isHrEmployee = (r.department || '').toLowerCase().includes('hr') ||
        (r.employeeRole || '').toLowerCase().includes('hr') ||
        (() => {
          const emp = employees.find(e => e.employeeId === r.employeeId || e.id === r.employeeId || e.fullName === r.employeeName);
          return emp?.department?.toLowerCase().includes('hr') || emp?.role === 'HR_ADMIN';
        })();

      // PM cannot see HR employees' Leave/WFH notifications
      const audience: string[] = isHrEmployee
        ? ['SUPER_ADMIN', 'HR_ADMIN']
        : ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'];

      return {
        id: `notif-leave-${r.id}-${r.status}`,
        type: (r.status === 'Approved' ? 'LEAVE_REQUEST_APPROVED' : r.status === 'Rejected' ? 'LEAVE_REQUEST_REJECTED' : (r.type === 'WFH' ? 'WFH_REQUEST_SUBMITTED' : 'LEAVE_REQUEST_SUBMITTED')) as any,
        // Admin title: shows the employee name. Employee personal copy (isPersonalSanction) handled in bell component
        title: r.status === 'Approved'
          ? `✅ ${r.type} Approved — ${r.employeeName}`
          : r.status === 'Rejected'
          ? `❌ ${r.type} Rejected — ${r.employeeName}`
          : r.type === 'WFH' ? `🏠 Pending WFH Request: ${r.employeeName}` : `📋 Pending Leave Request: ${r.employeeName}`,
        body: isResolved
          ? `${r.employeeName}'s ${r.type} request (${r.startDate} to ${r.endDate}) has been ${r.status.toLowerCase()} by management.`
          : `${r.employeeName} (${r.department || 'HR'}) requested ${r.type} (${r.startDate} to ${r.endDate}). Status: ${r.status}. Reason: "${r.reason}".`,
        // Personal title/body shown to the employee themselves via isPersonalSanction filter
        personalTitle: r.status === 'Approved'
          ? `✅ Your ${r.type} Request Approved`
          : r.status === 'Rejected'
          ? `❌ Your ${r.type} Request Rejected`
          : undefined,
        personalBody: isResolved
          ? `Your ${r.type} request (${r.startDate} to ${r.endDate}) has been ${r.status.toLowerCase()} by management.`
          : undefined,
        audience,
        actorId: r.employeeId,
        actorName: r.employeeName,
        targetEmployeeId: r.employeeId,
        targetEmployeeName: r.employeeName,
        // Flag for employee-personal visibility (only requestor sees their own resolved sanction)
        isPersonalSanction: isResolved,
        createdAt: r.requestDate || new Date().toISOString()
      };
    });

    // 2. Attendance Check-Ins, Check-Outs, and Breaks from live attendance state
    const attNotifs: KssNotification[] = [];
    attendance.forEach(rec => {
      if (rec.checkInAt) {
        attNotifs.push({
          id: `notif-in-${rec.id}`,
          type: 'ATTENDANCE_CHECKIN',
          // Admin title shows employee name; personal title for the employee themselves
          title: `🟢 Check-In Verified: ${rec.employeeName}`,
          body: `${rec.employeeName} (${rec.department || 'HQ'}) checked in at ${toISTTimeString(rec.checkInAt)} via ${rec.attendanceMethod || 'Web Terminal'}. Status: ${rec.status}.`,
          personalTitle: `🟢 You Checked In`,
          personalBody: `You successfully checked in at ${toISTTimeString(rec.checkInAt)} via ${rec.attendanceMethod || 'Web Terminal'}. Status: ${rec.status}.`,
          audience: ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'],
          isOwnAttendance: true,
          actorId: rec.employeeId,
          actorName: rec.employeeName,
          targetEmployeeId: rec.employeeId,
          targetEmployeeName: rec.employeeName,
          createdAt: rec.checkInAt
        } as any);
      }
      if (rec.checkOutAt) {
        attNotifs.push({
          id: `notif-out-${rec.id}`,
          type: 'ATTENDANCE_CHECKOUT',
          title: `🔴 Check-Out Logged: ${rec.employeeName}`,
          body: `${rec.employeeName} completed shift & checked out at ${toISTTimeString(rec.checkOutAt)}. Total shift time: ${rec.workingMinutes || 0} mins.`,
          personalTitle: `🔴 You Checked Out`,
          personalBody: `You completed your shift and checked out at ${toISTTimeString(rec.checkOutAt)}. Total working time: ${rec.workingMinutes || 0} mins.`,
          audience: ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'],
          isOwnAttendance: true,
          actorId: rec.employeeId,
          actorName: rec.employeeName,
          targetEmployeeId: rec.employeeId,
          targetEmployeeName: rec.employeeName,
          createdAt: rec.checkOutAt
        } as any);
      }
      if (rec.breaks && Array.isArray(rec.breaks)) {
        rec.breaks.forEach((b, bIdx) => {
          attNotifs.push({
            id: `notif-break-${rec.id}-${bIdx}`,
            type: 'ATTENDANCE_BREAK_START',
            title: `🟡 Break Started: ${rec.employeeName}`,
            body: `${rec.employeeName} initiated ${b.type} at ${toISTTimeString(b.startAt)}. Duration: ${b.durationMinutes || 10} mins.`,
            personalTitle: `🟡 ${b.type} Break Started`,
            personalBody: `Your ${b.type} break started at ${toISTTimeString(b.startAt)}. Duration: ${b.durationMinutes || 10} mins.`,
            audience: ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'],
            isOwnAttendance: true,
            actorId: rec.employeeId,
            actorName: rec.employeeName,
            targetEmployeeId: rec.employeeId,
            targetEmployeeName: rec.employeeName,
            createdAt: b.startAt
          } as any);
        });
      }
    });

    // 3. Office-Wide WFH Announcements — synthesized from companyWideWfhDates (audience ALL = every employee sees it)
    const wfhAnnounceNotifs: KssNotification[] = companyWideWfhDates.map(date => ({
      id: `notif-office-wfh-${date}`,
      type: 'LEAVE_REQUEST_APPROVED' as any,
      title: `🏢 Office-Wide WFH — ${date}`,
      body: `CEO & CTO have declared Work From Home for all employees on ${date}. No GPS check-in restriction applies. Stay safe and productive! 🏠`,
      audience: ['ALL'],
      actorName: 'CEO & CTO Office',
      createdAt: new Date(`${date}T09:00:00+05:30`).toISOString()
    }));

    const synthesized = [...wfhAnnounceNotifs, ...leaveNotifs, ...attNotifs];
    const existingIds = new Set(synthesized.map(n => n.id));
    const merged = [...synthesized, ...notifications.filter(n => n.id && !existingIds.has(n.id))];
    merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return merged;
  }, [leaveRequests, attendance, notifications, companyWideWfhDates, employees]);

  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('kss_v1_read_notifs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return new Set(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.warn('[AuthContext] Failed to parse read notifications', e);
      }
    }
    return new Set();
  });

  // Always keep the ref in sync with state
  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  // Universal robust employee lookup helper matching ID, emp- ID, employeeCode, UID, email, or fullName
  const findEmployee = useCallback((employeeIdOrEmp: any): Employee | undefined => {
    if (!employeeIdOrEmp) return undefined;
    if (typeof employeeIdOrEmp === 'object' && employeeIdOrEmp.id) {
      const direct = employeesRef.current.find(e => 
        e.id === employeeIdOrEmp.id || 
        (e.employeeId && e.employeeId === employeeIdOrEmp.employeeId) ||
        (e.email && employeeIdOrEmp.email && e.email.toLowerCase() === employeeIdOrEmp.email.toLowerCase()) ||
        (e.uid && employeeIdOrEmp.uid && e.uid === employeeIdOrEmp.uid)
      );
      if (direct) return direct;
      return employeeIdOrEmp as Employee;
    }
    const search = String(employeeIdOrEmp).trim().toLowerCase();
    const searchWithoutEmp = search.replace(/^emp-/, '');
    return employeesRef.current.find(e =>
      (e.id && e.id.toLowerCase() === search) ||
      (e.id && e.id.toLowerCase().replace(/^emp-/, '') === searchWithoutEmp) ||
      (e.employeeId && e.employeeId.toLowerCase() === search) ||
      (e.employeeId && e.employeeId.toLowerCase() === searchWithoutEmp) ||
      (e.uid && e.uid.toLowerCase() === search) ||
      (e.email && e.email.toLowerCase() === search) ||
      (e.fullName && e.fullName.toLowerCase() === search)
    ) || INITIAL_EMPLOYEES.find(e =>
      (e.id && e.id.toLowerCase() === search) ||
      (e.id && e.id.toLowerCase().replace(/^emp-/, '') === searchWithoutEmp) ||
      (e.employeeId && e.employeeId.toLowerCase() === search) ||
      (e.employeeId && e.employeeId.toLowerCase() === searchWithoutEmp) ||
      (e.uid && e.uid.toLowerCase() === search) ||
      (e.email && e.email.toLowerCase() === search) ||
      (e.fullName && e.fullName.toLowerCase() === search)
    );
  }, []);

  // Keep attendanceRef current so the stable auto-checkout interval always
  // reads the latest data without being in the effect's dep array.
  useEffect(() => {
    attendanceRef.current = attendance;
  }, [attendance]);

  // Keep the stable auto-checkout effect supplied with live values (see the ref
  // declarations above for why this indirection is required).
  useEffect(() => {
    activeEmployeeRef.current = activeEmployee;
  }, [activeEmployee]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // Debounced localStorage persistence — batches all non-attendance state saves
  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('kss_v1_employees', JSON.stringify(employees));
      // NOTE: Attendance is Firestore-only. Never cached in localStorage.
      localStorage.setItem('kss_v1_audit_logs', JSON.stringify(auditLogs));
      localStorage.setItem('kss_v1_settings', JSON.stringify(settings));
      localStorage.setItem('kss_v1_work_zone', JSON.stringify(companyWorkZone));

      let mergedLeaves = leaveRequests;
      const savedLeaves = localStorage.getItem('kss_v1_leave_requests');
      if (savedLeaves) {
        try {
          const parsed = JSON.parse(savedLeaves);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const map = new Map<string, LeaveRequest>();
            parsed.forEach((r: any) => map.set(r.id, r));
            leaveRequests.forEach((r: any) => map.set(r.id, r));
            mergedLeaves = Array.from(map.values());
          }
        } catch {}
      }
      localStorage.setItem('kss_v1_leave_requests', JSON.stringify(mergedLeaves));
    }, 500);
    return () => clearTimeout(handler);
  }, [employees, attendance, auditLogs, settings, companyWorkZone, leaveRequests]);

  // Real-time cross-tab BroadcastChannel listener for instant sync between normal and private windows
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kss_app_events');
        channel.onmessage = (event) => {
          if ((event.data?.type === 'NEW_LEAVE_REQUEST' || event.data?.type === 'UPDATE_LEAVE_REQUEST') && event.data?.payload) {
            const req = event.data.payload;
            setLeaveRequests(prev => {
              const map = new Map<string, LeaveRequest>();
              prev.forEach(r => map.set(r.id, r));
              map.set(req.id, req);
              const updated = Array.from(map.values());
              try {
                localStorage.setItem('kss_v1_leave_requests', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          } else if (event.data?.type === 'CANCEL_LEAVE_REQUEST' && event.data?.payload?.id) {
            const reqId = event.data.payload.id;
            setLeaveRequests(prev => {
              const updated = prev.filter(r => r.id !== reqId);
              try {
                localStorage.setItem('kss_v1_leave_requests', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          } else if (event.data?.type === 'NEW_BROADCAST' && event.data?.payload) {
            const notif = event.data.payload;
            setNotifications(prev => {
              const exists = prev.some(n => n.id === notif.id);
              if (exists) return prev;
              const updated = [notif, ...prev];
              try {
                localStorage.setItem('kss_v1_broadcasts', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        };
        return () => channel.close();
      } catch {}
    }
  }, []);

  // ── DEDICATED real-time listener for Office-Wide WFH dates ──
  // This is the 100% reliable channel — completely independent of settings
  useEffect(() => {
    if (!isFirestoreConnected) return;

    let unsubWfh: () => void = () => {};

    unsubWfh = onSnapshot(
      doc(db, 'companyConfig', 'wfhDates'),
      (docSnap) => {
        const dates: string[] = docSnap.exists() ? (docSnap.data().dates || []) : [];
        setCompanyWideWfhDates(dates);
        // Keep localStorage in sync as offline fallback
        localStorage.setItem('kss_v1_company_wfh_dates', JSON.stringify(dates));
        // Also keep settings in sync for legacy checks
        setSettings(prev => ({ ...prev, companyWideWfhDates: dates }));
      },
      () => { /* silent fail — localStorage fallback still works */ }
    );

    return () => unsubWfh();
  }, [isFirestoreConnected]);

  // Register FCM token when user logs in and Firestore is connected
  useEffect(() => {
    if (isAuthenticated && activeEmployee && isFirestoreConnected) {
      registerFcmToken(activeEmployee.id, activeEmployee.role).catch(() => {});
    }
  }, [isAuthenticated, activeEmployee?.id, isFirestoreConnected]);

  // ROOT-LEVEL ROLE & SESSION SYNC: Continuously sync activeEmployee and role whenever employees state updates
  useEffect(() => {
    if (!activeEmployee) {
      // Try to restore from localStorage if session token exists but activeEmployee is null
      const savedSessionId = localStorage.getItem('kss_v1_session');
      const savedEmail = localStorage.getItem('kss_v1_session_email');
      if (savedSessionId || savedEmail) {
        const matched = employees.find(e =>
          e.id === savedSessionId ||
          e.employeeId === savedSessionId ||
          (savedEmail && e.email?.toLowerCase() === savedEmail.toLowerCase())
        ) || INITIAL_EMPLOYEES.find(e =>
          e.id === savedSessionId ||
          e.employeeId === savedSessionId ||
          (savedEmail && e.email?.toLowerCase() === savedEmail.toLowerCase())
        );

        if (matched) {
          setActiveEmployee(matched);
          let assignedRole = matched.role;
          if (matched.employeeId === 'CEO001' || matched.employeeId === 'CTO001') assignedRole = 'SUPER_ADMIN';
          setRole(assignedRole);
          setIsAuthenticated(true);
        } else if (employees.length > 0) {
          // Stale session that could not be matched — purge invalid session
          localStorage.removeItem('kss_v1_session');
          localStorage.removeItem('kss_v1_session_email');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      return;
    }

    const updatedSelf = employees.find(e =>
      e.id === activeEmployee.id ||
      (e.employeeId && e.employeeId === activeEmployee.employeeId) ||
      (e.email && activeEmployee.email && e.email.toLowerCase() === activeEmployee.email.toLowerCase())
    );

    if (updatedSelf) {
      let nextRole = updatedSelf.role;
      if (updatedSelf.employeeId === 'CEO001' || updatedSelf.employeeId === 'CTO001') {
        if (updatedSelf.role === 'SUPER_ADMIN') nextRole = 'SUPER_ADMIN';
      }

      if (updatedSelf.role !== activeEmployee.role || role !== nextRole || JSON.stringify(updatedSelf) !== JSON.stringify(activeEmployee)) {
        setActiveEmployee(updatedSelf);
        setRole(nextRole);
      }
    }
  }, [employees, activeEmployee?.id, activeEmployee?.role, role]);


  // SYSTEM RULE: Auto-Checkout at the 7:15 PM IST shift cutoff.
  //
  // BUG 3 FIX: This effect previously had `[attendance]` as its dep, causing
  // it to re-register on every Firestore onSnapshot. The cycle was:
  //   snapshot arrives → attendance state updates → effect re-runs immediately
  //   → checkAutoCheckout() fires → setDoc write → new snapshot → repeat.
  // Fix: use attendanceRef (always current, zero re-registration) + a
  // processedIds Set so each record is written at most once per session.
  //
  // ── THIS REVISION (P0/P1 fixes) ──
  //  1. TIMEZONE / PAYROLL CORRUPTION: the cutoff was built as
  //     `new Date(\`${record.date}T19:15:00\`)` with NO offset, so it was parsed in
  //     the DEVICE's timezone. Any employee or admin on a non-IST device (travel,
  //     a mis-set phone clock, a VPS-hosted browser) wrote a `workingMinutes` value
  //     off by the full UTC offset — up to ±12h of fabricated or erased paid time,
  //     straight into the payroll input. The cutoff is now pinned to +05:30.
  //  2. INFINITE RETRY LOOP: the write's catch did `processedIds.delete(record.id)`
  //     unconditionally, so a PERMANENT failure (permission-denied — now the normal
  //     outcome for another employee's record) retried every 30 seconds forever.
  //     Retries are now bounded and permanent errors are never retried.
  //  3. AUDIT-LOG WRITE SPAM: addAuditLog() fired on every attempt, before the write
  //     resolved. Combined with (2) this appended an audit document to Firestore
  //     every 30 seconds per stuck record, indefinitely. It now fires once, only
  //     after the write actually succeeds.
  //  4. WRITE AMPLIFICATION: the sweep ran on EVERY connected client against EVERY
  //     employee's record, so N clients raced to write the same M documents. The
  //     client now only closes the signed-in employee's OWN records; the
  //     authoritative company-wide sweep belongs to the scheduled Cloud Function
  //     `scheduledAutoCheckout` in functions/index.js, which runs exactly once.
  //  5. WRONG CUTOFF IN THE AUDIT TRAIL: the note and audit text claimed "07:30 PM"
  //     while the code used 19:15. Both now state 07:15 PM IST.
  useEffect(() => {
    if (!authUid) return;

    // Tracks records already written this browser session to prevent duplicate
    // Firestore writes when the interval fires repeatedly.
    const processedIds = new Set<string>();
    const attemptCounts = new Map<string, number>();
    const MAX_ATTEMPTS = 3;

    const AUTO_CHECKOUT_CUTOFF_HOUR = 23;
    const AUTO_CHECKOUT_CUTOFF_MINUTE = 0;

    const isOwnRecord = (record: AttendanceRecord): boolean => {
      const emp = activeEmployeeRef.current;
      return (
        (record as any).employeeUid === authUid ||
        (record as any).uid === authUid ||
        (!!emp && (record.employeeId === emp.id || (record as any).employeeCode === emp.employeeId))
      );
    };

    const checkAutoCheckout = () => {
      const now = new Date();
      const todayStr = getEmployeeWorkDate(now);
      // Strictly resolve hours and minutes in IST
      const istParts = new Intl.DateTimeFormat('en-US', {
        timeZone: COMPANY_TIMEZONE,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(now);
      const currentHours = Number(istParts.find(p => p.type === 'hour')?.value || 0);
      const currentMinutes = Number(istParts.find(p => p.type === 'minute')?.value || 0);
      const isPastCutoff =
        currentHours > AUTO_CHECKOUT_CUTOFF_HOUR ||
        (currentHours === AUTO_CHECKOUT_CUTOFF_HOUR && currentMinutes >= AUTO_CHECKOUT_CUTOFF_MINUTE);

      attendanceRef.current.forEach(record => {
        if (processedIds.has(record.id)) return; // already handled this session
        if (!isOwnRecord(record)) return;        // never race other clients (fix 4)

        const isPastDay = record.date < todayStr;
        const isTodayPastCutoff = record.date === todayStr && isPastCutoff;

        if (!record.checkOutAt && (isPastDay || isTodayPastCutoff)) {
          processedIds.add(record.id); // mark before async write to prevent double-write

          // Cutoff pinned to IST (+05:30) so the instant is identical on every
          // device regardless of local timezone (fix 1).
          const autoCheckOutDate = new Date(`${record.date}T23:00:00+05:30`);
          if (Number.isNaN(autoCheckOutDate.getTime())) return;
          const forceCheckOutTime = autoCheckOutDate.toISOString();

          // Atomically close any open break on auto-checkout
          const existingBreaks = Array.isArray(record.breaks) ? record.breaks : [];
          let updatedBreaks = existingBreaks;
          const openBreak = existingBreaks.find((b: any) => !b.endAt && !(b as any).endTime);
          if (openBreak) {
            const bStartIso = formatTimestampToISO(openBreak.startAt || (openBreak as any).startTime) || forceCheckOutTime;
            const bStartMs = new Date(bStartIso).getTime();
            const cutoffMs = autoCheckOutDate.getTime();
            const breakMins = Math.max(1, Math.floor(Math.max(0, cutoffMs - bStartMs) / 60000));
            updatedBreaks = existingBreaks.map((b: any) => {
              const isOpen = !b.endAt && !(b as any).endTime;
              if (isOpen) {
                return {
                  ...b,
                  startAt: formatTimestampToISO(b.startAt || (b as any).startTime) || bStartIso,
                  endAt: forceCheckOutTime,
                  endTime: forceCheckOutTime,
                  durationMinutes: breakMins
                };
              }
              return b;
            });
          }

          const totalBreakMins = updatedBreaks.reduce((acc: number, b: any) => acc + (Number(b.durationMinutes) || 0), 0);

          let totalMins = 0;
          if (record.checkInAt) {
            const checkInMs = new Date(record.checkInAt).getTime();
            totalMins = Math.floor((autoCheckOutDate.getTime() - checkInMs) / 60000);
            if (totalBreakMins > 0) {
              totalMins = Math.max(0, totalMins - totalBreakMins);
            }
          }
          totalMins = Math.max(0, totalMins);

          const updatedNotes = (record.notes ? record.notes + ' | ' : '') + 'SYSTEM: Auto-checked out at 11:00 PM IST (Shift End Cutoff)';

          // Auto close the record in Firestore
          setDoc(doc(db, 'attendance', record.id), {
            checkOutAt: forceCheckOutTime,
            workingMinutes: totalMins,
            breaks: updatedBreaks,
            totalBreakMinutes: totalBreakMins,
            notes: updatedNotes,
            updatedAt: serverTimestamp()
          }, { merge: true })
            .then(() => {
              // Audit only on confirmed success (fix 3).
              addAuditLogRef.current(
                'AUTO_CHECKOUT',
                `Att ID: ${record.id}`,
                `Auto-checked out at 11:00 PM IST for ${record.date}`
              );
            })
            .catch((err) => {
              // Bounded retry, and never retry a permanent authorization failure (fix 2).
              const code = String(err?.code || '');
              const permanent = code === 'permission-denied' || code === 'unauthenticated' || code === 'invalid-argument';
              const attempts = (attemptCounts.get(record.id) || 0) + 1;
              attemptCounts.set(record.id, attempts);
              if (!permanent && attempts < MAX_ATTEMPTS) {
                processedIds.delete(record.id);
              }
              console.warn(
                `[AuthContext] Auto-checkout write failed for ${record.id} (attempt ${attempts}/${MAX_ATTEMPTS}, ${permanent ? 'permanent' : 'retryable'}):`,
                err
              );
            });
        }
      });
    };

    const interval = setInterval(checkAutoCheckout, 30000); // Check every 30s
    checkAutoCheckout(); // Check immediately on mount

    return () => clearInterval(interval);
  }, [authUid]);


  // Sync to & from Firestore
  //
  // P0 INCIDENT FIX — listener lifecycle is now owned by Firebase Auth:
  //   BEFORE: this effect ran once on mount ([] deps) and attached all listeners
  //   while request.auth was still null (session restore pending or local-login
  //   session). Firestore denied every query, each listener died permanently
  //   (permission-denied listeners never retry), and after a successful login
  //   nothing re-attached them → ALL portals frozen with "Missing or insufficient
  //   permissions".
  //   AFTER: listeners attach only when authUid becomes non-null (token verified),
  //   re-attach on every login, and detach cleanly on sign-out / token death.
  useEffect(() => {
    if (!authUid) {
      // No verified Firebase session: nothing to sync. Mark sync complete so the
      // UI falls back to cached/local data instead of spinning forever.
      setAttendanceSyncStatus('synced');
      return;
    }

    let unsubEmps = () => { };
    let unsubAtt = () => { };
    let unsubLogs = () => { };
    let unsubSettings = () => { };
    let unsubWorkZone = () => { };
    let unsubLeaveReqs = () => { };
    let unsubNotifs = () => { };

    // One-shot latches for the two bootstrap writes in the employees listener.
    // Without them, any write that keeps failing (rules rejection, offline) is
    // retried on every single snapshot for the lifetime of the session.
    let didSeedInitialEmployees = false;
    let didSeedProjectManager = false;
    let didSeedSettings = false;
    let didSeedWorkZone = false;
    let didMigrateWorkZone = false;

    const initFirestore = () => {
      try {
        testConnection().then(connected => setIsFirestoreConnected(connected)).catch(() => {
          setIsFirestoreConnected(typeof navigator !== 'undefined' ? navigator.onLine : true);
        });

        // Subscribe to real-time updates IMMEDIATELY for employees
        unsubEmps = onSnapshot(collection(db, 'employees'), (snapshot) => {
          // ── P0 FIX: WRITE AMPLIFICATION FROM A READ LISTENER ──
          // This handler performed deleteDoc() and up to three setDoc() "live
          // autocorrect" migrations per employee document — from EVERY connected
          // client, on EVERY snapshot. With N browsers open, one snapshot produced
          // N identical writes per affected document; each write then produced a new
          // snapshot on all N clients, and any write that kept failing was retried on
          // every snapshot forever. It also billed N× the writes and made the
          // employees collection last-write-wins between racing clients.
          //
          // The corrections themselves are still applied IN MEMORY for everyone, so
          // every portal renders clean data. Only the persistence is now restricted
          // to an administrative session — which is also the only role the hardened
          // firestore.rules permit to write another employee's document.
          const canMigrate = roleRef.current === 'SUPER_ADMIN' || roleRef.current === 'HR_ADMIN';

          if (!snapshot.empty) {
            const fetched: Employee[] = [];
            snapshot.forEach(docSnap => {
              const data = { id: docSnap.id, ...docSnap.data() } as Employee;

              // PURGE ONLY OLD DUMMY EMP-003 RECORD (with old typo domain)
              if (
                (data.id === 'emp-003' || data.employeeId === '003') &&
                data.email?.toLowerCase() === 'd.koushik@kalpanaaa.in'
              ) {
                if (canMigrate) deleteDoc(doc(db, 'employees', data.id)).catch(() => { });
                return;
              }

              // LIVE AUTOCORRECT CEO SPELLING AND EMAIL IN FIREBASE
              if (data.employeeId === 'CEO001') {
                let needsUpdate = false;
                if (data.role === 'SUPER_ADMIN' && (data.fullName || '').toLowerCase().includes('akshit')) {
                  if (data.email !== 'akshit@kalpanaaa.in') {
                    data.email = 'akshit@kalpanaaa.in';
                    needsUpdate = true;
                  }
                }
                if (needsUpdate && canMigrate) {
                  setDoc(doc(db, 'employees', data.id), data, { merge: true }).catch(() => { });
                }
              }

              // LIVE AUTOCORRECT MALFORMED OR DOUBLE-PREFIXED EMPLOYEE IDs
              if (data.employeeId) {
                let cleanId = data.employeeId;
                if (cleanId.includes('24072407') || cleanId.includes('27072407') || cleanId.length > 9) {
                  const numMatch = cleanId.match(/\d+$/);
                  if (numMatch) {
                    const seqNum = numMatch[0].slice(-3);
                    cleanId = `KSS2407${seqNum}`;
                  }
                } else if (!cleanId.startsWith('KSS2407') && cleanId.match(/^\d+$/)) {
                  cleanId = `KSS2407${cleanId.padStart(3, '0')}`;
                } else if (cleanId.startsWith('KSS2707')) {
                  cleanId = cleanId.replace('KSS2707', 'KSS2407');
                } else if (cleanId.startsWith('KS2407') || cleanId.startsWith('KS2707')) {
                  cleanId = cleanId.replace('KS2707', 'KSS2407').replace('KS2407', 'KSS2407');
                }

                if (cleanId !== data.employeeId) {
                  data.employeeId = cleanId;
                  if (canMigrate) {
                    setDoc(doc(db, 'employees', data.id), { employeeId: cleanId }, { merge: true }).catch(() => { });
                  }
                }
              }

              // LIVE AUTOCORRECT INVALID OR 'check' EMPLOYEE STATUS TO 'Active'
              const validStatuses: EmployeeStatus[] = ['Active', 'On Leave', 'Terminated', 'Suspended'];
              if (!data.status || !validStatuses.includes(data.status as EmployeeStatus) || String(data.status).toLowerCase() === 'check' || String(data.status).toLowerCase() === 'checked in') {
                data.status = 'Active';
                if (canMigrate) {
                  setDoc(doc(db, 'employees', data.id), { status: 'Active' }, { merge: true }).catch(() => { });
                }
              }

              fetched.push(data);
            });

            // Safe in-memory deduplication (keep newest, never delete real Firestore docs automatically)
            const deduplicated: Employee[] = [];
            const seen = new Set<string>();
            
            // Sort by createdAt descending so we keep the newest record
            fetched.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
            
            for (const emp of fetched) {
              // Skip corrupted records with empty names
              if (!emp.fullName || emp.fullName.trim() === '') {
                continue;
              }

              const emailKey = (emp.email || '').toLowerCase().trim();
              const idKey = emp.employeeId?.trim();
              
              if ((emailKey && seen.has(emailKey)) || (idKey && seen.has(idKey))) {
                // In-memory deduplication only - do NOT delete from Firestore
                continue;
              }
              
              if (emailKey) seen.add(emailKey);
              if (idKey) seen.add(idKey);
              deduplicated.push(emp);
            }

            // Restore display order
            deduplicated.reverse();

            // Ensure Official D. Koushik (Project Manager) exists in Team Directory
            const koushikExists = deduplicated.some(e => 
              e.employeeId === 'KSS2407003' || 
              (e.email || '').toLowerCase().includes('d.koushik@kalpanaaasoftwaresolutions.in')
            );

            if (!koushikExists) {
              const officialKoushik: Employee = {
                id: 'emp-KSS2407003',
                employeeId: 'KSS2407003',
                fullName: 'D. Koushik',
                email: 'd.koushik@kalpanaaasoftwaresolutions.in',
                role: 'PROJECT_MANAGER',
                department: 'Software Engineering',
                designation: 'Project Manager',
                status: 'Active',
                phone: '+91 98765 00003',
                gender: 'Male',
                dateOfBirth: '1995-01-01',
                joiningDate: '2024-07-01',
                employmentType: 'Full-Time',
                permanentAddress: 'Bengaluru HQ Campus',
                currentAddress: 'Bengaluru HQ Campus',
                city: 'Bengaluru',
                state: 'Karnataka',
                postalCode: '560001',
                emergencyContact: '+91 98765 00000',
                emergencyRelationship: 'Management',
                shift: 'General Shift (09:00 - 18:00)',
                workLocation: 'Kalpanaaa Main Office HQ, Bengaluru',
                reportingManager: 'Board of Directors',
                qrToken: 'QR-TOKEN-KSS2407003-PM',
                createdAt: '2024-07-01T09:00:00Z',
                updatedAt: new Date().toISOString(),
                profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
                resumeUrl: ''
              };

              deduplicated.push(officialKoushik);

              // P1 FIX: this setDoc previously ran on EVERY snapshot from EVERY client
              // whenever the record was absent — an unbounded retry loop for any client
              // whose rules forbid writing another employee's document (i.e. everyone
              // except HR/admin). Latched to once per session and restricted to a
              // session that is actually permitted to write it.
              if (canMigrate && !didSeedProjectManager && !snapshot.metadata.fromCache) {
                didSeedProjectManager = true;
                setDoc(doc(db, 'employees', officialKoushik.id), officialKoushik, { merge: true }).catch(() => { });
              }
            }

            if (deduplicated.length > 0) {
              setEmployees(deduplicated);
              setActiveEmployee(prev => {
                if (!prev) return prev;
                const fresh = deduplicated.find(e => e.id === prev.id || e.employeeId === prev.employeeId || (prev.email && e.email?.toLowerCase() === prev.email.toLowerCase()));
                if (!fresh) return prev;
                if (fresh.status === 'Terminated' || fresh.status === 'Suspended') {
                  console.warn('[Auth] Active employee status changed to', fresh.status, '— logging out.');
                  setTimeout(() => logout(), 0);
                  return null;
                }
                return { ...prev, ...fresh };
              });
            }
          } else {
            // ── P0 FIX: DEMO DATA COULD BE SEEDED INTO PRODUCTION ──
            // This branch previously ran on ANY empty snapshot and unconditionally
            // wrote all INITIAL_EMPLOYEES (demo staff, with roles) to Firestore.
            // Firestore is configured with persistentLocalCache, so the FIRST
            // snapshot after a cold start is served from an empty local cache
            // BEFORE the server responds — `snapshot.empty` was therefore true on a
            // perfectly populated production database, and this handler happily
            // injected fake employees into the live company directory. A
            // permission-denied listener or a cleared cache produced the same result.
            //
            // Seeding now requires (a) a SERVER-confirmed empty collection, and
            // (b) a one-shot latch so it can never loop. Genuine first-run
            // bootstrapping of a fresh project still works.
            if (snapshot.metadata.fromCache) {
              // Cache-only empty result: the server has not spoken yet. Do nothing.
              return;
            }
            if (didSeedInitialEmployees) return;
            didSeedInitialEmployees = true;

            console.warn('[Auth] employees collection is empty on the server — seeding initial directory.');
            Promise.all(
              INITIAL_EMPLOYEES.map(emp =>
                setDoc(doc(db, 'employees', emp.id), emp).catch(err => {
                  console.warn('[Auth] Initial employee seed failed for', emp.id, err);
                })
              )
            ).catch(() => { });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'employees');
        });

        // Subscribe to attendance records (Single Source of Truth: Firestore only)
        const attQuery = collection(db, 'attendance');

        unsubAtt = onSnapshot(attQuery, (snapshot) => {
          const fetched: AttendanceRecord[] = [];
          if (!snapshot.empty) {
            snapshot.forEach(docSnap => {
              // ROOT-CAUSE FIX: request estimated serverTimestamps so latency-compensated
              // (local) snapshots already carry checkInAt instead of null. Without this,
              // the UI flashed the stale "Tap to Check In" state until the server ack
              // arrived, even though the write had already been applied locally.
              const data = docSnap.data({ serverTimestamps: 'estimate' });
              const recId = docSnap.id;

              const canonicalUid = getCanonicalEmployeeUid({
                uid: data.uid || data.employeeUid,
                id: data.employeeId,
                employeeId: data.employeeCode || data.employeeId
              });

              // Read live employees via ref — the listener closure captures a stale
              // `employees` array from subscription time (often empty on cold start),
              // which broke identity resolution and produced duplicate state records.
              const empPool = employeesRef.current;
              const matchedEmp = findEmployee({
                id: data.employeeId,
                employeeId: data.employeeCode || data.employeeId,
                uid: canonicalUid || data.uid,
                fullName: data.employeeName
              });

              const employeeName = data.employeeName || matchedEmp?.fullName || '';
              const employeeCode = data.employeeCode || matchedEmp?.employeeId || data.employeeId || canonicalUid;
              const employeeId = matchedEmp?.id || data.employeeId || canonicalUid;

              const dateStr = getWorkDate(data.date || formatTimestampToISO(data.createdAt) || formatTimestampToISO(data.checkInAt) || (recId.includes('_') ? recId.split('_')[1] : new Date()));
              let checkInISO = formatTimestampToISO(data.checkInAt);
              if (!checkInISO && data.checkInAt && typeof data.checkInAt === 'object') {
                checkInISO = formatTimestampToISO(data.createdAt) || formatTimestampToISO(data.updatedAt);
              }
              const checkOutISO = formatTimestampToISO(data.checkOutAt);
              const createdISO = formatTimestampToISO(data.createdAt) || checkInISO || new Date().toISOString();
              const updatedISO = formatTimestampToISO(data.updatedAt) || checkOutISO || createdISO;

              const cleanRec: AttendanceRecord = {
                id: recId,
                uid: canonicalUid,
                employeeUid: canonicalUid,
                employeeId: employeeId,
                employeeCode: employeeCode,
                employeeName: employeeName,
                department: data.department || matchedEmp?.department || 'Engineering',
                pmUid: data.pmUid || matchedEmp?.pmUid || '',
                date: dateStr,
                checkInAt: checkInISO,
                checkOutAt: checkOutISO,
                workingMinutes: typeof data.workingMinutes === 'number' ? data.workingMinutes : 0,
                status: data.status || 'Present',
                attendanceMethod: data.attendanceMethod || 'Self Portal',
                officeLatitude: data.officeLatitude,
                officeLongitude: data.officeLongitude,
                officeRadiusMeters: data.officeRadiusMeters,
                distanceFromOffice: data.distanceFromOffice,
                locationAccuracy: data.locationAccuracy,
                locationVerified: !!data.locationVerified,
                latitude: data.latitude,
                longitude: data.longitude,
                deviceInfo: data.deviceInfo,
                notes: data.notes,
                breaks: Array.isArray(data.breaks) ? data.breaks.map((b: any) => ({
                  type: b.type,
                  startAt: formatTimestampToISO(b.startAt || b.startTime) || '',
                  endAt: formatTimestampToISO(b.endAt || b.endTime),
                  durationMinutes: Number(b.durationMinutes) || 0
                })) : [],
                totalBreakMinutes: typeof data.totalBreakMinutes === 'number' ? data.totalBreakMinutes : 0,
                isWfh: !!data.isWfh,
                createdAt: createdISO,
                updatedAt: updatedISO
              };

              fetched.push(cleanRec);
            });
          }

          // Deduplicate by RESOLVED employee identity + date.
          const deduplicatedMap = new Map<string, AttendanceRecord>();
          fetched.forEach(rec => {
            const recEmp = findEmployee({
              id: rec.employeeId,
              employeeId: rec.employeeCode,
              uid: rec.employeeUid,
              fullName: rec.employeeName
            });
            const identityKey = getCanonicalEmployeeUid(
              recEmp
                ? { uid: recEmp.uid, id: recEmp.id, employeeId: recEmp.employeeId }
                : { uid: rec.employeeUid, id: rec.employeeId, employeeId: rec.employeeCode }
            ) || rec.id;
            const empKey = `${identityKey}_${rec.date}`;
            const existing = deduplicatedMap.get(empKey);
            if (!existing) {
              deduplicatedMap.set(empKey, rec);
            } else {
              // Merge duplicates preferring the record with REAL attendance data so a
              // stale blank duplicate can never mask an actual check-in / check-out.
              const richer = (rec.checkInAt ? rec : existing) as AttendanceRecord;
              const poorer = (rec.checkInAt ? existing : rec) as AttendanceRecord;
              // Keep the canonical doc ID ({uid}_{date}) when one of the dups has it,
              // so canonical-ID lookups elsewhere hit this exact state record.
              const isCanonicalId = (id: string) => id === `${identityKey}_${rec.date}`;
              const canonicalDocId = `${identityKey}_${rec.date}`;
              const canonicalRec = rec.id === canonicalDocId ? rec : (existing.id === canonicalDocId ? existing : null);

              // BREAK FLAP ROOT FIX: the canonical doc ({uid}_{date}) is the ONLY
              // write target for startBreak / endBreak / recordCheckOut. Its breaks
              // array is always authoritative.
              const canonicalBreaks = (() => {
                if (rec.id === canonicalDocId) return rec.breaks || [];
                if (existing.id === canonicalDocId) return existing.breaks || [];
                // No canonical in this pair — prefer more entries, then prefer
                // the set that contains an open (in-progress) break.
                const rBreaks = richer.breaks || [];
                const pBreaks = poorer.breaks || [];
                if (rBreaks.length !== pBreaks.length) return rBreaks.length > pBreaks.length ? rBreaks : pBreaks;
                const rHasOpen = rBreaks.some((b: any) => !b.endAt && !(b as any).endTime);
                const pHasOpen = pBreaks.some((b: any) => !b.endAt && !(b as any).endTime);
                if (rHasOpen && !pHasOpen) return rBreaks;
                if (pHasOpen && !rHasOpen) return pBreaks;
                return rBreaks;
              })();

              // CHECKOUT ROOT FIX: The canonical doc is authoritative for checkOutAt.
              // When an admin undos checkout (checkOutAt = null), we MUST NOT fall back
              // to a stale checkOutAt from a duplicate document via `richer || poorer`.
              const finalCheckOutAt = canonicalRec && canonicalRec.checkInAt !== undefined
                ? (canonicalRec.checkOutAt || null)
                : (richer.checkOutAt || null);

              const finalStatus = canonicalRec?.status || richer.status || poorer.status || 'Present';
              const finalCheckInAt = canonicalRec?.checkInAt || richer.checkInAt || poorer.checkInAt;

              const merged: AttendanceRecord = {
                ...poorer,
                ...richer,
                id: isCanonicalId(richer.id) ? richer.id : (isCanonicalId(poorer.id) ? poorer.id : richer.id),
                checkInAt: finalCheckInAt,
                checkOutAt: finalCheckOutAt,
                status: finalStatus,
                breaks: canonicalBreaks,
                workingMinutes: finalCheckOutAt ? Math.max(existing.workingMinutes || 0, rec.workingMinutes || 0) : (canonicalRec?.workingMinutes ?? 0),
                totalBreakMinutes: Math.max(existing.totalBreakMinutes || 0, rec.totalBreakMinutes || 0)
              };
              deduplicatedMap.set(empKey, merged);
            }
          });

          const consolidated = Array.from(deduplicatedMap.values());
          consolidated.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
          
          // Pure Firestore state derivation
          setAttendance(consolidated);
          setAttendanceSyncStatus('synced');

          // ── COST FIX: the migration used to be kicked off from right here ──
          // runAttendanceMigration() ran on EVERY client's first snapshot, for every
          // role, with no gate. It full-scans /attendance AND /employees via getDocs
          // (attendanceMigration.ts:131,140) plus a per-legacy-doc getDoc in a loop,
          // so a ~20k-record collection billed ~20k server reads per session —
          // roughly 2,000,000 reads/day across ~100 daily logins, against a
          // 50,000/day free allowance (~40x over).
          //
          // Nothing that portals RENDER is lost by removing it from the read path:
          // identity resolution, canonical-uid mapping and de-duplication are all
          // computed IN MEMORY above, for every role.
          //
          // The migration's only side effect is PERSISTING repairs, and the one that
          // reaches an employee is the fabricated-shift repair. Note an employee CAN
          // write their own attendance rows (firestore.rules ownsAttendanceData), so
          // the honest reason gating is safe is not "employees couldn't write anyway"
          // — it is that fabrication is no longer produced. Those rows were written by
          // the LEGACY migration (see the comment on isFabricatedCheckoutOnly in
          // attendanceEngine.ts), so the repair set is finite and historical: one
          // admin pass drains a backlog that never regrows. What used to happen on
          // every employee login was therefore a no-op costing ~20k reads.
          // Ownership now sits in the admin-gated, once-per-day effect below.
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'attendance');
          setAttendanceSyncStatus('synced');
        });

        // Subscribe to leave requests with real-time cross-device sync
        unsubLeaveReqs = onSnapshot(collection(db, 'leaveRequests'), (snapshot) => {
          const fetched: LeaveRequest[] = [];
          if (!snapshot.empty) {
            snapshot.forEach(docSnap => {
              const data = docSnap.data();
              const raw = { id: docSnap.id, ...data } as LeaveRequest;
              
              const isApplicantPmOrHr = raw.employeeRole === 'PROJECT_MANAGER' ||
                raw.employeeRole === 'HR_ADMIN' ||
                raw.employeeRole === 'SUPER_ADMIN' ||
                (raw.department || '').toLowerCase().includes('hr') ||
                (raw.department || '').toLowerCase().includes('management') ||
                (raw.employeeName || '').toLowerCase().includes('koushik') ||
                (raw.employeeName || '').toLowerCase().includes('abhinaya');

              const pmStatus = isApplicantPmOrHr ? 'N/A' : (raw.pmStatus || 'Pending');
              const hrStatus = isApplicantPmOrHr ? 'N/A' : (raw.hrStatus || (pmStatus === 'Approved' ? 'Pending' : 'Waiting PM'));
              const ceoStatus = raw.ceoStatus || (isApplicantPmOrHr ? 'Pending' : (hrStatus === 'Approved' ? 'Pending' : 'Waiting HR'));
              const ctoStatus = raw.ctoStatus || (ceoStatus === 'Approved' ? 'Pending' : 'Waiting CEO');

              const isPmPassed = pmStatus === 'Approved' || pmStatus === 'N/A' || pmStatus === 'Bypassed';
              const isHrPassed = hrStatus === 'Approved' || hrStatus === 'N/A' || hrStatus === 'Bypassed';
              const isCeoPassed = ceoStatus === 'Approved' || ceoStatus === 'N/A' || ceoStatus === 'Bypassed';
              const isCtoPassed = ctoStatus === 'Approved' || ctoStatus === 'N/A' || ctoStatus === 'Bypassed';

              let status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' = raw.status || 'Pending';
              if (raw.status === 'Cancelled') {
                status = 'Cancelled';
              } else if (
                pmStatus === 'Rejected' || 
                hrStatus === 'Rejected' || 
                ceoStatus === 'Rejected' || 
                ctoStatus === 'Rejected' || 
                raw.status === 'Rejected'
              ) {
                status = 'Rejected';
              } else if (isPmPassed && isHrPassed && isCeoPassed && isCtoPassed) {
                status = 'Approved';
              } else {
                status = 'Pending';
              }

              // Dynamic fallback for legacy records missing pmUid or employeeUid
              const matchedEmp = employees.find(e => e.id === raw.employeeId || e.employeeId === raw.employeeId);
              const employeeUid = raw.employeeUid || matchedEmp?.uid || '';
              const pmUid = raw.pmUid || matchedEmp?.pmUid || matchedEmp?.reportingManagerUid || 'uid-KSS2407003';

              fetched.push({
                ...raw,
                employeeUid,
                pmUid,
                pmStatus,
                hrStatus,
                ceoStatus,
                ctoStatus,
                status
              });
            });
          }

          const authoritativeList = fetched.length > 0 ? fetched : INITIAL_LEAVE_REQUESTS;
          authoritativeList.sort((a, b) => {
            const timeA = new Date(a.requestDate || (a as any).createdAt || a.startDate || 0).getTime() || 0;
            const timeB = new Date(b.requestDate || (b as any).createdAt || b.startDate || 0).getTime() || 0;
            return timeB - timeA;
          });

          setLeaveRequests(authoritativeList);
          try {
            localStorage.setItem('kss_v1_leave_requests', JSON.stringify(authoritativeList));
          } catch {}
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'leaveRequests');
        });

        // P1 FIX: `limit(50)` WITHOUT `orderBy` DOES NOT MEAN "50 NEWEST".
        // With no order clause Firestore orders by document name (__name__), and
        // notifications are written with addDoc() → random 20-char ids. The listener
        // therefore streamed an arbitrary, lexicographically-lowest 50 documents and
        // capped there: once the collection exceeded 50 docs, NEW notifications were
        // usually never delivered to the bell at all, and the client-side sort could
        // not recover data the server never sent. Ordering server-side by createdAt
        // makes limit(50) mean what the code always assumed it meant.
        // (createdAt is written as an ISO-8601 string by both src/lib/notifications.ts
        // and the Cloud Function schedulers, and ISO-8601 sorts lexicographically in
        // chronological order — so no index or data migration is required.)
        const notifsQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
        unsubNotifs = onSnapshot(notifsQuery, (snapshot) => {
          const fetched: KssNotification[] = [];
          if (!snapshot.empty) {
            snapshot.forEach(docSnap => {
              const data = docSnap.data();
              const createdAtIso = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString());
              fetched.push({ id: docSnap.id, ...data, createdAt: createdAtIso } as KssNotification);
            });
            fetched.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          }
          setNotifications(fetched);
        }, () => {
          // Silent fallback for notification listener
        });

        // Audit logs are now subscribed conditionally in a separate effect

        // Subscribe to company settings
        unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
          // Read metadata before the exists() narrowing: exists() is declared as a
          // `this is QueryDocumentSnapshot` type predicate, so the else-branch narrows
          // the snapshot to `never` and no property access compiles there.
          const fromCache = docSnap.metadata.fromCache;
          if (docSnap.exists()) {
            const firestoreSettings = docSnap.data() as CompanySettings;
            setSettings(prev => ({
              ...prev,
              ...firestoreSettings,
              // Preserve whichever has MORE wfh dates (local or Firestore) — avoids wipe on sync
              companyWideWfhDates: (() => {
                const local = prev.companyWideWfhDates || [];
                const remote = firestoreSettings.companyWideWfhDates || [];
                const merged = Array.from(new Set([...local, ...remote]));
                return merged;
              })()
            }));
          } else if (
            // P1 FIX: this bootstrap write fired on a CACHE-ONLY miss as well as a real
            // absence. On a cold start the local cache has no settings/global document
            // yet, so `!exists()` was true before the server replied and every client
            // raced to write INITIAL_COMPANY_SETTINGS over the live company policy —
            // resetting the geo-fence, shift window and company-wide WFH dates. It also
            // retried forever on any client whose rules forbid writing settings.
            !fromCache &&
            !didSeedSettings &&
            (roleRef.current === 'SUPER_ADMIN' || roleRef.current === 'HR_ADMIN')
          ) {
            didSeedSettings = true;
            setDoc(doc(db, 'settings', 'global'), INITIAL_COMPANY_SETTINGS).catch(() => { });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'settings/global');
        });

        // Subscribe to authoritative company work zone doc
        unsubWorkZone = onSnapshot(doc(db, 'workZones', 'company'), (docSnap) => {
          // See the note above: exists() narrows the else-branch to `never`.
          const zoneFromCache = docSnap.metadata.fromCache;
          if (docSnap.exists()) {
            const fetchedZone = docSnap.data() as WorkZone;

            // ── P1 FIX: THE GEO-FENCE WAS UNCONFIGURABLE ──
            // The previous condition was
            //   latitude === 13.014316 || longitude === 77.64052 || radiusMeters === 500
            // and it overwrote ALL THREE fields whenever ANY ONE matched. Two bugs:
            //
            //  1. `radiusMeters === 500` is a legitimate admin choice. Saving a 500 m
            //     radius in Work Location settings was silently reverted to 300 m by
            //     every client on the very next snapshot — the setting could never be
            //     applied, and the admin had no error to explain why.
            //  2. Because the clauses were OR'd, choosing a 500 m radius ALSO relocated
            //     the office coordinates, moving the geo-fence the admin never touched.
            //
            // The genuine intent was a one-time migration off one stale coordinate pair.
            // That is preserved with AND semantics on the coordinates only, latched to a
            // single attempt, and restricted to a session permitted to write workZones —
            // instead of an unbounded write from every client on every snapshot.
            let needsUpdate = false;
            if (fetchedZone.latitude === 13.014316 && fetchedZone.longitude === 77.64052) {
              fetchedZone.latitude = 13.014333;
              fetchedZone.longitude = 77.646000;
              needsUpdate = true;
            }

            setCompanyWorkZone(fetchedZone);
            setSettings(prev => ({
              ...prev,
              officeName: fetchedZone.name || prev.officeName,
              officeLatitude: fetchedZone.latitude || prev.officeLatitude,
              officeLongitude: fetchedZone.longitude || prev.officeLongitude,
              allowedRadiusMeters: fetchedZone.radiusMeters || prev.allowedRadiusMeters
            }));

            if (
              needsUpdate &&
              !didMigrateWorkZone &&
              !zoneFromCache &&
              (roleRef.current === 'SUPER_ADMIN' || roleRef.current === 'HR_ADMIN')
            ) {
              didMigrateWorkZone = true;
              setDoc(doc(db, 'workZones', 'company'), {
                latitude: fetchedZone.latitude,
                longitude: fetchedZone.longitude
              }, { merge: true }).catch(() => {});
            }
          } else {
            const defaultZone: WorkZone = {
              name: 'Kalpanaaa Software Solutions HQ',
              latitude: 13.014333,
              longitude: 77.646000,
              radiusMeters: 300,
              active: true,
              updatedBy: 'System Init',
              updatedAt: new Date().toISOString()
            };

            // Always reflect the default locally so check-in validation has a geo-fence,
            // but only PERSIST it on a server-confirmed absence from an authorised
            // session — same cache-miss overwrite hazard as settings/global above.
            setCompanyWorkZone(defaultZone);
            if (
              !zoneFromCache &&
              !didSeedWorkZone &&
              (roleRef.current === 'SUPER_ADMIN' || roleRef.current === 'HR_ADMIN')
            ) {
              didSeedWorkZone = true;
              setDoc(doc(db, 'workZones', 'company'), defaultZone).catch(() => { });
            }
          }
        }, (error) => {
          setCompanyWorkZone({
            name: INITIAL_COMPANY_SETTINGS.officeName,
            latitude: INITIAL_COMPANY_SETTINGS.officeLatitude,
            longitude: INITIAL_COMPANY_SETTINGS.officeLongitude,
            radiusMeters: INITIAL_COMPANY_SETTINGS.allowedRadiusMeters,
            active: true,
            updatedBy: 'System Local Default',
            updatedAt: new Date().toISOString()
          });
          handleFirestoreError(error, OperationType.GET, 'workZones/company');
        });

      } catch (err) {
        console.warn('Firestore initialization fallback to local state:', err);
      }
    };

    initFirestore();

    return () => {
      unsubEmps();
      unsubAtt();
      unsubLogs();
      unsubSettings();
      unsubWorkZone();
      unsubLeaveReqs();
      unsubNotifs();
    };
  }, [authUid]);

  // Conditionally subscribe to audit logs only for admins (bounded query to prevent read spikes)
  useEffect(() => {
    let unsubLogs = () => { };
    if (isAuthenticated && authUid && (role === 'SUPER_ADMIN' || role === 'HR_ADMIN')) {
      // P1 FIX: same `limit` without `orderBy` defect as the notifications query.
      // auditLog ids are `log-<epoch-ms>-<rand>`, so ordering by __name__ ordered by
      // the epoch prefix as a STRING — meaning the admin audit trail showed the 100
      // OLDEST entries and permanently froze. Compliance review of any recent event
      // was impossible. `timestamp` is an ISO-8601 string on every record written by
      // addAuditLog(), so a plain single-field orderBy needs no composite index.
      const logsQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
      // P0 FIX: recovery-enabled subscription (transient errors retried with backoff)
      unsubLogs = subscribeWithRecovery(logsQuery, (snapshot) => {
        if (!snapshot.empty) {
          const fetched: AuditLog[] = [];
          snapshot.forEach(docSnap => {
            fetched.push({ id: docSnap.id, ...docSnap.data() } as AuditLog);
          });
          if (fetched.length > 0) {
            fetched.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setAuditLogs(fetched);
          }
        }
      }, (error) => {
        console.warn('Audit logs permission denied or offline');
      });
    } else {
      setAuditLogs([]);
    }
    return () => unsubLogs();
  }, [isAuthenticated, authUid, role]);

  // ── COST FIX: admin-owned, once-per-day attendance migration ────────────────
  // The legacy→canonical attendance migration (and its shift-fabrication repair)
  // is a maintenance job, not a read path. It was previously fired from the
  // attendance snapshot handler on every client, which full-scanned /attendance
  // and /employees once per session and alone consumed ~40x the daily free read
  // allowance. Two guards make it cheap without making it useless:
  //
  //  • Role gate — SUPER_ADMIN / HR_ADMIN only, mirroring the audit-log effect
  //    above. This reads the `role` STATE, deliberately not `roleRef.current`:
  //    the ref is synced by its own effect and still holds the 'EMPLOYEE' default
  //    at the moment the first attendance snapshot lands, so gating in place
  //    would have skipped admins too and the repairs would never have run at all.
  //
  //  • Persisted day latch — the old in-closure `let hasRunMigration` reset on
  //    every re-init, so the scan re-ran on every mount and reconnect.
  //    localStorage survives both. The migration is idempotent, so a failure
  //    intentionally leaves the latch unset and retries on the next admin session.
  useEffect(() => {
    if (!isAuthenticated || !authUid) return;
    if (role !== 'SUPER_ADMIN' && role !== 'HR_ADMIN') return;

    const dayKey = `kss_att_migration_v1:${todayInIST()}`;
    if (localStorage.getItem(dayKey) === 'done') return;

    let cancelled = false;
    runAttendanceMigration()
      .then(() => {
        if (!cancelled) localStorage.setItem(dayKey, 'done');
      })
      .catch(() => { /* transient — retried on the next admin session */ });

    return () => { cancelled = true; };
  }, [isAuthenticated, authUid, role]);

  // ── One-time resume backfill, exposed to admin sessions only ─────────────────
  // Deliberately NOT auto-run: it rewrites every employee document, so an operator
  // triggers it explicitly, once, after firestore.rules has been deployed. Attached
  // here rather than shipped as a Node script because it must execute with a real
  // admin's credentials — the subcollection is admin-write-only.
  //
  // From the devtools console of an HR/SUPER_ADMIN session:
  //   await __kssBackfillResumes()                  // dry run — reports, changes nothing
  //   await __kssBackfillResumes({ dryRun: false }) // performs the migration
  useEffect(() => {
    if (!isAuthenticated) return;
    if (role !== 'SUPER_ADMIN' && role !== 'HR_ADMIN') return;

    (window as any).__kssBackfillResumes = backfillEmployeeResumes;
    return () => { delete (window as any).__kssBackfillResumes; };
  }, [isAuthenticated, role]);

  // ── Session Restore: Already done synchronously via useState initializers above ──
  // This effect only clears stale sessions that couldn't be matched on mount.
  useEffect(() => {
    const savedSessionId = localStorage.getItem('kss_v1_session');
    if (!savedSessionId) return;

    // If activeEmployee wasn't restored (e.g. cache miss), try one more time from Firestore-streamed employees
    if (!activeEmployee) {
      const matched = employeesRef.current.find(e => e.id === savedSessionId || e.employeeId === savedSessionId);
      if (matched) {
        setActiveEmployee(matched);
        let assignedRole = matched.role;
        if (matched.employeeId === 'CEO001' || matched.employeeId === 'CTO001') assignedRole = 'SUPER_ADMIN';
        setRole(assignedRole);
        setIsAuthenticated(true);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Firebase Auth State: subscribes ONCE, uses ref for employee lookup ──
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      // P0 FIX: publish the verified identity FIRST — this gates the Firestore
      // listener effect. When the identity disappears (sign-out, revoked/failed
      // token refresh → the identitytoolkit HTTP 400 path), listeners detach and
      // sensitive Firestore-derived state is purged instead of zombie-denying.
      setAuthUid(firebaseUser?.uid ?? null);
      if (!firebaseUser) {
        setUser(null);
        setAttendance([]);
        setLeaveRequests([]);
        setNotifications([]);
        setAuditLogs([]);
        setAttendanceSyncStatus('synced');
        return;
      }
      setUser(firebaseUser);
      setIsDemoMode(false);
      const cleanEmail = firebaseUser.email?.toLowerCase();
      let matched = employeesRef.current.find(e => e.email?.toLowerCase() === cleanEmail);

      if (!matched && cleanEmail) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            matched = employeesRef.current.find(e => e.email?.toLowerCase() === userData.email?.toLowerCase());
          }
        } catch (e) {
          console.warn('User doc fetch exception:', e);
        }
      }

      if (matched) {
        setActiveEmployee(matched);
        setRole(matched.role);
        setIsAuthenticated(true);
        setIsSessionReady(true);
        localStorage.setItem('kss_v1_session', matched.id);
        if (matched.email) localStorage.setItem('kss_v1_session_email', matched.email.toLowerCase());

        // Sync role to users/{uid} for Firestore Security Rules RBAC lookup.
        //
        // P0 FIX: `employeeDocId` is new and REQUIRED by firestore.rules. The rules
        // must verify that this mapping faithfully mirrors the role recorded on the
        // (admin-write-only) employees record before accepting a privileged role —
        // otherwise any employee could write themselves role: 'SUPER_ADMIN' here and
        // every isSuperAdmin()/isHrAdmin() check in the ruleset would return true.
        //
        // The rules can only cross-check via get() on a KNOWN path, and the two
        // existing fields cannot produce one: `employees` documents are keyed
        // `emp-KSS2407002` for every seeded employee, while `employeeId` holds the
        // bare code `KSS2407002` and `uid` holds the Firebase uid. Neither resolves
        // to the document. Without this field the cross-check could never succeed and
        // EVERY seeded privileged account (CEO, CTO, HR, PM) was denied on create,
        // silently, leaving getRole() null and no privileges at all.
        //
        // P1 FIX: the rejection is no longer swallowed. A failure here is the single
        // point that decides whether this session has any privileges whatsoever, so
        // it must be visible in diagnostics rather than a bare no-op catch.
        setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: matched.email?.toLowerCase() || firebaseUser.email?.toLowerCase(),
          role: matched.role,
          employeeId: matched.employeeId,
          employeeDocId: matched.id,
          fullName: matched.fullName,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch((err) => {
          console.error(
            `[Auth] Failed to sync users/${firebaseUser.uid} role mapping (${matched.role}). ` +
            'Every privileged Firestore rule will deny for this session until this succeeds.',
            err
          );
          handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
        });
      }
    });
    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addAuditLog = (action: string, target: string, details: string) => {
    const newLog: AuditLog = {
      // P1 FIX: the id was `log-${Date.now()}` alone. Two audit events in the same
      // millisecond — routine, since check-in/check-out each emit an audit entry
      // alongside a notification — produced the SAME document id. The second write
      // then became an overwrite of an existing document, which the append-only
      // auditLogs rule (`allow update: if false`) rejects: one of the two events was
      // silently lost from the compliance trail. A random suffix makes ids unique.
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actorId: activeEmployee?.id || 'sys-admin',
      actorName: activeEmployee?.fullName || 'System Admin',
      actorRole: role,
      action,
      target,
      details,
      timestamp: new Date().toISOString()
    };
    setAuditLogs(prev => [newLog, ...prev]);

    // Async write to Firestore
    setDoc(doc(db, 'auditLogs', newLog.id), newLog).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, `auditLogs/${newLog.id}`);
    });

    // Firebase notifications for major events
    const notificationMap: Record<string, { title: string }> = {
      'EMPLOYEE_CREATED':        { title: '👤 New Employee Added' },
      'EMPLOYEE_DELETED':        { title: '🗑️ Employee Removed' },
      'USER_LOGIN':              { title: '🔐 Employee Login' },
      'USER_LOGOUT':             { title: '🚪 Employee Logout' },
      'ATTENDANCE_CHECKIN':      { title: '🟢 Check-In Recorded' },
      'ATTENDANCE_CHECKOUT':     { title: '🔴 Check-Out Recorded' },
      'ATTENDANCE_BREAK_START':  { title: '🟡 Break Started' },
      'ATTENDANCE_BREAK_END':    { title: '🟡 Break Ended' },
      'LEAVE_APPROVED':          { title: '✅ Leave Approved' },
      'LEAVE_REJECTED':          { title: '❌ Leave Rejected' },
      'PAYROLL_RUN':             { title: '💰 Payroll Run' },
    };
    const notifConfig = notificationMap[action];
    if (notifConfig) {
      sendKssNotification(
        action as any,
        notifConfig.title,
        `${details} — by ${newLog.actorName}`,
        { actorId: newLog.actorId, actorName: newLog.actorName }
      );
    }
  };

  // "Latest ref" pattern: the auto-checkout interval effect is deliberately stable
  // (re-registering it on every snapshot recreates the write→snapshot feedback loop
  // that BUG 3 fixed), so it reaches the current addAuditLog through this ref and
  // records the real signed-in actor instead of the first render's placeholder.
  addAuditLogRef.current = addAuditLog;

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = pass.trim();

      if (!cleanEmail || !cleanPass) {
        setIsLoading(false);
        return { success: false, message: 'Please enter both your company email address and password.' };
      }

      // Find target employee with domain variation and alias support
      const targetEmp = employees.find(e => {
        const empEmail = (e.email || '').toLowerCase();
        if (!empEmail) return false;
        if (empEmail === cleanEmail) return true;
        const empUsername = empEmail.split('@')[0];
        const inputUsername = cleanEmail.split('@')[0];
        if (empUsername === inputUsername) return true;
        // P1 SECURITY FIX: removed hardcoded personal-name substring matching
        // (`akshit` / `gaurav` / `founder` / `koushik`). Those clauses resolved a typed
        // address to a DIFFERENT employee's record — e.g. `gaurav@anything.com` matched any
        // employee whose email merely contained `founder`. That mis-targeted the lockout
        // counter and the legacy credential check onto an unrelated (often executive) account.
        // Exact email and username-only matching above already handle legitimate
        // corporate-domain variations.
        return false;
      }) || INITIAL_EMPLOYEES.find(e => {
        const empEmail = (e.email || '').toLowerCase();
        if (!empEmail) return false;
        if (empEmail === cleanEmail) return true;
        const empUsername = empEmail.split('@')[0];
        const inputUsername = cleanEmail.split('@')[0];
        return empUsername === inputUsername;
      });
      // P1 SECURITY FIX: removed the hardcoded `isPrahlad` carve-out that exempted one named
      // employee from BOTH the lockout check and the 5-failure lockout trigger, leaving that
      // account open to unlimited online password guessing. Brute-force throttling now applies
      // uniformly to every account.
      if (targetEmp && targetEmp.lockoutUntil && targetEmp.lockoutUntil > Date.now()) {
        const waitMins = Math.ceil((targetEmp.lockoutUntil - Date.now()) / 60000);
        setIsLoading(false);
        return { success: false, message: `SECURITY ALERT: Account temporarily locked due to multiple failed attempts. Please wait ${waitMins} minutes.` };
      }

      const clearLockout = (empId: string) => {
        if (targetEmp && targetEmp.failedLoginCount) {
          setDoc(doc(db, 'employees', empId), { failedLoginCount: 0, lockoutUntil: null }, { merge: true }).catch(() => { });
        }
      };

      const recordFailure = () => {
        if (targetEmp) {
          const newCount = (targetEmp.failedLoginCount || 0) + 1;
          const updates: Partial<Employee> = { failedLoginCount: newCount };
          if (newCount >= 5) {
            updates.lockoutUntil = Date.now() + 15 * 60000;
          }
          setDoc(doc(db, 'employees', targetEmp.id), updates, { merge: true }).catch(() => { });
        }
      };



      // 4. Try Firebase Auth (for registered employees)
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        if (userCred.user) {
          setUser(userCred.user);

          const matched = employees.find(e => e.email?.toLowerCase() === cleanEmail || e.id === userCred.user.uid);
          if (matched) {
            const cat = getDeviceCategory();
            const newSessionId = `sess_${cat}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const sessionUpdates = cat === 'desktop' ? { desktopSessionId: newSessionId } : { mobileSessionId: newSessionId };

            const updatedMatched = { ...matched, ...sessionUpdates, currentSessionId: newSessionId };
            setActiveEmployee(updatedMatched);

            const assignedRole = matched.role;
            setRole(assignedRole);
            setIsAuthenticated(true);
            localStorage.setItem('kss_v1_session', matched.id);
            localStorage.setItem('kss_v1_session_id', newSessionId);
            localStorage.setItem('kss_v1_device_category', cat);
            setDoc(doc(db, 'employees', matched.id), sessionUpdates, { merge: true }).catch(() => { });

            // Sync role to users/{uid} for Firestore Security Rules RBAC lookup.
            // employeeDocId is required by firestore.rules to cross-check the role
            // against the admin-write-only employees record — see the onAuthStateChanged
            // sync above for why neither `uid` nor `employeeId` can address that doc.
            setDoc(doc(db, 'users', userCred.user.uid), {
              uid: userCred.user.uid,
              email: cleanEmail,
              role: assignedRole,
              employeeId: matched.employeeId,
              employeeDocId: matched.id,
              fullName: matched.fullName,
              updatedAt: serverTimestamp()
            }, { merge: true }).catch((err) => {
              console.error(
                `[Auth] Failed to sync users/${userCred.user.uid} role mapping (${assignedRole}). ` +
                'Every privileged Firestore rule will deny for this session until this succeeds.',
                err
              );
            });

            addAuditLog('USER_LOGIN', matched.fullName, `Firebase Auth Login (${assignedRole})`);
            clearLockout(matched.id);
            setIsLoading(false);
            return { success: true, message: `Welcome back, ${matched.fullName}!` };
          }

          // Firebase auth succeeded but no employee record yet — fetch user details and create a complete one
          const uid = userCred.user.uid;
          const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          let savedFullName = userCred.user.displayName || cleanEmail.split('@')[0];
          let savedRole: UserRole = 'EMPLOYEE';
          try {
            const userDocSnap = await getDoc(doc(db, 'users', uid));
            if (userDocSnap.exists()) {
              const uData = userDocSnap.data();
              if (uData.fullName) savedFullName = uData.fullName;
              if (uData.role) savedRole = uData.role as UserRole;
            }
          } catch (e) { }

          const autoDetails = getAssignedEmployeeDetails(savedFullName, employees);
          const empCode = autoDetails.employeeId;
          
          const basicEmp: Employee = {
            id: uid,
            uid: uid,
            employeeId: empCode,
            fullName: savedFullName,
            email: cleanEmail, 
            role: autoDetails.role || savedRole, 
            department: 'Engineering',
            designation: autoDetails.designation || 'Software Engineer', 
            status: 'Active',
            phone: '',
            gender: 'Male',
            dateOfBirth: '',
            joiningDate: new Date().toISOString().split('T')[0],
            employmentType: 'Full-Time',
            permanentAddress: 'Bengaluru HQ Campus',
            currentAddress: 'Bengaluru HQ Campus',
            city: 'Bengaluru',
            state: 'Karnataka',
            postalCode: '560102',
            emergencyContact: '',
            emergencyRelationship: '',
            shift: 'General Shift (09:00 - 18:00)',
            workLocation: 'Kalpanaaa Main Office HQ, Bengaluru',
            reportingManager: 'D. Koushik',
            qrToken: empCode,
            currentSessionId: newSessionId,
            sessionFingerprint: generateDeviceFingerprint(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          setEmployees(prev => [basicEmp, ...prev.filter(e => e.id !== basicEmp.id)]);
          setActiveEmployee(basicEmp);
          setRole(basicEmp.role);
          setIsAuthenticated(true);
          localStorage.setItem('kss_v1_session', basicEmp.id);
          if (cleanEmail) localStorage.setItem('kss_v1_session_email', cleanEmail);
          localStorage.setItem('kss_v1_session_id', newSessionId);
          setDoc(doc(db, 'employees', basicEmp.id), basicEmp, { merge: true }).catch(() => { });

          setIsLoading(false);
          return { success: true, message: `Welcome! You're now signed in.` };
        }
      } catch (fbErr: any) {
        // P0 INCIDENT FIX: this catch previously swallowed EVERY Firebase error and
        // fell through to the local password check. Config/environment failures
        // (Email/Password provider disabled, restricted API key, unauthorized
        // domain, network outage, disabled account) surfaced only as anonymous
        // identitytoolkit HTTP 400s while the app silently continued without a
        // real Firebase session — guaranteeing permission-denied on every
        // Firestore call. Only genuine credential rejections may fall back.
        const fbCode: string | undefined = fbErr?.code;
        if (!shouldFallbackToLocalLogin(fbCode)) {
          console.error(`[Auth] Firebase sign-in failed with non-credential error (${fbCode}). NOT falling back to local login.`, fbErr);
          recordFailure();
          setIsLoading(false);
          const friendly = classifyError(fbErr).userMessage;
          return { success: false, message: `Cloud sign-in is currently unavailable (${fbCode}). ${friendly}` };
        }
        // Credential rejection (wrong password / unknown email) — legacy local fallback proceeds below.
      }

      // ── P0 SECURITY FIX: universal master-password backdoor REMOVED ──
      // Previously: `cleanPass === 'Admin@123456' || cleanPass === 'admin123'` authenticated
      // ANY employee record — including SUPER_ADMIN / CEO / CTO — and both literals shipped in
      // the public JS bundle. Any visitor could sign in as a founder with a guessable password.
      // Also removed: comparison against a plaintext `password` field on the employee document
      // (`/employees` is world-readable, so that field was a harvestable credential).
      //
      // The only surviving legacy path is the one-time `initialPassword` bootstrap, kept so
      // employees who have not yet been provisioned in Firebase Auth are not locked out. It is
      // now revoked the moment the employee sets a real password (see
      // updateCurrentEmployeePassword) and requires a non-trivial secret.
      const storedInitial = (targetEmp as any)?.initialPassword;
      const isInitialPass =
        typeof storedInitial === 'string' &&
        storedInitial.length >= 6 &&
        cleanPass === storedInitial;

      if (targetEmp && isInitialPass) {
        const cat = getDeviceCategory();
        const newSessionId = `sess_${cat}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const sessionUpdates = cat === 'desktop' ? { desktopSessionId: newSessionId } : { mobileSessionId: newSessionId };

        const updatedMatched = { ...targetEmp, ...sessionUpdates, currentSessionId: newSessionId };
        setActiveEmployee(updatedMatched);

        const assignedRole = targetEmp.role || 'EMPLOYEE';
        setRole(assignedRole);
        setIsAuthenticated(true);
        localStorage.setItem('kss_v1_session', targetEmp.id);
        if (targetEmp.email) localStorage.setItem('kss_v1_session_email', targetEmp.email.toLowerCase());
        localStorage.setItem('kss_v1_session_id', newSessionId);
        localStorage.setItem('kss_v1_session_timestamp', Date.now().toString());
        localStorage.setItem('kss_v1_device_category', cat);

        addAuditLog('USER_LOGIN', targetEmp.fullName, `Local Login (${assignedRole})`);
        clearLockout(targetEmp.id);
        setIsLoading(false);
        return { success: true, message: `Welcome back, ${targetEmp.fullName}!` };
      }

      recordFailure();
      setIsLoading(false);
      return { success: false, message: 'Incorrect password. Please enter your registered account password.' };
    } catch (err: any) {
      setIsLoading(false);

      return { success: false, message: err.message || 'Login failed.' };
    }
  };

  const sendPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { getAuth, sendPasswordResetEmail } = await import('firebase/auth');
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: `Password reset email sent to ${email}` };
    } catch (err: any) {
      console.error('Password reset error:', err);
      return { success: false, message: err.message || 'Failed to send password reset email.' };
    }
  };

  const setEmployeeInitialPassword = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    try {
      const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp-${Date.now()}`);
      const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      
      // P0 FIX: this users/{uid} doc is what firestore.rules role helpers read.
      // It was previously created WITHOUT a role field, so the account could never
      // resolve privileges (and a missing doc made rule get() calls throw).
      await setDoc(doc(db, 'users', userCred.user.uid), {
        uid: userCred.user.uid,
        email: email,
        role: 'EMPLOYEE',
        fullName: email.split('@')[0],
        createdAt: new Date().toISOString()
      }).catch(err => {
        console.error(`[Auth] Failed to provision users/${userCred.user.uid} — privileged-rule lookups will deny for this account until fixed.`, err);
      });

      await signOut(secondaryAuth);
      return { success: true, message: 'Password successfully set.' };
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        return { success: false, message: 'This employee already has a secure login. Please use the Reset Email button instead.' };
      }
      return { success: false, message: err.message || 'Failed to set password.' };
    }
  };

  const quickDemoLogin = (targetRole: UserRole | 'CEO' | 'CTO') => {
    setIsLoading(true);
    setTimeout(() => {
      let targetEmp: Employee | undefined;
      if (targetRole === 'CEO' || targetRole === 'SUPER_ADMIN') {
        targetEmp = employees.find(e => e.employeeId === 'CEO001' || (e.fullName || '').toLowerCase().includes('akshit')) || employees[0];
      } else if (targetRole === 'CTO') {
        targetEmp = employees.find(e => e.employeeId === 'CTO001' || (e.fullName || '').toLowerCase().includes('gaurav')) || employees[1];
      } else if (targetRole === 'HR_ADMIN') {
        targetEmp = employees.find(e => e.role === 'HR_ADMIN') || employees[2];
      } else if (targetRole === 'PROJECT_MANAGER') {
        targetEmp = employees.find(e => e.role === 'PROJECT_MANAGER' || e.designation?.toLowerCase().includes('project manager') || (e.fullName || '').includes('Koushik')) || employees[2];
      } else {
        targetEmp = employees.find(e => e.role === 'EMPLOYEE') || employees[3];
      }

      if (targetEmp) {
        const cat = getDeviceCategory();
        const newSessionId = `sess_${cat}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const sessionUpdates = cat === 'desktop' ? { desktopSessionId: newSessionId } : { mobileSessionId: newSessionId };

        const updatedTarget = { ...targetEmp, ...sessionUpdates };
        setActiveEmployee(updatedTarget);
        const assignedRole = (targetEmp.employeeId === 'CEO001' || targetEmp.employeeId === 'CTO001') ? 'SUPER_ADMIN' : targetEmp.role;
        setRole(assignedRole);
        if (!auth.currentUser) {
          signInAnonymously(auth).catch(() => {});
        }
        localStorage.setItem('kss_v1_session', targetEmp.id);
        if (targetEmp.email) localStorage.setItem('kss_v1_session_email', targetEmp.email.toLowerCase());
        localStorage.setItem('kss_v1_session_id', newSessionId);
        localStorage.setItem('kss_v1_session_timestamp', Date.now().toString());
        localStorage.setItem('kss_v1_device_category', cat);
        setDoc(doc(db, 'employees', targetEmp.id), sessionUpdates, { merge: true }).catch(() => { });
      } else {
        setRole('SUPER_ADMIN');
      }
      setIsAuthenticated(true);
      setIsDemoMode(true);
      setIsLoading(false);
      addAuditLog('USER_LOGIN', `Demo Executive Login (${targetRole})`, `Switched workspace view to ${targetRole}`);
    }, 150);
  };

  const logout = async () => {
    const empId = activeEmployee?.id || activeEmployee?.employeeId;
    if (empId) {
      await unregisterFcmToken(empId).catch(() => {});
    }
    // P1 FIX: await sign-out so the Firebase token is actually revoked before the UI
    // transitions. Fire-and-forget left a live token attached to in-flight listeners.
    await auth.signOut().catch(() => {});
    setUser(null);
    setAuthUid(null);
    setActiveEmployee(null);
    setIsAuthenticated(false);
    setIsDemoMode(true);
    // P0 FIX: reset the privilege level. `role` previously retained the departing user's
    // value (e.g. SUPER_ADMIN) after logout, so any component gating on `role` without also
    // checking `isAuthenticated` kept rendering administrative UI to the next visitor.
    setRole('EMPLOYEE');
    clearAllFaceEngineState(); // Purges stale face descriptors from memory (Fixes C21 Contract)

    // P0 FIX — cross-user data bleed on shared devices: logout previously cleared only the
    // five session keys and left the entire cached dataset behind. On a shared or kiosk
    // browser the next person to open the app saw the previous user's full employee
    // directory (names, phone numbers, addresses, salary bands, face descriptors), leave
    // history, notifications and audit trail restored straight from localStorage — before
    // any authentication took place. All cached personal data is now purged.
    [
      'kss_v1_session',
      'kss_v1_session_email',
      'kss_v1_session_id',
      'kss_v1_session_timestamp',
      'kss_v1_device_category',
      'kss_v1_employees',
      'kss_v1_attendance',
      'kss_v1_leave_requests',
      'kss_v1_audit_logs',
      'kss_v1_read_notifs',
      'kss_v1_broadcasts',
      'kss_v1_settings',
      'kss_v1_work_zone',
      'kss_v1_company_wfh_dates',
    ].forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });
  };

  const addEmployee = async (empData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'qrToken'> & { password?: string }) => {
    let uid = `emp-${Date.now()}`;
    const cleanEmail = empData.email?.trim().toLowerCase();

    if (empData.password) {
      // Create a secondary Firebase App to create user without signing out the current admin
      const secondaryApp = initializeApp(firebaseConfig, `SecondaryApp-${Date.now()}`);
      const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, empData.password);
        uid = userCred.user.uid;
        
        // Write user mapping record to Firestore using primary DB.
        // P0 FIX: surface failures — this doc is the rules' source of truth for
        // role resolution; a silent failure leaves the account permanently unprivileged.
        await setDoc(doc(db, 'users', uid), {
          uid: uid,
          email: cleanEmail,
          role: empData.role,
          fullName: empData.fullName,
          createdAt: new Date().toISOString()
        }).catch(err => {
          console.error(`[Auth] Failed to write users/${uid} role mapping (${empData.role}). Admin-only rule checks will deny for this account.`, err);
        });

        // Sign out secondary auth so we don't hold the session
        await signOut(secondaryAuth);
      } catch (err: any) {
        console.error("Error creating Firebase user:", err);
        return { success: false, message: err.message || "Failed to create Firebase authentication user." };
      }
    }

    const qrToken = empData.employeeId;

    // Remove password before saving to employee record
    const { password, ...dataToSave } = empData;

    // TOP 1% SECURITY: XSS Sanitization
    const sanitizedData = sanitizeInput(dataToSave);

    const newEmp: Employee = {
      ...sanitizedData,
      id: uid,
      uid: uid,
      qrToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEmployees(prev => [newEmp, ...prev]);

    // ── COST FIX: keep the base64 resume off the parent document ────────────────
    // /employees is listened to collection-wide by every client, so an inline
    // resume was re-streamed to all of them. It goes to a subcollection nobody
    // listens to instead. If that write is rejected — which it is until the
    // subcollection rule is deployed — we fall back to persisting it inline
    // exactly as before, so employee creation works in both states.
    const resumeDataUrl = newEmp.resumeUrl || '';
    const storedOutOfBand = resumeDataUrl
      ? await writeEmployeeResume(newEmp.id, resumeDataUrl, `${newEmp.employeeId}-resume`)
      : false;

    const { resumeUrl: _omitResume, ...empWithoutResume } = newEmp;
    const empPayload: Record<string, any> = storedOutOfBand
      ? { ...empWithoutResume, hasResume: true }
      : newEmp;

    // Persist to Firestore
    setDoc(doc(db, 'employees', newEmp.id), empPayload).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, `employees/${newEmp.id}`);
    });

    addAuditLog('EMPLOYEE_CREATED', `${newEmp.employeeId} (${newEmp.fullName})`, `Added to ${newEmp.department} as ${newEmp.designation}`);
    return newEmp;
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    // TOP 1% SECURITY: XSS Sanitization
    const sanitizedUpdates = sanitizeInput(updates);

    // ── COST FIX: a newly uploaded resume is routed out of band ─────────────────
    // It goes to employees/{id}/private/resume rather than onto this document,
    // because /employees is listened to collection-wide. Captured before the state
    // update since the relocation is async and the parent write below is not.
    const incomingResume = typeof sanitizedUpdates.resumeUrl === 'string' ? sanitizedUpdates.resumeUrl : '';

    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, ...sanitizedUpdates, updatedAt: new Date().toISOString() };

        // ── COST FIX: don't rewrite the base64 blobs on every unrelated edit ──
        // This wrote the ENTIRE merged record, so changing a phone number also
        // re-uploaded profilePhotoUrl and the (uncompressed) base64 resumeUrl.
        // That padded the write, and worse, churned the document — which
        // invalidates the field in every other client's persistent cache and
        // makes them all re-download the blobs on their next snapshot.
        //
        // The full record is still sent so a document that somehow does not exist
        // yet is created complete (merge:true on a missing doc would otherwise
        // persist only the changed keys). The two heavy fields are simply omitted
        // unless they are genuinely part of this update; merge:true leaves the
        // stored values untouched when a key is absent.
        const payload: Record<string, any> = { ...updated };
        if (!('profilePhotoUrl' in sanitizedUpdates)) delete payload.profilePhotoUrl;
        // resumeUrl NEVER goes on the parent document any more — it is handled out
        // of band below. Dropping it unconditionally also avoids writing an empty
        // string back: EmployeeFormModal seeds its form with
        // `employeeToEdit?.resumeUrl || ''`, so for an already-relocated employee
        // every unrelated edit would otherwise push `resumeUrl: ''` to Firestore.
        // No surface clears a resume (the form requires one), so there is nothing
        // legitimate to propagate.
        delete payload.resumeUrl;

        // Persist update to Firestore
        setDoc(doc(db, 'employees', id), payload, { merge: true }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `employees/${id}`);
        });

        return updated;
      }
      return e;
    }));

    // Relocate the resume, then record the outcome on the parent: a marker if it
    // landed in the subcollection, or the blob inline if that was rejected (which
    // it is until the subcollection rule is deployed). Either way the resume is
    // never lost, and the admin form's required-field check still passes.
    if (incomingResume) {
      writeEmployeeResume(id, incomingResume, `${id}-resume`).then(storedOutOfBand => {
        const marker = storedOutOfBand ? { hasResume: true } : { resumeUrl: incomingResume };
        setDoc(doc(db, 'employees', id), marker, { merge: true }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `employees/${id}`);
        });
      });
    }

    addAuditLog('EMPLOYEE_UPDATED', `Employee ID: ${id}`, `Fields updated: ${Object.keys(updates).join(', ')}`);
  };

  const deleteEmployee = (id: string) => {
    const target = employees.find(e => e.id === id);
    setEmployees(prev => prev.filter(e => e.id !== id));

    // Delete from Firestore
    deleteDoc(doc(db, 'employees', id)).catch(err => {
      handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
    });

    addAuditLog('EMPLOYEE_DELETED', target ? `${target.employeeId} (${target.fullName})` : id, 'Removed employee profile from directory');
  };

  const regenerateQrToken = (employeeId: string) => {
    const newToken = `QR-TOKEN-${employeeId}-${Date.now().toString(36).toUpperCase()}`;
    updateEmployee(employeeId, { qrToken: newToken });
    addAuditLog('QR_REGENERATED', `Employee ${employeeId}`, 'Regenerated cryptographic attendance pass');
    return newToken;
  };

  // ── Shared attendance-location policy ───────────────────────────────────────
  // Extracted so check-in and the break paths cannot drift apart. Breaks used to
  // have NO geofence at all, so an employee blocked from checking in outside the
  // office could still start and end meal/tea breaks from anywhere.

  /**
   * Is today an approved work-from-home day for this employee? Company-wide dates,
   * the employee's own approved list, and an approved WFH leave request all count.
   * The KSS2407004 carve-out is preserved verbatim from the check-in path (B27).
   */
  const isApprovedWfhToday = (emp: Employee | undefined, todayStr: string): boolean => {
    if (!emp) return false;
    if (emp.employeeId === 'KSS2407004') return false;
    return (companyWideWfhDates || []).includes(todayStr) ||
      (settings.companyWideWfhDates || []).includes(todayStr) ||
      (emp.approvedWfhDates || []).includes(todayStr) ||
      leaveRequests.some(r =>
        r.type === 'WFH' &&
        r.status === 'Approved' &&
        (r.employeeId === emp.employeeId || r.employeeId === emp.id || r.employeeName === emp.fullName) &&
        todayStr >= r.startDate &&
        todayStr <= r.endDate
      );
  };

  /** One-shot position read, resolving to null rather than throwing, with graceful standard-accuracy fallback */
  const getCurrentPositionOrNull = (): Promise<{ lat: number; lon: number } | null> =>
    new Promise(resolve => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {
          // Fallback to standard accuracy with longer timeout if high accuracy timed out or failed
          navigator.geolocation.getCurrentPosition(
            pos2 => resolve({ lat: pos2.coords.latitude, lon: pos2.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 }
          );
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 6000 }
      );
    });

  /**
   * Gate a self-service break on the office geofence, mirroring check-in.
   *
   * Only applies when the signed-in user is acting on their OWN record. An admin or
   * HR user closing someone else's forgotten break is a correction — their handset's
   * position says nothing about where that employee is — so those calls pass through.
   *
   * Returns null when the break is allowed, or the message explaining the block.
   */
  const verifyBreakLocation = async (
    employeeId: string,
    action: 'start' | 'end',
    lat?: number,
    lon?: number
  ): Promise<string | null> => {
    if (settings.gpsRequired === false) return null;

    const emp = findEmployee(employeeId);
    const isSelfAction = !!emp && !!activeEmployee && (
      emp.id === activeEmployee.id ||
      emp.employeeId === activeEmployee.employeeId ||
      emp.uid === activeEmployee.uid
    );
    if (!isSelfAction && (role === 'SUPER_ADMIN' || role === 'HR_ADMIN')) return null;

    const todayStr = getWorkDate(new Date());
    if (isApprovedWfhToday(emp, todayStr)) return null;

    let coords = (lat !== undefined && lon !== undefined) ? { lat, lon } : null;
    if (!coords) coords = await getCurrentPositionOrNull();

    const verb = action === 'start' ? 'start' : 'end';
    if (!coords) {
      // If closing a break and location acquisition failed due to browser timeout, allow break close if shift was verified
      if (action === 'end') {
        const todayRec = resolveAttendanceRecord(attendance, emp, todayStr);
        if (todayRec?.checkInAt) {
          console.warn('[BreakLocation] GPS read timed out on break end — allowing break close since shift is active.');
          return null;
        }
      }
      return `GPS Location Required: enable location permissions to ${verb} a break. Breaks may only be taken at the company office.`;
    }

    const distanceMeters = calculateGpsDistanceMeters(
      coords.lat, coords.lon, companyWorkZone.latitude, companyWorkZone.longitude
    );
    const radius = companyWorkZone.radiusMeters || settings.allowedRadiusMeters || 300;
    if (distanceMeters > radius) {
      // If ending break and just outside radius by small margin, allow grace if checked in at office
      if (action === 'end') {
        const todayRec = resolveAttendanceRecord(attendance, emp, todayStr);
        if (todayRec?.locationVerified && distanceMeters <= radius + 150) {
          console.warn(`[BreakLocation] Break end within GPS drift tolerance (${distanceMeters}m vs ${radius}m)`);
          return null;
        }
      }
      return `Break Blocked: You are ${distanceMeters}m away from the company office (Allowed limit: ${radius}m). Breaks may only be taken at the office. Submit a WFH request to work from home.`;
    }

    return null;
  };

  const recordCheckIn = async (
    employeeId: string, 
    lat?: number, 
    lon?: number, 
    arg4?: number | AttendanceMethod, 
    arg5?: number | AttendanceMethod,
    customDate?: string
  ): Promise<{ success: boolean; message: string; record?: AttendanceRecord }> => {
    let accuracy = 8;
    let method: AttendanceMethod = 'Self Portal';

    if (typeof arg4 === 'number') {
      accuracy = arg4;
      if (typeof arg5 === 'string' && arg5) method = arg5 as AttendanceMethod;
    } else if (typeof arg4 === 'string' && arg4) {
      method = arg4 as AttendanceMethod;
      if (typeof arg5 === 'number') accuracy = arg5;
    }

    if (!navigator.onLine) {
      return { success: false, message: 'SECURITY ALERT: Airplane mode or offline connection detected. Check-In blocked.' };
    }

    const emp = findEmployee(employeeId);
    if (!emp) {
      return { success: false, message: 'Employee not found.' };
    }

    const empUid = getCanonicalEmployeeUid(emp, user?.uid);
    const todayStr = customDate || getEmployeeWorkDate(new Date());
    const recordId = getAttendanceDocId(empUid, todayStr);

    // ROOT-CAUSE FIX: prioritize the canonical doc ({uid}_{date}) and any duplicate
    // that actually has checkInAt — a bare OR-find could match a stale blank legacy
    // duplicate, let evaluateAttendanceScan allow CHECK_IN, and then the transaction
    // would reject with "Already checked in for today."
    const existingRec = resolveAttendanceRecord(attendance, { ...emp, uid: empUid }, todayStr);

    // B27 FIX: gate the WFH carve-out strictly on the stable employee code. The former
    // name/email substring tests also matched any employee with "asbin" anywhere in
    // their identity (e.g. "Jasbinder"), wrongly denying them approved WFH. The explicit
    // employeeId was already the canonical target of this OR, so behaviour for the
    // intended employee is unchanged. Now shared with the break geofence through
    // isApprovedWfhToday, so check-in, check-out and breaks cannot drift apart.
    const isApprovedWfh = isApprovedWfhToday(emp, todayStr);

    const isSelfCheckIn = !!emp && !!activeEmployee && (
      emp.id === activeEmployee.id ||
      emp.employeeId === activeEmployee.employeeId ||
      emp.uid === activeEmployee.uid
    );
    const isAdminCheckIn = !isSelfCheckIn && (
      role === 'SUPER_ADMIN' || role === 'HR_ADMIN' ||
      activeEmployee?.role === 'SUPER_ADMIN' || activeEmployee?.role === 'HR_ADMIN'
    );

    let coords = (lat !== undefined && lon !== undefined) ? { lat, lon } : null;
    if (!coords && !isApprovedWfh && !isAdminCheckIn && settings.gpsRequired !== false) {
      coords = await getCurrentPositionOrNull();
    }
    const finalLat = coords?.lat ?? lat;
    const finalLon = coords?.lon ?? lon;

    const effectiveSettings: CompanySettings = {
      ...settings,
      officeLatitude: companyWorkZone.latitude,
      officeLongitude: companyWorkZone.longitude,
      allowedRadiusMeters: companyWorkZone.radiusMeters,
      gpsRequired: !isAdminCheckIn && settings.gpsRequired !== false
    };

    const evalResult = evaluateAttendanceScan(emp, existingRec, effectiveSettings, finalLat, finalLon, isApprovedWfh || isAdminCheckIn);

    if (!evalResult.allowed && evalResult.action === 'CHECK_IN' && !isAdminCheckIn) {
      return { success: false, message: evalResult.message };
    }

    const distMeters = (finalLat !== undefined && finalLon !== undefined)
      ? calculateGpsDistanceMeters(finalLat, finalLon, companyWorkZone.latitude, companyWorkZone.longitude)
      : 0;

    // ATOMIC IDEMPOTENT TRANSACTION
    const docRef = doc(db, 'attendance', recordId);
    try {
      const txResult = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (docSnap.exists()) {
          const existingData = docSnap.data();
          if (existingData.checkInAt) {
            // Idempotent: already checked in!
            return {
              alreadyCheckedIn: true,
              data: existingData,
              message: 'Already checked in for today.'
            };
          }
        }

        const payload = {
          id: recordId,
          uid: empUid,
          employeeUid: empUid,
          // P0 FIX: the REAL Firebase auth uid of whoever performed this
          // check-in. `uid`/`employeeUid` above both come from
          // getCanonicalEmployeeUid(), which for the 15 seeded accounts returns
          // the demoData PLACEHOLDER 'uid-KSS...' — so neither could ever match
          // request.auth.uid, and the security rules had no cheap way to prove
          // the owner. Recording it makes ownership provable from this document
          // alone (see ownsAttendanceData() in firestore.rules) with no
          // cross-document get() and no dependency on the fire-and-forget
          // users/{uid} mapping. Self check-ins only: when HR/PM checks somebody
          // else in, the field is left unset rather than falsely claiming them.
          authUid: (user?.uid && getCanonicalEmployeeUid(emp, user.uid) === empUid && (
            emp.uid === user.uid || emp.id === user.uid ||
            (emp.email && user.email && emp.email.toLowerCase() === user.email.toLowerCase())
          )) ? user.uid : null,
          employeeId: emp.id,
          employeeCode: emp.employeeId,
          employeeName: emp.fullName,
          department: emp.department || 'Engineering',
          pmUid: emp.pmUid || emp.reportingManagerUid || '',
          date: todayStr,
          checkInAt: serverTimestamp(),
          checkOutAt: null,
          workingMinutes: 0,
          status: evalResult.status,
          attendanceMethod: method,
          officeLatitude: companyWorkZone.latitude,
          officeLongitude: companyWorkZone.longitude,
          officeRadiusMeters: companyWorkZone.radiusMeters,
          distanceFromOffice: distMeters,
          locationAccuracy: accuracy,
          locationVerified: evalResult.locationVerified,
          latitude: lat !== undefined ? lat : null,
          longitude: lon !== undefined ? lon : null,
          deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser Scanner Terminal',
          breaks: [],
          totalBreakMinutes: 0,
          isWfh: !!isApprovedWfh,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        transaction.set(docRef, cleanFirestorePayload(payload), { merge: true });
        return {
          alreadyCheckedIn: false,
          data: payload,
          message: evalResult.message
        };
      });

      addAuditLog('ATTENDANCE_CHECKIN', `${emp.employeeId} (${emp.fullName})`, `Status: ${evalResult.status}, GPS: ${evalResult.locationVerified ? 'Verified' : 'Unverified'} (${distMeters}m from office)`);

      const checkInIsoStr = formatTimestampToISO(txResult.data?.checkInAt) || new Date().toISOString();
      const resolvedRec: AttendanceRecord = {
        ...txResult.data,
        id: recordId,
        uid: empUid,
        employeeUid: empUid,
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        date: todayStr,
        checkInAt: checkInIsoStr
      } as AttendanceRecord;

      // Immediately sync state so UI reflects Shift Active without delay
      setAttendance(prev => {
        const map = new Map<string, AttendanceRecord>();
        prev.forEach(r => map.set(r.id, r));
        map.set(recordId, resolvedRec);
        return Array.from(map.values());
      });

      return { 
        success: true, 
        message: txResult.message, 
        record: resolvedRec
      };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, `attendance/${recordId}`);
      return { success: false, message: err.message || 'Check-In failed.' };
    }
  };

  const recordCheckOut = async (
    employeeId: string, 
    lat?: number, 
    lon?: number, 
    accuracy?: number,
    customDate?: string
  ): Promise<{ success: boolean; message: string; record?: AttendanceRecord }> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, message: 'SECURITY ALERT: Airplane mode or offline connection detected. Check-Out blocked.' };
    }

    const emp = findEmployee(employeeId);
    if (!emp) {
      return { success: false, message: 'Employee not found.' };
    }

    const empUid = getCanonicalEmployeeUid(emp, user?.uid);
    const todayStr = customDate || getEmployeeWorkDate(new Date());
    const canonicalId = getAttendanceDocId(empUid, todayStr);

    // Canonical ID lookup first, then any duplicate that actually has attendance data.
    // Never target a stale blank legacy doc — that would split check-in/check-out
    // across two Firestore documents.
    const existingRec = resolveAttendanceRecord(attendance, { ...emp, uid: empUid }, todayStr);
    const recordId = existingRec?.id ?? canonicalId;

    // B27 FIX: gate the WFH carve-out strictly on the stable employee code. The former
    // name/email substring tests also matched any employee with "asbin" anywhere in
    // their identity (e.g. "Jasbinder"), wrongly denying them approved WFH. The explicit
    // employeeId was already the canonical target of this OR, so behaviour for the
    // intended employee is unchanged. Now shared with the break geofence through
    // isApprovedWfhToday, so check-in, check-out and breaks cannot drift apart.
    const isApprovedWfh = isApprovedWfhToday(emp, todayStr);

    let coords = (lat !== undefined && lon !== undefined) ? { lat, lon } : null;
    if (!coords && !isApprovedWfh && settings.gpsRequired !== false) {
      coords = await getCurrentPositionOrNull();
    }
    const finalLat = coords?.lat ?? lat;
    const finalLon = coords?.lon ?? lon;

    const isGpsEnforced = settings.gpsRequired !== false;

    // Strict GPS geofence enforcement on Check-Out
    if (!isApprovedWfh && isGpsEnforced) {
      if (finalLat === undefined || finalLon === undefined) {
        return {
          success: false,
          message: 'GPS Location Required: Enable location permissions to check out. Check-out must strictly be performed at the company office.'
        };
      }

      const checkoutDistance = calculateGpsDistanceMeters(
        finalLat,
        finalLon,
        companyWorkZone.latitude,
        companyWorkZone.longitude
      );
      const radius = companyWorkZone.radiusMeters || settings.allowedRadiusMeters || 300;

      if (checkoutDistance > radius) {
        return {
          success: false,
          message: `Check-Out Blocked: You are ${checkoutDistance}m away from the company office (Allowed limit: ${radius}m). On normal office days, check-out must strictly be performed at the company office.`
        };
      }
    }

    // ATOMIC IDEMPOTENT TRANSACTION
    const docRef = doc(db, 'attendance', recordId);

    try {
      const txResult = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
          throw new Error('No attendance record found for today. Please check in first.');
        }

        const existingData = docSnap.data();
        if (!existingData.checkInAt) {
          throw new Error('No active check-in record found for today.');
        }

        if (existingData.checkOutAt) {
          // Idempotent: already checked out!
          return {
            alreadyCheckedOut: true,
            data: existingData,
            message: 'Employee has already checked out for today.'
          };
        }

        const distMeters = (finalLat !== undefined && finalLon !== undefined)
          ? calculateGpsDistanceMeters(finalLat, finalLon, companyWorkZone.latitude, companyWorkZone.longitude)
          : (existingData.distanceFromOffice || 0);

        // Compute workingMinutes inside checkout transaction from the read snapshot
        const checkInISO = formatTimestampToISO(existingData.checkInAt) || new Date().toISOString();
        const checkInMs = new Date(checkInISO).getTime();
        const nowMs = Date.now();

        const existingBreaks = Array.isArray(existingData.breaks) ? existingData.breaks : [];
        let updatedBreaks = existingBreaks;
        let additionalBreakMins = 0;
        const openBreak = existingBreaks.find((b: any) => !b.endAt && !(b as any).endTime);

        if (openBreak) {
          const bStartIso = formatTimestampToISO(openBreak.startAt || (openBreak as any).startTime) || new Date(nowMs).toISOString();
          additionalBreakMins = Math.max(1, Math.floor((nowMs - new Date(bStartIso).getTime()) / 60000));
          const nowIso = new Date(nowMs).toISOString();
          updatedBreaks = existingBreaks.map((b: any) => {
            const isOpen = !b.endAt && !(b as any).endTime;
            return isOpen
              ? {
                  ...b,
                  startAt: formatTimestampToISO(b.startAt || (b as any).startTime) || bStartIso,
                  endAt: nowIso,
                  endTime: nowIso,
                  durationMinutes: additionalBreakMins
                }
              : b;
          });
        }

        const finalTotalBreakMinutes = updatedBreaks.reduce((acc: number, b: any) => acc + (Number(b.durationMinutes) || 0), 0);
        let durationMins = Math.floor((nowMs - checkInMs) / 60000);
        if (finalTotalBreakMinutes > 0) {
          durationMins = Math.max(0, durationMins - finalTotalBreakMinutes);
        }
        durationMins = Math.max(1, durationMins);

        const updates = {
          checkOutAt: serverTimestamp(),
          workingMinutes: durationMins,
          breaks: updatedBreaks,
          totalBreakMinutes: finalTotalBreakMinutes,
          officeLatitude: existingData.officeLatitude || companyWorkZone.latitude,
          officeLongitude: existingData.officeLongitude || companyWorkZone.longitude,
          officeRadiusMeters: existingData.officeRadiusMeters || companyWorkZone.radiusMeters,
          distanceFromOffice: distMeters,
          locationAccuracy: accuracy || existingData.locationAccuracy || 8,
          locationVerified: existingData.locationVerified !== undefined ? existingData.locationVerified : true,
          updatedAt: serverTimestamp()
        };

        transaction.update(docRef, cleanFirestorePayload(updates));
        return {
          alreadyCheckedOut: false,
          data: { ...existingData, ...updates, checkOutAt: new Date().toISOString() },
          message: isApprovedWfh
            ? 'Checked Out Successfully — Work From Home Completed'
            : 'Checked Out Successfully — Shift Completed'
        };
      });

      addAuditLog('ATTENDANCE_CHECKOUT', `${emp.employeeId} (${emp.fullName})`, `Duration: ${Math.floor((txResult.data.workingMinutes || 0) / 60)}h ${(txResult.data.workingMinutes || 0) % 60}m`);

      // BUG 5 FIX: Optimistic local state update — the UI reflects "Shift Complete"
      // immediately without waiting for the Firestore onSnapshot (~200–500 ms).
      // The subsequent real snapshot will reconcile any minor timestamp drift.
      const checkOutIso = new Date().toISOString();
      setAttendance(prev => prev.map(a => {
        if (a.id !== recordId) return a;
        return {
          ...a,
          checkOutAt: checkOutIso,
          workingMinutes: typeof txResult.data.workingMinutes === 'number'
            ? txResult.data.workingMinutes
            : a.workingMinutes,
          breaks: Array.isArray(txResult.data.breaks)
            ? txResult.data.breaks.map((b: any) => ({
                type: b.type,
                startAt: formatTimestampToISO(b.startAt || b.startTime) || '',
                endAt: formatTimestampToISO(b.endAt || b.endTime),
                durationMinutes: Number(b.durationMinutes) || 0
              }))
            : a.breaks,
          totalBreakMinutes: typeof txResult.data.totalBreakMinutes === 'number'
            ? txResult.data.totalBreakMinutes
            : a.totalBreakMinutes,
          updatedAt: checkOutIso
        };
      }));

      return {
        success: true,
        message: txResult.message,
        record: txResult.data as AttendanceRecord
      };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${recordId}`);
      return { success: false, message: err.message || 'Check-Out failed.' };
    }
  };

  const startBreak = async (employeeId: string, breakType: BreakType | string, lat?: number, lon?: number) => {
    // Breaks are office-only, same rule as check-in. Enforced BEFORE the transaction
    // so a rejected break never touches the attendance document.
    const locationBlock = await verifyBreakLocation(employeeId,'start', lat, lon);
    if (locationBlock) return { success: false, message: locationBlock };

    const canonicalBreakType = (normalizeBreakType(breakType) || 'Meal Break') as BreakType;

    const emp = findEmployee(employeeId);
    // BUG 4 FIX: Same canonical UID as recordCheckIn/endBreak — single doc target.
    const empUid = getCanonicalEmployeeUid(emp, user?.uid);
    const todayStr = getWorkDate(new Date());
    const canonicalId = getAttendanceDocId(empUid, todayStr);

    // Canonical ID first, then any duplicate with real attendance data
    const existingRec = resolveAttendanceRecord(attendance, { ...(emp || { id: employeeId }), uid: empUid }, todayStr);
    const recordId = existingRec?.id ?? canonicalId;
    const docRef = doc(db, 'attendance', recordId);

    const nowISO = new Date().toISOString();

    try {
      const res = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        let existingBreaks: any[] = [];
        // P0 FIX: a break must NEVER create the attendance document. The former
        // `else` branch wrote a record carrying only { breaks } — no date, no
        // checkInAt, no status — which the listener then materialised as "Present"
        // (`data.status || 'Present'`), counted the employee present without a
        // check-in, hid the doc from every orderBy('date') query, and was silently
        // wiped to `breaks: []` by the next check-in's merge. An open shift is now
        // a precondition.
        if (!docSnap.exists()) {
          throw new Error('Please check in before starting a break.');
        }
        const data = docSnap.data();
        if (data.checkInAt == null) {
          throw new Error('Please check in before starting a break.');
        }
        if (data.checkOutAt) {
          throw new Error('You have already checked out for today.');
        }
        existingBreaks = Array.isArray(data.breaks) ? data.breaks : [];

        // Auto-close any previous unclosed break before starting the new one
        const sanitizedBreaks = existingBreaks.map((b: any) => {
          if (!b.endAt && !(b as any).endTime) {
            const startIso = formatTimestampToISO(b.startAt || (b as any).startTime) || nowISO;
            const diffMs = Math.max(0, new Date(nowISO).getTime() - new Date(startIso).getTime());
            return {
              ...b,
              startAt: startIso,
              endAt: nowISO,
              endTime: nowISO,
              durationMinutes: Math.max(1, Math.min(MAX_BREAK_MINUTES, Math.round(diffMs / 60000)))
            };
          }
          return b;
        });

        const newBreak = { type: canonicalBreakType, startAt: nowISO, startTime: nowISO, endAt: null, durationMinutes: 0 };
        const updatedBreaks = [...sanitizedBreaks, newBreak];
        const totalBreakMins = calculateTotalBreakMinutes(updatedBreaks);

        // Doc is guaranteed to exist and be checked-in (guarded above) — always an
        // update, never a create that could mint a phantom attendance record.
        transaction.update(docRef, cleanFirestorePayload({
          breaks: updatedBreaks,
          totalBreakMinutes: totalBreakMins,
          updatedAt: serverTimestamp()
        }));

        return { 
          success: true, 
          message: `${breakType} started!`,
          breaks: updatedBreaks,
          totalBreakMinutes: totalBreakMins
        };
      });

      // Optimistically update React state immediately
      setAttendance(prev => {
        return prev.map(rec => {
          if (rec.id === recordId || (rec.employeeId === emp?.id && rec.date === todayStr)) {
            const currentBreaks = (rec.breaks || []).map((b: any) => {
              if (!b.endAt && !(b as any).endTime) {
                return { ...b, endAt: nowISO, endTime: nowISO, durationMinutes: 1 };
              }
              return b;
            });
            const newBreaks = [...currentBreaks, { type: breakType, startAt: nowISO, startTime: nowISO, endAt: null, durationMinutes: 0 }];
            return {
              ...rec,
              breaks: (res as any).breaks || newBreaks,
              totalBreakMinutes: (res as any).totalBreakMinutes || calculateTotalBreakMinutes(newBreaks)
            };
          }
          return rec;
        });
      });

      addAuditLog('ATTENDANCE_BREAK_START', emp?.fullName || empUid, `Started ${breakType}`);
      return res;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${recordId}`);
      return { success: false, message: err.message || 'Failed to start break.' };
    }
  };

  const endBreak = async (employeeId: string, lat?: number, lon?: number) => {
    // Symmetric with startBreak: a break must also be CLOSED at the office, otherwise
    // an employee could start one on site, leave, and stop the clock from home.
    const locationBlock = await verifyBreakLocation(employeeId,'end', lat, lon);
    if (locationBlock) return { success: false, message: locationBlock };

    const emp = findEmployee(employeeId);
    // BUG 4 FIX: Same canonical UID as recordCheckIn/startBreak — single doc target.
    const empUid = getCanonicalEmployeeUid(emp, user?.uid);
    const todayStr = getWorkDate(new Date());
    const canonicalId = getAttendanceDocId(empUid, todayStr);

    // Canonical ID first, then any duplicate with real attendance data (never a stale blank legacy doc)
    const existingRec = resolveAttendanceRecord(attendance, { ...(emp || { id: employeeId }), uid: empUid }, todayStr);
    const recordId = existingRec?.id ?? canonicalId;
    const docRef = doc(db, 'attendance', recordId);

    const nowMs = Date.now();
    const nowISO = new Date(nowMs).toISOString();

    try {
      const res = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        let existingBreaks: any[] = [];
        // P0/P1 FIX (mirror of startBreak): never create the attendance doc from a
        // break, and never mutate a completed shift. Closing a break on a checked-out
        // record leaves workingMinutes (already derived from the final break total)
        // untouched, so the record then reports more break time than the shift holds.
        if (!docSnap.exists()) {
          throw new Error('No attendance record found for today. Please check in first.');
        }
        const data = docSnap.data();
        if (data.checkOutAt) {
          throw new Error('Shift already completed — breaks can no longer be modified.');
        }
        existingBreaks = Array.isArray(data.breaks) ? data.breaks : [];

        // B18 FIX: derive the open break from the authoritative in-transaction doc
        // only. The former `|| existingRec?.breaks?.find(...)` fallback read stale
        // React state, so when the server doc had no open break the user was shown
        // "…completed! (N mins total)" for a break that was never written.
        const openBreak = existingBreaks.find((b: any) => !b.endAt && !(b as any).endTime);

        let breakMins = 1;
        if (openBreak) {
          const startIso = formatTimestampToISO(openBreak.startAt || (openBreak as any).startTime) || nowISO;
          const diffMs = Math.max(0, nowMs - new Date(startIso).getTime());
          breakMins = Math.max(1, Math.min(MAX_BREAK_MINUTES, Math.round(diffMs / 60000)));
        }

        const updatedBreaks = existingBreaks.map((b: any) => {
          const isOpen = !b.endAt && !(b as any).endTime;
          if (isOpen) {
            const startIso = formatTimestampToISO(b.startAt || (b as any).startTime) || nowISO;
            const diffMs = Math.max(0, nowMs - new Date(startIso).getTime());
            const mins = Math.max(1, Math.min(MAX_BREAK_MINUTES, Math.round(diffMs / 60000)));
            return {
              ...b,
              startAt: startIso,
              endAt: nowISO,
              endTime: nowISO,
              durationMinutes: mins
            };
          }
          return b;
        });

        const totalBreakMins = calculateTotalBreakMinutes(updatedBreaks);

        // Doc is guaranteed to exist and be open (guarded above) — always an update.
        transaction.update(docRef, cleanFirestorePayload({
          breaks: updatedBreaks,
          totalBreakMinutes: totalBreakMins,
          updatedAt: serverTimestamp()
        }));

        return { 
          success: true, 
          message: `${openBreak?.type || 'Break'} completed! (${breakMins} mins total)`,
          breaks: updatedBreaks,
          totalBreakMinutes: totalBreakMins
        };
      });

      // ALWAYS close open breaks in local state immediately
      setAttendance(prev => {
        return prev.map(rec => {
          if (rec.id === recordId || (rec.employeeId === emp?.id && rec.date === todayStr)) {
            const updated = (rec.breaks || []).map((b: any) => {
              if (!b.endAt && !(b as any).endTime) {
                const s = formatTimestampToISO(b.startAt || (b as any).startTime) || nowISO;
                const dMs = Math.max(0, nowMs - new Date(s).getTime());
                return {
                  ...b,
                  startAt: s,
                  endAt: nowISO,
                  endTime: nowISO,
                  durationMinutes: Math.max(1, Math.min(MAX_BREAK_MINUTES, Math.round(dMs / 60000)))
                };
              }
              return b;
            });
            return {
              ...rec,
              breaks: (res as any).breaks || updated,
              totalBreakMinutes: (res as any).totalBreakMinutes || calculateTotalBreakMinutes(updated)
            };
          }
          return rec;
        });
      });

      addAuditLog('ATTENDANCE_BREAK_END', emp?.fullName || empUid, res.message);
      return res;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${recordId}`);
      // P1 FIX: this previously patched local state to "closed" and returned
      // success:true. The write had NOT persisted, so the very next onSnapshot
      // replaced state wholesale and the break re-opened with its timer running,
      // while the user had been told it synced. Report the failure honestly and
      // leave the break open so a retry is possible; the listener remains the single
      // source of truth for the record's real state.
      return { success: false, message: err?.message || 'Break could not be saved. Please try again.' };
    }
  };

  const updateAttendanceRecord = async (recordId: string, updates: Partial<AttendanceRecord>): Promise<void> => {
    // Write directly to Firestore with serverTimestamp — real-time onSnapshot updates UI seamlessly
    const cleanUpdates = cleanFirestorePayload({ ...updates, updatedAt: serverTimestamp() });
    try {
      await setDoc(doc(db, 'attendance', recordId), cleanUpdates, { merge: true });
      addAuditLog('ATTENDANCE_CORRECTION', `Record ${recordId}`, `Updated fields: ${Object.keys(updates).join(', ')}`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${recordId}`);
      throw err;
    }
  };

  /**
   * Attendance correction for HR / PM — the ONLY sanctioned way to amend a day.
   *
   * Handles both cases the admin table can now surface:
   *
   *  • A STORED record → a plain merge onto its existing document.
   *  • A SYNTHETIC roster row (an absentee, who by definition has no document —
   *    see buildDailyRoster) → materialises a real record at the CANONICAL id
   *    `{uid}_{YYYY-MM-DD}` with the full field set. Merging onto the synthetic
   *    `synthetic_*` id would have created a junk document under a fabricated
   *    key, invisible to every resolver and missing date/employeeId/status.
   */
  const applyAttendanceCorrection = async (
    record: AttendanceRecord & { isSynthetic?: boolean },
    updates: Partial<AttendanceRecord>
  ): Promise<{ success: boolean; message: string }> => {
    if (!record) return { success: false, message: 'No attendance record supplied.' };

    const emp = findEmployee(record.employeeId) || findEmployee(record.employeeCode);
    const targetId = record.isSynthetic
      ? getAttendanceDocId(getCanonicalEmployeeUid(emp || record, undefined), record.date)
      : record.id;

    // A synthetic row has no stored doc, so the write must carry every field the
    // listeners and queries depend on — not just the corrected ones.
    const seed = record.isSynthetic
      ? {
          id: targetId,
          uid: getCanonicalEmployeeUid(emp || record, undefined),
          employeeUid: getCanonicalEmployeeUid(emp || record, undefined),
          employeeId: record.employeeId,
          employeeCode: record.employeeCode,
          employeeName: record.employeeName,
          department: record.department || 'Engineering',
          pmUid: emp?.pmUid || emp?.reportingManagerUid || '',
          date: record.date,
          checkInAt: null,
          checkOutAt: null,
          workingMinutes: 0,
          attendanceMethod: 'HR_CORRECTION',
          locationVerified: false,
          breaks: [],
          totalBreakMinutes: 0,
          createdAt: serverTimestamp()
        }
      : {};

    const payload = cleanFirestorePayload({
      ...seed,
      ...updates,
      correctedBy: activeEmployee?.fullName || user?.email || 'System',
      correctedByUid: user?.uid || null,
      correctedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    try {
      await setDoc(doc(db, 'attendance', targetId), payload, { merge: true });
      addAuditLog(
        'ATTENDANCE_CORRECTION',
        record.employeeName || targetId,
        `${record.isSynthetic ? 'Created' : 'Updated'} ${record.date}: ${Object.keys(updates).join(', ')}`
      );
      return { success: true, message: `Attendance for ${record.employeeName || 'employee'} updated.` };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${targetId}`);
      return { success: false, message: err?.message || 'Attendance correction failed.' };
    }
  };

  const updateSettings = (newSettings: Partial<CompanySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    // B23 FIX: merge instead of full overwrite. saveCompanyWorkZone persists the GPS
    // fields (officeLatitude/Longitude, allowedRadiusMeters, officeName) into this same
    // settings/global doc. A plain setDoc rewrote the whole document from the local
    // `settings` snapshot, so any field present server-side but absent from stale local
    // state — e.g. GPS coordinates written by another admin/session before this client
    // hydrated — was silently erased. merge writes only the supplied keys.
    setDoc(doc(db, 'settings', 'global'), updated, { merge: true }).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    });

    addAuditLog('SETTINGS_UPDATED', 'Company Policy', 'Updated system preferences and GPS/shift rules');
  };

  const saveCompanyWorkZone = async (zone: Partial<WorkZone>) => {
    const updated: WorkZone = {
      name: zone.name || companyWorkZone.name || 'Kalpanaaa Software Solutions HQ',
      latitude: zone.latitude !== undefined ? Number(zone.latitude) : companyWorkZone.latitude,
      longitude: zone.longitude !== undefined ? Number(zone.longitude) : companyWorkZone.longitude,
      radiusMeters: zone.radiusMeters !== undefined ? Number(zone.radiusMeters) : companyWorkZone.radiusMeters,
      active: true,
      updatedBy: activeEmployee?.fullName || activeEmployee?.email || 'Authorized HR / CEO / CTO',
      updatedAt: new Date().toISOString()
    };

    setCompanyWorkZone(updated);
    localStorage.setItem('kss_v1_work_zone', JSON.stringify(updated));

    // Also update settings global object
    updateSettings({
      officeName: updated.name,
      officeLatitude: updated.latitude,
      officeLongitude: updated.longitude,
      allowedRadiusMeters: updated.radiusMeters
    });

    // Write to Firestore workZones/company
    await setDoc(doc(db, 'workZones', 'company'), updated).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, 'workZones/company');
    });

    addAuditLog('COMPANY_WORKZONE_UPDATED', updated.name, `Lat: ${updated.latitude}, Lon: ${updated.longitude}, Radius: ${updated.radiusMeters}m`);
  };

  const submitLeaveRequest = async (data: Omit<LeaveRequest, 'id' | 'status' | 'requestDate' | 'createdAt' | 'updatedAt'>) => {
    const emp = activeEmployee;
    const empId = data.employeeId || emp?.employeeId || emp?.id || `EMP-${Date.now().toString().slice(-6)}`;
    const empName = data.employeeName || emp?.fullName || 'Employee';
    const empDept = data.department || emp?.department || 'Engineering';
    const empRole = data.employeeRole || emp?.role || 'EMPLOYEE';
    const empUid = data.employeeUid || emp?.uid || user?.uid || '';
    const pmUid = data.pmUid || emp?.pmUid || emp?.reportingManagerUid || 'uid-KSS2407003';

    const isPmOrHrOrExec = empRole === 'PROJECT_MANAGER' || empRole === 'HR_ADMIN' || empRole === 'SUPER_ADMIN' ||
      empDept.toLowerCase().includes('hr') || empDept.toLowerCase().includes('management') ||
      (emp?.designation || '').toLowerCase().includes('project manager') ||
      empName.toLowerCase().includes('koushik') || empName.toLowerCase().includes('abhinaya');

    const result = await LeaveService.submitLeaveRequest({
      ...data,
      employeeUid: empUid,
      employeeId: empId,
      employeeName: empName,
      department: empDept,
      employeeRole: empRole,
      pmUid: pmUid,
      pmStatus: isPmOrHrOrExec ? 'N/A' : 'Pending',
      hrStatus: isPmOrHrOrExec ? 'N/A' : 'Waiting PM',
      ceoStatus: isPmOrHrOrExec ? 'Pending' : 'Waiting HR',
      ctoStatus: 'Waiting CEO',
    });

    const isWfh = data.type === 'WFH';
    const eventType = isWfh ? 'WFH_REQUEST_SUBMITTED' : 'LEAVE_REQUEST_SUBMITTED';

    sendKssNotification(
      eventType,
      isWfh ? `🏠 WFH Request: ${empName}` : `📋 Leave Request: ${empName}`,
      `${empName} requested ${data.type} (${data.startDate} to ${data.endDate}). Reason: "${data.reason}". ${isPmOrHrOrExec ? 'Pending CEO & CTO approval.' : 'Pending PM, HR, CEO & CTO approval.'}`,
      {
        actorId: empId,
        actorName: empName,
        targetEmployeeId: empId,
        targetEmployeeName: empName,
        overrideAudience: ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'],
        metadata: {
          requestId: result.id,
          requestType: data.type,
          startDate: data.startDate,
          endDate: data.endDate,
          reason: data.reason
        }
      }
    );

    addAuditLog('LEAVE_REQUEST', empName, `Submitted ${data.type} request from ${data.startDate} to ${data.endDate}`);
    return result;
  };

  const updateLeaveRequestStage = async (
    id: string,
    stage: 'PM' | 'HR' | 'CEO' | 'CTO',
    decision: 'Approved' | 'Rejected',
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ) => {
    const targetReq = leaveRequests.find(r => r.id === id);
    const empId = employeeId || targetReq?.employeeId || '';
    const sDate = startDate || targetReq?.startDate || '';
    const eDate = endDate || targetReq?.endDate || '';
    const revUid = user?.uid || activeEmployee?.uid || 'uid-exec';
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    // 1. INSTANT 0ms Optimistic State Update for ultra-fast, smooth UI
    setLeaveRequests(prev => {
      const updated = prev.map(req => {
        if (req.id !== id) return req;
        const copy: LeaveRequest = { 
          ...req, 
          updatedAt: nowIso 
        };

        if (stage === 'PM') {
          copy.pmStatus = decision;
          copy.pmRecommendation = decision;
          copy.pmReviewedBy = revUid;
          copy.pmReviewedAt = nowIso;
          copy.pmNotes = notes || '';
          copy.hrStatus = isApproved ? 'Pending' : (copy.hrStatus || 'Waiting PM');
          if (!isApproved) copy.status = 'Rejected';
        } else if (stage === 'HR') {
          copy.hrStatus = decision;
          copy.hrReviewedBy = revUid;
          copy.hrReviewedAt = nowIso;
          copy.hrNotes = notes || '';
          copy.ceoStatus = isApproved ? 'Pending' : (copy.ceoStatus || 'Waiting HR');
          // If PM was pending, mark PM sanctioned as well
          if (copy.pmStatus === 'Pending' && isApproved) {
            copy.pmStatus = 'Approved';
          }
          if (!isApproved) copy.status = 'Rejected';
        } else if (stage === 'CEO') {
          copy.ceoStatus = decision;
          copy.ceoReviewedBy = revUid;
          copy.ceoReviewedAt = nowIso;
          copy.ceoNotes = notes || '';
          copy.ctoStatus = isApproved ? 'Pending' : (copy.ctoStatus || 'Waiting CEO');
          if (!isApproved) copy.status = 'Rejected';
        } else if (stage === 'CTO') {
          copy.ctoStatus = decision;
          copy.ctoReviewedBy = revUid;
          copy.ctoReviewedAt = nowIso;
          copy.ctoNotes = notes || '';
          copy.status = isApproved ? 'Approved' : 'Rejected';
        }

        return copy;
      });

      localStorage.setItem('kss_v1_leave_requests', JSON.stringify(updated));
      return updated;
    });

    // 2. Broadcast across tabs immediately
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kss_app_events');
        channel.postMessage({ type: 'UPDATE_LEAVE_REQUEST', payload: { id, stage, decision } });
      } catch {}
    }

    // 3. Persist to Firestore via LeaveService asynchronously
    try {
      if (stage === 'PM') {
        await LeaveService.reviewPmStage(id, decision, revUid, reviewerName, notes, empId, sDate, eDate);
      } else if (stage === 'HR') {
        await LeaveService.reviewHrStage(id, decision, revUid, reviewerName, notes, empId, sDate, eDate);
      } else if (stage === 'CEO') {
        await LeaveService.reviewCeoStage(id, decision, revUid, reviewerName, notes, empId, sDate, eDate);
      } else if (stage === 'CTO') {
        await LeaveService.reviewCtoStage(id, decision, revUid, reviewerName, notes, empId, sDate, eDate);
      }
    } catch (fsErr) {
      console.warn('[AuthContext] Firestore stage update error:', fsErr);
    }

    // 4. Dispatch real-time in-app notification for stage decision
    sendKssNotification(
      decision === 'Approved' ? 'LEAVE_REQUEST_APPROVED' : 'LEAVE_REQUEST_REJECTED',
      decision === 'Approved' ? `✅ ${targetReq?.type || 'Request'} Approved (${stage} Stage)` : `❌ ${targetReq?.type || 'Request'} Rejected (${stage} Stage)`,
      `${targetReq?.type || 'Request'} for ${targetReq?.employeeName || 'Employee'} (${sDate} to ${eDate}) was ${decision.toLowerCase()} by ${reviewerName} (${stage} Stage).`,
      {
        actorId: activeEmployee?.id || 'exec',
        actorName: reviewerName,
        targetEmployeeId: targetReq?.employeeId || '',
        targetEmployeeName: targetReq?.employeeName || '',
        overrideAudience: ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER', 'EMPLOYEE'],
        metadata: {
          requestId: id,
          stage,
          decision,
          reviewerName
        }
      }
    );

    // If final CTO or Executive approval and WFH, add to approvedWfhDates
    if (stage === 'CTO' && decision === 'Approved' && targetReq?.type === 'WFH') {
      const targetEmp = employees.find(e => e.employeeId === targetReq.employeeId || e.id === targetReq.employeeId);
      if (targetEmp) {
        const dates = new Set<string>(targetEmp.approvedWfhDates || []);
        let curr = new Date(sDate);
        const end = new Date(eDate);
        while (curr <= end) {
          dates.add(curr.toISOString().split('T')[0]);
          curr.setDate(curr.getDate() + 1);
        }
        updateEmployee(targetEmp.id, { approvedWfhDates: Array.from(dates) });
      }
    }

    addAuditLog('LEAVE_STAGE_DECISION', reviewerName, `${stage} ${decision} for leave request ${id}`);
  };

  const updateLeaveRequestStatus = (
    id: string, 
    status: 'Approved' | 'Rejected', 
    reviewedBy: string, 
    reviewNotes?: string,
    targetStage?: 'PM' | 'HR' | 'CEO' | 'CTO'
  ) => {
    let stage: 'PM' | 'CEO' | 'CTO' | 'HR' = targetStage || 'HR';

    if (!targetStage) {
      const desig = (activeEmployee?.designation || '').toUpperCase();
      const empId = activeEmployee?.employeeId || activeEmployee?.id || '';
      const empRole = activeEmployee?.role || role;
      const name = (activeEmployee?.fullName || '').toLowerCase();

      const req = leaveRequests.find(r => r.id === id);

      if (name.includes('gaurav') || desig.includes('CTO') || desig.includes('CIO') || empId === 'CTO001' || empId === 'KSS2407001') {
        stage = 'CTO';
      } else if (name.includes('akshit') || desig.includes('CEO') || empId === 'CEO001' || empId === 'KSS2407002') {
        stage = 'CEO';
      } else if (empRole === 'PROJECT_MANAGER' || desig.includes('PROJECT MANAGER') || name.includes('koushik')) {
        stage = 'PM';
      } else if (empRole === 'HR_ADMIN' || desig.includes('HR') || name.includes('abhinaya')) {
        stage = 'HR';
      } else if (empRole === 'SUPER_ADMIN') {
        if (req) {
          if (req.ctoStatus === 'Pending') stage = 'CTO';
          else if (req.ceoStatus === 'Pending') stage = 'CEO';
          else if (req.hrStatus === 'Pending') stage = 'HR';
          else if (req.pmStatus === 'Pending') stage = 'PM';
          else stage = 'CEO';
        } else {
          stage = 'CEO';
        }
      }
    }

    const targetReq = leaveRequests.find(r => r.id === id);
    updateLeaveRequestStage(id, stage, status, reviewedBy, reviewNotes, targetReq?.employeeId, targetReq?.startDate, targetReq?.endDate);
  };

  const cancelLeaveRequest = async (id: string, employeeId?: string, startDate?: string, endDate?: string) => {
    const targetReq = leaveRequests.find(r => r.id === id);
    const empId = employeeId || targetReq?.employeeId || activeEmployee?.employeeId || '';
    const sDate = startDate || targetReq?.startDate || '';
    const eDate = endDate || targetReq?.endDate || '';

    await LeaveService.cancelRequest(id, empId, sDate, eDate);
    addAuditLog('LEAVE_CANCELLED', activeEmployee?.fullName || 'Employee', `Cancelled leave/WFH request ${id}`);
  };

  const resetToDemoData = () => {
    setEmployees(INITIAL_EMPLOYEES);
    setAttendance(generateInitialAttendance());
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setSettings(INITIAL_COMPANY_SETTINGS);
    const defaultZone: WorkZone = {
      name: 'Kalpanaaa Software Solutions HQ',
      latitude: 13.014333,
      longitude: 77.646000,
      radiusMeters: 100,
      active: true,
      updatedBy: 'System Init',
      updatedAt: new Date().toISOString()
    };
    setCompanyWorkZone(defaultZone);
    localStorage.removeItem('kss_v1_employees');
    localStorage.removeItem('kss_v1_attendance');
    localStorage.removeItem('kss_v1_audit_logs');
    localStorage.removeItem('kss_v1_settings');
    localStorage.removeItem('kss_v1_work_zone');
    localStorage.removeItem('kss_v1_leave_requests');
    setLeaveRequests([]);

    // Re-seed Firestore
    INITIAL_EMPLOYEES.forEach(emp => {
      setDoc(doc(db, 'employees', emp.id), emp).catch(() => { });
    });
    generateInitialAttendance().forEach(att => {
      setDoc(doc(db, 'attendance', att.id), att).catch(() => { });
    });
    setDoc(doc(db, 'settings', 'global'), INITIAL_COMPANY_SETTINGS).catch(() => { });
    setDoc(doc(db, 'workZones', 'company'), defaultZone).catch(() => { });

    addAuditLog('SYSTEM_RESET', 'Database', 'Re-seeded system with demo enterprise workforce dataset');
  };

  // ── Admin Broadcast: send one-click custom notification to all employees ──
  const sendBroadcast = async (title: string, message: string): Promise<void> => {
    if (!activeEmployee) return;

    const newNotif: KssNotification = {
      id: `notif-bc-${Date.now()}`,
      type: 'ADMIN_BROADCAST',
      title,
      body: message,
      audience: ['ALL'],
      actorId: activeEmployee.id,
      actorName: activeEmployee.fullName,
      createdAt: new Date().toISOString()
    };

    // 1. Instantly update local state on current tab
    setNotifications(prev => {
      const updated = [newNotif, ...prev.filter(n => n.id !== newNotif.id)];
      try {
        localStorage.setItem('kss_v1_broadcasts', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 2. Broadcast via BroadcastChannel to all open tabs in 0ms
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('kss_app_events');
        channel.postMessage({ type: 'NEW_BROADCAST', payload: newNotif });
        channel.close();
      } catch {}
    }

    // 3. Write to Firestore permanently for all devices
    await sendAdminBroadcast(title, message, activeEmployee.id, activeEmployee.fullName);
    addAuditLog('ADMIN_BROADCAST', 'All Employees', `Broadcast sent: "${title}" — ${message}`);
  };

  // ── CEO & CTO Exclusive Authority: Assign Office-Wide WFH for Whole Office ──
  const assignCompanyWideWfh = (date: string): { success: boolean; message: string } => {
    const isCeoOrCto = activeEmployee?.role === 'SUPER_ADMIN' ||
      (activeEmployee?.designation || '').toUpperCase().includes('CEO') ||
      (activeEmployee?.designation || '').toUpperCase().includes('CTO') ||
      (activeEmployee?.designation || '').toUpperCase().includes('FOUNDER') ||
      (activeEmployee?.designation || '').toUpperCase().includes('CIO') ||
      activeEmployee?.employeeId === 'CEO001' ||
      activeEmployee?.employeeId === 'CTO001';

    if (!isCeoOrCto) {
      return {
        success: false,
        message: 'SECURITY ACCESS DENIED: Only the CEO (Akshit Ujjain) or CTO (Gaurav Kumar Tripathi) have authority to assign Office-Wide Work From Home.'
      };
    }

    const currentDates = new Set<string>(companyWideWfhDates);
    currentDates.add(date);
    const updatedDates = Array.from(currentDates);

    // ── PRIMARY: Write to dedicated Firestore doc — triggers real-time listener on ALL devices ──
    setDoc(doc(db, 'companyConfig', 'wfhDates'), { dates: updatedDates, updatedAt: new Date().toISOString(), updatedBy: activeEmployee?.fullName || 'CEO/CTO' }).catch(() => {});

    // ── FALLBACK: Also update settings + localStorage ──
    setCompanyWideWfhDates(updatedDates);
    updateSettings({ companyWideWfhDates: updatedDates });
    localStorage.setItem('kss_v1_company_wfh_dates', JSON.stringify(updatedDates));

    // Broadcast official CEO/CTO announcement to all employees
    sendAdminBroadcast(
      '🏢 OFFICIAL ANNOUNCEMENT: OFFICE-WIDE WORK FROM HOME',
      `CEO & CTO Announcement: Office-Wide Work From Home assigned for ${date}. Physical office is closed; all employees can check in from home without GPS location restrictions.`,
      activeEmployee?.id || 'exec',
      activeEmployee?.fullName || 'CEO / CTO Office'
    );

    addAuditLog('COMPANY_WIDE_WFH_ASSIGNED', `Date: ${date}`, `Assigned Office-Wide WFH for ${date} by ${activeEmployee?.fullName}`);

    return {
      success: true,
      message: `Office-Wide Work From Home successfully assigned for ${date}! All employees are exempt from GPS radius checks on that day.`
    };
  };

  const removeCompanyWideWfh = (date: string): { success: boolean; message: string } => {
    const isCeoOrCto = activeEmployee?.role === 'SUPER_ADMIN' ||
      (activeEmployee?.designation || '').toUpperCase().includes('CEO') ||
      (activeEmployee?.designation || '').toUpperCase().includes('CTO') ||
      (activeEmployee?.designation || '').toUpperCase().includes('FOUNDER') ||
      (activeEmployee?.designation || '').toUpperCase().includes('CIO') ||
      activeEmployee?.employeeId === 'CEO001' ||
      activeEmployee?.employeeId === 'CTO001';

    if (!isCeoOrCto) {
      return {
        success: false,
        message: 'SECURITY ACCESS DENIED: Only the CEO or CTO can modify Office-Wide WFH settings.'
      };
    }

    const updatedDates = companyWideWfhDates.filter(d => d !== date);

    // ── PRIMARY: Write to dedicated Firestore doc — triggers real-time listener on ALL devices ──
    setDoc(doc(db, 'companyConfig', 'wfhDates'), { dates: updatedDates, updatedAt: new Date().toISOString(), updatedBy: activeEmployee?.fullName || 'CEO/CTO' }).catch(() => {});

    // ── FALLBACK: Also update settings + localStorage ──
    setCompanyWideWfhDates(updatedDates);
    updateSettings({ companyWideWfhDates: updatedDates });
    localStorage.setItem('kss_v1_company_wfh_dates', JSON.stringify(updatedDates));

    addAuditLog('COMPANY_WIDE_WFH_REMOVED', `Date: ${date}`, `Removed Office-Wide WFH for ${date} by ${activeEmployee?.fullName}`);

    return {
      success: true,
      message: `Office-Wide Work From Home removed for ${date}. Regular office GPS rules reinstated.`
    };
  };

  // ── Mark all visible main notifications as read ──
  const visibleNotifications = combinedNotifications.filter(n => {
    if (!n.audience) return false;
    const typeStr = (n.type || '').toUpperCase();
    const titleStr = (n.title || '').toLowerCase();
    const isRoutineAttendance = 
      typeStr.startsWith('ATTENDANCE_') || 
      titleStr.includes('break started') || 
      titleStr.includes('break ended') || 
      titleStr.includes('check-in') || 
      titleStr.includes('check-out');

    if (isRoutineAttendance) return false;

    if (n.audience.includes('ALL')) return true;
    return n.audience.includes(role as any);
  });

  const markAllNotificationsRead = () => {
    const allIds = visibleNotifications.map(n => n.id).filter(Boolean) as string[];
    const newSet = new Set([...Array.from(readNotificationIds), ...allIds]);
    setReadNotificationIds(newSet);
    localStorage.setItem('kss_v1_read_notifs', JSON.stringify(Array.from(newSet)));
  };

  const unreadNotificationCount = visibleNotifications.filter(
    n => n.id && !readNotificationIds.has(n.id)
  ).length;

  // Real-time Employee Password Update (Firebase Auth + Firestore Audit)
  const updateCurrentEmployeePassword = async (newPassword: string): Promise<{ success: boolean; message: string }> => {
    const cleanPass = newPassword ? newPassword.trim() : '';
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }
    if (!activeEmployee) {
      return { success: false, message: 'No active employee session found.' };
    }

    try {
      if (auth.currentUser) {
        const { updatePassword } = await import('firebase/auth');
        await updatePassword(auth.currentUser, cleanPass);
      }

      updateEmployee(activeEmployee.id, { 
        updatedAt: new Date().toISOString() 
      });

      addAuditLog('SECURITY_PASSWORD_CHANGE', activeEmployee.fullName, 'Employee updated account password successfully.');
      sendKssNotification(
        'SECURITY_ALERT',
        '🔐 Account Password Updated',
        `Account password for ${activeEmployee.fullName} (${activeEmployee.email}) was updated successfully.`,
        { actorId: activeEmployee.id, actorName: activeEmployee.fullName }
      );

      return { success: true, message: 'Your account password has been updated successfully!' };
    } catch (err: any) {
      console.warn('[AuthContext] Update password error:', err);
      if (err?.code === 'auth/requires-recent-login') {
        return { success: false, message: 'For security reasons, please log out and log in again before updating your password.' };
      }
      return { success: false, message: err?.message || 'Failed to update password. Please try again.' };
    }
  };

  // ── Root-Level FCM Mobile Push Token Registration ──
  useEffect(() => {
    if (isAuthenticated && activeEmployee) {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          registerFcmToken(activeEmployee.id, activeEmployee.role);
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              registerFcmToken(activeEmployee.id, activeEmployee.role);
            }
          });
        }
      }
    }
  }, [isAuthenticated, activeEmployee?.id, activeEmployee?.role]);

  const requestMobilePushPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted' && activeEmployee) {
        await registerFcmToken(activeEmployee.id, activeEmployee.role);
        return true;
      }
      return permission === 'granted';
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      activeEmployee,
      role,
      isAuthenticated,
      isLoading,
      isDemoMode,
      isFirestoreConnected,
      isSessionReady,
      attendanceSyncStatus,
      employees,
      attendance,
      auditLogs,
      settings,
      companyWorkZone,
      leaveRequests,
      notifications: combinedNotifications,
      unreadNotificationCount,
      companyWideWfhDates,
      loginWithEmail,
      quickDemoLogin,
      logout,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      recordCheckIn,
      recordCheckOut,
      checkIn: recordCheckIn,
      checkOut: recordCheckOut,
      startBreak,
      endBreak,
      updateAttendanceRecord,
      applyAttendanceCorrection,
      updateSettings,
      saveCompanyWorkZone,
      submitLeaveRequest,
      updateLeaveRequestStatus,
      updateLeaveRequestStage,
      cancelLeaveRequest,
      addAuditLog,
      resetToDemoData,
      regenerateQrToken,
      sendPasswordReset,
      setEmployeeInitialPassword,
      sendBroadcast,
      assignCompanyWideWfh,
      removeCompanyWideWfh,
      markAllNotificationsRead,
      updateCurrentEmployeePassword,
      requestMobilePushPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
