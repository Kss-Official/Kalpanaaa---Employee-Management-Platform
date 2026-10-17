/**
 * Safely update Pratiksha Harode's employmentType to 'Full Stack Development'
 * Uses PATCH with updateMask so only the target field is touched.
 */
import https from 'https';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY    = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const HR_EMAIL   = 'hr@kalpanaaa.in';
const HR_PASS    = 'Hr@123456';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Known UID for Pratiksha (from Asbin recovery work)
const PRAT_UID   = 'NTirYBVT1pSuLj5thrdsjM54F303';

function req(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const b = body ? JSON.stringify(body) : null;
    if (b) headers['Content-Length'] = Buffer.byteLength(b);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (b) r.write(b);
    r.end();
  });
}

async function getToken() {
  const r = await req(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST', { email: HR_EMAIL, password: HR_PASS, returnSecureToken: true }
  );
  if (!r.body.idToken) throw new Error('Auth failed: ' + JSON.stringify(r.body));
  return r.body.idToken;
}

async function run() {
  console.log('🔐 Authenticating...');
  const token = await getToken();
  console.log('✅ Authenticated');

  const now = new Date().toISOString();

  // Patch only employmentType and updatedAt — no other fields touched
  const patchBody = {
    fields: {
      employmentType: { stringValue: 'Full Stack Development' },
      updatedAt:      { stringValue: now }
    }
  };
  const updateMask = 'updateMask.fieldPaths=employmentType&updateMask.fieldPaths=updatedAt';

  // Update canonical UID doc
  const docUrl = `${BASE}/employees/${PRAT_UID}?${updateMask}`;
  console.log(`\n📝 PATCH employees/${PRAT_UID} ...`);
  const r1 = await req(docUrl, 'PATCH', patchBody, token);
  if (r1.status === 200) {
    console.log(`✅ employees/${PRAT_UID} → employmentType: 'Full Stack Development'`);
  } else {
    console.error(`❌ Failed (${r1.status}):`, JSON.stringify(r1.body, null, 2));
  }

  // Also verify the read-back
  const checkUrl = `${BASE}/employees/${PRAT_UID}`;
  const r2 = await req(checkUrl, 'GET', null, token);
  if (r2.status === 200) {
    const empType = r2.body.fields?.employmentType?.stringValue;
    const fullName = r2.body.fields?.fullName?.stringValue;
    console.log(`\n🔎 Verification: ${fullName} → employmentType = "${empType}"`);
    if (empType === 'Full Stack Development') {
      console.log('✅ Firestore confirmed — Full Stack Development');
    } else {
      console.error('❌ Mismatch! Got:', empType);
    }
  } else {
    console.error('Could not read back doc:', r2.status);
  }
}

run().catch(console.error);
