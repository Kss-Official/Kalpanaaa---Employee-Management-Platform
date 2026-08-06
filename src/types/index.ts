export type UserRole = 'SUPER_ADMIN' | 'HR_ADMIN' | 'EMPLOYEE';

export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Contract' | 'Intern';

export type EmployeeStatus = 'Active' | 'On Leave' | 'Terminated' | 'Suspended';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Holiday' | 'Work From Home';

export interface BreakEntry {
  type: 'Tea Break' | 'Lunch Break' | 'Geo-Fence Auto Break';
  startAt: string;   // ISO timestamp
  endAt: string | null; // null = break is ongoing
  durationMinutes: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'Leave' | 'WFH';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestDate: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export type AttendanceMethod = 'QR Code' | 'Manual Admin' | 'Self Portal' | 'Biometric';

export interface Employee {
  id: string; // Firestore document ID
  employeeId: string; // e.g. EMP-1001
  uid?: string; // Linked Firebase Auth UID
  fullName: string;
  email: string;
  phone: string;
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  dateOfBirth: string;
  profilePhotoUrl?: string;
  resumeUrl?: string;

  // Employment
  department: string;
  designation: string;
  joiningDate: string;
  employmentType: EmploymentType;
  reportingManager: string;
  workLocation: string;
  status: EmployeeStatus;
  shift: string; // e.g., 'Day Shift (09:00 - 18:00)'

  // Personal & Profile
  permanentAddress: string;
  currentAddress: string;
  city: string;
  state: string;
  postalCode: string;
  emergencyContact: string;
  emergencyRelationship: string;
  bio?: string;
  skills?: string[];
  preferredShift?: string;
  linkedinUrl?: string;

  // System
  role: UserRole;
  qrToken: string;
  approvedWfhDates?: string[]; // YYYY-MM-DD format
  currentSessionId?: string; // For preventing concurrent logins
  sessionFingerprint?: string; // For preventing session token theft / device spoofing
  failedLoginCount?: number;
  lockoutUntil?: number; // timestamp
  createdAt: string;
  updatedAt: string;
}

export interface WorkZone {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  active: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  date: string; // YYYY-MM-DD
  checkInAt: string | null; // ISO timestamp
  checkOutAt: string | null; // ISO timestamp
  workingMinutes: number;
  status: AttendanceStatus;
  attendanceMethod: AttendanceMethod;
  
  // Work Zone Location Snapshot fields
  officeLatitude?: number;
  officeLongitude?: number;
  officeRadiusMeters?: number;
  distanceFromOffice?: number;
  locationAccuracy?: number;
  locationVerified: boolean;

  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  notes?: string;

  // Break tracking
  breaks?: BreakEntry[];
  totalBreakMinutes?: number; // sum of all completed breaks
  isWfh?: boolean; // work from home flag

  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  target: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface CompanySettings {
  companyName: string;
  logoUrl: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  
  // GPS & Attendance
  officeName: string;
  officeLatitude: number;
  officeLongitude: number;
  officeStaticIp?: string; // For strict Wi-Fi check-in
  gpsRequired: boolean;
  allowedRadiusMeters: number;
  workStartTime: string; // "09:00"
  workEndTime: string; // "18:00"
  gracePeriodMinutes: number; // 15
  lateThresholdMinutes: number; // 30
  teaBreakDurationMinutes: number; // 10
  lunchBreakDurationMinutes: number; // 30
  wfhEnabled: boolean;
  
  // QR settings
  qrTokenLifetimeMinutes: number;
  qrAttendanceEnabled: boolean;
  
  // Reports & Signature
  pdfHeaderTitle: string;
  authorizedSignatureName: string;
  authorizedSignatureTitle: string;
}

export interface DocumentTemplate {
  id: string;
  title: string;
  description: string;
  category: 'HR' | 'Attendance' | 'ID Card' | 'Certification';
  contentMarkdown: string;
}
