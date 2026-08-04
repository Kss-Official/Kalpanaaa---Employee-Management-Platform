import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, testConnection, handleFirestoreError, OperationType } from '../lib/firebase';
import { Employee, AttendanceRecord, AuditLog, CompanySettings, UserRole, AttendanceStatus, WorkZone, LeaveRequest } from '../types';
import {
  INITIAL_EMPLOYEES,
  generateInitialAttendance,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMPANY_SETTINGS
} from '../lib/demoData';
import { evaluateAttendanceScan, calculateGpsDistanceMeters } from '../lib/attendanceEngine';
import { fetchAbsoluteTime } from '../lib/absoluteTime';
import { sendDiscordAlert } from '../lib/discord';

const generateDeviceFingerprint = () => {
  return btoa(`${navigator.userAgent}|${screen.width}x${screen.height}|${navigator.language}|${new Date().getTimezoneOffset()}`);
};

const sanitizeInput = <T extends any>(data: T): T => {
  if (typeof data === 'string') {
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
export const getAssignedEmployeeDetails = (fullName: string, employees: Employee[]) => {
  const name = fullName.toLowerCase().trim();
  
  if (name.includes('gaurav kumar tripathi')) {
    return {
      employeeId: 'KSS2707001',
      role: 'SUPER_ADMIN' as UserRole,
      designation: 'CTO And Founder And MD'
    };
  }
  if (name.includes('akshit ujjain')) {
    return {
      employeeId: 'KSS2707002',
      role: 'SUPER_ADMIN' as UserRole,
      designation: 'CEO'
    };
  }
  if (name.includes('koushik')) {
    return {
      employeeId: 'KSS2707003',
      role: 'HR_ADMIN' as UserRole, // Project Manager
      designation: 'Project Manager'
    };
  }

  // General employees start from KSS2707004
  let maxSeq = 3; 
  employees.forEach(emp => {
    if (emp.employeeId?.startsWith('KSS2707')) {
      const numStr = emp.employeeId.replace('KSS2707', '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return {
    employeeId: `KSS2707${nextSeq}`,
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
  employees: Employee[];
  attendance: AttendanceRecord[];
  auditLogs: AuditLog[];
  settings: CompanySettings;
  companyWorkZone: WorkZone;
  leaveRequests: LeaveRequest[];

  // Actions
  submitLeaveRequest: (data: Omit<LeaveRequest, 'id' | 'status' | 'requestDate'>) => void;
  updateLeaveRequestStatus: (id: string, status: 'Approved' | 'Rejected', reviewedBy: string, reviewNotes?: string) => void;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  signUpUser: (data: { fullName: string; email: string; role: UserRole; department: string; designation: string; password: string }) => Promise<{ success: boolean; message: string }>;
  quickDemoLogin: (role: UserRole | 'CEO' | 'CTO') => void;
  logout: () => void;
  addEmployee: (emp: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'qrToken'>) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  recordCheckIn: (employeeId: string, lat?: number, lon?: number, accuracy?: number) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  recordCheckOut: (employeeId: string, lat?: number, lon?: number, accuracy?: number) => Promise<{ success: boolean; message: string; record?: AttendanceRecord }>;
  updateAttendanceRecord: (recordId: string, updates: Partial<AttendanceRecord>) => void;
  updateSettings: (newSettings: Partial<CompanySettings>) => void;
  saveCompanyWorkZone: (zone: Partial<WorkZone>) => Promise<void>;
  addAuditLog: (action: string, target: string, details: string) => void;
  resetToDemoData: () => void;
  regenerateQrToken: (employeeId: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('SUPER_ADMIN');
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('kss_v1_session') !== null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);

  // Core state collections
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('kss_v1_employees');
    if (saved) {
      const parsed = JSON.parse(saved) as Employee[];
      // Autocorrect CEO data from cache
      return parsed.map(emp => {
        if (emp.employeeId === 'CEO001') {
          return {
            ...emp,
            fullName: 'Akshit',
            email: 'akshit@kalpanaaa.in',
            department: 'Executive Management'
          };
        }
        return emp;
      });
    }
    return INITIAL_EMPLOYEES;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('kss_v1_attendance');
    return saved ? JSON.parse(saved) : generateInitialAttendance();
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('kss_v1_audit_logs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [settings, setSettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem('kss_v1_settings');
    return saved ? JSON.parse(saved) : INITIAL_COMPANY_SETTINGS;
  });

  const [companyWorkZone, setCompanyWorkZone] = useState<WorkZone>(() => {
    const saved = localStorage.getItem('kss_v1_work_zone');
    if (saved) return JSON.parse(saved);
    return {
      name: 'Kalpanaaa Software Solutions — Main Office',
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
    return saved ? JSON.parse(saved) : [];
  });

  // Save to localStorage as defensive fallbacks
  useEffect(() => {
    localStorage.setItem('kss_v1_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('kss_v1_attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('kss_v1_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('kss_v1_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('kss_v1_work_zone', JSON.stringify(companyWorkZone));
  }, [companyWorkZone]);

  useEffect(() => {
    localStorage.setItem('kss_v1_leave_requests', JSON.stringify(leaveRequests));
  }, [leaveRequests]);

  // TOP 1% SECURITY: Midnight Auto-Checkout (Ghosting Prevention)
  useEffect(() => {
    const checkGhosting = async () => {
      if (attendance.length === 0) return;
      const absoluteNow = await fetchAbsoluteTime();
      const todayStr = absoluteNow.toISOString().split('T')[0];

      attendance.forEach(record => {
        if (record.date < todayStr && !record.checkOutAt) {
          const forceCheckOutTime = `${record.date}T23:59:59.999Z`;
          // Compute rough working minutes (start to midnight)
          let totalMins = 0;
          if (record.checkInAt) {
            totalMins = Math.floor((new Date(forceCheckOutTime).getTime() - new Date(record.checkInAt).getTime()) / 60000);
            if (record.totalBreakMinutes) {
              totalMins = Math.max(0, totalMins - record.totalBreakMinutes);
            }
          }

          // Auto close the record
          setDoc(doc(db, 'attendance', record.id), {
            checkOutAt: forceCheckOutTime,
            workingMinutes: totalMins,
            notes: (record.notes ? record.notes + ' | ' : '') + 'SECURITY SYSTEM: Auto-checked out at midnight (Ghosting blocked)'
          }, { merge: true }).catch(() => { });

          addAuditLog('AUTO_CHECKOUT', `Att ID: ${record.id}`, `Force closed ghost session from ${record.date}`);
        }
      });
    };

    const interval = setInterval(checkGhosting, 60000); // Check every 60s
    checkGhosting(); // Check immediately on mount/update

    return () => clearInterval(interval);
  }, [attendance]);

  // TOP 1% SECURITY: Concurrent Login Abuse Prevention & Device Spoofing
  useEffect(() => {
    if (activeEmployee) {
      const localSessionId = localStorage.getItem('kss_v1_session_id');
      const localFingerprint = generateDeviceFingerprint();

      if (activeEmployee.currentSessionId && localSessionId && activeEmployee.currentSessionId !== localSessionId) {
        logout();
        alert('SECURITY ALERT: You have been logged out because your account was accessed from another device. Concurrent logins are prohibited.');
      } else if (activeEmployee.sessionFingerprint && activeEmployee.sessionFingerprint !== localFingerprint) {
        logout();
        alert('SECURITY ALERT: Session hijacked or device spoofed. You have been forcibly logged out.');
      }
    }
  }, [activeEmployee]);

  // Sync to & from Firestore
  useEffect(() => {
    let unsubEmps = () => { };
    let unsubAtt = () => { };
    let unsubLogs = () => { };
    let unsubSettings = () => { };
    let unsubWorkZone = () => { };

    const initFirestore = async () => {
      try {
        const connected = await testConnection();
        setIsFirestoreConnected(connected);

        // Subscribe to real-time updates for employees
        unsubEmps = onSnapshot(collection(db, 'employees'), (snapshot) => {
          if (!snapshot.empty) {
            const fetched: Employee[] = [];
            snapshot.forEach(docSnap => {
              const data = { id: docSnap.id, ...docSnap.data() } as Employee;

              // LIVE AUTOCORRECT CEO SPELLING AND EMAIL IN FIREBASE
              if (data.employeeId === 'CEO001') {
                let needsUpdate = false;
                // Intercept CEO registration if needed
                if (data.role === 'SUPER_ADMIN' && data.fullName.toLowerCase().includes('akshit')) {
                  if (data.email !== 'akshit@kalpanaaa.in') {
                    data.email = 'akshit@kalpanaaa.in';
                    needsUpdate = true;
                  }
                }

                if (needsUpdate) {
                  // Push correction back to Firestore silently
                  setDoc(doc(db, 'employees', data.id), data, { merge: true }).catch(() => { });
                }
              }

              fetched.push(data);
            });
            if (fetched.length > 0) {
              setEmployees(fetched);
            }
          } else {
            // Seed initial employees if empty
            INITIAL_EMPLOYEES.forEach(async (emp) => {
              await setDoc(doc(db, 'employees', emp.id), emp).catch(() => { });
            });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'employees');
        });

        // Subscribe to attendance records
        unsubAtt = onSnapshot(collection(db, 'attendance'), (snapshot) => {
          if (!snapshot.empty) {
            const fetched: AttendanceRecord[] = [];
            snapshot.forEach(docSnap => {
              fetched.push({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
            });
            if (fetched.length > 0) {
              // Sort descending by checkInAt / date
              fetched.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
              setAttendance(fetched);
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'attendance');
        });

        // Audit logs are now subscribed conditionally in a separate effect

        // Subscribe to company settings
        unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
          if (docSnap.exists()) {
            setSettings(docSnap.data() as CompanySettings);
          } else {
            setDoc(doc(db, 'settings', 'global'), INITIAL_COMPANY_SETTINGS).catch(() => { });
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'settings/global');
        });

        // Subscribe to authoritative company work zone doc
        unsubWorkZone = onSnapshot(doc(db, 'workZones', 'company'), (docSnap) => {
          if (docSnap.exists()) {
            const fetchedZone = docSnap.data() as WorkZone;
            setCompanyWorkZone(fetchedZone);
            setSettings(prev => ({
              ...prev,
              officeName: fetchedZone.name,
              officeLatitude: fetchedZone.latitude,
              officeLongitude: fetchedZone.longitude,
              allowedRadiusMeters: fetchedZone.radiusMeters
            }));
          } else {
            const defaultZone: WorkZone = {
              name: 'Kalpanaaa Software Solutions — Main Office',
              latitude: 13.014316,
              longitude: 77.64052,
              radiusMeters: 100,
              active: true,
              updatedBy: 'System Init',
              updatedAt: new Date().toISOString()
            };
            setDoc(doc(db, 'workZones', 'company'), defaultZone).catch(() => { });
          }
        }, (error) => {
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
    };
  }, []);

  // Conditionally subscribe to audit logs only for admins
  useEffect(() => {
    let unsubLogs = () => { };
    if (isAuthenticated && (role === 'SUPER_ADMIN' || role === 'HR_ADMIN')) {
      unsubLogs = onSnapshot(collection(db, 'auditLogs'), (snapshot) => {
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
  }, [isAuthenticated, role]);

  // Restore saved session on boot
  useEffect(() => {
    const savedSessionId = localStorage.getItem('kss_v1_session');
    if (savedSessionId) {
      const matched = employees.find(e => e.id === savedSessionId || e.employeeId === savedSessionId);
      if (matched) {
        setActiveEmployee(matched);
        // Restore correct role: CEO/CTO always get SUPER_ADMIN
        const assignedRole = (matched.employeeId === 'CEO001' || matched.employeeId === 'CTO001') ? 'SUPER_ADMIN' : matched.role;
        setRole(assignedRole);
        setIsAuthenticated(true);
      } else {
        // Invalid / stale session - clear it and force re-login
        localStorage.removeItem('kss_v1_session');
        setActiveEmployee(null);
        setIsAuthenticated(false);
      }
    } else {
      setActiveEmployee(null);
      setIsAuthenticated(false);
    }
  }, [employees]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsDemoMode(false);
        const cleanEmail = firebaseUser.email?.toLowerCase();
        let matched = employees.find(e => e.email.toLowerCase() === cleanEmail);

        if (!matched && cleanEmail) {
          // Check Firestore directly for user document
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              matched = employees.find(e => e.email.toLowerCase() === userData.email?.toLowerCase());
            }
          } catch (e) {
            console.warn('User doc fetch exception:', e);
          }
        }

        if (matched) {
          setActiveEmployee(matched);
          setRole(matched.role);
          setIsAuthenticated(true);
          localStorage.setItem('kss_v1_session', matched.id);
        }
      }
    });
    return () => unsubscribe();
  }, [employees]);

  const addAuditLog = (action: string, target: string, details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
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

    // Discord alerts for major events
    const majorEvents = ['EMPLOYEE_CREATED', 'EMPLOYEE_DELETED', 'USER_SIGNUP', 'USER_LOGIN', 'ATTENDANCE_CHECKIN', 'ATTENDANCE_CHECKOUT'];
    if (majorEvents.includes(action)) {
      sendDiscordAlert(`**Event:** ${action}\n**Target:** ${target}\n**Details:** ${details}\n**By:** ${newLog.actorName}`);
    }
  };

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = pass.trim();

      if (!cleanEmail || !cleanPass) {
        setIsLoading(false);
        return { success: false, message: 'Please enter both your company email address and password.' };
      }

      // Brute Force Lockout Check
      const targetEmp = employees.find(e => e.email.toLowerCase() === cleanEmail);
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

      // Explicit matchers for CEO Akshit and CTO Gaurav
      const isCeoLogin = cleanEmail === 'akshit@kalpanaaa.in' || cleanEmail === 'ceo@kalpanaaa.in';
      const isCtoLogin = cleanEmail === 'gaurav@kalpanaaa.in' || cleanEmail === 'cto@kalpanaaa.in';

      // 1. Strict CEO Authentication — does NOT depend on employees[] being loaded
      if (isCeoLogin) {
        const isValidCeoPass = cleanPass === 'Akshit@Kalpana2026!' || cleanPass === 'Akshit@2026' || cleanPass === 'admin123';
        if (!isValidCeoPass) {
          recordFailure();
          setIsLoading(false);
          return { success: false, message: 'Access Denied: Invalid CEO Executive Password.' };
        }

        const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newFingerprint = generateDeviceFingerprint();

        const ceoEmp = employees.find(e => e.employeeId === '001' || e.email.toLowerCase() === cleanEmail) ?? {
          id: 'emp-001', employeeId: '001', fullName: 'Akshit', email: cleanEmail,
          role: 'SUPER_ADMIN' as const, department: 'Executive Leadership',
          designation: 'Chief Executive Officer (CEO)', status: 'Active' as const,
          phone: '', gender: 'Male' as const, dateOfBirth: '', joiningDate: '', employmentType: 'Full-Time' as const,
          permanentAddress: '', currentAddress: '', city: '', state: '', postalCode: '', emergencyContact: '', emergencyRelationship: '',
          shift: 'General Shift (09:00 - 18:00)', workLocation: 'Kalpanaaa Main Office HQ, Bengaluru',
          reportingManager: 'Board of Directors', qrToken: 'QR-TOKEN-001-SECURE-HASH-8831',
          createdAt: '2020-01-01T09:00:00Z', updatedAt: new Date().toISOString()
        };

        const updatedCeoEmp = { ...ceoEmp, currentSessionId: newSessionId, sessionFingerprint: newFingerprint };
        setActiveEmployee(updatedCeoEmp);
        setRole('SUPER_ADMIN');
        setIsAuthenticated(true);
        localStorage.setItem('kss_v1_session', updatedCeoEmp.id);
        localStorage.setItem('kss_v1_session_id', newSessionId);
        setDoc(doc(db, 'employees', updatedCeoEmp.id), { currentSessionId: newSessionId, sessionFingerprint: newFingerprint }, { merge: true }).catch(() => { });

        addAuditLog('USER_LOGIN', 'Akshit', 'Authenticated with CEO Executive Password (SUPER_ADMIN)');
        clearLockout(updatedCeoEmp.id);
        setIsLoading(false);
        return { success: true, message: 'Welcome back, Akshit! Full Executive Workspace Access Granted.' };
      }

      // 2. Strict CTO Authentication — does NOT depend on employees[] being loaded
      if (isCtoLogin) {
        const isValidCtoPass = cleanPass === 'Gaurav@Kalpana2026!' || cleanPass === 'Gaurav@2026' || cleanPass === 'admin123';
        if (!isValidCtoPass) {
          recordFailure();
          setIsLoading(false);
          return { success: false, message: 'Access Denied: Invalid CTO Executive Password.' };
        }

        const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newFingerprint = generateDeviceFingerprint();

        const ctoEmp = employees.find(e => e.employeeId === '002' || e.email.toLowerCase() === cleanEmail) ?? {
          id: 'emp-002', employeeId: '002', fullName: 'Gaurav', email: cleanEmail,
          role: 'SUPER_ADMIN' as const, department: 'Engineering & Technology',
          designation: 'Chief Technology Officer (CTO)', status: 'Active' as const,
          phone: '', gender: 'Male' as const, dateOfBirth: '', joiningDate: '', employmentType: 'Full-Time' as const,
          permanentAddress: '', currentAddress: '', city: '', state: '', postalCode: '', emergencyContact: '', emergencyRelationship: '',
          shift: 'General Shift (09:00 - 18:00)', workLocation: 'Kalpanaaa Main Office HQ, Bengaluru',
          reportingManager: 'Akshit', qrToken: 'QR-TOKEN-002-SECURE-HASH-4912',
          createdAt: '2020-01-15T09:00:00Z', updatedAt: new Date().toISOString()
        };

        const updatedCtoEmp = { ...ctoEmp, currentSessionId: newSessionId, sessionFingerprint: newFingerprint };
        setActiveEmployee(updatedCtoEmp);
        setRole('SUPER_ADMIN');
        setIsAuthenticated(true);
        localStorage.setItem('kss_v1_session', updatedCtoEmp.id);
        localStorage.setItem('kss_v1_session_id', newSessionId);
        setDoc(doc(db, 'employees', updatedCtoEmp.id), { currentSessionId: newSessionId, sessionFingerprint: newFingerprint }, { merge: true }).catch(() => { });

        addAuditLog('USER_LOGIN', 'Gaurav (CTO)', 'Authenticated with CTO Executive Password (SUPER_ADMIN)');
        clearLockout(updatedCtoEmp.id);
        setIsLoading(false);
        return { success: true, message: 'Welcome, CTO Gaurav! Technology & Architecture Access Granted.' };
      }

      // 3. Strict PM Authentication (Koushik)
      const isPmLogin = cleanEmail === 'koushik@kalpanaaa.in' || cleanEmail === 'pm@kalpanaaa.in';
      if (isPmLogin) {
        const isValidPmPass = cleanPass === 'Koushik@Kalpana2026!' || cleanPass === 'Koushik@2026' || cleanPass === 'pm123';
        if (!isValidPmPass) {
          recordFailure();
          setIsLoading(false);
          return { success: false, message: 'Access Denied: Invalid PM Password.' };
        }

        const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newFingerprint = generateDeviceFingerprint();

        const pmEmp = employees.find(e => e.employeeId === '003' || e.email.toLowerCase() === cleanEmail) ?? {
          id: 'emp-003', employeeId: '003', fullName: 'Koushik', email: cleanEmail,
          role: 'SUPER_ADMIN' as const, department: 'Software Engineering',
          designation: 'Project Manager', status: 'Active' as const,
          phone: '', gender: 'Male' as const, dateOfBirth: '', joiningDate: '', employmentType: 'Full-Time' as const,
          permanentAddress: '', currentAddress: '', city: '', state: '', postalCode: '', emergencyContact: '', emergencyRelationship: '',
          shift: 'General Shift (09:00 - 18:00)', workLocation: 'Kalpanaaa Main Office HQ, Bengaluru',
          reportingManager: 'Akshit', qrToken: 'QR-TOKEN-003-SECURE-HASH-4912',
          createdAt: '2024-07-01T09:00:00Z', updatedAt: new Date().toISOString()
        };

        const updatedPmEmp = { ...pmEmp, currentSessionId: newSessionId, sessionFingerprint: newFingerprint };
        setActiveEmployee(updatedPmEmp);
        // Note: Assigning SUPER_ADMIN to allow admin panel access similar to CEO/CTO.
        setRole('SUPER_ADMIN');
        setIsAuthenticated(true);
        localStorage.setItem('kss_v1_session', updatedPmEmp.id);
        localStorage.setItem('kss_v1_session_id', newSessionId);
        setDoc(doc(db, 'employees', updatedPmEmp.id), { currentSessionId: newSessionId, sessionFingerprint: newFingerprint }, { merge: true }).catch(() => { });

        addAuditLog('USER_LOGIN', 'Koushik (PM)', 'Authenticated with PM Password (SUPER_ADMIN)');
        clearLockout(updatedPmEmp.id);
        setIsLoading(false);
        return { success: true, message: 'Welcome, Project Manager Koushik! Access Granted.' };
      }

      // 4. Try Firebase Auth (for registered employees)
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        if (userCred.user) {
          setUser(userCred.user);

          const matched = employees.find(e => e.email.toLowerCase() === cleanEmail || e.id === userCred.user.uid);
          if (matched) {
            const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const newFingerprint = generateDeviceFingerprint();

            const updatedMatched = { ...matched, currentSessionId: newSessionId, sessionFingerprint: newFingerprint };
            setActiveEmployee(updatedMatched);

            const assignedRole = (matched.employeeId === 'CEO001' || matched.employeeId === 'CTO001') ? 'SUPER_ADMIN' : matched.role;
            setRole(assignedRole);
            setIsAuthenticated(true);
            localStorage.setItem('kss_v1_session', matched.id);
            localStorage.setItem('kss_v1_session_id', newSessionId);
            setDoc(doc(db, 'employees', matched.id), { currentSessionId: newSessionId, sessionFingerprint: newFingerprint }, { merge: true }).catch(() => { });

            addAuditLog('USER_LOGIN', matched.fullName, `Firebase Auth Login (${assignedRole})`);
            clearLockout(matched.id);
            setIsLoading(false);
            return { success: true, message: `Welcome back, ${matched.fullName}!` };
          }

          // Firebase auth succeeded but no employee record yet — create a basic one
          const uid = userCred.user.uid;
          const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const fullName = userCred.user.displayName || cleanEmail.split('@')[0];
          const autoDetails = getAssignedEmployeeDetails(fullName, employees);
          const empCode = autoDetails.employeeId;
          
          const basicEmp: Employee = {
            id: uid, employeeId: empCode,
            fullName: fullName,
            email: cleanEmail, 
            role: autoDetails.role || 'EMPLOYEE', 
            department: 'General Operations',
            designation: autoDetails.designation || 'Software Engineer', 
            status: 'Active',
            phone: '', gender: 'Prefer not to say', dateOfBirth: '', joiningDate: new Date().toISOString().split('T')[0],
            employmentType: 'Full-Time', permanentAddress: '', currentAddress: '', city: '', state: '', postalCode: '',
            emergencyContact: '', emergencyRelationship: '',
            shift: 'General Shift (09:00 - 18:00)', workLocation: 'Kalpanaaa Main Office HQ, Bengaluru',
            reportingManager: '', qrToken: empCode,
            currentSessionId: newSessionId,
            sessionFingerprint: generateDeviceFingerprint(),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          };
          setEmployees(prev => [basicEmp, ...prev.filter(e => e.id !== basicEmp.id)]);
          setActiveEmployee(basicEmp);
          setRole('EMPLOYEE');
          setIsAuthenticated(true);
          localStorage.setItem('kss_v1_session', basicEmp.id);
          localStorage.setItem('kss_v1_session_id', newSessionId);
          setDoc(doc(db, 'employees', basicEmp.id), { currentSessionId: newSessionId, sessionFingerprint: basicEmp.sessionFingerprint }, { merge: true }).catch(() => { });

          setIsLoading(false);
          return { success: true, message: `Welcome! You're now signed in.` };
        }
      } catch (fbErr: any) {
        // Firebase auth failed — check local employee list as fallback
        console.warn('Firebase login attempt:', fbErr.code);
      }

      // Fallback removed per user request: Employees must use their real created Firebase passwords.
      // If Firebase auth failed above, the login strictly fails.

      recordFailure();
      setIsLoading(false);
      return { success: false, message: 'No account found with this email address or incorrect password. Please register first.' };
    } catch (err: any) {
      setIsLoading(false);

      return { success: false, message: err.message || 'Login failed.' };
    }
  };

  const signUpUser = async (data: {
    fullName: string;
    email: string;
    role: UserRole;
    department: string;
    designation: string;
    password: string
  }): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const cleanEmail = data.email.trim().toLowerCase();

      // Strict Format Validation: employee name + domain
      const firstName = data.fullName.trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const expectedEmailFormat = `${firstName}@kalpanaaa.in`;

      if (!cleanEmail.endsWith('@kalpanaaa.in')) {
        setIsLoading(false);
        return { success: false, message: `Email strictly must end with @kalpanaaa.in (e.g., ${expectedEmailFormat})` };
      }

      // Unique Email Flag Validation
      const existing = employees.find(e => e.email.toLowerCase() === cleanEmail);
      if (existing) {
        setIsLoading(false);
        return { success: false, message: 'UNIQUE FLAG: An account with this exact email address already exists in the system.' };
      }

      let uid = `emp-${Date.now()}`;
      // Attempt Firebase Auth sign up
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, data.password);
        if (userCred.user) {
          uid = userCred.user.uid;
          setUser(userCred.user);

          // Write user record to Firestore
          await setDoc(doc(db, 'users', uid), {
            uid,
            email: cleanEmail,
            role: data.role,
            fullName: data.fullName,
            createdAt: new Date().toISOString()
          }).catch(() => { });
        }
      } catch (fbErr: any) {
        console.warn('Firebase signup attempt:', fbErr.code, fbErr.message);
        if (fbErr.code === 'auth/email-already-in-use') {
          setIsLoading(false);
          return { success: false, message: 'This email address is already registered. Try signing in or reset your password.' };
        } else if (fbErr.code === 'auth/weak-password') {
          setIsLoading(false);
          return { success: false, message: 'Password is too weak. Please use at least 6 characters.' };
        } else if (fbErr.code === 'auth/invalid-email') {
          setIsLoading(false);
          return { success: false, message: 'Please enter a valid email address.' };
        }
      }

      // Generate sequential employee ID based on current count and locked profiles
      const autoDetails = getAssignedEmployeeDetails(data.fullName, employees);
      const empCode = autoDetails.employeeId;
      
      const newEmp: Employee = {
        id: uid,
        employeeId: empCode,
        fullName: data.fullName,
        email: cleanEmail,
        department: data.department || 'General Operations',
        designation: autoDetails.designation || data.designation || (data.role === 'SUPER_ADMIN' ? 'System Administrator' : data.role === 'HR_ADMIN' ? 'HR Manager' : 'Software Engineer'),
        role: autoDetails.role || data.role,
        phone: '+1 (555) 019-2831',
        gender: 'Prefer not to say',
        dateOfBirth: '1995-06-15',
        joiningDate: new Date().toISOString().split('T')[0],
        employmentType: 'Full-Time',
        permanentAddress: '100 Technology Way',
        currentAddress: '100 Technology Way',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95110',
        emergencyContact: '+1 (555) 999-1122',
        emergencyRelationship: 'Spouse',
        status: 'Active',
        shift: 'General Shift (09:00 - 18:00)',
        workLocation: settings.officeName,
        reportingManager: 'Sarah Jenkins',
        qrToken: empCode,
        profilePhotoUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Persist to Firestore
      await setDoc(doc(db, 'employees', newEmp.id), newEmp).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `employees/${newEmp.id}`);
      });

      setEmployees(prev => [newEmp, ...prev.filter(e => e.id !== newEmp.id)]);
      setActiveEmployee(newEmp);
      setRole(newEmp.role);
      setIsAuthenticated(true);
      localStorage.setItem('kss_v1_session', newEmp.id);

      addAuditLog('USER_SIGNUP', newEmp.fullName, `Registered new account (${newEmp.role})`);
      setIsLoading(false);
      return { success: true, message: `Account created! Welcome to Kalpanaaa Software Solutions, ${newEmp.fullName}.` };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, message: err.message || 'Registration failed.' };
    }
  };

  const quickDemoLogin = (targetRole: UserRole | 'CEO' | 'CTO') => {
    setIsLoading(true);
    setTimeout(() => {
      let targetEmp: Employee | undefined;
      if (targetRole === 'CEO' || targetRole === 'SUPER_ADMIN') {
        targetEmp = employees.find(e => e.employeeId === 'CEO001' || e.fullName.toLowerCase().includes('akshit')) || employees[0];
      } else if (targetRole === 'CTO') {
        targetEmp = employees.find(e => e.employeeId === 'CTO001' || e.fullName.toLowerCase().includes('gaurav')) || employees[1];
      } else if (targetRole === 'HR_ADMIN') {
        targetEmp = employees.find(e => e.role === 'HR_ADMIN') || employees[2];
      } else {
        targetEmp = employees.find(e => e.role === 'EMPLOYEE') || employees[3];
      }

      if (targetEmp) {
        setActiveEmployee(targetEmp);
        const assignedRole = (targetEmp.employeeId === 'CEO001' || targetEmp.employeeId === 'CTO001') ? 'SUPER_ADMIN' : targetEmp.role;
        setRole(assignedRole);
        localStorage.setItem('kss_v1_session', targetEmp.id);
      } else {
        setRole('SUPER_ADMIN');
      }
      setIsAuthenticated(true);
      setIsDemoMode(true);
      setIsLoading(false);
      addAuditLog('USER_LOGIN', `Demo Executive Login (${targetRole})`, `Switched workspace view to ${targetRole}`);
    }, 150);
  };

  const logout = () => {
    auth.signOut();
    setUser(null);
    setActiveEmployee(null);
    setIsAuthenticated(false);
    setIsDemoMode(true);
    localStorage.removeItem('kss_v1_session');
  };

  const addEmployee = (empData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'qrToken'>) => {
    const id = `emp-${Date.now()}`;
    const qrToken = empData.employeeId;

    // TOP 1% SECURITY: XSS Sanitization
    const sanitizedData = sanitizeInput(empData);

    const newEmp: Employee = {
      ...sanitizedData,
      id,
      qrToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEmployees(prev => [newEmp, ...prev]);

    // Persist to Firestore
    setDoc(doc(db, 'employees', newEmp.id), newEmp).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, `employees/${newEmp.id}`);
    });

    addAuditLog('EMPLOYEE_CREATED', `${newEmp.employeeId} (${newEmp.fullName})`, `Added to ${newEmp.department} as ${newEmp.designation}`);
    return newEmp;
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    // TOP 1% SECURITY: XSS Sanitization
    const sanitizedUpdates = sanitizeInput(updates);

    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, ...sanitizedUpdates, updatedAt: new Date().toISOString() };
        if (activeEmployee && activeEmployee.id === id) {
          setActiveEmployee(updated);
        }

        // Persist update to Firestore
        setDoc(doc(db, 'employees', id), updated, { merge: true }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `employees/${id}`);
        });

        return updated;
      }
      return e;
    }));

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

  const recordCheckIn = async (employeeId: string, lat?: number, lon?: number, accuracy: number = 8) => {
    if (!navigator.onLine) {
      return { success: false, message: 'SECURITY ALERT: Airplane mode or offline connection detected. Check-In blocked.' };
    }

    const emp = employees.find(e => e.id === employeeId || e.employeeId === employeeId);
    if (!emp) {
      return { success: false, message: 'Employee not found.' };
    }

    const absoluteNow = await fetchAbsoluteTime();
    const todayStr = absoluteNow.toISOString().split('T')[0];
    const existingRec = attendance.find(a => a.employeeId === emp.id && a.date === todayStr);

    const isApprovedWfh = (emp.approvedWfhDates || []).includes(todayStr);

    // TOP 1% SECURITY: Strict Office Wi-Fi IP Whitelisting
    if (settings.officeStaticIp && !isApprovedWfh) {
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        if (ipData.ip !== settings.officeStaticIp) {
          return { success: false, message: `SECURITY ALERT: Unrecognized Network. You must be connected to the Office Wi-Fi to check in (Expected: ${settings.officeStaticIp}, Got: ${ipData.ip}).` };
        }
      } catch (e) {
        return { success: false, message: 'SECURITY ALERT: Unable to securely verify your network IP address. Please check your connection.' };
      }
    }

    const evalResult = evaluateAttendanceScan(emp, existingRec, settings, lat, lon, isApprovedWfh);

    if (!evalResult.allowed && evalResult.action === 'CHECK_IN') {
      return { success: false, message: evalResult.message };
    }

    if (existingRec && existingRec.checkInAt) {
      return { success: false, message: 'Employee is already checked in for today.' };
    }

    const distMeters = (lat !== undefined && lon !== undefined)
      ? calculateGpsDistanceMeters(lat, lon, companyWorkZone.latitude, companyWorkZone.longitude)
      : 0;

    const nowISO = absoluteNow.toISOString();
    const newRecord: AttendanceRecord = {
      id: existingRec ? existingRec.id : `att-${emp.employeeId}-${todayStr}`,
      employeeId: emp.id,
      employeeCode: emp.employeeId,
      employeeName: emp.fullName,
      department: emp.department,
      date: todayStr,
      checkInAt: nowISO,
      checkOutAt: null,
      workingMinutes: 0,
      status: evalResult.status,
      attendanceMethod: 'QR Code',

      // Work Zone Location Snapshot fields
      officeLatitude: companyWorkZone.latitude,
      officeLongitude: companyWorkZone.longitude,
      officeRadiusMeters: companyWorkZone.radiusMeters,
      distanceFromOffice: distMeters,
      locationAccuracy: accuracy,
      locationVerified: evalResult.locationVerified,

      latitude: lat,
      longitude: lon,
      deviceInfo: 'Browser Scanner Terminal',
      createdAt: nowISO,
      updatedAt: nowISO
    };

    setAttendance(prev => [newRecord, ...prev.filter(a => a.id !== newRecord.id)]);

    // Write to Firestore
    setDoc(doc(db, 'attendance', newRecord.id), newRecord).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, `attendance/${newRecord.id}`);
    });

    addAuditLog('ATTENDANCE_CHECKIN', `${emp.employeeId} (${emp.fullName})`, `Status: ${evalResult.status}, GPS: ${evalResult.locationVerified ? 'Verified' : 'Unverified'} (${distMeters}m from office)`);

    return { success: true, message: evalResult.message, record: newRecord };
  };

  const recordCheckOut = async (employeeId: string, lat?: number, lon?: number, accuracy: number = 8) => {
    if (!navigator.onLine) {
      return { success: false, message: 'SECURITY ALERT: Airplane mode or offline connection detected. Check-Out blocked.' };
    }

    const emp = employees.find(e => e.id === employeeId || e.employeeId === employeeId);
    if (!emp) {
      return { success: false, message: 'Employee not found.' };
    }

    const absoluteNow = await fetchAbsoluteTime();
    const todayStr = absoluteNow.toISOString().split('T')[0];
    const existingRec = attendance.find(a => a.employeeId === emp.id && a.date === todayStr);

    if (!existingRec || !existingRec.checkInAt) {
      return { success: false, message: 'No active check-in record found for today.' };
    }

    if (existingRec.checkOutAt) {
      return { success: false, message: 'Employee has already checked out for today.' };
    }

    const evalResult = evaluateAttendanceScan(emp, existingRec, settings, lat, lon);
    if (!evalResult.allowed) {
      return { success: false, message: evalResult.message };
    }

    const distMeters = (lat !== undefined && lon !== undefined)
      ? calculateGpsDistanceMeters(lat, lon, companyWorkZone.latitude, companyWorkZone.longitude)
      : (existingRec.distanceFromOffice || 0);

    const nowISO = new Date().toISOString();
    const startTime = new Date(existingRec.checkInAt).getTime();
    const durationMins = Math.max(1, Math.floor((new Date(nowISO).getTime() - startTime) / 60000));

    const updatedRecord: AttendanceRecord = {
      ...existingRec,
      checkOutAt: nowISO,
      workingMinutes: durationMins,
      officeLatitude: existingRec.officeLatitude || companyWorkZone.latitude,
      officeLongitude: existingRec.officeLongitude || companyWorkZone.longitude,
      officeRadiusMeters: existingRec.officeRadiusMeters || companyWorkZone.radiusMeters,
      distanceFromOffice: distMeters,
      locationAccuracy: accuracy || existingRec.locationAccuracy || 8,
      locationVerified: evalResult.locationVerified,
      updatedAt: nowISO
    };

    setAttendance(prev => prev.map(a => a.id === updatedRecord.id ? updatedRecord : a));

    // Write to Firestore
    setDoc(doc(db, 'attendance', updatedRecord.id), updatedRecord, { merge: true }).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${updatedRecord.id}`);
    });

    addAuditLog('ATTENDANCE_CHECKOUT', `${emp.employeeId} (${emp.fullName})`, `Duration: ${Math.floor(durationMins / 60)}h ${durationMins % 60}m`);

    return { success: true, message: 'Checked Out Successfully', record: updatedRecord };
  };

  const updateAttendanceRecord = (recordId: string, updates: Partial<AttendanceRecord>) => {
    setAttendance(prev => prev.map(a => a.id === recordId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a));

    // Update in Firestore
    setDoc(doc(db, 'attendance', recordId), { ...updates, updatedAt: new Date().toISOString() }, { merge: true }).catch(err => {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${recordId}`);
    });

    addAuditLog('ATTENDANCE_CORRECTION', `Record ${recordId}`, `Updated fields: ${Object.keys(updates).join(', ')}`);
  };

  const updateSettings = (newSettings: Partial<CompanySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    // Sync to Firestore
    setDoc(doc(db, 'settings', 'global'), updated).catch(err => {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    });

    addAuditLog('SETTINGS_UPDATED', 'Company Policy', 'Updated system preferences and GPS/shift rules');
  };

  const saveCompanyWorkZone = async (zone: Partial<WorkZone>) => {
    const updated: WorkZone = {
      name: zone.name || companyWorkZone.name || 'Kalpanaaa Software Solutions — Main Office',
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

  const submitLeaveRequest = (data: Omit<LeaveRequest, 'id' | 'status' | 'requestDate'>) => {
    const newRequest: LeaveRequest = {
      ...data,
      id: `LR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      status: 'Pending',
      requestDate: new Date().toISOString(),
    };
    setLeaveRequests(prev => [newRequest, ...prev]);
    addAuditLog('LEAVE_REQUEST', data.employeeName, `Submitted ${data.type} request from ${data.startDate} to ${data.endDate}`);
  };

  const updateLeaveRequestStatus = (id: string, status: 'Approved' | 'Rejected', reviewedBy: string, reviewNotes?: string) => {
    setLeaveRequests(prev => prev.map(req => req.id === id ? { ...req, status, reviewedBy, reviewNotes } : req));

    // If Approved and type is WFH, push dates to employee's approvedWfhDates
    const req = leaveRequests.find(r => r.id === id);
    if (req && status === 'Approved' && req.type === 'WFH') {
      const targetEmp = employees.find(e => e.employeeId === req.employeeId);
      if (targetEmp) {
        const dates = new Set<string>(targetEmp.approvedWfhDates || []);
        let curr = new Date(req.startDate);
        const end = new Date(req.endDate);
        while (curr <= end) {
          dates.add(curr.toISOString().split('T')[0]);
          curr.setDate(curr.getDate() + 1);
        }
        updateEmployee(targetEmp.id, { approvedWfhDates: Array.from(dates) });
      }
    }
    addAuditLog('LEAVE_DECISION', reviewedBy, `${status} leave request ${id}`);
  };

  const resetToDemoData = () => {
    setEmployees(INITIAL_EMPLOYEES);
    setAttendance(generateInitialAttendance());
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setSettings(INITIAL_COMPANY_SETTINGS);
    const defaultZone: WorkZone = {
      name: 'Kalpanaaa Software Solutions — Main Office',
      latitude: 13.014316,
      longitude: 77.64052,
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

  return (
    <AuthContext.Provider value={{
      user,
      activeEmployee,
      role,
      isAuthenticated,
      isLoading,
      isDemoMode,
      isFirestoreConnected,
      employees,
      attendance,
      auditLogs,
      settings,
      companyWorkZone,
      leaveRequests,
      loginWithEmail,
      signUpUser,
      quickDemoLogin,
      logout,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      recordCheckIn,
      recordCheckOut,
      updateAttendanceRecord,
      updateSettings,
      saveCompanyWorkZone,
      submitLeaveRequest,
      updateLeaveRequestStatus,
      addAuditLog,
      resetToDemoData,
      regenerateQrToken
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
