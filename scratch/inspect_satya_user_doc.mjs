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

async function main() {
  const hrRes = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST',
    { email: HR_EMAIL, password: HR_PASS, returnSecureToken: true }
  );
  const token = hrRes.idToken;

  const doc = await request(`${FIRESTORE_BASE}/users/QpDtyS6Jp5OqNu3klvfWGoWHfmS2`, 'GET', null, token);
  console.log('users/QpDtyS6Jp5OqNu3klvfWGoWHfmS2:', JSON.stringify(doc, null, 2));
}

main().catch(console.error);
