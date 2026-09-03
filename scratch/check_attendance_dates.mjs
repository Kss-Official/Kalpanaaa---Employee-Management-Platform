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
  const attRes = await request(`${FIRESTORE_BASE}/attendance?pageSize=1000`, 'GET', null, token);
  const attDocs = attRes.documents || [];
  console.log(`Checking attendance records for the 5 employees...`);
  
  for (const doc of attDocs) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    const eName = (f.employeeName?.stringValue || '').toLowerCase();
    const eId = f.employeeId?.stringValue || '';
    const date = f.date?.stringValue;

    // Akash: 2026-08-25 was taken 1 earn leave -> attendance on 2026-08-25 can be marked Leave
    if ((eName.includes('akash') || eId === 'KSS2407013') && date === '2026-08-25') {
      console.log(`Akash on 2026-08-25: current status = ${f.status?.stringValue}`);
      if (f.status?.stringValue !== 'Leave') {
        console.log(`Updating Akash 2026-08-25 attendance to Leave...`);
        await request(`${FIRESTORE_BASE}/attendance/${docId}?updateMask.fieldPaths=status&updateMask.fieldPaths=workMode`, 'PATCH', {
          fields: {
            ...f,
            status: { stringValue: 'Leave' },
            workMode: { stringValue: 'Office' }
          }
        }, token);
      }
    }
  }
}

main().catch(console.error);
