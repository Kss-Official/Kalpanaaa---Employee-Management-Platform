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

function parseDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = { _docId: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields)) {
    if (k === 'faceDescriptor' || k === 'resumeUrl' || k === 'profilePhotoUrl') {
      obj[k] = `[${k} present]`;
      continue;
    }
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) obj[k] = Number(v.doubleValue);
    else if (v.arrayValue !== undefined) obj[k] = (v.arrayValue.values || []).map(x => x.stringValue || x);
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
    if (res.documents) all = all.concat(res.documents.map(parseDoc));
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return all;
}

async function main() {
  const { idToken } = await signIn();
  const employees = await getCollection('employees', idToken);
  const matchedEmps = employees.filter(e =>
    (e.fullName && e.fullName.toLowerCase().includes('satya')) ||
    (e.email && e.email.toLowerCase().includes('satya')) ||
    (e.employeeId && e.employeeId.toLowerCase().includes('kss2407012')) ||
    e._docId.includes('KSS2407012')
  );

  console.log(`Found ${matchedEmps.length} matching employee docs:`);
  for (const m of matchedEmps) {
    console.log(JSON.stringify(m, null, 2));
  }

  // Also check Firebase Auth for users with satya in email
  // We can use identitytoolkit to check email or lookup
  try {
    const dashCheck = await request(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${API_KEY}`, 'POST', {
      identifier: 'satya.ranjan.dash@kalpanaaa.in',
      continueUri: 'http://localhost'
    });
    console.log('\nAuth check for satya.ranjan.dash@kalpanaaa.in:');
    console.log('Registered?', dashCheck.registered, dashCheck.allProviders);
  } catch (e) {
    console.log('Error checking dash auth:', e.message);
  }

  try {
    const dasCheck = await request(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${API_KEY}`, 'POST', {
      identifier: 'satya.ranjan.das@kalpanaaa.in',
      continueUri: 'http://localhost'
    });
    console.log('\nAuth check for satya.ranjan.das@kalpanaaa.in:');
    console.log('Registered?', dasCheck.registered, dasCheck.allProviders);
  } catch (e) {
    console.log('Error checking das auth:', e.message);
  }
}

main().catch(console.error);
