import https from 'https';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY    = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const HR_EMAIL   = 'hr@kalpanaaa.in';
const HR_PASS    = 'Hr@123456';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function req(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {'Content-Type': 'application/json'};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const b = body ? JSON.stringify(body) : null;
    if (b) headers['Content-Length'] = Buffer.byteLength(b);
    const r = https.request({hostname: u.hostname, path: u.pathname + u.search, method, headers}, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({status: res.statusCode, body: JSON.parse(d)}); }
        catch { resolve({status: res.statusCode, body: d}); }
      });
    });
    r.on('error', reject);
    if (b) r.write(b);
    r.end();
  });
}

function parseFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.mapValue !== undefined) res[k] = parseFields(v.mapValue.fields);
    else if (v.arrayValue !== undefined) res[k] = (v.arrayValue.values || []).map(i => i.stringValue || i.integerValue || i);
    else res[k] = v;
  }
  return res;
}

async function main() {
  const auth = await req(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, 'POST', {email: HR_EMAIL, password: HR_PASS, returnSecureToken: true});
  const token = auth.body.idToken;

  const d1 = await req(`${BASE}/employees/GCIqrMaffebCGNdmbuzPbcl6IpQ2`, 'GET', null, token);
  const d2 = await req(`${BASE}/employees/emp-KSS2407004`, 'GET', null, token);

  console.log('=== GCIqrMaffebCGNdmbuzPbcl6IpQ2 (Original Auth UID Doc) ===');
  console.log(JSON.stringify(parseFields(d1.body.fields), null, 2));

  console.log('\n=== emp-KSS2407004 ===');
  console.log(JSON.stringify(parseFields(d2.body.fields), null, 2));
}

main().catch(console.error);
