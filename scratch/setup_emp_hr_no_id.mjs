/**
 * Create canonical employees/emp-hr in Firestore with NO employee ID,
 * and mark old emp-KSS2407011 as Terminated so only Jason has KSS2407011.
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

  // 1. Create / update employees/emp-hr with NO employee ID
  console.log('Creating/updating employees/emp-hr (HR Department, NO employeeId)...');
  const hrDoc = {
    id: { stringValue: 'emp-hr' },
    fullName: { stringValue: 'HR Department' },
    email: { stringValue: 'hr@kalpanaaa.in' },
    role: { stringValue: 'HR_ADMIN' },
    department: { stringValue: 'HR Department' },
    designation: { stringValue: 'HR Operations Manager' },
    status: { stringValue: 'Active' },
    employmentType: { stringValue: 'Full-Time' },
    workLocation: { stringValue: 'Main Office HQ' },
    shift: { stringValue: 'Day Shift (10:00 - 19:00)' },
    permanentAddress: { stringValue: 'Bengaluru HQ Campus' },
    currentAddress: { stringValue: 'Bengaluru HQ Campus' },
    city: { stringValue: 'Bengaluru' },
    state: { stringValue: 'Karnataka' },
    postalCode: { stringValue: '560102' },
    phone: { stringValue: '8105866141' },
    emergencyContact: { stringValue: '8105866141' },
    emergencyRelationship: { stringValue: 'Management' },
    reportingManager: { stringValue: 'Akshit Ujjain' },
    qrToken: { stringValue: 'QR-HR' },
    createdAt: { stringValue: '2026-08-24T09:00:00Z' },
    updatedAt: { stringValue: new Date().toISOString() }
  };
  await request(`${FIRESTORE_BASE}/employees/emp-hr`, 'PATCH', { fields: hrDoc }, token);
  console.log('✅ Created employees/emp-hr with NO employee ID!');

  // 2. Mark legacy emp-KSS2407011 as Terminated and clear employeeId so it does not conflict with Jason
  console.log('Deactivating legacy employees/emp-KSS2407011...');
  await patchDoc('employees', 'emp-KSS2407011', {
    status: 'Terminated',
    employeeId: '',
    qrToken: '',
    updatedAt: new Date().toISOString()
  }, token);
  console.log('✅ Marked legacy employees/emp-KSS2407011 as Terminated!');

  console.log('\n🎉 HR now has NO employee ID (document ID is emp-hr). KSS2407011 belongs exclusively to Jason Kenneth N.');
}

main().catch(console.error);
