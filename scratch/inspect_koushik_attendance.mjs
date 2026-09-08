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
  
  let pageToken = '';
  let allDocs = [];
  do {
    const url = `${FIRESTORE_BASE}/attendance?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await request(url, 'GET', null, token);
    if (res.documents) allDocs.push(...res.documents);
    pageToken = res.nextPageToken;
  } while (pageToken);

  console.log(`Total attendance records found: ${allDocs.length}`);
  
  const koushikRecords = [];
  const recordsWith99Mins = [];

  for (const doc of allDocs) {
    const docId = doc.name.split('/').pop();
    const data = parseFields(doc.fields);
    data._docId = docId;

    const name = (data.employeeName || '').toLowerCase();
    const empId = data.employeeId || '';
    const uid = data.uid || data.userId || '';

    if (name.includes('koushik') || empId.includes('KSS2407003') || uid.includes('vhKLIJCVZoTncqVtmh14paMbiXk2') || docId.includes('KSS2407003')) {
      koushikRecords.push(data);
    }

    if (data.workingMinutes === 99 || (data.workingMinutes >= 95 && data.workingMinutes <= 105)) {
      recordsWith99Mins.push(data);
    }
  }

  console.log(`\n--- KOUSHIK RECORDS (${koushikRecords.length}) ---`);
  koushikRecords.sort((a,b) => (a.date || '').localeCompare(b.date || ''));
  for (const r of koushikRecords) {
    console.log(`Doc: ${r._docId} | Date: ${r.date} | Status: ${r.status} | WorkingMins: ${r.workingMinutes} (${Math.floor((r.workingMinutes||0)/60)}h ${(r.workingMinutes||0)%60}m) | CheckIn: ${r.checkInAt} | CheckOut: ${r.checkOutAt} | TotalBreak: ${r.totalBreakMinutes}`);
  }

  console.log(`\n--- RECORDS WITH ~99 MINS (${recordsWith99Mins.length}) ---`);
  for (const r of recordsWith99Mins) {
    console.log(`Doc: ${r._docId} | Name: ${r.employeeName} (${r.employeeId}) | Date: ${r.date} | Status: ${r.status} | WorkingMins: ${r.workingMinutes} | CheckIn: ${r.checkInAt} | CheckOut: ${r.checkOutAt}`);
  }
}

main().catch(console.error);
