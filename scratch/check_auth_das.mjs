import https from 'https';

const API_KEY = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';

function request(url, method, body) {
  return new Promise((resolve) => {
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
            resolve({ status: res.statusCode, body: parsed });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', (e) => resolve({ status: 500, body: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const email = 'satya.ranjan.das@kalpanaaa.in';
  const pass = 'Satya@2026!';

  console.log(`Checking signUp for ${email}...`);
  const signUpRes = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    'POST',
    { email, password: pass, returnSecureToken: true }
  );
  console.log('signUp status:', signUpRes.status, JSON.stringify(signUpRes.body));
}

main().catch(console.error);
