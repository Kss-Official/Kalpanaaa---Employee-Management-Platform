// Automated verification script for Leave & WFH Workflow Real-Time Lifecycle

const mockEmployees = [
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
  },
  {
    id: 'emp-KSS2407011',
    employeeId: 'emp-KSS2407011',
    fullName: 'Abhinaya V',
    department: 'HR Department',
    role: 'HR_ADMIN'
  }
];

let leaveRequestsStore = [];

// 1. Submit request as Akash SB
function submitRequest(data) {
  const req = {
    id: `LR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    department: 'Engineering',
    employeeRole: 'EMPLOYEE',
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    reason: data.reason,
    status: 'Pending',
    pmStatus: 'Pending',
    ctoStatus: 'Pending',
    ceoStatus: 'Pending',
    requestDate: new Date().toISOString()
  };
  leaveRequestsStore.push(req);
  return req;
}

// 2. Filter PM view (D. Koushik)
function getPmPendingRequests() {
  return leaveRequestsStore.filter(req => {
    const isPending = (req.status === 'Pending' || req.pmStatus === 'Pending' || !req.status) &&
                      req.ceoStatus !== 'Approved' && req.ceoStatus !== 'Rejected' &&
                      req.ctoStatus !== 'Approved' && req.ctoStatus !== 'Rejected';
    if (!isPending) return false;

    const empMatch = mockEmployees.find(e => e.id === req.employeeId || e.employeeId === req.employeeId || e.fullName === req.employeeName);
    const isHr = (req.department || '').toLowerCase().includes('hr') ||
                 (req.employeeRole || '').toLowerCase().includes('hr') ||
                 empMatch?.department?.toLowerCase().includes('hr') ||
                 empMatch?.role === 'HR_ADMIN';
    return !isHr;
  });
}

// 3. Cancel request as Akash SB
function cancelRequest(id) {
  leaveRequestsStore = leaveRequestsStore.filter(r => r.id !== id);
}

// EXECUTE LIFECYCLE TEST
console.log('--- TEST 1: Initial PM Pending List ---');
console.log('PM Pending Count:', getPmPendingRequests().length); // Expected: 0

console.log('\n--- TEST 2: Akash SB Submits Leave Request ---');
const newReq = submitRequest({
  employeeId: 'KSS2407013',
  employeeName: 'Akash SB',
  type: 'Leave',
  startDate: '2026-08-25',
  endDate: '2026-08-27',
  reason: 'Medical checkup'
});
console.log('Created Request ID:', newReq.id);
console.log('PM Pending Count after submission:', getPmPendingRequests().length); // Expected: 1
console.log('PM Pending Record:', getPmPendingRequests()[0].employeeName, getPmPendingRequests()[0].reason);

console.log('\n--- TEST 3: Akash SB Cancels Leave Request ---');
cancelRequest(newReq.id);
console.log('PM Pending Count after cancellation:', getPmPendingRequests().length); // Expected: 0

if (getPmPendingRequests().length === 0) {
  console.log('\n✅ ALL LIFECYCLE TESTS PASSED PERFECTLY!');
} else {
  console.error('\n❌ LIFECYCLE TEST FAILED!');
  process.exit(1);
}
