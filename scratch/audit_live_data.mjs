import https from 'https';
import { INITIAL_EMPLOYEES } from '../src/lib/demoData.ts';
import { computeTotalLeaveBalances, computeEmployeeLeaveBalance, computeSickLeaveBalance, computeCasualLeaveBalance } from '../src/lib/attendanceEngine.ts';

const PROJECT_ID   = 'kalpanaaa-employees-website';
const API_KEY      = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL  = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS   = 'Koushik@777';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function request(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch { resolve(data); }
          } else {
            reject(new Error(`HTTP ${res.statusCode} ${method} ${url}\n${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function signIn(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await request(url, 'POST', { email, password, returnSecureToken: true });
  return res.idToken;
}

async function main() {
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  const leavesRes = await request(`${FIRESTORE_BASE}/leaveRequests?pageSize=100`, 'GET', null, token);
  const leaveDocs = leavesRes.documents || [];
  
  const leaveRequests = leaveDocs.map(d => {
    const f = d.fields || {};
    const obj = {};
    for (const [k, v] of Object.entries(f)) {
      obj[k] = Object.values(v)[0];
    }
    return obj;
  });

  const empRes = await request(`${FIRESTORE_BASE}/employees?pageSize=100`, 'GET', null, token);
  const empDocs = empRes.documents || [];
  const firestoreEmployees = empDocs.map(d => {
    const f = d.fields || {};
    const obj = { id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) {
      obj[k] = Object.values(v)[0];
    }
    return obj;
  });

  const allEmps = [...firestoreEmployees];
  for (const ie of INITIAL_EMPLOYEES) {
    if (!allEmps.some(e => e.employeeId === ie.employeeId)) {
      allEmps.push(ie);
    }
  }

  const refDate = new Date(2026, 9, 1);
  console.log(`\n=== AUDITING WITH FIRESTORE LIVE DATA (${allEmps.length} employees, ${leaveRequests.length} leaveRequests) ===`);
  
  let violations = 0;
  for (const emp of allEmps) {
    const tot = computeTotalLeaveBalances(emp, leaveRequests, refDate);
    const el = computeEmployeeLeaveBalance(emp, leaveRequests, refDate);
    const sl = computeSickLeaveBalance(emp, leaveRequests, refDate);
    const cl = computeCasualLeaveBalance(emp, leaveRequests, refDate);
    
    console.log(`[${emp.employeeId || 'NO-ID'}] ${emp.fullName || emp.name}:`);
    console.log(`   EL credited: ${el.credited}, taken: ${el.taken}, bal: ${el.balance}`);
    console.log(`   SL credited: ${sl.credited}, taken: ${sl.taken}, bal: ${sl.balance}`);
    console.log(`   CL credited: ${cl.credited}, taken: ${cl.taken}, bal: ${cl.balance}`);
    console.log(`   TOTAL CREDITED: ${tot.totalCredited}, TOTAL TAKEN: ${tot.totalTaken}, TOTAL BAL: ${tot.totalBalance}`);

    if (tot.totalCredited > 3 || el.credited > 2 || sl.credited > 1) {
      console.error(`   ❌ VIOLATION FOUND!`);
      violations++;
    }
  }

  console.log(`\nTotal violations: ${violations}`);
}

main().catch(console.error);
