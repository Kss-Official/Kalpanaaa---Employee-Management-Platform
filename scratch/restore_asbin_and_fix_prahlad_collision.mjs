import https from 'https';
import fs from 'fs';
import path from 'path';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY    = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const HR_EMAIL   = 'hr@kalpanaaa.in';
const HR_PASS    = 'Hr@123456';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const ASBIN_UID   = 'GCIqrMaffebCGNdmbuzPbcl6IpQ2';
const PRAHLAD_UID = 'taq2d87UFqMrd6z036KuTHIeW9n2';
const STUB_ID     = 'emp-KSS2407004';

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
  console.log('================================================================');
  console.log('  STARTING NON-DESTRUCTIVE RECOVERY: ASBIN T.S. & PRAHLAD FIX   ');
  console.log('================================================================\n');

  console.log('1. Authenticating as HR Administrator...');
  const authRes = await req(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST', { email: HR_EMAIL, password: HR_PASS, returnSecureToken: true }
  );
  if (authRes.status !== 200) {
    throw new Error(`HR Auth failed: HTTP ${authRes.status} - ${JSON.stringify(authRes.body)}`);
  }
  const token = authRes.body.idToken;
  console.log('   ✅ HR Authenticated successfully.\n');

  // STEP 1: Pre-Restoration Snapshot
  console.log('2. Taking pre-restoration snapshot of affected documents...');
  const asbinDocPre   = await req(`${BASE}/employees/${ASBIN_UID}`, 'GET', null, token);
  const prahladDocPre = await req(`${BASE}/employees/${PRAHLAD_UID}`, 'GET', null, token);
  const stubDocPre    = await req(`${BASE}/employees/${STUB_ID}`, 'GET', null, token);
  const asbinUserPre  = await req(`${BASE}/users/${ASBIN_UID}`, 'GET', null, token);
  const prahladUserPre= await req(`${BASE}/users/${PRAHLAD_UID}`, 'GET', null, token);

  const backupData = {
    timestamp: new Date().toISOString(),
    records: {
      [`employees/${ASBIN_UID}`]: asbinDocPre.body,
      [`employees/${PRAHLAD_UID}`]: prahladDocPre.body,
      [`employees/${STUB_ID}`]: stubDocPre.body,
      [`users/${ASBIN_UID}`]: asbinUserPre.body,
      [`users/${PRAHLAD_UID}`]: prahladUserPre.body
    }
  };

  const backupPath = path.resolve('scratch/backup_pre_prahlad_asbin_fix.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`   ✅ Backup snapshot written safely to: ${backupPath}\n`);

  // STEP 2: Resolve Prahlad Sharma's Employee ID Collision -> KSS2407010
  const now = new Date().toISOString();
  console.log('3. Resolving Employee ID collision for Prahlad Sharma (taq2d87UFqMrd6z036KuTHIeW9n2)...');
  console.log("   Patching employees/taq2d87UFqMrd6z036KuTHIeW9n2 with employeeId: 'KSS2407010'...");
  const prahladPatch = await patchDoc(token, `employees/${PRAHLAD_UID}`, {
    employeeId: 'KSS2407010',
    qrToken: 'QR-KSS2407010',
    updatedAt: now
  });
  if (prahladPatch.status !== 200) {
    throw new Error(`Failed to patch Prahlad employee doc: HTTP ${prahladPatch.status}`);
  }
  console.log('   ✅ employees/taq2d87UFqMrd6z036KuTHIeW9n2 patched to KSS2407010.');

  console.log("   Patching users/taq2d87UFqMrd6z036KuTHIeW9n2 with employeeId: 'KSS2407010'...");
  const prahladUserPatch = await patchDoc(token, `users/${PRAHLAD_UID}`, {
    employeeId: 'KSS2407010',
    updatedAt: now
  });
  if (prahladUserPatch.status !== 200) {
    throw new Error(`Failed to patch Prahlad user doc: HTTP ${prahladUserPatch.status}`);
  }
  console.log('   ✅ users/taq2d87UFqMrd6z036KuTHIeW9n2 patched to KSS2407010.\n');

  // STEP 3: Normalize Asbin T S Canonical Document
  console.log('4. Normalizing Asbin T S canonical document (GCIqrMaffebCGNdmbuzPbcl6IpQ2)...');
  const asbinPatch = await patchDoc(token, `employees/${ASBIN_UID}`, {
    id: ASBIN_UID,
    uid: ASBIN_UID,
    employeeId: 'KSS2407004',
    fullName: 'Asbin T S',
    email: 'asbin.t.s@kalpanaaa.in',
    status: 'Active',
    isDeleted: false,
    department: 'IT',
    designation: 'Software Developer',
    updatedAt: now
  });
  if (asbinPatch.status !== 200) {
    throw new Error(`Failed to patch Asbin doc: HTTP ${asbinPatch.status}`);
  }
  console.log('   ✅ employees/GCIqrMaffebCGNdmbuzPbcl6IpQ2 normalized and activated.');

  console.log('5. Ensuring users/GCIqrMaffebCGNdmbuzPbcl6IpQ2 role mapping is consistent...');
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
    throw new Error(`Failed to patch users doc: HTTP ${userPatch.status}`);
  }
  console.log('   ✅ users/GCIqrMaffebCGNdmbuzPbcl6IpQ2 verified.\n');

  // STEP 4: Verification
  console.log('================================================================');
  console.log('                POST-RESTORATION VERIFICATION                   ');
  console.log('================================================================\n');

  let pageToken = '';
  const fetched = [];
  do {
    const url = BASE + '/employees?pageSize=100' + (pageToken ? '&pageToken=' + pageToken : '');
    const res = await req(url, 'GET', null, token);
    const docs = res.body.documents || [];
    for (const d of docs) {
      fetched.push({
        id: d.name.split('/').pop(),
        ...parseFields(d.fields)
      });
    }
    pageToken = res.body.nextPageToken;
  } while (pageToken);

  // Exact AuthContext deduplication
  const deduplicated = [];
  const seen = new Set();
  fetched.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
  
  for (const emp of fetched) {
    if (!emp.fullName || emp.fullName.trim() === '') continue;
    const emailKey = (emp.email || '').toLowerCase().trim();
    const idKey = emp.employeeId?.trim();
    if ((emailKey && seen.has(emailKey)) || (idKey && seen.has(idKey))) {
      continue;
    }
    if (emailKey) seen.add(emailKey);
    if (idKey) seen.add(idKey);
    deduplicated.push(emp);
  }
  deduplicated.reverse();

  const asbinInPool = deduplicated.find(e => 
    e.employeeId === 'KSS2407004' ||
    (e.fullName && e.fullName.toLowerCase().includes('asbin')) ||
    (e.email && e.email.toLowerCase().includes('asbin'))
  );

  const prahladInPool = deduplicated.find(e =>
    (e.fullName && e.fullName.toLowerCase().includes('prahlad')) ||
    (e.email && e.email.toLowerCase().includes('prahlad'))
  );

  console.log('VERIFICATION RESULTS:');
  console.log('1. Asbin T S in deduplicated portal pool:');
  console.log('   - Present:     ', !!asbinInPool);
  console.log('   - Doc ID:      ', asbinInPool?.id);
  console.log('   - Employee ID: ', asbinInPool?.employeeId);
  console.log('   - Name:        ', asbinInPool?.fullName);
  console.log('   - Email:       ', asbinInPool?.email);
  console.log('   - Status:      ', asbinInPool?.status);
  console.log('   - Department:  ', asbinInPool?.department);

  console.log('\n2. Prahlad Sharma in deduplicated portal pool:');
  console.log('   - Present:     ', !!prahladInPool);
  console.log('   - Doc ID:      ', prahladInPool?.id);
  console.log('   - Employee ID: ', prahladInPool?.employeeId);
  console.log('   - Name:        ', prahladInPool?.fullName);
  console.log('   - Email:       ', prahladInPool?.email);

  if (asbinInPool && asbinInPool.employeeId === 'KSS2407004' && prahladInPool && prahladInPool.employeeId === 'KSS2407010') {
    console.log('\n🎉 SUCCESS: Asbin T S and Prahlad Sharma are both cleanly restored with no collisions!');
  } else {
    console.log('\n⚠️ ATTENTION: Check discrepancy above.');
  }
}

main().catch(err => {
  console.error('ERROR during recovery:', err);
  process.exit(1);
});
