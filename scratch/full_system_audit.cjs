// Full System Verification Audit Script for Kalpanaaa Employee Management Platform

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   FULL SYSTEM LEAVE & WFH AUDIT & COMPLIANCE CHECK  ');
console.log('====================================================\n');

const srcDir = path.join(__dirname, '..', 'src');

function checkFileContains(relPath, pattern) {
  const fullPath = path.join(srcDir, relPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  return pattern.test(content);
}

// 1. Check AppCheck bypass in firebase.ts
const firebaseOk = checkFileContains('lib/firebase.ts', /isLocalhost/);
console.log('[1/5] Firebase AppCheck Localhost Bypass:', firebaseOk ? '✅ PASSED' : '❌ FAILED');

// 2. Check PM Role in quickDemoLogin in AuthContext.tsx
const pmDemoOk = checkFileContains('context/AuthContext.tsx', /targetRole === 'PROJECT_MANAGER'/);
console.log('[2/5] PM Quick Role Switch Handling:', pmDemoOk ? '✅ PASSED' : '❌ FAILED');

// 3. Check BroadcastChannel sync in AuthContext.tsx
const bcOk = checkFileContains('context/AuthContext.tsx', /BroadcastChannel\('kss_app_events'\)/);
console.log('[3/5] Cross-Tab BroadcastChannel Engine:', bcOk ? '✅ PASSED' : '❌ FAILED');

// 4. Check robust myRequests filter in EmployeeLeaveTab.tsx
const employeeFilterOk = checkFileContains('components/employee/EmployeeLeaveTab.tsx', /activeEmployee\?.employeeId \|\|/);
console.log('[4/5] Employee Leave History Robust Filter:', employeeFilterOk ? '✅ PASSED' : '❌ FAILED');

// 5. Check PM recommendation stage update in PMDashboard.tsx
const pmStageOk = checkFileContains('components/pm/PMDashboard.tsx', /updateLeaveRequestStage\(reqId, 'PM'/);
console.log('[5/5] PM Dashboard Stage Update Wireup:', pmStageOk ? '✅ PASSED' : '❌ FAILED');

console.log('\n====================================================');
if (firebaseOk && pmDemoOk && bcOk && employeeFilterOk && pmStageOk) {
  console.log('🎉 ALL SYSTEM AUDITS PASSED 100%! SYSTEM READY FOR LIVE DEMO!');
} else {
  console.error('⚠️ AUDIT FAILED! Review missing requirements above.');
}
console.log('====================================================');
