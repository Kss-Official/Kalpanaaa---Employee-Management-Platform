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

function parseFields(fields) {
  const res = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.mapValue !== undefined) res[k] = parseFields(v.mapValue.fields);
    else if (v.arrayValue !== undefined) res[k] = (v.arrayValue.values || []).map(item => item.stringValue || item.integerValue || item);
    else res[k] = v;
  }
  return res;
}

async function main() {
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);

  // 1. Check all employees matching koushik
  const empRes = await request(`${FIRESTORE_BASE}/employees?pageSize=300`, 'GET', null, token);
  const empDocs = empRes.documents || [];
  console.log(`Total employees: ${empDocs.length}`);
  for (const doc of empDocs) {
    const data = parseFields(doc.fields);
    data._docId = doc.name.split('/').pop();
    const name = (data.fullName || data.name || '').toLowerCase();
    const id = data.employeeId || '';
    if (name.includes('koushik') || id.includes('KSS2407003') || data._docId.includes('KSS2407003')) {
      console.log('Employee doc:', JSON.stringify(data, null, 2));
    }
  }

  // 2. Check today's record in detail
  const todayRec = await request(`${FIRESTORE_BASE}/attendance/vhKLIJCVZoTncqVtmh14paMbiXk2_2026-09-08`, 'GET', null, token);
  console.log('vhKLIJCVZoTncqVtmh14paMbiXk2_2026-09-08 doc:', JSON.stringify(parseFields(todayRec.fields), null, 2));

  // 3. Also check if there's any other 2026-09-08 attendance doc
  const attRes = await request(`${FIRESTORE_BASE}/attendance?pageSize=500`, 'GET', null, token);
  const todayDocs = (attRes.documents || []).filter(d => {
    const f = parseFields(d.fields);
    return f.date === '2026-09-08';
  });
  console.log(`Today (2026-09-08) total docs: ${todayDocs.length}`);
  for (const td of todayDocs) {
    const parsed = parseFields(td.fields);
    console.log(`  Doc: ${td.name.split('/').pop()} | Emp: ${parsed.employeeName} (${parsed.employeeId}) | status: ${parsed.status} | in: ${parsed.checkInAt} | out: ${parsed.checkOutAt} | workMins: ${parsed.workingMinutes}`);
  }
}

main().catch(console.error);
