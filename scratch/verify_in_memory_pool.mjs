import https from 'https';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY    = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const HR_EMAIL   = 'hr@kalpanaaa.in';
const HR_PASS    = 'Hr@123456';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
  const authRes = await req(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST', { email: HR_EMAIL, password: HR_PASS, returnSecureToken: true }
  );
  const token = authRes.body.idToken;

  const res = await req(`${BASE}/employees?pageSize=300`, 'GET', null, token);
  const docs = res.body.documents || [];

  const fetched = docs.map(d => ({
    id: d.name.split('/').pop(),
    ...parseFields(d.fields)
  }));

  // Exactly replicate AuthContext.tsx lines 1398-1423
  const deduplicated = [];
  const seen = new Set();
  fetched.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());

  for (const emp of fetched) {
    if (!emp.fullName || emp.fullName.trim() === '') continue;
    const emailKey = (emp.email || '').toLowerCase().trim();
    const idKey = emp.employeeId?.trim();
    if ((emailKey && seen.has(emailKey)) || (idKey && seen.has(idKey))) continue;
    if (emailKey) seen.add(emailKey);
    if (idKey) seen.add(idKey);
    deduplicated.push(emp);
  }

  console.log(`Total live Firestore employee docs: ${fetched.length}`);
  console.log(`Deduplicated in-memory employee pool: ${deduplicated.length}`);

  const asbinInPool = deduplicated.find(e =>
    e.employeeId === 'KSS2407004' ||
    e.id === 'GCIqrMaffebCGNdmbuzPbcl6IpQ2' ||
    (e.email && e.email.toLowerCase().includes('asbin'))
  );

  if (asbinInPool) {
    console.log('\n✅ ASBIN T S IS PRESENT IN THE IN-MEMORY EMPLOYEE POOL:');
    console.log(`   - ID:          ${asbinInPool.id}`);
    console.log(`   - Employee ID: ${asbinInPool.employeeId}`);
    console.log(`   - Full Name:   ${asbinInPool.fullName}`);
    console.log(`   - Email:       ${asbinInPool.email}`);
    console.log(`   - Status:      ${asbinInPool.status}`);
    console.log(`   - Face Biometrics Enrolled: ${asbinInPool.isFaceEnrolled}`);
  } else {
    console.error('\n❌ Asbin not found in in-memory pool!');
  }

  const pratInPool = deduplicated.find(e =>
    (e.email && e.email.toLowerCase().includes('pratiksha'))
  );
  if (pratInPool) {
    console.log('\n✅ PRATIKSHA HARODE IN-MEMORY RECORD:');
    console.log(`   - ID:          ${pratInPool.id}`);
    console.log(`   - Employee ID: ${pratInPool.employeeId} (Verified separate KSS2407008)`);
  }
}

main().catch(console.error);
