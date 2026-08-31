/**
 * Check if 3ZHI3aTB37StHjR97WEBJQSWT9H3 or KSS2407016 has any attendance/leave records
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

async function main() {
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated.\n');

  // Check attendance
  const attRes = await request(`${FIRESTORE_BASE}/attendance?pageSize=300`, 'GET', null, token);
  const attDocs = attRes.documents || [];
  const matchedAtt = attDocs.filter(d => {
    const s = JSON.stringify(d.fields || {});
    return s.includes('3ZHI3aTB37StHjR97WEBJQSWT9H3') || s.includes('KSS2407016');
  });
  console.log(`Matched attendance records: ${matchedAtt.length}`);
  for (const m of matchedAtt) {
    console.log(`  - ${m.name.split('/').pop()}`);
  }

  // Check leaveRequests
  const lrRes = await request(`${FIRESTORE_BASE}/leaveRequests?pageSize=300`, 'GET', null, token);
  const lrDocs = lrRes.documents || [];
  const matchedLr = lrDocs.filter(d => {
    const s = JSON.stringify(d.fields || {});
    return s.includes('3ZHI3aTB37StHjR97WEBJQSWT9H3') || s.includes('KSS2407016');
  });
  console.log(`Matched leaveRequests: ${matchedLr.length}`);
}

main().catch(console.error);
