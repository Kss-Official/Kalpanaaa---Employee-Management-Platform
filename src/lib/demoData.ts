import { Employee, AttendanceRecord, AuditLog, CompanySettings, DocumentTemplate } from '../types';

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
  workStartTime: '09:00',
  workEndTime: '18:00',
  gracePeriodMinutes: 15,
  lateThresholdMinutes: 30,
  teaBreakDurationMinutes: 10,
  lunchBreakDurationMinutes: 30,
  wfhEnabled: true,
  
  qrTokenLifetimeMinutes: 10,
  qrAttendanceEnabled: true,
  
  pdfHeaderTitle: 'CONFIDENTIAL WORKFORCE & ATTENDANCE STATEMENT',
  authorizedSignatureName: 'Akshit',
  authorizedSignatureTitle: 'Chief Executive Officer (CEO)'
};

const TODAY_STR = new Date().toISOString().split('T')[0];

export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: 'emp-003',
    employeeId: '003',
    fullName: 'D. Koushik',
    email: 'd.koushik@kalpanaaa.in',
    role: 'HR_ADMIN',
    department: 'Software Engineering',
    designation: 'Project Manager',
    status: 'Active',
    phone: '',
    gender: 'Male',
    dateOfBirth: '1995-01-01',
    joiningDate: '2024-07-01',
    employmentType: 'Full-Time',
    permanentAddress: '',
    currentAddress: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '',
    emergencyContact: '',
    emergencyRelationship: '',
    shift: 'General Shift (09:00 - 18:00)',
    workLocation: 'Kalpanaaa Main Office HQ, Bengaluru',
    reportingManager: 'Akshit',
    qrToken: 'QR-TOKEN-003-SECURE-HASH-4912',
    createdAt: '2024-07-01T09:00:00Z',
    updatedAt: new Date().toISOString(),
    profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    resumeUrl: ''
  }
];

// Helper to generate last 7 days attendance history
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
