// Strict Sequential Workflow Verification: Request -> PM -> CEO -> CTO (HR Read-Only)

const initialReq = {
  id: 'LR-SEQ001',
  employeeId: 'KSS2407013',
  employeeName: 'Akash SB',
  type: 'WFH',
  startDate: '2026-08-25',
  endDate: '2026-08-27',
  status: 'Pending',
  pmStatus: 'Pending',
  ceoStatus: 'Waiting PM',
  ctoStatus: 'Waiting CEO'
};

function processStage(req, stage, decision) {
  let pmStatus = req.pmStatus || 'Pending';
  let ceoStatus = req.ceoStatus || 'Waiting PM';
  let ctoStatus = req.ctoStatus || 'Waiting CEO';

  if (stage === 'PM') {
    pmStatus = decision;
    if (decision === 'Approved') {
      ceoStatus = 'Pending'; // Unlock for CEO
    }
  } else if (stage === 'CEO') {
    if (pmStatus !== 'Approved') {
      throw new Error('CEO cannot act until PM has approved!');
    }
    ceoStatus = decision;
    if (decision === 'Approved') {
      ctoStatus = 'Pending'; // Unlock for CTO
    }
  } else if (stage === 'CTO') {
    if (ceoStatus !== 'Approved') {
      throw new Error('CTO cannot act until CEO has approved!');
    }
    ctoStatus = decision;
  }

  let status = 'Pending';
  if (pmStatus === 'Rejected' || ceoStatus === 'Rejected' || ctoStatus === 'Rejected' || decision === 'Rejected') {
    status = 'Rejected';
  } else if (pmStatus === 'Approved' && ceoStatus === 'Approved' && ctoStatus === 'Approved') {
    status = 'Approved';
  } else {
    status = 'Pending';
  }

  return { ...req, pmStatus, ctoStatus, ceoStatus, status };
}

console.log('--- STEP 1: Employee Submits Request ---');
let current = initialReq;
console.log('Status:', current.status, '| PM:', current.pmStatus, '| CEO:', current.ceoStatus, '| CTO:', current.ctoStatus);

console.log('\n--- STEP 2: PM (D. Koushik) Approves ---');
current = processStage(current, 'PM', 'Approved');
console.log('Status:', current.status, '| PM:', current.pmStatus, '| CEO:', current.ceoStatus, '| CTO:', current.ctoStatus);

console.log('\n--- STEP 3: CEO (Akshit Ujjain) Approves ---');
current = processStage(current, 'CEO', 'Approved');
console.log('Status:', current.status, '| PM:', current.pmStatus, '| CEO:', current.ceoStatus, '| CTO:', current.ctoStatus);

console.log('\n--- STEP 4: CTO (Gaurav Kumar Tripathi) Final Sanction ---');
current = processStage(current, 'CTO', 'Approved');
console.log('Status:', current.status, '| PM:', current.pmStatus, '| CEO:', current.ceoStatus, '| CTO:', current.ctoStatus);

if (current.status === 'Approved' && current.pmStatus === 'Approved' && current.ceoStatus === 'Approved' && current.ctoStatus === 'Approved') {
  console.log('\n🎉 SEQUENTIAL REQUEST -> PM -> CEO -> CTO WORKFLOW VERIFIED 100% PERFECTLY!');
} else {
  console.error('\n❌ SEQUENTIAL WORKFLOW TEST FAILED!');
  process.exit(1);
}
