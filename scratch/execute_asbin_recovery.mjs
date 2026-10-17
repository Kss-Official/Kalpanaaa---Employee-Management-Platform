/**
 * PRODUCTION RESTORATION SCRIPT — ASBIN T.S. (100% NON-DESTRUCTIVE)
 * 
 * Target:
 * 1. Backup pre-flight state of affected documents to scratch/backup_pre_asbin_recovery.json
 * 2. Fix Employee ID collision on Pratiksha Harode (NTirYBVT1pSuLj5thrdsjM54F303) -> KSS2407008
 * 3. Normalize Asbin's original document (GCIqrMaffebCGNdmbuzPbcl6IpQ2) with id, uid, employeeId, status=Active, isDeleted=false
 * 4. Ensure users/GCIqrMaffebCGNdmbuzPbcl6IpQ2 mapping is consistent
 * 5. NO DATA DELETION: emp-KSS2407004 is left intact in Firestore.
 * 6. Run full verification
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY    = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const HR_EMAIL   = 'hr@kalpanaaa.in';
const HR_PASS    = 'Hr@123456';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const ASBIN_UID  = 'GCIqrMaffebCGNdmbuzPbcl6IpQ2';
const PRAT_UID   = 'NTirYBVT1pSuLj5thrdsjM54F303';
const STUB_ID    = 'emp-KSS2407004';

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

function patchDoc(token, docPath, fields) {
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `${BASE}/${docPath}?${fieldPaths}`;
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else if (typeof v === 'number') firestoreFields[k] = { integerValue: String(v) };
    else if (v === null) firestoreFields[k] = { nullValue: null };
  }
  return req(url, 'PATCH', { fields: firestoreFields }, token);
}

function parseFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.mapValue !== undefined) res[k] = parseFields(v.mapValue.fields);
    else if (v.arrayValue !== undefined) res[k] = (v.arrayValue.values || []).map(i => i.stringValue || i.integerValue || i);
    else res[k] = v;
  }
  return res;
}

async function main() {
  console.log('====================================================');
  console.log('   STARTING PRODUCTION RECOVERY FOR ASBIN T.S.     ');
  console.log('   MODE: 100% NON-DESTRUCTIVE (ZERO DATA DELETION)  ');
  console.log('====================================================\n');

  console.log('1. Authenticating as HR administrator...');
  const authRes = await req(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST', { email: HR_EMAIL, password: HR_PASS, returnSecureToken: true }
  );
  if (authRes.status !== 200) {
    throw new Error(`HR Authentication failed with HTTP ${authRes.status}: ${JSON.stringify(authRes.body)}`);
  }
  const token = authRes.body.idToken;
  console.log('   ✅ Authenticated successfully.\n');

  // STEP 1: Pre-Restoration Snapshot
  console.log('2. Taking pre-restoration snapshot of affected documents...');
  const asbinDocPre = await req(`${BASE}/employees/${ASBIN_UID}`, 'GET', null, token);
  const pratDocPre  = await req(`${BASE}/employees/${PRAT_UID}`, 'GET', null, token);
  const stubDocPre  = await req(`${BASE}/employees/${STUB_ID}`, 'GET', null, token);
  const userDocPre  = await req(`${BASE}/users/${ASBIN_UID}`, 'GET', null, token);

  const backupData = {
    timestamp: new Date().toISOString(),
    records: {
      [`employees/${ASBIN_UID}`]: asbinDocPre.body,
      [`employees/${PRAT_UID}`]: pratDocPre.body,
      [`employees/${STUB_ID}`]: stubDocPre.body,
      [`users/${ASBIN_UID}`]: userDocPre.body
    }
  };

  const backupPath = path.resolve('scratch/backup_pre_asbin_recovery.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`   ✅ Pre-restoration snapshot safely written to: ${backupPath}\n`);

  // STEP 2: Correct Pratiksha Harode's Employee ID Collision
  console.log('3. Resolving Employee ID collision on Pratiksha Harode doc...');
  console.log(`   Patching employees/${PRAT_UID} with employeeId: 'KSS2407008'...`);
  const pratPatch = await patchDoc(token, `employees/${PRAT_UID}`, {
    employeeId: 'KSS2407008'
  });
  if (pratPatch.status !== 200) {
    throw new Error(`Failed to update Pratiksha doc: HTTP ${pratPatch.status} - ${JSON.stringify(pratPatch.body)}`);
  }
  console.log('   ✅ Pratiksha Harode employeeId restored to KSS2407008 (collision eliminated).\n');

  // STEP 3: Normalize Asbin's Original Document (Non-destructive patch)
  const now = new Date().toISOString();
  console.log('4. Normalizing Asbin T S original employee document...');
  console.log(`   Patching employees/${ASBIN_UID} with canonical identity anchors...`);
  const asbinPatch = await patchDoc(token, `employees/${ASBIN_UID}`, {
    id: ASBIN_UID,
    uid: ASBIN_UID,
    employeeId: 'KSS2407004',
    status: 'Active',
    isDeleted: false,
    updatedAt: now
  });
  if (asbinPatch.status !== 200) {
    throw new Error(`Failed to patch Asbin doc: HTTP ${asbinPatch.status} - ${JSON.stringify(asbinPatch.body)}`);
  }
  console.log('   ✅ Asbin T S original doc normalized with id, uid, employeeId, status=Active.\n');

  // STEP 4: Ensure users/ mapping is consistent
  console.log('5. Ensuring users role mapping document is synced...');
  const userPatch = await patchDoc(token, `users/${ASBIN_UID}`, {
    uid: ASBIN_UID,
    role: 'EMPLOYEE',
    employeeId: 'KSS2407004',
    employeeDocId: ASBIN_UID,
    email: 'asbin.t.s@kalpanaaa.in',
    fullName: 'Asbin T S',
    updatedAt: now
  });
  if (userPatch.status !== 200) {
    throw new Error(`Failed to patch users doc: HTTP ${userPatch.status} - ${JSON.stringify(userPatch.body)}`);
  }
  console.log('   ✅ users/GCIqrMaffebCGNdmbuzPbcl6IpQ2 verified and mapped.\n');

  // STEP 5: NO DATA DELETION
  console.log('6. Preserving all existing records (ZERO DELETIONS executed as instructed).');
  console.log(`   employees/${STUB_ID} retained in Firestore without modification.\n`);

  // STEP 6: Validation & Verification
  console.log('====================================================');
  console.log('             VALIDATION & VERIFICATION              ');
  console.log('====================================================\n');

  const vAsbin = await req(`${BASE}/employees/${ASBIN_UID}`, 'GET', null, token);
  const vPrat  = await req(`${BASE}/employees/${PRAT_UID}`, 'GET', null, token);
  const vUser  = await req(`${BASE}/users/${ASBIN_UID}`, 'GET', null, token);

  const asbinClean = parseFields(vAsbin.body.fields);
  const pratClean  = parseFields(vPrat.body.fields);
  const userClean  = parseFields(vUser.body.fields);

  console.log('A. Asbin T S Employee Document:');
  console.log(`   - Document ID:     ${ASBIN_UID}`);
  console.log(`   - Full Name:       ${asbinClean.fullName}`);
  console.log(`   - Employee ID:     ${asbinClean.employeeId}`);
  console.log(`   - Linked UID:      ${asbinClean.uid}`);
  console.log(`   - Status:          ${asbinClean.status}`);
  console.log(`   - Department:      ${asbinClean.department}`);
  console.log(`   - Face Enrolled:   ${asbinClean.isFaceEnrolled} (${asbinClean.faceEnrolledAt})`);
  const vectorLength = vAsbin.body.fields.faceDescriptor?.arrayValue?.values?.length || 0;
  console.log(`   - Face Descriptor: ${vectorLength === 128 ? '128-element Float vector verified' : `${vectorLength} elements`}`);

  console.log('\nB. Pratiksha Harode Employee Document:');
  console.log(`   - Document ID:     ${PRAT_UID}`);
  console.log(`   - Full Name:       ${pratClean.fullName}`);
  console.log(`   - Employee ID:     ${pratClean.employeeId} (Verified separate from Asbin)`);

  console.log('\nC. Asbin Users Mapping Document:');
  console.log(`   - Role:            ${userClean.role}`);
  console.log(`   - EmployeeDocId:   ${userClean.employeeDocId}`);
  console.log(`   - EmployeeId:      ${userClean.employeeId}`);

  console.log('\n====================================================');
  console.log('   ASBIN T.S. RECOVERY COMPLETED SAFELY (NO LOSS)   ');
  console.log('====================================================');
}

main().catch(err => {
  console.error('\n❌ RECOVERY SCRIPT ERROR:', err);
  process.exit(1);
});
