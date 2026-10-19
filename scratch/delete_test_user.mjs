import https from 'https';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const HR_EMAIL = 'hr@kalpanaaa.in';
const HR_PASS = 'Hr@123456';
const TEST_EMAIL = 'test.emp.audit@kalpanaaa.in';
const TEST_PASS = 'TestEmp@123456';
const TEST_UID = 'mI4dV1Tp9rdbmRqEUMGsRd1j0Sx2';

function req(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
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

function parseFields(fields) {
  const res = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.arrayValue !== undefined) res[k] = (v.arrayValue.values || []).map(item => item.stringValue || item.integerValue || item);
    else res[k] = v;
  }
  return res;
}

async function main() {
  console.log('--- PURGING TEST AUDIT EMPLOYEE (KSS2407999) ---');

  // 1. Authenticate HR Admin
  const hrAuth = await req(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST',
    { email: HR_EMAIL, password: HR_PASS, returnSecureToken: true }
  );
  if (hrAuth.status !== 200) throw new Error('HR Auth failed: ' + JSON.stringify(hrAuth.body));
  const hrToken = hrAuth.body.idToken;
  console.log('✅ HR Admin Authenticated');

  // 2. Delete from employees collection
  const delEmpRes = await req(`${BASE}/employees/${TEST_UID}`, 'DELETE', null, hrToken);
  console.log(`🗑️ Deleted employees/${TEST_UID}: status ${delEmpRes.status}`);

  // Check any other employee doc that might have KSS2407999
  let allEmps = [];
  let pageToken = null;
  do {
    const res = await req(`${BASE}/employees?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`, 'GET', null, hrToken);
    if (res.body?.documents) allEmps = allEmps.concat(res.body.documents);
    pageToken = res.body?.nextPageToken || null;
  } while (pageToken);

  for (const doc of allEmps) {
    const docId = doc.name.split('/').pop();
    const data = parseFields(doc.fields);
    if (data.employeeId === 'KSS2407999' || (data.fullName && data.fullName.toLowerCase().includes('test audit'))) {
      const dRes = await req(`${BASE}/employees/${docId}`, 'DELETE', null, hrToken);
      console.log(`🗑️ Deleted employee doc ${docId}: status ${dRes.status}`);
    }
  }

  // 3. Delete from users collection
  const delUserRes = await req(`${BASE}/users/${TEST_UID}`, 'DELETE', null, hrToken);
  console.log(`🗑️ Deleted users/${TEST_UID}: status ${delUserRes.status}`);

  // 4. Delete attendance records for test user
  let allAttendance = [];
  pageToken = null;
  do {
    const res = await req(`${BASE}/attendance?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`, 'GET', null, hrToken);
    if (res.body?.documents) allAttendance = allAttendance.concat(res.body.documents);
    pageToken = res.body?.nextPageToken || null;
  } while (pageToken);

  let deletedAttCount = 0;
  for (const doc of allAttendance) {
    const docId = doc.name.split('/').pop();
    const data = parseFields(doc.fields);
    if (
      docId.startsWith(TEST_UID) ||
      data.employeeId === TEST_UID ||
      data.employeeId === 'KSS2407999' ||
      data.employeeCode === 'KSS2407999' ||
      data.uid === TEST_UID ||
      data.employeeUid === TEST_UID ||
      (data.employeeName && data.employeeName.toLowerCase().includes('test audit'))
    ) {
      await req(`${BASE}/attendance/${docId}`, 'DELETE', null, hrToken);
      deletedAttCount++;
      console.log(`🗑️ Deleted attendance record: ${docId}`);
    }
  }
  console.log(`✅ Deleted ${deletedAttCount} attendance records for test user`);

  // 5. Delete Firebase Auth account
  try {
    const testAuth = await req(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      'POST',
      { email: TEST_EMAIL, password: TEST_PASS, returnSecureToken: true }
    );
    if (testAuth.status === 200) {
      const testToken = testAuth.body.idToken;
      const delAuthRes = await req(
        `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`,
        'POST',
        { idToken: testToken }
      );
      console.log(`🗑️ Deleted Firebase Auth account (${TEST_EMAIL}): status ${delAuthRes.status}`);
    } else {
      console.log(`ℹ️ Test account login returned ${testAuth.status} (already deleted or invalid credentials)`);
    }
  } catch (err) {
    console.warn('Auth deletion error (non-fatal):', err.message);
  }

  console.log('\n🎉 Test user (KSS2407999) has been completely eradicated from the system!');
}

main().catch(console.error);
