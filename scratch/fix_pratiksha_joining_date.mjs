/**
 * Diagnose and fix Pratiksha Harode's joiningDate in Firestore.
 * The calendar shows "15-10-2026" as joining date, causing all prior days
 * to render as "—" (isPreInception). The real joining date is 2024-04-01.
 */
import https from 'https';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY    = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const HR_EMAIL   = 'hr@kalpanaaa.in';
const HR_PASS    = 'Hr@123456';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
  console.log('✅ Authenticated\n');

  // Step 1: Read current state
  const readUrl = `${BASE}/employees/${PRAT_UID}`;
  const r1 = await req(readUrl, 'GET', null, token);
  if (r1.status !== 200) {
    console.error('❌ Cannot read doc:', r1.status, JSON.stringify(r1.body));
    return;
  }

  const fields = r1.body.fields || {};
  const currentJoining = fields.joiningDate?.stringValue || fields.joining_date?.stringValue || 'NOT_FOUND';
  const fullName = fields.fullName?.stringValue || 'Unknown';
  const empId = fields.employeeId?.stringValue || 'Unknown';
  const empType = fields.employmentType?.stringValue || 'NOT_SET';

  console.log('📋 Current Firestore state:');
  console.log(`   Name:           ${fullName}`);
  console.log(`   EmployeeId:     ${empId}`);
  console.log(`   joiningDate:    ${currentJoining}  ← THIS IS THE BUG (should be 2024-04-01)`);
  console.log(`   employmentType: ${empType}`);

  const CORRECT_JOINING_DATE = '2024-04-01';

  if (currentJoining === CORRECT_JOINING_DATE) {
    console.log('\n✅ joiningDate is already correct. No fix needed.');
    return;
  }

  // Step 2: Patch ONLY joiningDate and updatedAt — non-destructive
  console.log(`\n🔧 Patching joiningDate: "${currentJoining}" → "${CORRECT_JOINING_DATE}"`);
  const now = new Date().toISOString();
  const patchBody = {
    fields: {
      joiningDate: { stringValue: CORRECT_JOINING_DATE },
      updatedAt:   { stringValue: now }
    }
  };
  const updateMask = 'updateMask.fieldPaths=joiningDate&updateMask.fieldPaths=updatedAt';
  const patchUrl = `${BASE}/employees/${PRAT_UID}?${updateMask}`;

  const r2 = await req(patchUrl, 'PATCH', patchBody, token);
  if (r2.status === 200) {
    console.log(`✅ Patched successfully`);
  } else {
    console.error(`❌ Patch failed (${r2.status}):`, JSON.stringify(r2.body, null, 2));
    return;
  }

  // Step 3: Verify
  const r3 = await req(readUrl, 'GET', null, token);
  const verifiedJoining = r3.body.fields?.joiningDate?.stringValue;
  console.log(`\n🔎 Verification: joiningDate = "${verifiedJoining}"`);
  if (verifiedJoining === CORRECT_JOINING_DATE) {
    console.log('✅ CONFIRMED — Calendar will now show all attendance records correctly');
  } else {
    console.error('❌ Mismatch! Got:', verifiedJoining);
  }
}

run().catch(console.error);
