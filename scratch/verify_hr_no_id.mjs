/**
 * Ensure employees/emp-KSS2407011 has NO employeeId (employeeId: "")
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

async function patchDoc(collection, docId, fieldsToUpdate, token) {
  const mask = Object.keys(fieldsToUpdate)
    .map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?${mask}`;
  const fields = {};
  for (const [k, v] of Object.entries(fieldsToUpdate)) {
    if (v === null || v === '') fields[k] = { nullValue: null };
    else fields[k] = { stringValue: String(v) };
  }
  return request(url, 'PATCH', { fields }, token);
}

async function main() {
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated.\n');

  console.log('Checking employees/emp-KSS2407011...');
  const doc = await request(`${FIRESTORE_BASE}/employees/emp-KSS2407011`, 'GET', null, token);
  console.log('Current fields:', JSON.stringify(doc?.fields));

  console.log('\nEnsuring employeeId is empty/null for HR...');
  await patchDoc('employees', 'emp-KSS2407011', {
    employeeId: '',
    qrToken: '',
    fullName: 'HR Department',
    email: 'hr@kalpanaaa.in',
    status: 'Active',
    updatedAt: new Date().toISOString()
  }, token);
  console.log('✅ HR profile updated: employeeId is now completely UNASSIGNED/EMPTY.');

  console.log('\nChecking Jason doc (employees/KfAB95lpbJOeylpKQaWX4GXOPGt2)...');
  const jason = await request(`${FIRESTORE_BASE}/employees/KfAB95lpbJOeylpKQaWX4GXOPGt2`, 'GET', null, token);
  console.log(`Jason employeeId: ${jason?.fields?.employeeId?.stringValue}`);
}

main().catch(console.error);
