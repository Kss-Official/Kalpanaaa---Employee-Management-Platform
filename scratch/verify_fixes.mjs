/**
 * Verification — check final state of all changed records
 */
import https from 'https';

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
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function getField(fields, key) {
  const f = fields?.[key];
  if (!f) return '';
  return f.stringValue ?? String(f.integerValue ?? f.booleanValue ?? '');
}

async function getDoc(token, docPath) {
  return request(`${FIRESTORE_BASE}/${docPath}`, 'GET', null, token);
}

async function main() {
  const authRes = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST', { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true }
  );
  const token = authRes.idToken;

  const checks = [
    { label: 'Jigyansha',       path: 'employees/8RxH6z3ZzUTmM26iqta1DhCPa8l1',   expectId: 'KSS2407016', expectStatus: 'Active' },
    { label: 'Shruti',          path: 'employees/4lJ6efl4vYTAemQ24cjgq2hC7fe2',    expectId: 'KSS2407017', expectStatus: 'Active' },
    { label: 'Rahul',           path: 'employees/OKTqtqSfi2WRxkdWMawyryT7IDC2',    expectId: 'KSS2407015', expectStatus: 'Active' },
    { label: 'Jason',           path: 'employees/KfAB95lpbJOeylpKQaWX4GXOPGt2',    expectId: 'KSS2407011', expectStatus: 'Inactive' },
    { label: 'Satya canonical', path: 'employees/emp-KSS2407012',                   expectId: 'KSS2407012', expectStatus: 'Active' },
    { label: 'Satya ghost',     path: 'employees/bf41B0ztyefb6OZzO9NykxA9MSz2',    expectId: 'GHOST-DO-NOT-USE', expectStatus: 'Terminated' },
  ];

  console.log('\n' + '═'.repeat(70));
  console.log(' VERIFICATION RESULTS');
  console.log('═'.repeat(70));
  console.log('Name'.padEnd(18) + 'EmpID'.padEnd(20) + 'Status'.padEnd(14) + 'Result');
  console.log('─'.repeat(70));

  let allPass = true;
  for (const c of checks) {
    try {
      const doc = await getDoc(token, c.path);
      const f = doc.fields || {};
      const empId  = getField(f, 'employeeId');
      const status = getField(f, 'status');
      const idOk     = empId === c.expectId;
      const statusOk = status === c.expectStatus;
      const ok = idOk && statusOk;
      if (!ok) allPass = false;
      const icon = ok ? '✅' : '❌';
      console.log(
        c.label.padEnd(18) +
        `${empId} (want ${c.expectId})`.padEnd(20) +
        `${status} (want ${c.expectStatus})`.padEnd(14) +
        icon
      );
    } catch (e) {
      console.log(c.label.padEnd(18) + 'ERROR: ' + e.message);
      allPass = false;
    }
  }
  console.log('═'.repeat(70));
  console.log(allPass ? '\n✅ ALL CHECKS PASSED' : '\n⚠️  Some checks failed — see above');
}

main().catch(console.error);
