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

  // 1. Fetch all attendance docs for 2026-09-07
  const attRes = await request(`${FIRESTORE_BASE}/attendance?pageSize=500`, 'GET', null, token);
  const sep7Docs = (attRes.documents || []).filter(d => {
    const f = parseFields(d.fields);
    return f.date === '2026-09-07';
  });
  console.log(`Sep 7 (2026-09-07) total docs: ${sep7Docs.length}`);
  for (const td of sep7Docs) {
    const parsed = parseFields(td.fields);
    const docId = td.name.split('/').pop();
    console.log(`  Doc: ${docId} | Emp: ${parsed.employeeName} | empId: ${parsed.employeeId} | empCode: ${parsed.employeeCode} | uid: ${parsed.uid} | status: ${parsed.status} | in: ${parsed.checkInAt} | out: ${parsed.checkOutAt} | workMins: ${parsed.workingMinutes}`);
  }

  // 2. Fetch all employees with Koushik or KSS2407003
  const empIds = ['emp-KS2407003', 'emp-KSS2407003', 'vhKLIJCVZoTncqVtmh14paMbiXk2'];
  for (const eid of empIds) {
    try {
      const edoc = await request(`${FIRESTORE_BASE}/employees/${eid}`, 'GET', null, token);
      console.log(`\nEmployee [${eid}]:`, JSON.stringify(parseFields(edoc.fields), null, 2));
    } catch(e) {
      console.log(`Employee [${eid}] not found or error:`, e.message);
    }
  }
}

main().catch(console.error);
