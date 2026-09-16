import https from 'https';

const API_KEY = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const HR_EMAIL = 'hr@kalpanaaa.in';
const HR_PASS  = 'Hr@123456';
const PROJECT_ID = 'kalpanaaa-employees-website';
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
            resolve(parsed);
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
      console.log(`Error in ${collection}: ${e.message}`);
      break;
    }
  } while (pageToken);
  return all;
}

async function main() {
  const hrRes = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST',
    { email: HR_EMAIL, password: HR_PASS, returnSecureToken: true }
  );
  const token = hrRes.idToken;

  const collections = [
    'leaves', 'payslips', 'payroll', 'feedback', 'performance',
    'presence', 'auditLogs', 'quizResults', 'faceDescriptors', 'users'
  ];

  for (const col of collections) {
    const docs = await listCollection(col, token);
    const matches = [];
    for (const d of docs) {
      const json = JSON.stringify(d.fields || {}).toLowerCase();
      if (json.includes('satya.ranjan.dash')) {
        matches.push(d.name.split('/').pop());
      }
    }
    console.log(`Collection "${col}": ${matches.length} matches (scanned ${docs.length} docs)${matches.length > 0 ? ` -> ${matches}` : ''}`);
  }
}

main().catch(console.error);
