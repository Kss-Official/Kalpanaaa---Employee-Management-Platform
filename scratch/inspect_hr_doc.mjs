/**
 * Inspect and update Abhinaya / HR employee doc in Firestore
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
  console.log('Signing in...');
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated.');

  // List all employee docs
  const res = await request(`${FIRESTORE_BASE}/employees?pageSize=300`, 'GET', null, token);
  const docs = res.documents || [];
  console.log(`Found ${docs.length} employee documents.`);

  for (const doc of docs) {
    const docId = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const name = fields.fullName?.stringValue || '';
    const email = fields.email?.stringValue || '';
    const empId = fields.employeeId?.stringValue || '';

    if (docId.includes('011') || name.toLowerCase().includes('abhinaya') || email.includes('abhinaya') || email.includes('hr@kalpanaaa.in') || docId.includes('3ZHI3aTB37StHjR97WEBJQSWT9H3')) {
      console.log(`\nFound matching doc: ${docId}`);
      console.log(`  fullName: ${name}`);
      console.log(`  email: ${email}`);
      console.log(`  employeeId: ${empId}`);
      console.log(`  role: ${fields.role?.stringValue}`);
      console.log(`  department: ${fields.department?.stringValue}`);
    }
  }

  // Also check users collection
  const usersRes = await request(`${FIRESTORE_BASE}/users?pageSize=300`, 'GET', null, token);
  const userDocs = usersRes.documents || [];
  console.log(`\nFound ${userDocs.length} user documents.`);
  for (const doc of userDocs) {
    const docId = doc.name.split('/').pop();
    const fields = doc.fields || {};
    const name = fields.fullName?.stringValue || fields.displayName?.stringValue || '';
    const email = fields.email?.stringValue || '';
    if (name.toLowerCase().includes('abhinaya') || email.includes('abhinaya') || email.includes('hr@kalpanaaa.in') || docId === '3ZHI3aTB37StHjR97WEBJQSWT9H3') {
      console.log(`\nFound matching user doc: ${docId}`);
      console.log(`  email: ${email}`);
      console.log(`  fields:`, JSON.stringify(fields));
    }
  }
}

main().catch(console.error);
