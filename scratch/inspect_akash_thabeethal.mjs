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
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} ${method} ${url}\n${data}`));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function signIn() {
  const res = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, 'POST', { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true });
  return res.idToken;
}

async function getAllDocs(token, collection) {
  let all = [];
  let pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/${collection}?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await request(url, 'GET', null, token);
    if (res.documents) all = all.concat(res.documents);
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return all;
}

async function main() {
  const token = await signIn();
  console.log('Authenticated\n');

  const allLeaves = await getAllDocs(token, 'leaveRequests');
  console.log(`Total leaveRequests: ${allLeaves.length}`);

  const akashLeaves = allLeaves.filter(l => {
    const f = l.fields || {};
    const name = (f.employeeName?.stringValue || '').toLowerCase();
    const id   = (f.employeeId?.stringValue || '').toLowerCase();
    const uid  = (f.employeeUid?.stringValue || '').toLowerCase();
    return name.includes('akash') || id.includes('kss2407013') || uid.includes('nMnI0qXOmMO9gw2nDnnPJuz2G1S2'.toLowerCase());
  });

  const thabLeaves = allLeaves.filter(l => {
    const f = l.fields || {};
    const name = (f.employeeName?.stringValue || '').toLowerCase();
    const id   = (f.employeeId?.stringValue || '').toLowerCase();
    const uid  = (f.employeeUid?.stringValue || '').toLowerCase();
    return name.includes('thabeetha') || id.includes('kss2407005') || uid.includes('mzgal3sijzazgrgf6wneu7htrew2');
  });

  console.log('\n=== AKASH SB LEAVE REQUESTS ===');
  for (const doc of akashLeaves) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    console.log(`DocID: ${docId}`);
    console.log(`  Name: ${f.employeeName?.stringValue} | ID: ${f.employeeId?.stringValue} | UID: ${f.employeeUid?.stringValue}`);
    console.log(`  Type: ${f.type?.stringValue} / ${f.leaveCategory?.stringValue}`);
    console.log(`  Date: ${f.startDate?.stringValue} to ${f.endDate?.stringValue}`);
    console.log(`  Status: ${f.status?.stringValue} pm:${f.pmStatus?.stringValue} hr:${f.hrStatus?.stringValue} ceo:${f.ceoStatus?.stringValue} cto:${f.ctoStatus?.stringValue}`);
  }

  console.log('\n=== THABEETHAL LEAVE REQUESTS ===');
  for (const doc of thabLeaves) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    console.log(`DocID: ${docId}`);
    console.log(`  Name: ${f.employeeName?.stringValue} | ID: ${f.employeeId?.stringValue} | UID: ${f.employeeUid?.stringValue}`);
    console.log(`  Type: ${f.type?.stringValue} / ${f.leaveCategory?.stringValue}`);
    console.log(`  Date: ${f.startDate?.stringValue} to ${f.endDate?.stringValue}`);
    console.log(`  Status: ${f.status?.stringValue} pm:${f.pmStatus?.stringValue} hr:${f.hrStatus?.stringValue} ceo:${f.ceoStatus?.stringValue} cto:${f.ctoStatus?.stringValue}`);
  }

  const allEmps = await getAllDocs(token, 'employees');
  const akashEmps = allEmps.filter(e => {
    const f = e.fields || {};
    const name = (f.fullName?.stringValue || f.name?.stringValue || '').toLowerCase();
    const id   = (f.employeeId?.stringValue || '').toLowerCase();
    return name.includes('akash') || id.includes('kss2407013');
  });
  const thabEmps = allEmps.filter(e => {
    const f = e.fields || {};
    const name = (f.fullName?.stringValue || f.name?.stringValue || '').toLowerCase();
    const id   = (f.employeeId?.stringValue || '').toLowerCase();
    return name.includes('thabeetha') || id.includes('kss2407005');
  });

  console.log('\n=== AKASH SB EMPLOYEE DOCS ===');
  for (const doc of akashEmps) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    console.log(`DocID: ${docId}`);
    console.log(`  Name: ${f.fullName?.stringValue || f.name?.stringValue} | empId: ${f.employeeId?.stringValue}`);
    console.log(`  earnLeaveBalance: ${f.earnLeaveBalance?.integerValue ?? f.earnLeaveBalance?.doubleValue ?? 'NOT SET'}`);
    console.log(`  sickLeaveBalance: ${f.sickLeaveBalance?.integerValue ?? f.sickLeaveBalance?.doubleValue ?? 'NOT SET'}`);
  }

  console.log('\n=== THABEETHAL EMPLOYEE DOCS ===');
  for (const doc of thabEmps) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    console.log(`DocID: ${docId}`);
    console.log(`  Name: ${f.fullName?.stringValue || f.name?.stringValue} | empId: ${f.employeeId?.stringValue}`);
    console.log(`  earnLeaveBalance: ${f.earnLeaveBalance?.integerValue ?? f.earnLeaveBalance?.doubleValue ?? 'NOT SET'}`);
    console.log(`  sickLeaveBalance: ${f.sickLeaveBalance?.integerValue ?? f.sickLeaveBalance?.doubleValue ?? 'NOT SET'}`);
  }
}

main().catch(console.error);
