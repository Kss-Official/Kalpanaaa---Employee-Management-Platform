/**
 * Evaluate isExecutiveOrLeadership and status for all employees in Firestore
 */
import https from 'https';

const PROJECT_ID   = 'kalpanaaa-employees-website';
const API_KEY      = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL  = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS   = 'Koushik@777';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const EXEC_ACRONYMS = /\b(ceo|cto|coo|cfo|cio|md)\b/;
const EXEC_TITLES = /\b(chief\s+(executive|technology|technical|operating|financial|information)|founder|co-?founder|managing\s+director)\b/;

function isExecutiveOrLeadership(emp) {
  if (!emp) return false;
  if (emp.executiveRole === 'CEO' || emp.executiveRole === 'CTO') return true;
  if (String(emp.role || '').toUpperCase() === 'SUPER_ADMIN') return true;
  const desig = String(emp.designation || '').toLowerCase();
  if (!desig) return false;
  return EXEC_ACRONYMS.test(desig) || EXEC_TITLES.test(desig);
}

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
  console.log('✅ Authenticated.\n');

  const res = await request(`${FIRESTORE_BASE}/employees?pageSize=300`, 'GET', null, token);
  const docs = res.documents || [];
  
  const allEmps = docs.map(d => {
    const f = d.fields || {};
    return {
      id: d.name.split('/').pop(),
      fullName: f.fullName?.stringValue || '',
      employeeId: f.employeeId?.stringValue || '',
      email: f.email?.stringValue || '',
      status: f.status?.stringValue || 'Active',
      role: f.role?.stringValue || 'EMPLOYEE',
      designation: f.designation?.stringValue || '',
      executiveRole: f.executiveRole?.stringValue || '',
      createdAt: f.createdAt?.stringValue || '',
      updatedAt: f.updatedAt?.stringValue || ''
    };
  });

  // Deduplication logic like AuthContext
  const fetched = [...allEmps];
  fetched.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
  const deduplicated = [];
  const seen = new Set();
  for (const emp of fetched) {
    if (!emp.fullName || emp.fullName.trim() === '') continue;
    const emailKey = (emp.email || '').toLowerCase().trim();
    const idKey = emp.employeeId?.trim();
    if ((emailKey && seen.has(emailKey)) || (idKey && seen.has(idKey))) continue;
    if (emailKey) seen.add(emailKey);
    if (idKey) seen.add(idKey);
    deduplicated.push(emp);
  }

  console.log(`Total deduplicated employees: ${deduplicated.length}\n`);

  const operational = deduplicated.filter(e => e.status !== 'Terminated' && !isExecutiveOrLeadership(e));
  console.log(`Operational workforce count: ${operational.length}\n`);

  for (const op of operational) {
    console.log(`  - ${op.fullName.padEnd(25)} | EmpID: ${op.employeeId.padEnd(12)} | Status: ${op.status.padEnd(10)} | Role: ${op.role.padEnd(12)} | Desig: ${op.designation}`);
  }

  console.log('\nExcluded employees:');
  const excluded = deduplicated.filter(e => e.status === 'Terminated' || isExecutiveOrLeadership(e));
  for (const ex of excluded) {
    const reason = ex.status === 'Terminated' ? 'Terminated' : 'Executive/Leadership';
    console.log(`  - ${ex.fullName.padEnd(25)} | EmpID: ${ex.employeeId.padEnd(12)} | Reason: ${reason.padEnd(20)} | Desig: ${ex.designation}`);
  }
}

main().catch(console.error);
