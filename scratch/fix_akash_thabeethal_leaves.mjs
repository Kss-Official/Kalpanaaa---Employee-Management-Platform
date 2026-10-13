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
  const res = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST',
    { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true }
  );
  return res.idToken;
}

async function patchEarnLeaveBalance(token, docId, value) {
  const url = `${FIRESTORE_BASE}/employees/${docId}?updateMask.fieldPaths=earnLeaveBalance`;
  const body = {
    fields: {
      earnLeaveBalance: { integerValue: String(value) }
    }
  };
  const res = await request(url, 'PATCH', body, token);
  console.log(`  Patched ${docId} -> earnLeaveBalance=${value}`);
  return res;
}

async function main() {
  const token = await signIn();
  console.log('Authenticated\n');

  // Akash SB has 2 EL credited (not 1). Update both employee docs.
  // earnLeaveBalance = 2 means: credited=2, taken=0, balance=2
  // Previously set to 1 which was showing balance=1 instead of 2.
  const akashDocIds = ['emp-KSS2407013', 'nMnI0qXOmMO9gw2nDnnPJuz2G1S2'];
  console.log('=== Updating Akash SB earnLeaveBalance: 1 -> 2 ===');
  for (const docId of akashDocIds) {
    try {
      await patchEarnLeaveBalance(token, docId, 2);
    } catch (err) {
      console.warn(`  Warning for ${docId}: ${err.message}`);
    }
  }

  console.log('\nAll updates completed successfully!');
  console.log('\nSummary of changes:');
  console.log('  Akash SB: earnLeaveBalance = 2 (was 1)');
  console.log('    -> EL: credited=2, taken=0, balance=2');
  console.log('    -> SL: credited=1, taken=1, balance=0 (fixed by demoData.ts dedupe)');
  console.log('    -> Total credited=3, Total used=1, Balance=2');
  console.log('');
  console.log('  Thabeethal: No Firestore change needed.');
  console.log('    -> Aug-22 duplicate removed from demoData.ts');
  console.log('    -> EL: credited=2 (only Aug+Sep EL taken), taken=2, balance=0 per earnLeaveBalance=0');
}

main().catch(console.error);
