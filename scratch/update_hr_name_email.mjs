/**
 * Safely update Abhinaya employee records in Firestore to generic HR without deleting any data:
 * - fullName: "HR Department"
 * - email: "hr@kalpanaaa.in"
 * - employeeId: "" (cleared so Jason has KSS2407011 exclusively)
 * - qrToken: ""
 * All other fields (role, department, designation, addresses, shift, dates, etc.) are fully preserved!
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
  console.log('Signing in...');
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated.\n');

  const targets = ['emp-1785997048965', 'emp-KSS2407011'];

  for (const docId of targets) {
    try {
      const doc = await request(`${FIRESTORE_BASE}/employees/${docId}`, 'GET', null, token);
      if (doc?.fields) {
        console.log(`Updating employees/${docId}...`);
        console.log(`  Current fullName: ${doc.fields.fullName?.stringValue}`);
        console.log(`  Current email:    ${doc.fields.email?.stringValue}`);
        console.log(`  Current empId:    ${doc.fields.employeeId?.stringValue}`);

        await patchDoc('employees', docId, {
          fullName: 'HR Department',
          email: 'hr@kalpanaaa.in',
          employeeId: '',
          qrToken: '',
          updatedAt: new Date().toISOString()
        }, token);

        console.log(`  ✅ Successfully updated employees/${docId} to HR Department (hr@kalpanaaa.in)!\n`);
      } else {
        console.log(`  ⬜ employees/${docId} not found`);
      }
    } catch (e) {
      console.error(`  ❌ Failed to update employees/${docId}:`, e.message);
    }
  }

  console.log('🎉 Firestore HR employee records updated smoothly without deleting or disturbing existing data/flow.');
}

main().catch(console.error);
