import { Employee, AttendanceRecord, AuditLog, CompanySettings, DocumentTemplate, LeaveRequest } from '../types';

export const INITIAL_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'Kalpanaaa Software Solutions',
  logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=120&auto=format&fit=crop&q=80',
  companyAddress: 'No. 14, Bhoganahalli, Sarjapur Road, Bengaluru, KA 560102',
  companyPhone: '+91 (040) 4821-9900',
  companyEmail: 'hr@kalpanaaa.in',
  
  officeName: 'Kalpanaaa Main Office HQ',
  officeLatitude: 13.014333,
  officeLongitude: 77.646000,
  gpsRequired: true,
  allowedRadiusMeters: 500,
  workStartTime: '10:00',
  workEndTime: '19:30',
  gracePeriodMinutes: 60,
  lateThresholdMinutes: 60,
  teaBreakDurationMinutes: 10,
  lunchBreakDurationMinutes: 30,
  wfhEnabled: true,
  companyWideWfhDates: [],
  
  qrTokenLifetimeMinutes: 10,
  qrAttendanceEnabled: true,
  
  pdfHeaderTitle: 'CONFIDENTIAL WORKFORCE & ATTENDANCE STATEMENT',
  authorizedSignatureName: 'Akshit',
  authorizedSignatureTitle: 'Chief Executive Officer (CEO)'
};

const TODAY_STR = new Date().toISOString().split('T')[0];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-KSS2407001',
    employeeId: 'KSS2407001',
    fullName: 'Gaurav Kumar Tripathi',
    email: 'founder@kalpanaaasoftwaresolutions.in',
    phone: '+91 74390 67376',
    gender: 'Male',
    dateOfBirth: '1995-05-15',
    department: 'Engineering',
    designation: 'Chief Technology Officer (CTO)',
    joiningDate: '2024-01-01',
    employmentType: 'Full-Time',
    reportingManager: 'Executive Board',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '+91 74390 67376',
    emergencyRelationship: 'Management',
    role: 'SUPER_ADMIN',
    qrToken: 'QR-KSS2407001',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300'
  },
  {
    id: 'emp-KSS2407002',
    employeeId: 'KSS2407002',
    fullName: 'Akshit Ujjain',
    email: 'akshit.ujjain@kalpanaaasoftwaresolutions.in',
    phone: '+919790733700',
    gender: 'Male',
    dateOfBirth: '1996-08-20',
    department: 'Operations',
    designation: 'CEO',
    joiningDate: '2024-01-01',
    employmentType: 'Full-Time',
    reportingManager: 'Executive Board',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '+919790733700',
    emergencyRelationship: 'Management',
    role: 'SUPER_ADMIN',
    qrToken: 'QR-KSS2407002',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300'
  },
  {
    id: 'emp-KSS2407003',
    employeeId: 'KSS2407003',
    fullName: 'D. Koushik',
    email: 'd.koushik@kalpanaaasoftwaresolutions.in',
    phone: '+91 98765 00003',
    gender: 'Male',
    dateOfBirth: '1997-03-10',
    department: 'Software Engineering',
    designation: 'Project Manager',
    joiningDate: '2024-02-15',
    employmentType: 'Full-Time',
    reportingManager: 'Akshit Ujjain',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '+91 98765 00003',
    emergencyRelationship: 'Management',
    role: 'PROJECT_MANAGER',
    qrToken: 'QR-KSS2407003',
    createdAt: '2024-02-15T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'
  },
  {
    id: 'emp-KSS2407004',
    employeeId: 'KSS2407004',
    fullName: 'Asbin T S',
    email: 'asbin.ts@kalpanaaa.in',
    phone: '7603872359',
    gender: 'Male',
    dateOfBirth: '1998-11-05',
    department: 'Engineering',
    designation: 'Frontend Developer',
    joiningDate: '2024-03-01',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '7603872359',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407004',
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300'
  },
  {
    id: 'emp-KSS2407005',
    employeeId: 'KSS2407005',
    fullName: 'Thabeethal Asnath I',
    email: 'i.thabeethal.asnath@kalpanaaa.in',
    phone: '9080841727',
    gender: 'Female',
    dateOfBirth: '1999-04-18',
    department: 'Engineering',
    designation: 'Backend Developer',
    joiningDate: '2024-03-01',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '9080841727',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407005',
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300'
  },
  {
    id: 'emp-KSS2407006',
    employeeId: 'KSS2407006',
    fullName: 'Kuruva Mahesh',
    email: 'kuruva.mahesh@kalpanaaa.in',
    phone: '+91 93924 13033',
    gender: 'Male',
    dateOfBirth: '1998-07-22',
    department: 'Product & Design',
    designation: 'UI/UX Designer',
    joiningDate: '2024-03-15',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '+91 93924 13033',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407006',
    createdAt: '2024-03-15T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300'
  },
  {
    id: 'emp-KSS2407007',
    employeeId: 'KSS2407007',
    fullName: 'Ritish Devadiga',
    email: 'ritish.krishna.devadiga@kalpanaaa.in',
    phone: '7338516935',
    gender: 'Male',
    dateOfBirth: '1999-09-30',
    department: 'Product & Design',
    designation: 'UI/UX Designer',
    joiningDate: '2024-03-15',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '7338516935',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407007',
    createdAt: '2024-03-15T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300'
  },
  {
    id: 'emp-KSS2407008',
    employeeId: 'KSS2407008',
    fullName: 'Pratiksha Harode',
    email: 'pratiksha.harode@kalpanaaa.in',
    phone: '+916268164429',
    gender: 'Female',
    dateOfBirth: '2000-01-12',
    department: 'Software Engineering',
    designation: 'Software Engineer',
    joiningDate: '2024-04-01',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '+916268164429',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407008',
    createdAt: '2024-04-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300'
  },
  {
    id: 'emp-KSS2407009',
    employeeId: 'KSS2407009',
    fullName: 'Priyanka Kushwah',
    email: 'priyanka.kushwah@kalpanaaa.in',
    phone: '780600480',
    gender: 'Female',
    dateOfBirth: '2000-06-14',
    department: 'Software Engineering',
    designation: 'Software Engineer',
    joiningDate: '2024-04-01',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '780600480',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407009',
    createdAt: '2024-04-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'
  },
  {
    id: 'emp-KSS2407010',
    employeeId: 'KSS2407010',
    fullName: 'Prahlad Sharma',
    email: 'prahlad.sharma@kalpanaaa.in',
    phone: '8527949523',
    gender: 'Male',
    dateOfBirth: '1998-12-01',
    department: 'Engineering',
    designation: 'Frontend Developer',
    joiningDate: '2024-04-10',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '8527949523',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407010',
    createdAt: '2024-04-10T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300'
  },
  {
    id: 'emp-KSS2407011',
    employeeId: 'KSS2407011',
    fullName: 'Abhinaya V',
    email: 'abhinayav1919@kalpanaaa.in',
    phone: '8105866141',
    gender: 'Female',
    dateOfBirth: '1997-02-19',
    department: 'HR Department',
    designation: 'HR Operations Manager',
    joiningDate: '2024-02-01',
    employmentType: 'Full-Time',
    reportingManager: 'Akshit Ujjain',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '8105866141',
    emergencyRelationship: 'Management',
    role: 'HR_ADMIN',
    qrToken: 'QR-KSS2407011',
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    approvedWfhDates: ['2026-09-14', '2026-09-15'],
    profilePhotoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300'
  },
  {
    id: 'emp-KSS2407012',
    employeeId: 'KSS2407012',
    fullName: 'Satya Ranjan Das',
    email: 'satya.ranjan.dash@kalpanaaa.in',
    phone: '72056 63611',
    gender: 'Male',
    dateOfBirth: '1999-10-15',
    department: 'Software Engineering',
    designation: 'Software Engineer',
    joiningDate: '2024-05-01',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '72056 63611',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407012',
    createdAt: '2024-05-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300'
  },
  {
    id: 'emp-KSS2407013',
    employeeId: 'KSS2407013',
    fullName: 'Akash SB',
    email: 'sb.akash@kalpanaaa.in',
    phone: '9360843281',
    gender: 'Male',
    dateOfBirth: '2000-08-08',
    department: 'Engineering',
    designation: 'Backend Developer',
    joiningDate: '2024-05-01',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '9360843281',
    emergencyRelationship: 'Family',
    role: 'EMPLOYEE',
    qrToken: 'QR-KSS2407013',
    createdAt: '2024-05-01T10:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300'
  },
  {
    id: 'KfAB95lpbJOeylpKQaWX4GXOPGt2',
    employeeId: 'KSS2407014',
    fullName: 'Jason Kenneth N',
    email: 'jasonkennethn@kalpanaaa.in',
    phone: '+91 98765 00014',
    gender: 'Male',
    dateOfBirth: '2000-01-01',
    department: 'Engineering',
    designation: 'Software Engineer',
    joiningDate: '2026-08-17',
    employmentType: 'Full-Time',
    reportingManager: 'D. Koushik',
    workLocation: 'Main Office HQ',
    status: 'Active',
    shift: 'Day Shift (10:00 - 19:30)',
    permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560102',
    emergencyContact: '+91 98765 00000',
    emergencyRelationship: 'Management',
    role: 'EMPLOYEE',
    qrToken: 'KSS2407014',
    createdAt: '2026-08-17T04:38:47.685Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'
  }
];

// Helper to generate initial attendance history (Returns empty - ONLY real live user check-ins are stored!)
export function generateInitialAttendance(): AttendanceRecord[] {
  return [];
}

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-101',
    actorId: 'system',
    actorName: 'System',
    actorRole: 'SUPER_ADMIN',
    action: 'SYSTEM_INIT',
    target: 'Database',
    details: 'System initialized for Kalpanaaa Software Solutions with fresh database.',
    timestamp: new Date().toISOString()
  }
];

export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'LR-ABHINAYA-001',
    employeeId: 'emp-KSS2407011',
    employeeName: 'Abhinaya V',
    department: 'HR Department',
    type: 'WFH',
    startDate: '2026-09-14',
    endDate: '2026-09-15',
    reason: 'health issue',
    status: 'Approved',
    pmStatus: 'Approved',
    ctoStatus: 'Approved',
    ceoStatus: 'Approved',
    reviewedBy: 'Gaurav Kumar Tripathi (CTO)',
    requestDate: '2026-08-13T10:00:00.000Z'
  }
];

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'tmpl-id-card',
    title: 'Official Employee ID Badge Card',
    description: 'Print-ready corporate identity badge containing employee photo, designation, QR code & security seal.',
    category: 'ID Card',
    contentMarkdown: `
# KALPANA ENTERPRISE SOLUTIONS
**EMPLOYEE IDENTIFICATION CARD**

---
Photo: {{PROFILE_PHOTO}}
Name: **{{FULL_NAME}}**
Employee ID: **{{EMPLOYEE_ID}}**
Designation: **{{DESIGNATION}}**
Department: **{{DEPARTMENT}}**
Work Location: **{{WORK_LOCATION}}**

Security QR Token: {{QR_CODE}}
Issued: {{JOINING_DATE}} | Emergency: {{EMERGENCY_CONTACT}}
    `
  },
  {
    id: 'tmpl-att-stmt',
    title: 'Monthly Attendance & Working Hours Statement',
    description: 'Official monthly attendance log detailing daily check-ins, check-outs, total hours, and HR certification.',
    category: 'Attendance',
    contentMarkdown: `
# KALPANA ENTERPRISE SOLUTIONS
### MONTHLY ATTENDANCE CERTIFICATION STATEMENT

**Employee Name:** {{FULL_NAME}}
**Employee ID:** {{EMPLOYEE_ID}}
**Department:** {{DEPARTMENT}}
**Period:** {{CURRENT_MONTH}}

---
### Attendance Summary:
* Total Working Days: {{TOTAL_DAYS}}
* Days Present: {{DAYS_PRESENT}}
* Late Arrivals: {{DAYS_LATE}}
* Half Days / Leaves: {{DAYS_LEAVE}}
* Total Recorded Hours: {{TOTAL_HOURS}} hrs

*This statement is verified and generated electronically by the Enterprise HRMS system.*
    `
  },
  {
    id: 'tmpl-hr-letter',
    title: 'Official Employment & Verification Letter',
    description: 'Formal HR confirmation letter confirming employment status, designation, and company standing.',
    category: 'HR',
    contentMarkdown: `
# KALPANA ENTERPRISE SOLUTIONS
Plot 42, Tech Corridor, Hitech City, Hyderabad, TG 500081

**TO WHOMSOEVER IT MAY CONCERN**

This is to certify that **{{FULL_NAME}}** (Employee ID: **{{EMPLOYEE_ID}}**) is a full-time employee with Kalpanaaa Enterprise Solutions, currently serving as **{{DESIGNATION}}** in the **{{DEPARTMENT}}** department since **{{JOINING_DATE}}**.

During their tenure, {{FULL_NAME}} has demonstrated exemplary performance and professionalism. Their current work location is **{{WORK_LOCATION}}**.

This certificate is issued upon employee request for official documentation purposes.

**For Kalpanaaa Enterprise Solutions,**

*Rahul Sharma*
Head of Human Resources
Date: {{CURRENT_DATE}}
    `
  }
];
