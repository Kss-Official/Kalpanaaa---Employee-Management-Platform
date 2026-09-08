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

  // Fetch all attendance for 2026-09-07 and 2026-09-08
  const attRes = await request(`${FIRESTORE_BASE}/attendance?pageSize=500`, 'GET', null, token);
  const allAtt = (attRes.documents || []).map(d => {
    const data = parseFields(d.fields);
    data.id = d.name.split('/').pop();
    return data;
  });

  // Fetch all employees
  const empRes = await request(`${FIRESTORE_BASE}/employees?pageSize=300`, 'GET', null, token);
  const allEmps = (empRes.documents || []).map(d => {
    const data = parseFields(d.fields);
    data.id = d.name.split('/').pop();
    return data;
  });

  const koushikEmps = allEmps.filter(e => 
    (e.fullName || '').toLowerCase().includes('koushik') || 
    (e.employeeId || '') === 'KSS2407003' ||
    e.id.includes('KSS2407003') ||
    e.id === 'vhKLIJCVZoTncqVtmh14paMbiXk2'
  );

  console.log(`Found ${koushikEmps.length} employee objects for Koushik:`);
  for (const ke of koushikEmps) {
    console.log(`\nEmployee: id=${ke.id}, employeeId=${ke.employeeId}, uid=${ke.uid}, name=${ke.fullName}`);
    
    // Check attendance for 2026-09-07
    const att07 = allAtt.filter(a => a.date === '2026-09-07');
    console.log(`  Total att records for 2026-09-07: ${att07.length}`);
    const myAtt07 = att07.filter(a => 
      a.employeeId === ke.id || a.employeeId === ke.employeeId || a.uid === ke.uid || a.uid === ke.id || a.id.startsWith(ke.id) || a.id.startsWith(ke.uid || '')
    );
    console.log(`  Matching att records for 2026-09-07:`, myAtt07.map(a => ({ id: a.id, date: a.date, empId: a.employeeId, uid: a.uid, status: a.status, workMins: a.workingMinutes })));

    // Check attendance for 2026-09-08
    const att08 = allAtt.filter(a => a.date === '2026-09-08');
    const myAtt08 = att08.filter(a => 
      a.employeeId === ke.id || a.employeeId === ke.employeeId || a.uid === ke.uid || a.uid === ke.id || a.id.startsWith(ke.id) || a.id.startsWith(ke.uid || '')
    );
    console.log(`  Matching att records for 2026-09-08:`, myAtt08.map(a => ({ id: a.id, date: a.date, empId: a.employeeId, uid: a.uid, status: a.status, workMins: a.workingMinutes })));
  }

  // Also print ALL attendance records in DB where date is 2026-09-07
  console.log('\n--- ALL ATTENDANCE RECORDS FOR 2026-09-07 ---');
  for (const a of allAtt.filter(x => x.date === '2026-09-07')) {
    console.log(`Doc: ${a.id} | Name: ${a.employeeName} | empId: ${a.employeeId} | empCode: ${a.employeeCode} | uid: ${a.uid} | status: ${a.status} | workMins: ${a.workingMinutes}`);
  }
}

main().catch(console.error);
