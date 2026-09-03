/**
 * Set up users/2d48Rm9eY4eBswXOZw2IBpWGkZK2 using its own authenticated token
 */
import https from 'https';

const PROJECT_ID   = 'kalpanaaa-employees-website';
const API_KEY      = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';

const TARGET_EMAIL = 'hr@kalpanaaa.in';
const TARGET_PASS  = 'Hr@123456';

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
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode} ${method} ${url}\n${data}`));
            }
          } catch {
            resolve(data);
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
  return request(url, 'POST', { email, password, returnSecureToken: true });
}

async function setDoc(collection, docId, fields, token) {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}`;
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === '') firestoreFields[k] = { nullValue: null };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else firestoreFields[k] = { stringValue: String(v) };
  }
  return request(url, 'PATCH', { fields: firestoreFields }, token);
}

async function main() {
  console.log(`Signing in as ${TARGET_EMAIL}...`);
  const hrAuth = await signIn(TARGET_EMAIL, TARGET_PASS);
  const hrToken = hrAuth.idToken;
  const hrUid = hrAuth.localId;
  console.log(`✅ Authenticated in Firebase Auth! UID: ${hrUid}`);

  console.log(`Writing users/${hrUid} document...`);
  await setDoc('users', hrUid, {
    email: TARGET_EMAIL,
    role: 'HR_ADMIN',
    employeeDocId: 'emp-KSS2407011',
    fullName: 'HR Department',
    updatedAt: new Date().toISOString()
  }, hrToken);
  console.log(`✅ users/${hrUid} successfully written!`);

  // Sign in as Admin to update employees/emp-KSS2407011 with uid
  const adminRes = await signIn('d.koushik@kalpanaaasoftwaresolutions.in', 'Koushik@777');
  console.log('Writing employees/emp-KSS2407011 with UID mapping...');
  await setDoc('employees', 'emp-KSS2407011', {
    id: 'emp-KSS2407011',
    uid: hrUid,
    fullName: 'HR Department',
    email: TARGET_EMAIL,
    role: 'HR_ADMIN',
    department: 'HR Department',
    designation: 'HR Operations Manager',
    status: 'Active',
    employmentType: 'Full-Time',
    workLocation: 'Main Office HQ',
    updatedAt: new Date().toISOString()
  }, adminRes.idToken);
  console.log(`✅ employees/emp-KSS2407011 synced with uid ${hrUid}!`);

  console.log('\n🎉 ALL DONE! HR account is 100% active in Firebase Auth and Firestore.');
}

main().catch(console.error);
