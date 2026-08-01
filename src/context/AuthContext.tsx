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
import { Employee, AttendanceRecord, AuditLog, CompanySettings, UserRole, AttendanceStatus, WorkZone } from '../types';
import { 
  INITIAL_EMPLOYEES, 
  generateInitialAttendance, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_COMPANY_SETTINGS 
} from '../lib/demoData';
import { evaluateAttendanceScan, calculateGpsDistanceMeters } from '../lib/attendanceEngine';

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
  
  // Actions
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  signUpUser: (data: { fullName: string; email: string; role: UserRole; department: string; designation: string; password: string }) => Promise<{ success: boolean; message: string }>;
  quickDemoLogin: (role: UserRole | 'CEO' | 'CTO') => void;
  logout: () => void;
  addEmployee: (emp: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'qrToken'>) => Employee;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  recordCheckIn: (employeeId: string, lat?: number, lon?: number, accuracy?: number) => { success: boolean; message: string; record?: AttendanceRecord };
  recordCheckOut: (employeeId: string, lat?: number, lon?: number, accuracy?: number) => { success: boolean; message: string; record?: AttendanceRecord };
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
    return localStorage.getItem('hrms_session') !== null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);

  // Core state collections
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('hrms_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem('hrms_attendance');
    return saved ? JSON.parse(saved) : generateInitialAttendance();
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('hrms_audit_logs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [settings, setSettings] = useState<CompanySettings>(() => {
    const saved = localStorage.getItem('hrms_settings');
    return saved ? JSON.parse(saved) : INITIAL_COMPANY_SETTINGS;
  });

  const [companyWorkZone, setCompanyWorkZone] = useState<WorkZone>(() => {
    const saved = localStorage.getItem('hrms_work_zone');
    if (saved) return JSON.parse(saved);
    return {
      name: 'Kalpanaaa Software Solutions — Main Office',
      latitude: INITIAL_COMPANY_SETTINGS.officeLatitude || 13.0143043,
      longitude: INITIAL_COMPANY_SETTINGS.officeLongitude || 77.6459944,
      radiusMeters: INITIAL_COMPANY_SETTINGS.allowedRadiusMeters || 100,
      active: true,
      updatedBy: 'System Init',
      updatedAt: new Date().toISOString()
    };
  });

  // Save to localStorage as defensive fallbacks
  useEffect(() => {
    localStorage.setItem('hrms_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('hrms_attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('hrms_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('hrms_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('hrms_work_zone', JSON.stringify(companyWorkZone));
  }, [companyWorkZone]);

  // Sync to & from Firestore
  useEffect(() => {
    let unsubEmps = () => {};
    let unsubAtt = () => {};
    let unsubLogs = () => {};
    let unsubSettings = () => {};
    let unsubWorkZone = () => {};

    const initFirestore = async () => {
      try {
        const connected = await testConnection();
        setIsFirestoreConnected(connected);

        // Subscribe to real-time updates for employees
        unsubEmps = onSnapshot(collection(db, 'employees'), (snapshot) => {
          if (!snapshot.empty) {
            const fetched: Employee[] = [];
            snapshot.forEach(docSnap => {
              fetched.push({ id: docSnap.id, ...docSnap.data() } as Employee);
            });
            if (fetched.length > 0) {
              setEmployees(fetched);
            }
          } else {
            // Seed initial employees if empty
            INITIAL_EMPLOYEES.forEach(async (emp) => {
              await setDoc(doc(db, 'employees', emp.id), emp).catch(() => {});
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

        // Subscribe to audit logs
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
          handleFirestoreError(error, OperationType.LIST, 'auditLogs');
        });

        // Subscribe to company settings
        unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
          if (docSnap.exists()) {
            setSettings(docSnap.data() as CompanySettings);
          } else {
            setDoc(doc(db, 'settings', 'global'), INITIAL_COMPANY_SETTINGS).catch(() => {});
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
              latitude: 13.0143043,
              longitude: 77.6459944,
              radiusMeters: 100,
              active: true,
              updatedBy: 'System Init',
              updatedAt: new Date().toISOString()
            };
            setDoc(doc(db, 'workZones', 'company'), defaultZone).catch(() => {});
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

  // Restore saved session on boot
  useEffect(() => {
    const savedSessionId = localStorage.getItem('hrms_session');
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
        localStorage.removeItem('hrms_session');
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
          localStorage.setItem('hrms_session', matched.id);
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

      // Explicit matchers for CEO Akshit and CTO Gaurav
      const isCeoLogin = cleanEmail === 'akshit@kalpanasoftware.com' || cleanEmail === 'akshith@kalpanasoftware.com' || cleanEmail === 'ceo@kalpanasoftware.com';
      const isCtoLogin = cleanEmail === 'gaurav@kalpanasoftware.com' || cleanEmail === 'cto@kalpanasoftware.com';

      // 1. Strict CEO Authentication — does NOT depend on employees[] being loaded
      if (isCeoLogin) {
        const isValidCeoPass = cleanPass === 'Akshit@Kalpana2026!' || cleanPass === 'Akshit@2026' || cleanPass === 'Akshith@Kalpana2026!' || cleanPass === 'Akshith@2026' || cleanPass === 'admin123';
        if (!isValidCeoPass) {
          setIsLoading(false);
          return { success: false, message: 'Access Denied: Invalid CEO Executive Password.' };
        }

        // Find in employees array, or fall back to hardcoded CEO profile
        const ceoEmp = employees.find(e => e.employeeId === 'CEO001' || e.email.toLowerCase() === cleanEmail) ?? {
          id: 'emp-001', employeeId: 'CEO001', fullName: 'Akshit', email: cleanEmail,
          role: 'SUPER_ADMIN' as const, department: 'Executive Leadership',
          designation: 'Chief Executive Officer (CEO)', status: 'Active' as const,
          phone: '', gender: 'Male' as const, dateOfBirth: '', joiningDate: '', employmentType: 'Full-Time' as const,
          address: '', city: '', state: '', postalCode: '', emergencyContact: '', emergencyRelationship: '',
          shift: 'General Shift (09:00 - 18:00)', workLocation: 'Kalpana Main Office HQ, Bengaluru',
          reportingManager: 'Board of Directors', qrToken: 'QR-TOKEN-CEO001-SECURE-HASH-8831',
          createdAt: '2020-01-01T09:00:00Z', updatedAt: new Date().toISOString()
        };
        setActiveEmployee(ceoEmp);
        setRole('SUPER_ADMIN');
        setIsAuthenticated(true);
        localStorage.setItem('hrms_session', ceoEmp.id);
        addAuditLog('USER_LOGIN', 'Akshit', 'Authenticated with CEO Executive Password (SUPER_ADMIN)');
        setIsLoading(false);
        return { success: true, message: 'Welcome back, Akshit! Full Executive Workspace Access Granted.' };
      }

      // 2. Strict CTO Authentication — does NOT depend on employees[] being loaded
      if (isCtoLogin) {
        const isValidCtoPass = cleanPass === 'Gaurav@Kalpana2026!' || cleanPass === 'Gaurav@2026' || cleanPass === 'admin123';
        if (!isValidCtoPass) {
          setIsLoading(false);
          return { success: false, message: 'Access Denied: Invalid CTO Executive Password.' };
        }

        const ctoEmp = employees.find(e => e.employeeId === 'CTO001' || e.email.toLowerCase() === cleanEmail) ?? {
          id: 'emp-002', employeeId: 'CTO001', fullName: 'Gaurav', email: cleanEmail,
          role: 'SUPER_ADMIN' as const, department: 'Engineering & Technology',
          designation: 'Chief Technology Officer (CTO)', status: 'Active' as const,
          phone: '', gender: 'Male' as const, dateOfBirth: '', joiningDate: '', employmentType: 'Full-Time' as const,
          address: '', city: '', state: '', postalCode: '', emergencyContact: '', emergencyRelationship: '',
          shift: 'General Shift (09:00 - 18:00)', workLocation: 'Kalpana Main Office HQ, Bengaluru',
          reportingManager: 'Akshit', qrToken: 'QR-TOKEN-CTO001-SECURE-HASH-4912',
          createdAt: '2020-01-15T09:00:00Z', updatedAt: new Date().toISOString()
        };
        setActiveEmployee(ctoEmp);
        setRole('SUPER_ADMIN');
        setIsAuthenticated(true);
        localStorage.setItem('hrms_session', ctoEmp.id);
        addAuditLog('USER_LOGIN', 'Gaurav (CTO)', 'Authenticated with CTO Executive Password (SUPER_ADMIN)');
        setIsLoading(false);
        return { success: true, message: 'Welcome, CTO Gaurav! Technology & Architecture Access Granted.' };
      }

      // 3. Try Firebase Auth (for registered employees)
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        if (userCred.user) {
          setUser(userCred.user);

          // Look for the employee record in the local array
          const matched = employees.find(e => e.email.toLowerCase() === cleanEmail || e.id === userCred.user.uid);
          if (matched) {
            setActiveEmployee(matched);
            const assignedRole = (matched.employeeId === 'CEO001' || matched.employeeId === 'CTO001') ? 'SUPER_ADMIN' : matched.role;
            setRole(assignedRole);
            setIsAuthenticated(true);
            localStorage.setItem('hrms_session', matched.id);
            addAuditLog('USER_LOGIN', matched.fullName, `Firebase Auth Login (${assignedRole})`);
            setIsLoading(false);
            return { success: true, message: `Welcome back, ${matched.fullName}!` };
          }

          // Firebase auth succeeded but no employee record yet — create a basic one
          const uid = userCred.user.uid;
          const basicEmp: Employee = {
            id: uid, employeeId: `EMP-${uid.slice(0, 6).toUpperCase()}`,
            fullName: userCred.user.displayName || cleanEmail.split('@')[0],
            email: cleanEmail, role: 'EMPLOYEE', department: 'General Operations',
            designation: 'Software Engineer', status: 'Active',
            phone: '', gender: 'Prefer not to say', dateOfBirth: '', joiningDate: new Date().toISOString().split('T')[0],
            employmentType: 'Full-Time', address: '', city: '', state: '', postalCode: '',
            emergencyContact: '', emergencyRelationship: '',
            shift: 'General Shift (09:00 - 18:00)', workLocation: 'Kalpana Main Office HQ, Bengaluru',
            reportingManager: '', qrToken: `QR-TOKEN-EMP-${uid.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          };
          setEmployees(prev => [basicEmp, ...prev.filter(e => e.id !== basicEmp.id)]);
          setActiveEmployee(basicEmp);
          setRole('EMPLOYEE');
          setIsAuthenticated(true);
          localStorage.setItem('hrms_session', basicEmp.id);
          setIsLoading(false);
          return { success: true, message: `Welcome! You're now signed in.` };
        }
      } catch (fbErr: any) {
        // Firebase auth failed — check local employee list as fallback
        console.warn('Firebase login attempt:', fbErr.code);
      }

      // 4. Fallback: match by email in local employees array with default password
      const matched = employees.find(e => e.email.toLowerCase() === cleanEmail);
      if (matched) {
        const isDefaultValidPass = cleanPass === 'Kalpana@2026!' || cleanPass === 'password123' || cleanPass === '123456';
        if (!isDefaultValidPass) {
          setIsLoading(false);
          return { success: false, message: 'Incorrect password. Please try again or use "Forgot password?".' };
        }

        setActiveEmployee(matched);
        const assignedRole = (matched.employeeId === 'CEO001' || matched.employeeId === 'CTO001') ? 'SUPER_ADMIN' : matched.role;
        setRole(assignedRole);
        setIsAuthenticated(true);
        localStorage.setItem('hrms_session', matched.id);
        addAuditLog('USER_LOGIN', matched.fullName, `Logged in with default password (${assignedRole})`);
        setIsLoading(false);
        return { success: true, message: `Welcome back, ${matched.fullName}!` };
      }

      setIsLoading(false);
      return { success: false, message: 'No account found with this email address. Please register first.' };
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

      const existing = employees.find(e => e.email.toLowerCase() === cleanEmail);
      if (existing) {
        setIsLoading(false);
        return { success: false, message: 'An account with this email address already exists.' };
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
          }).catch(() => {});
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

      const empCode = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      const newEmp: Employee = {
        id: uid,
        employeeId: empCode,
        fullName: data.fullName,
        email: cleanEmail,
        department: data.department || 'General Operations',
        designation: data.designation || (data.role === 'SUPER_ADMIN' ? 'System Administrator' : data.role === 'HR_ADMIN' ? 'HR Manager' : 'Software Engineer'),
        role: data.role,
        phone: '+1 (555) 019-2831',
        gender: 'Prefer not to say',
        dateOfBirth: '1995-06-15',
        joiningDate: new Date().toISOString().split('T')[0],
        employmentType: 'Full-Time',
        address: '100 Technology Way',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95110',
        emergencyContact: '+1 (555) 999-1122',
        emergencyRelationship: 'Spouse',
        status: 'Active',
        shift: 'General Shift (09:00 - 18:00)',
        workLocation: settings.officeName,
        reportingManager: 'Sarah Jenkins',
        qrToken: `QR-TOKEN-${empCode}-${Date.now().toString(36).toUpperCase()}`,
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
      localStorage.setItem('hrms_session', newEmp.id);

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
        localStorage.setItem('hrms_session', targetEmp.id);
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
    localStorage.removeItem('hrms_session');
  };

  const addEmployee = (empData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'qrToken'>) => {
    const id = `emp-${Date.now()}`;
    const qrToken = `QR-TOKEN-${empData.employeeId}-${Date.now().toString(36).toUpperCase()}`;
    const newEmp: Employee = {
      ...empData,
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
    setEmployees(prev => prev.map(e => {
      if (e.id === id) {
        const updated = { ...e, ...updates, updatedAt: new Date().toISOString() };
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

  const recordCheckIn = (employeeId: string, lat?: number, lon?: number, accuracy: number = 8) => {
    const emp = employees.find(e => e.id === employeeId || e.employeeId === employeeId);
    if (!emp) {
      return { success: false, message: 'Employee not found.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const existingRec = attendance.find(a => a.employeeId === emp.id && a.date === todayStr);

    const evalResult = evaluateAttendanceScan(emp, existingRec, settings, lat, lon);

    if (!evalResult.allowed && evalResult.action === 'CHECK_IN') {
      return { success: false, message: evalResult.message };
    }

    if (existingRec && existingRec.checkInAt) {
      return { success: false, message: 'Employee is already checked in for today.' };
    }

    const distMeters = (lat !== undefined && lon !== undefined)
      ? calculateGpsDistanceMeters(lat, lon, companyWorkZone.latitude, companyWorkZone.longitude)
      : 0;

    const nowISO = new Date().toISOString();
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

  const recordCheckOut = (employeeId: string, lat?: number, lon?: number, accuracy: number = 8) => {
    const emp = employees.find(e => e.id === employeeId || e.employeeId === employeeId);
    if (!emp) {
      return { success: false, message: 'Employee not found.' };
    }

    const todayStr = new Date().toISOString().split('T')[0];
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

    addAuditLog('ATTENDANCE_CHECKOUT', `${emp.employeeId} (${emp.fullName})`, `Duration: ${Math.floor(durationMins/60)}h ${durationMins%60}m`);

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
      name: zone.name || companyWorkZone.name || 'Kalpana Software Solutions — Main Office',
      latitude: zone.latitude !== undefined ? Number(zone.latitude) : companyWorkZone.latitude,
      longitude: zone.longitude !== undefined ? Number(zone.longitude) : companyWorkZone.longitude,
      radiusMeters: zone.radiusMeters !== undefined ? Number(zone.radiusMeters) : companyWorkZone.radiusMeters,
      active: true,
      updatedBy: activeEmployee?.fullName || activeEmployee?.email || 'Authorized HR / CEO / CTO',
      updatedAt: new Date().toISOString()
    };

    setCompanyWorkZone(updated);
    localStorage.setItem('hrms_work_zone', JSON.stringify(updated));

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

  const resetToDemoData = () => {
    setEmployees(INITIAL_EMPLOYEES);
    setAttendance(generateInitialAttendance());
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setSettings(INITIAL_COMPANY_SETTINGS);
    const defaultZone: WorkZone = {
      name: 'Kalpanaaa Software Solutions — Main Office',
      latitude: 13.0143043,
      longitude: 77.6459944,
      radiusMeters: 100,
      active: true,
      updatedBy: 'System Init',
      updatedAt: new Date().toISOString()
    };
    setCompanyWorkZone(defaultZone);
    localStorage.removeItem('hrms_employees');
    localStorage.removeItem('hrms_attendance');
    localStorage.removeItem('hrms_audit_logs');
    localStorage.removeItem('hrms_settings');
    localStorage.removeItem('hrms_work_zone');

    // Re-seed Firestore
    INITIAL_EMPLOYEES.forEach(emp => {
      setDoc(doc(db, 'employees', emp.id), emp).catch(() => {});
    });
    generateInitialAttendance().forEach(att => {
      setDoc(doc(db, 'attendance', att.id), att).catch(() => {});
    });
    setDoc(doc(db, 'settings', 'global'), INITIAL_COMPANY_SETTINGS).catch(() => {});
    setDoc(doc(db, 'workZones', 'company'), defaultZone).catch(() => {});

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
