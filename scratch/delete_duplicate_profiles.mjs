/**
 * Delete rogue auto-generated employee document 3ZHI3aTB37StHjR97WEBJQSWT9H3 (KSS2407016)
 * and duplicate HR doc emp-1785997048965
 */
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

async function deleteDoc(collection, docId, token) {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}`;
  return request(url, 'DELETE', null, token);
}

async function main() {
  console.log('Signing in...');
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated.\n');

  const docsToDelete = [
    { col: 'employees', id: '3ZHI3aTB37StHjR97WEBJQSWT9H3', desc: 'Rogue duplicate Abhinaya V (KSS2407016)' },
    { col: 'employees', id: 'emp-1785997048965', desc: 'Duplicate HR Department doc' },
  ];

  for (const item of docsToDelete) {
    try {
      console.log(`Deleting ${item.col}/${item.id} (${item.desc})...`);
      await deleteDoc(item.col, item.id, token);
      console.log(`✅ Deleted ${item.col}/${item.id}!`);
    } catch (e) {
      console.error(`❌ Failed to delete ${item.col}/${item.id}:`, e.message);
    }
  }

  console.log('\n🎉 Cleanup completed! Refreshing list of employees...\n');

  const res = await request(`${FIRESTORE_BASE}/employees?pageSize=300`, 'GET', null, token);
  const docs = res.documents || [];
  console.log(`Remaining ${docs.length} employee documents:`);
  for (const doc of docs) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    console.log(`- ID: ${docId.padEnd(25)} | EmpID: ${(f.employeeId?.stringValue || '---').padEnd(12)} | ${(f.fullName?.stringValue || '').padEnd(25)} | ${f.email?.stringValue || ''}`);
  }
}

main().catch(console.error);
