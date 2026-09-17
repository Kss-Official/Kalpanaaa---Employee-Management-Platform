/**
 * Lists all employees with their IDs to understand current format
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
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getAllDocs(token, coll) {
  let all = [];
  let pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/${coll}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await request(url, 'GET', null, token);
    if (res.documents) all = all.concat(res.documents);
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return all;
}

async function main() {
  const res = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST', { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true }
  );
  const token = res.idToken;
  console.log('✅ Authenticated\n');

  const docs = await getAllDocs(token, 'employees');
  console.log(`Total employees: ${docs.length}\n`);
  
  // Sort by employeeId
  const employees = docs.map(d => ({
    docId: d.name.split('/').pop(),
    empId: d.fields?.employeeId?.stringValue || '(none)',
    name: d.fields?.fullName?.stringValue || '(no name)',
    uid: d.fields?.uid?.stringValue || d.fields?.employeeUid?.stringValue || '(no uid)',
  })).sort((a, b) => a.empId.localeCompare(b.empId));

  console.log('='.repeat(80));
  console.log('EmpID'.padEnd(18) + 'Name'.padEnd(35) + 'DocID');
  console.log('='.repeat(80));
  for (const e of employees) {
    console.log(e.empId.padEnd(18) + e.name.padEnd(35) + e.docId);
  }

  // Check for duplicates
  console.log('\n--- DUPLICATE EMPLOYEE IDs ---');
  const idMap = {};
  for (const e of employees) {
    if (!idMap[e.empId]) idMap[e.empId] = [];
    idMap[e.empId].push(e);
  }
  let hasDupes = false;
  for (const [id, emps] of Object.entries(idMap)) {
    if (emps.length > 1) {
      hasDupes = true;
      console.log(`\n⚠️  DUPLICATE: ${id}`);
      for (const e of emps) {
        console.log(`   → ${e.name} (docId: ${e.docId})`);
      }
    }
  }
  if (!hasDupes) console.log('None found ✅');
}

main().catch(console.error);
