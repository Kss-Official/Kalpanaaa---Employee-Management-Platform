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

async function listCollection(collection, token) {
  let all = [];
  let pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    try {
      const res = await request(url, 'GET', null, token);
      if (res.documents) all = all.concat(res.documents);
      pageToken = res.nextPageToken || null;
    } catch (e) {
      console.log(`Skipping ${collection}: ${e.message}`);
      break;
    }
  } while (pageToken);
  return all;
}

async function main() {
  const { idToken } = await signIn();

  const collections = [
    'employees', 'attendance', 'leaveRequests', 'leaves', 'payslips',
    'notifications', 'feedback', 'performance', 'presence', 'auditLogs',
    'quizResults', 'faceDescriptors', 'users'
  ];

  for (const col of collections) {
    const docs = await listCollection(col, idToken);
    const matches = [];
    for (const d of docs) {
      const json = JSON.stringify(d.fields || {}).toLowerCase();
      if (json.includes('satya.ranjan.dash')) {
        matches.push(d.name.split('/').pop());
      }
    }
    if (matches.length > 0) {
      console.log(`Collection "${col}" has ${matches.length} docs with "satya.ranjan.dash":`, matches);
    } else {
      console.log(`Collection "${col}": 0 matches (scanned ${docs.length} docs)`);
    }
  }
}

main().catch(console.error);
