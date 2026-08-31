/**
 * Search all collections for any mention of abhinaya / abhinayav1919@kalpanaaa.in
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

const COLLECTIONS = [
  'employees', 'attendance', 'leaveRequests', 'leaves', 'payroll', 'payslips',
  'notifications', 'feedback', 'performance', 'presence', 'auditLogs'
];

async function main() {
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated.\n');

  for (const col of COLLECTIONS) {
    try {
      const res = await request(`${FIRESTORE_BASE}/${col}?pageSize=300`, 'GET', null, token);
      const docs = res.documents || [];
      const hits = docs.filter(d => {
        const s = JSON.stringify(d.fields || {}).toLowerCase();
        return s.includes('abhinaya') || s.includes('abhinayav1919');
      });
      if (hits.length > 0) {
        console.log(`📂 ${col}: ${hits.length} doc(s) matched 'abhinaya':`);
        for (const h of hits) {
          const docId = h.name.split('/').pop();
          console.log(`   - ${docId}:`, h.fields?.fullName?.stringValue || h.fields?.employeeName?.stringValue || '', h.fields?.email?.stringValue || '');
        }
      } else {
        console.log(`✅ ${col}: 0 matches (${docs.length} checked)`);
      }
    } catch (e) {
      console.log(`⚠️ ${col}: ${e.message.split('\n')[0]}`);
    }
  }
}

main().catch(console.error);
