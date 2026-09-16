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
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode} ${method} ${url}\n${data}`));
            }
          } catch {
            resolve(data);
          }
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function signIn() {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  return request(url, 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true });
}

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = { _name: doc.name };
  for (const [k, v] of Object.entries(doc.fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) obj[k] = Number(v.doubleValue);
    else if (v.arrayValue !== undefined) obj[k] = (v.arrayValue.values || []).map(x => x.stringValue || x);
    else if (v.mapValue !== undefined) obj[k] = v.mapValue;
    else if (v.nullValue !== undefined) obj[k] = null;
    else obj[k] = v;
  }
  return obj;
}

async function getCollection(collection, token) {
  let all = [];
  let pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await request(url, 'GET', null, token);
    if (res.documents) all = all.concat(res.documents.map(parseFirestoreDoc));
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return all;
}

async function main() {
  console.log('Signing in...');
  const { idToken } = await signIn();
  console.log('Signed in.');

  console.log('Fetching employees...');
  const employees = await getCollection('employees', idToken);
  const satyaEmps = employees.filter(e => 
    (e.fullName && e.fullName.toLowerCase().includes('satya')) ||
    (e.email && e.email.toLowerCase().includes('satya')) ||
    (e.employeeId && e.employeeId.includes('KSS2407012')) ||
    (e._name && (e._name.includes('KSS2407012') || e._name.includes('QpDtyS6Jp5OqNu3klvfWGoWHfmS2')))
  );
  console.log('\n--- SATYA EMPLOYEES DOCS ---');
  console.log(JSON.stringify(satyaEmps, null, 2));

  console.log('Fetching users individually if possible...');
  try {
    const users = await getCollection('users', idToken);
    const satyaUsers = users.filter(u =>
      (u.fullName && u.fullName.toLowerCase().includes('satya')) ||
      (u.email && u.email.toLowerCase().includes('satya')) ||
      (u.employeeId && u.employeeId.includes('KSS2407012'))
    );
    console.log('\n--- SATYA USERS DOCS ---');
    console.log(JSON.stringify(satyaUsers, null, 2));
  } catch (err) {
    console.log('Could not list /users collection directly:', err.message);
  }

  // Let's check if users/emp-KSS2407012 or users/QpDtyS6Jp5OqNu3klvfWGoWHfmS2 exists
  for (const uid of ['emp-KSS2407012', 'QpDtyS6Jp5OqNu3klvfWGoWHfmS2', 'KSS2407012']) {
    try {
      const doc = await request(`${FIRESTORE_BASE}/users/${uid}`, 'GET', null, idToken);
      console.log(`users/${uid}:`, JSON.stringify(parseFirestoreDoc(doc)));
    } catch (e) {
      console.log(`users/${uid} not found or inaccessible:`, e.message);
    }
  }

  // Also check across all collections for any mention of satya or KSS2407012
  const cols = [
    'attendance', 'leaveRequests', 'leaves', 'payslips', 'payroll',
    'notifications', 'feedback', 'performance', 'presence', 'auditLogs',
    'quizResults', 'faceDescriptors'
  ];

  for (const col of cols) {
    try {
      const docs = await getCollection(col, idToken);
      const matched = docs.filter(d => {
        const s = JSON.stringify(d).toLowerCase();
        return s.includes('satya') || s.includes('kss2407012');
      });
      if (matched.length > 0) {
        console.log(`\nFound ${matched.length} references to satya/KSS2407012 in ${col}:`);
        matched.forEach(m => {
          console.log('  Doc ID:', m._name.split('/').pop(), '| email:', m.email || m.userEmail, '| employeeId:', m.employeeId);
        });
      }
    } catch (e) {
      console.log(`Error checking ${col}:`, e.message);
    }
  }
}

main().catch(console.error);
