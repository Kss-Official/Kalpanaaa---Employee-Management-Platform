import https from 'https';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
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

async function run() {
  const authRes = await req(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, 'POST', {
    email: 'hr@kalpanaaa.in',
    password: 'Hr@123456',
    returnSecureToken: true
  });
  const token = authRes.body.idToken;

  const prahladDoc = await req(`${BASE}/employees/taq2d87UFqMrd6z036KuTHIeW9n2`, 'GET', null, token);
  const data = parseFields(prahladDoc.body.fields);
  console.log('✅ Prahlad Doc (taq2d87UFqMrd6z036KuTHIeW9n2):');
  console.log('  joiningDate:', data.joiningDate);
  console.log('  specialization:', data.specialization);
  console.log('  employeeId:', data.employeeId);

  let allAttendance = [];
  let pageToken = null;
  do {
    const aRes = await req(`${BASE}/attendance?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`, 'GET', null, token);
    if (aRes.body?.documents) allAttendance = allAttendance.concat(aRes.body.documents);
    pageToken = aRes.body?.nextPageToken || null;
  } while (pageToken);

  const octRecords = allAttendance
    .map(d => parseFields(d.fields))
    .filter(r => r.date && r.date.startsWith('2026-10') && (r.employeeCode === 'KSS2407010' || r.employeeId === 'emp-1785907335001' || r.uid === 'taq2d87UFqMrd6z036KuTHIeW9n2' || (r.employeeName || '').toLowerCase().includes('prahlad')))
    .sort((a,b) => a.date.localeCompare(b.date));

  console.log('\n✅ Prahlad October 2026 Records Count:', octRecords.length);
  for (const r of octRecords) {
    console.log(`  Date ${r.date}: Status=${r.status}, CheckIn=${r.checkInAt}, CheckOut=${r.checkOutAt}`);
  }
}

run().catch(console.error);
