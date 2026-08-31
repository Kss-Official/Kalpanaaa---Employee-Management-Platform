/**
 * Find all employee documents with KSS2407016 or Abhinaya in Firestore
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

  const res = await request(`${FIRESTORE_BASE}/employees?pageSize=300`, 'GET', null, token);
  const docs = res.documents || [];
  console.log(`Scanning ${docs.length} employee documents...\n`);

  for (const doc of docs) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    const str = JSON.stringify(f).toLowerCase();
    
    if (str.includes('kss2407016') || str.includes('abhinaya') || docId.includes('16')) {
      console.log(`📄 Document ID: ${docId}`);
      console.log(`   fullName:     ${f.fullName?.stringValue}`);
      console.log(`   employeeId:   ${f.employeeId?.stringValue}`);
      console.log(`   department:   ${f.department?.stringValue}`);
      console.log(`   designation:  ${f.designation?.stringValue}`);
      console.log(`   email:        ${f.email?.stringValue}`);
      console.log(`   role:         ${f.role?.stringValue}`);
      console.log(`   status:       ${f.status?.stringValue}`);
      console.log(`   createdAt:    ${f.createdAt?.stringValue}`);
      console.log('--------------------------------------------------');
    }
  }
}

main().catch(console.error);
