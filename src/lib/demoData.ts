import { Employee, AttendanceRecord, AuditLog, CompanySettings, DocumentTemplate } from '../types';

export const INITIAL_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'Kalpanaaa Software Solutions',
  logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=120&auto=format&fit=crop&q=80',
  companyAddress: 'No. 14, Bhoganahalli, Sarjapur Road, Bengaluru, KA 560102',
  companyPhone: '+91 (040) 4821-9900',
  companyEmail: 'hr@kalpanasoftware.com',
  
  officeName: 'Kalpanaaa Main Office HQ',
  officeLatitude: 13.0143043,
  officeLongitude: 77.6459944,
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
    id: 'emp-001',
    employeeId: 'CEO001',
    uid: 'uid-akshit-ceo-001',
    fullName: 'Akshit',
    email: 'akshit@kalpanasoftware.com',
    phone: '+91 98765 00001',
    gender: 'Male',
    dateOfBirth: '1988-04-12',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    department: 'Executive Leadership',
    designation: 'Chief Executive Officer (CEO)',
    joiningDate: '2020-01-01',
    employmentType: 'Full-Time',
    reportingManager: 'Board of Directors',
    workLocation: 'Kalpanaaa Main Office HQ, Bengaluru',
    status: 'Active',
    shift: 'General Shift (09:00 - 18:00)',
    address: 'Executive Suite 01, Kalpanaaa Towers',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    emergencyContact: '+91 98765 99991',
    emergencyRelationship: 'Spouse',
    role: 'SUPER_ADMIN',
    qrToken: 'QR-TOKEN-CEO001-SECURE-HASH-8831',
    createdAt: '2020-01-01T09:00:00Z',
    updatedAt: TODAY_STR + 'T08:00:00Z'
  },
  {
    id: 'emp-002',
    employeeId: 'CTO001',
    uid: 'uid-gaurav-cto-002',
    fullName: 'Gaurav',
    email: 'gaurav@kalpanasoftware.com',
    phone: '+91 98765 00002',
    gender: 'Male',
    dateOfBirth: '1990-08-25',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    department: 'Engineering & Technology',
    designation: 'Chief Technology Officer (CTO)',
    joiningDate: '2020-01-15',
    employmentType: 'Full-Time',
    reportingManager: 'Akshit',
    workLocation: 'Kalpana Main Office HQ, Bengaluru',
    status: 'Active',
    shift: 'General Shift (09:00 - 18:00)',
    address: 'Executive Suite 02, Kalpana Towers',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    emergencyContact: '+91 98765 99992',
    emergencyRelationship: 'Spouse',
    role: 'SUPER_ADMIN',
    qrToken: 'QR-TOKEN-CTO001-SECURE-HASH-4912',
    createdAt: '2020-01-15T09:00:00Z',
    updatedAt: TODAY_STR + 'T08:00:00Z'
  },
  {
    id: 'emp-003',
    employeeId: 'EMP003',
    uid: 'uid-priya-003',
    fullName: 'Priya Nair',
    email: 'priya.nair@enterprise.hr',
    phone: '+91 97654 32109',
    gender: 'Female',
    dateOfBirth: '1993-02-28',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    department: 'Finance',
    designation: 'Lead Financial Controller',
    joiningDate: '2022-01-10',
    employmentType: 'Full-Time',
    reportingManager: 'Rahul Sharma',
    workLocation: 'AGPS Nagar HQ Campus',
    status: 'Active',
    shift: 'General Shift (09:00 - 18:00)',
    address: 'Flat 301, Orchid Residency',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500032',
    emergencyContact: '+91 97654 00003',
    emergencyRelationship: 'Father',
    role: 'HR_ADMIN',
    qrToken: 'QR-TOKEN-EMP003-SECURE-HASH-1109',
    createdAt: '2022-01-10T09:00:00Z',
    updatedAt: TODAY_STR + 'T08:00:00Z'
  },
  {
    id: 'emp-004',
    employeeId: 'EMP004',
    uid: 'uid-arjun-004',
    fullName: 'Arjun R',
    email: 'arjun.r@enterprise.hr',
    phone: '+91 96543 21098',
    gender: 'Male',
    dateOfBirth: '1994-08-12',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    department: 'Engineering',
    designation: 'Frontend Developer',
    joiningDate: '2022-07-15',
    employmentType: 'Full-Time',
    reportingManager: 'Gaurav (CTO)',
    workLocation: 'AGPS Nagar HQ Campus',
    status: 'Active',
    shift: 'General Shift (09:00 - 18:00)',
    address: '77 Silicon Valley Avenue',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    emergencyContact: '+91 96543 00004',
    emergencyRelationship: 'Mother',
    role: 'EMPLOYEE',
    qrToken: 'QR-TOKEN-EMP004-SECURE-HASH-7721',
    createdAt: '2022-07-15T09:00:00Z',
    updatedAt: TODAY_STR + 'T08:00:00Z'
  },
  {
    id: 'emp-005',
    employeeId: 'EMP005',
    uid: 'uid-sneha-005',
    fullName: 'Sneha M',
    email: 'emp.sneha@enterprise.hr',
    phone: '+91 95432 10987',
    gender: 'Female',
    dateOfBirth: '1996-04-19',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
    department: 'Product & Design',
    designation: 'UI/UX Designer',
    joiningDate: '2023-02-01',
    employmentType: 'Full-Time',
    reportingManager: 'Gaurav (CTO)',
    workLocation: 'AGPS Nagar HQ Campus',
    status: 'Active',
    shift: 'General Shift (09:00 - 18:00)',
    address: 'House 14, Lotus Villa',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500033',
    emergencyContact: '+91 95432 00005',
    emergencyRelationship: 'Spouse',
    role: 'EMPLOYEE',
    qrToken: 'QR-TOKEN-EMP005-SECURE-HASH-3390',
    createdAt: '2023-02-01T09:00:00Z',
    updatedAt: TODAY_STR + 'T08:00:00Z'
  },
  {
    id: 'emp-006',
    employeeId: 'EMP006',
    uid: 'uid-vikram-006',
    fullName: 'Vikram Mehta',
    email: 'vikram.mehta@enterprise.hr',
    phone: '+91 94321 09876',
    gender: 'Male',
    dateOfBirth: '1991-09-05',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80',
    department: 'Engineering',
    designation: 'Backend Developer',
    joiningDate: '2022-04-18',
    employmentType: 'Full-Time',
    reportingManager: 'Gaurav (CTO)',
    workLocation: 'AGPS Nagar HQ Campus',
    status: 'Active',
    shift: 'General Shift (09:00 - 18:00)',
    address: '102 Palm Grove Enclave',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    emergencyContact: '+91 94321 00006',
    emergencyRelationship: 'Sister',
    role: 'EMPLOYEE',
    qrToken: 'QR-TOKEN-EMP006-SECURE-HASH-9981',
    createdAt: '2022-04-18T09:00:00Z',
    updatedAt: TODAY_STR + 'T08:00:00Z'
  },
  {
    id: 'emp-007',
    employeeId: 'EMP007',
    uid: 'uid-ananya-007',
    fullName: 'Ananya Deshmukh',
    email: 'ananya.d@enterprise.hr',
    phone: '+91 93210 98765',
    gender: 'Female',
    dateOfBirth: '1995-12-03',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
    department: 'Project Management',
    designation: 'Project Manager',
    joiningDate: '2023-05-10',
    employmentType: 'Full-Time',
    reportingManager: 'Akshit',
    workLocation: 'AGPS Nagar HQ Campus',
    status: 'Active',
    shift: 'General Shift (09:00 - 18:00)',
    address: '45 Lakeview Apartments',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500084',
    emergencyContact: '+91 93210 00007',
    emergencyRelationship: 'Mother',
    role: 'EMPLOYEE',
    qrToken: 'QR-TOKEN-EMP007-SECURE-HASH-4412',
    createdAt: '2023-05-10T09:00:00Z',
    updatedAt: TODAY_STR + 'T08:00:00Z'
  },
  {
    id: 'emp-008',
    employeeId: 'EMP008',
    uid: 'uid-david-008',
    fullName: 'David Vance',
    email: 'david.v@enterprise.hr',
    phone: '+91 92109 87654',
    gender: 'Male',
    dateOfBirth: '1989-07-22',
    profilePhotoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80',
    department: 'Engineering',
    designation: 'Software Engineer',
    joiningDate: '2023-08-01',
    employmentType: 'Contract',
    reportingManager: 'Arjun R',
    workLocation: 'AGPS Nagar HQ Campus',
    status: 'On Leave',
    shift: 'General Shift (09:00 - 18:00)',
    address: 'Block C, Tech Park Quarters',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    emergencyContact: '+91 92109 00008',
    emergencyRelationship: 'Friend',
    role: 'EMPLOYEE',
    qrToken: 'QR-TOKEN-EMP008-SECURE-HASH-1288',
    createdAt: '2023-08-01T09:00:00Z',
    updatedAt: TODAY_STR + 'T08:00:00Z'
  }
];

// Helper to generate last 7 days attendance history
export function generateInitialAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const employees = INITIAL_EMPLOYEES;
  
  // Generate records for today and past 14 days
  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - dayOffset);
    
    // Skip Sundays
    if (dateObj.getDay() === 0) continue;
    
    const dateStr = dateObj.toISOString().split('T')[0];
    
    employees.forEach((emp, index) => {
      // Deterministic variations for rich stats
      const isToday = dayOffset === 0;
      
      let status: 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave' = 'Present';
      let checkInHour = 8 + (index % 2); // 8:50 AM or 9:05 AM
      let checkInMin = (index * 7) % 50;
      let locationVerified = true;
      let checkOutHour = 18;
      let checkOutMin = 10 + (index * 3) % 40;
      
      if (emp.status === 'On Leave' && isToday) {
        status = 'On Leave';
      } else if ((index + dayOffset) % 9 === 0) {
        status = 'Late';
        checkInHour = 9;
        checkInMin = 35 + (index * 4) % 20;
      } else if ((index + dayOffset) % 13 === 0) {
        status = 'Absent';
      } else if ((index + dayOffset) % 17 === 0) {
        status = 'Half Day';
        checkOutHour = 13;
      }
      
      const checkInISO = status !== 'Absent' && status !== 'On Leave' 
        ? `${dateStr}T${String(checkInHour).padStart(2, '0')}:${String(checkInMin).padStart(2, '0')}:00.000Z`
        : null;
        
      const checkOutISO = (status === 'Present' || status === 'Late' || status === 'Half Day') && !isToday
        ? `${dateStr}T${String(checkOutHour).padStart(2, '0')}:${String(checkOutMin).padStart(2, '0')}:00.000Z`
        : isToday && index < 4
        ? `${dateStr}T${String(checkOutHour).padStart(2, '0')}:${String(checkOutMin).padStart(2, '0')}:00.000Z`
        : null; // currently checked in today if checkout is null
        
      let workingMinutes = 0;
      if (checkInISO && checkOutISO) {
        const start = new Date(checkInISO).getTime();
        const end = new Date(checkOutISO).getTime();
        workingMinutes = Math.floor((end - start) / 60000);
      } else if (checkInISO && isToday) {
        // Checked in today, calculation so far
        const start = new Date(checkInISO).getTime();
        workingMinutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
      }

      records.push({
        id: `att-${emp.employeeId}-${dateStr}`,
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        employeeName: emp.fullName,
        department: emp.department,
        date: dateStr,
        checkInAt: checkInISO,
        checkOutAt: checkOutISO,
        workingMinutes,
        status,
        attendanceMethod: index % 2 === 0 ? 'QR Code' : 'Self Portal',
        locationVerified,
        latitude: 17.4485 + (index * 0.0001),
        longitude: 78.3810 + (index * 0.0001),
        deviceInfo: 'Chrome Enterprise Workstation (macOS)',
        createdAt: dateStr + 'T08:50:00Z',
        updatedAt: dateStr + 'T18:05:00Z'
      });
    });
  }
  
  return records;
}

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-101',
    actorId: 'emp-001',
    actorName: 'Koushik Kumar',
    actorRole: 'SUPER_ADMIN',
    action: 'POLICY_UPDATE',
    target: 'Attendance GPS Settings',
    details: 'Updated office coordinates and expanded allowed perimeter radius to 500 meters.',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'log-102',
    actorId: 'emp-002',
    actorName: 'Rahul Sharma',
    actorRole: 'HR_ADMIN',
    action: 'EMPLOYEE_CREATED',
    target: 'EMP008 (David Vance)',
    details: 'Onboarded new contract employee to Operations department.',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'log-103',
    actorId: 'emp-005',
    actorName: 'Sneha M',
    actorRole: 'EMPLOYEE',
    action: 'ATTENDANCE_CHECKIN',
    target: 'Self Check-in',
    details: 'Verified QR Scan via Mobile Web at AGPS Nagar HQ Campus (GPS Lat: 17.4483, Long: 78.3808).',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'log-104',
    actorId: 'emp-002',
    actorName: 'Rahul Sharma',
    actorRole: 'HR_ADMIN',
    action: 'REPORT_GENERATED',
    target: 'Monthly HR Attendance Statement',
    details: 'Generated PDF audit summary report for Finance Department.',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
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

This is to certify that **{{FULL_NAME}}** (Employee ID: **{{EMPLOYEE_ID}}**) is a full-time employee with Kalpana Enterprise Solutions, currently serving as **{{DESIGNATION}}** in the **{{DEPARTMENT}}** department since **{{JOINING_DATE}}**.

During their tenure, {{FULL_NAME}} has demonstrated exemplary performance and professionalism. Their current work location is **{{WORK_LOCATION}}**.

This certificate is issued upon employee request for official documentation purposes.

**For Kalpana Enterprise Solutions,**

*Rahul Sharma*
Head of Human Resources
Date: {{CURRENT_DATE}}
    `
  }
];
