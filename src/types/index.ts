export type UserRole = 'SUPER_ADMIN' | 'HR_ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE';

export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Contract' | 'Intern';

export type EmployeeStatus = 'Active' | 'On Leave' | 'Terminated' | 'Suspended';

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' | 'Holiday' | 'Work From Home';

export type BreakType = 
  | 'Tea Break' 
  | 'Meal Break' 
  | 'Team Huddle' 
  | 'Team Meeting' 
  | 'Attainment / Training' 
  | 'Activity' 
  | 'Geo-Fence Auto Break';

export const normalizeBreakType = (type?: string): BreakType | string => {
  if (!type) return 'Meal Break';
  const lower = type.toLowerCase();
  if (lower.includes('huddle')) return 'Team Huddle';
  if (lower.includes('meeting')) return 'Team Meeting';
  if (lower.includes('meal') || lower.includes('lunch')) return 'Meal Break';
  if (lower.includes('tea break') || lower.includes('tea /') || lower.includes('coffee') || lower === 'tea') return 'Tea Break';
  if (lower.includes('attainment') || lower.includes('training')) return 'Attainment / Training';
  if (lower.includes('activity')) return 'Activity';
  if (lower.includes('geo')) return 'Geo-Fence Auto Break';
  return type;
};

export interface BreakEntry {
  type: BreakType;
  startAt: string;   // ISO timestamp
  endAt: string | null; // null = break is ongoing
  durationMinutes: number;
}

export interface LeaveRequest {
  id: string;
  employeeUid?: string; // Canonical Firebase Auth UID anchor
  employeeId: string;   // Corporate identifier (e.g. KSS2407004)
  employeeName: string;
  department?: string;
  employeeRole?: UserRole | string;
  pmUid?: string;       // Assigned Project Manager Auth UID for scoped routing
  type: 'Leave' | 'WFH';
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  requestDate: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  
  // Multi-tier Approval Cycle fields (PM -> HR -> CEO -> CTO)
  pmStatus?: 'Pending' | 'Approved' | 'Rejected' | 'N/A' | 'Bypassed';
  pmRecommendation?: 'Approved' | 'Rejected';
  pmNotes?: string;
  pmReviewedBy?: string;
  pmReviewedAt?: string;

  hrStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Waiting PM' | 'N/A' | 'Bypassed';
  hrNotes?: string;
  hrReviewedBy?: string;
  hrReviewedAt?: string;

  ceoStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Waiting PM' | 'Waiting HR' | 'N/A' | 'Bypassed';
  ceoNotes?: string;
  ceoReviewedBy?: string;
  ceoReviewedAt?: string;

  ctoStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Waiting CEO' | 'N/A' | 'Bypassed';
  ctoNotes?: string;
  ctoReviewedBy?: string;
  ctoReviewedAt?: string;

  // Audited Emergency SuperAdmin Override fields
  isEmergencyOverride?: boolean;
  overrideBy?: string;
  overrideReason?: string;
}

export interface LeaveLockEntry {
  id: string; // YYYY-MM-DD
  requestId: string;
  employeeUid: string;
  employeeId: string;
  type: 'Leave' | 'WFH';
  active: boolean;
  reservedAt: string;
}

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  executiveRole?: 'CEO' | 'CTO';
  fullName: string;
  employeeId: string;
  department?: string;
  createdAt?: string;
}

export type AttendanceMethod = 'QR Code' | 'Manual Admin' | 'Self Portal' | 'Biometric' | 'Facial Recognition';

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
  reportingManagerUid?: string; // Linked PM / Manager Auth UID
  pmUid?: string;
  executiveRole?: 'CEO' | 'CTO';
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

  // Facial Biometrics
  isFaceEnrolled?: boolean;
  faceEnrolledAt?: string;
  faceDescriptor?: number[];

  // System
  role: UserRole;
  qrToken: string;
  approvedWfhDates?: string[]; // YYYY-MM-DD format
  currentSessionId?: string; // For backward compatibility
  desktopSessionId?: string; // Active Laptop/Desktop session ID
  mobileSessionId?: string;  // Active Mobile/Tablet session ID
  sessionFingerprint?: string;
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
  employeeUid?: string; // Linked Firebase Auth UID
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  pmUid?: string; // Reporting PM Auth UID
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
  companyWideWfhDates?: string[]; // Dates (YYYY-MM-DD) assigned by CEO or CTO for Office-Wide WFH
  
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

// PM & Project Models
export type ProjectStatus = 'Not Started' | 'In Progress' | 'In Review' | 'Completed' | 'On Track' | 'At Risk' | 'Delayed';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Backlog' | 'To Do' | 'In Progress' | 'In Review' | 'Done';

export interface Project {
  id: string;
  name: string;
  description: string;
  client?: string;
  startDate: string;
  deadline: string;
  status: ProjectStatus;
  progressPercent: number;
  teamMemberIds: string[];
  managerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  estimatedHours?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OneOnOneNote {
  id: string;
  employeeId: string;
  managerId: string;
  date: string;
  agenda: string;
  notes: string;
  actionItems: string[];
  createdAt: string;
}

export interface SalaryDisbursement {
  id: string;
  month: string; // e.g. "2026-07"
  employeeId: string;
  employeeName: string;
  department: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  daysWorked: number;
  status: 'Draft' | 'Approved' | 'Paid';
  processedAt?: string;
}
