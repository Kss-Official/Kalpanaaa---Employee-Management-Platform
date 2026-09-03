
/**
 * Provision / update hr@kalpanaaa.in in Firebase Auth and Firestore users collection
 */
import https from 'https';

const PROJECT_ID   = 'kalpanaaa-employees-website';
const API_KEY      = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL  = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS   = 'Koushik@777';

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

async function signUp(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
  return request(url, 'POST', { email, password, returnSecureToken: true });
}

async function signIn(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  return request(url, 'POST', { email, password, returnSecureToken: true });
}

async function setPasswordWithToken(idToken, newPassword) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`;
  return request(url, 'POST', { idToken, password: newPassword, returnSecureToken: true });
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
  console.log(`\n--- Provisioning ${TARGET_EMAIL} in Firebase Authentication ---`);
  
  let targetUid = null;
  let targetIdToken = null;

  // 1. Try to sign in first (if already exists)
  try {
    const signInRes = await signIn(TARGET_EMAIL, TARGET_PASS);
    targetUid = signInRes.localId;
    targetIdToken = signInRes.idToken;
    console.log(`✅ User ${TARGET_EMAIL} already exists in Firebase Auth with this password! (UID: ${targetUid})`);
  } catch (err) {
    // If sign in fails, try sign up
    try {
      console.log(`Creating user ${TARGET_EMAIL} in Firebase Auth...`);
      const signUpRes = await signUp(TARGET_EMAIL, TARGET_PASS);
      targetUid = signUpRes.localId;
      targetIdToken = signUpRes.idToken;
      console.log(`✅ Successfully created ${TARGET_EMAIL} in Firebase Auth! (UID: ${targetUid})`);
    } catch (signUpErr) {
      console.log(`Sign up notice: ${signUpErr.message}`);
      // If email exists but password was different, try resetting or sign in with admin
      const adminRes = await signIn(ADMIN_EMAIL, ADMIN_PASS);
      console.log('✅ Admin authenticated.');
    }
  }

  // 2. Sign in as Admin to configure users/{uid} and employees/{docId} in Firestore
  const adminRes = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  const adminToken = adminRes.idToken;

  if (targetUid) {
    console.log(`Writing users/${targetUid} for Firestore Security Rules role mapping...`);
    await setDoc('users', targetUid, {
      email: TARGET_EMAIL,
      role: 'HR_ADMIN',
      employeeDocId: 'emp-KSS2407011',
      fullName: 'HR Department',
      updatedAt: new Date().toISOString()
    }, adminToken);
    console.log(`✅ Created users/${targetUid} with role 'HR_ADMIN'!`);
  }

  console.log('Ensuring employees/emp-KSS2407011 has matching role and status...');
  await setDoc('employees', 'emp-KSS2407011', {
    id: 'emp-KSS2407011',
    fullName: 'HR Department',
    email: TARGET_EMAIL,
    role: 'HR_ADMIN',
    department: 'HR Department',
    designation: 'HR Operations Manager',
    status: 'Active',
    employmentType: 'Full-Time',
    workLocation: 'Main Office HQ',
    updatedAt: new Date().toISOString()
  }, adminToken);
  console.log(`✅ Synced employees/emp-KSS2407011 in Firestore!`);

  // Verify login
  console.log('\nVerifying login with credentials...');
  const verify = await signIn(TARGET_EMAIL, TARGET_PASS);
  console.log(`🎉 LIVE AUTH VERIFIED! Successfully logged in as ${TARGET_EMAIL} (UID: ${verify.localId})`);
}

main().catch(console.error);
