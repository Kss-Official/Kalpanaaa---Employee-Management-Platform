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

async function main() {
  const { idToken } = await signIn();

  const uidsToCheck = [
    'QpDtyS6Jp5OqNu3klvfWGoWHfmS2',
    'emp-KSS2407012',
    'emp-1785997525850',
    'KSS2407012'
  ];

  for (const uid of uidsToCheck) {
    try {
      const doc = await request(`${FIRESTORE_BASE}/users/${uid}`, 'GET', null, idToken);
      console.log(`users/${uid}:`, JSON.stringify(doc));
    } catch (e) {
      console.log(`users/${uid}: ${e.message}`);
    }
  }
}

main().catch(console.error);
