// Multi-Tier Approval Chain Verification Script for CEO, CTO, and PM

const mockReq = {
  id: 'LR-TEST001',
  employeeId: 'KSS2407013',
  employeeName: 'Akash SB',
  type: 'WFH',
  startDate: '2026-08-25',
  endDate: '2026-08-27',
  status: 'Pending',
  pmStatus: 'Pending',
  ctoStatus: 'Pending',
  ceoStatus: 'Pending'
};

function processStage(req, stage, decision) {
  let pmStatus = req.pmStatus;
  let ceoStatus = req.ceoStatus;
  let ctoStatus = req.ctoStatus;

  if (stage === 'PM') {
    pmStatus = decision;
  } else if (stage === 'CEO') {
    ceoStatus = decision;
    if (decision === 'Approved') {
      pmStatus = 'Approved';
      ctoStatus = 'Approved';
    }
  } else if (stage === 'CTO') {
    ctoStatus = decision;
    if (decision === 'Approved') {
      pmStatus = 'Approved';
    }
  }

  let status = 'Pending';
  if (pmStatus === 'Rejected' || ceoStatus === 'Rejected' || ctoStatus === 'Rejected' || decision === 'Rejected') {
    status = 'Rejected';
  } else if (ceoStatus === 'Approved') {
    status = 'Approved';
  } else if (pmStatus === 'Approved' && ceoStatus === 'Approved' && ctoStatus === 'Approved') {
    status = 'Approved';
  } else {
    status = 'Pending';
  }

  return { ...req, pmStatus, ctoStatus, ceoStatus, status };
}

console.log('--- TEST 1: Initial Request ---');
let current = mockReq;
console.log('Initial Status:', current.status, '| PM:', current.pmStatus, '| CTO:', current.ctoStatus, '| CEO:', current.ceoStatus);

console.log('\n--- TEST 2: PM Approves ---');
current = processStage(current, 'PM', 'Approved');
console.log('After PM Approval:', current.status, '| PM:', current.pmStatus, '| CTO:', current.ctoStatus, '| CEO:', current.ceoStatus);

console.log('\n--- TEST 3: CTO Approves ---');
current = processStage(current, 'CTO', 'Approved');
console.log('After CTO Approval:', current.status, '| PM:', current.pmStatus, '| CTO:', current.ctoStatus, '| CEO:', current.ceoStatus);

console.log('\n--- TEST 4: CEO Approves ---');
current = processStage(current, 'CEO', 'Approved');
console.log('After CEO Approval:', current.status, '| PM:', current.pmStatus, '| CTO:', current.ctoStatus, '| CEO:', current.ceoStatus);

if (current.status === 'Approved' && current.pmStatus === 'Approved' && current.ctoStatus === 'Approved' && current.ceoStatus === 'Approved') {
  console.log('\n✅ MULTI-TIER STAGE APPROVAL CHAIN PASSED PERFECTLY FOR PM, CTO, & CEO!');
} else {
  console.error('\n❌ MULTI-TIER APPROVAL CHAIN FAILED!');
  process.exit(1);
}
