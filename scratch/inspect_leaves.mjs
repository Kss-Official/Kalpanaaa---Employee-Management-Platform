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
  console.log('✅ Authenticated.');
  
  const leavesRes = await request(`${FIRESTORE_BASE}/leaveRequests?pageSize=100`, 'GET', null, token);
  const leaveDocs = leavesRes.documents || [];
  console.log(`Total leaveRequests in Firestore: ${leaveDocs.length}`);
  for (const doc of leaveDocs) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    console.log(`LeaveDoc: ${docId}`);
    console.log(`  employee: ${f.employeeName?.stringValue} (${f.employeeId?.stringValue || f.employeeUid?.stringValue})`);
    console.log(`  type: ${f.type?.stringValue} / ${f.leaveCategory?.stringValue}`);
    console.log(`  dates: ${f.startDate?.stringValue} to ${f.endDate?.stringValue}`);
    console.log(`  status: ${f.status?.stringValue} | pm:${f.pmStatus?.stringValue} | hr:${f.hrStatus?.stringValue} | ceo:${f.ceoStatus?.stringValue} | cto:${f.ctoStatus?.stringValue}`);
  }

  const attRes = await request(`${FIRESTORE_BASE}/attendance?pageSize=300`, 'GET', null, token);
  const attDocs = attRes.documents || [];
  console.log(`Total attendance records: ${attDocs.length}`);
  for (const doc of attDocs) {
    const f = doc.fields || {};
    const status = f.status?.stringValue;
    if (status === 'Leave' || status === 'Earn Leave' || status === 'Sick Leave') {
      const docId = doc.name.split('/').pop();
      console.log(`Attendance Leave: ${docId} | ${f.employeeName?.stringValue || f.employeeId?.stringValue} | status: ${status} | date: ${f.date?.stringValue}`);
    }
  }
}
main().catch(console.error);
