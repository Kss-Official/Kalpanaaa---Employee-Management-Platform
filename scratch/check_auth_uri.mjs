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
            resolve({ status: res.statusCode, body: parsed });
          } catch {
            resolve({ status: res.statusCode, body: data });
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
  const res = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${API_KEY}`,
    'POST',
    { identifier: 'satya.ranjan.dash@kalpanaaa.in', continueUri: 'http://localhost' }
  );
  console.log('Result for satya.ranjan.dash@kalpanaaa.in:', JSON.stringify(res, null, 2));

  const res2 = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${API_KEY}`,
    'POST',
    { identifier: 'satya.ranjan.das@kalpanaaa.in', continueUri: 'http://localhost' }
  );
  console.log('Result for satya.ranjan.das@kalpanaaa.in:', JSON.stringify(res2, null, 2));
}

main().catch(console.error);
