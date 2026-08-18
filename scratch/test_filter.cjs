const leaveRequests = [
  {
    id: 'LR-6TBM1UP',
    employeeId: 'KSS2407013',
    employeeName: 'Akash SB',
    department: 'Engineering',
    employeeRole: 'EMPLOYEE',
    type: 'Leave',
    startDate: '2026-08-22',
    endDate: '2026-08-24',
    reason: 'Family function',
    status: 'Pending',
    pmStatus: 'Pending',
    ctoStatus: 'Pending',
    ceoStatus: 'Pending',
    requestDate: '2026-08-13T11:08:00.000Z'
  }
];

const employees = [
  {
    id: 'emp-KSS2407013',
    employeeId: 'KSS2407013',
    fullName: 'Akash SB',
    department: 'Engineering',
    role: 'EMPLOYEE'
  },
  {
    id: 'emp-KSS2407003',
    employeeId: 'KSS2407003',
    fullName: 'D. Koushik',
    department: 'Software Engineering',
    role: 'PROJECT_MANAGER'
  }
];

const activeEmployee = {
  id: 'emp-KSS2407003',
  employeeId: 'KSS2407003',
  fullName: 'D. Koushik',
  role: 'PROJECT_MANAGER'
};

const effectiveRole = activeEmployee?.role || 'SUPER_ADMIN';
const isPm = effectiveRole === 'PROJECT_MANAGER';

const pendingRequests = leaveRequests.filter(req => {
  const isPending = (req.status === 'Pending' || req.pmStatus === 'Pending' || !req.status) &&
                    req.ceoStatus !== 'Approved' && req.ceoStatus !== 'Rejected' &&
                    req.ctoStatus !== 'Approved' && req.ctoStatus !== 'Rejected';
  if (!isPending) return false;

  if (isPm) {
    const isHrEmployee = (req.department || '').toLowerCase().includes('hr') ||
      (req.employeeRole || '').toLowerCase().includes('hr') ||
      (() => {
        const emp = employees.find(e => e.id === req.employeeId || e.employeeId === req.employeeId || e.fullName === req.employeeName);
        return emp?.department?.toLowerCase().includes('hr') || emp?.role === 'HR_ADMIN';
      })();
    if (isHrEmployee) return false;
  }
  return true;
});

console.log('Pending requests count:', pendingRequests.length);
console.log('Filtered requests:', JSON.stringify(pendingRequests, null, 2));
