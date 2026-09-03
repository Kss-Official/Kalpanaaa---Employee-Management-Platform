/**
 * Updates Executive Leadership section in Firestore:
 *  - Updates profilePhotoUrl (as base64 data URL) for Akshit & Gaurav
 *  - Updates designation for both
 *  - Sets sortOrder: Gaurav=1 (left), Akshit=2 (right)
 *
 * Docs updated:
 *   emp-KSS2407001, emp-1785844335966, hOjKhSAtZKN7igNaePAmPKprVbp1  → Gaurav
 *   emp-KSS2407002, emp-1785847273632                                   → Akshit
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_ID  = 'kalpanaaa-employees-website';
const API_KEY     = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS  = 'Koushik@777';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── helpers ─────────────────────────────────────────────────────────────────

function httpsRequest(url, method, body, token) {
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
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function signIn(email, password) {
  const res = await httpsRequest(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST', { email, password, returnSecureToken: true }
  );
  if (!res.idToken) throw new Error('Auth failed: ' + JSON.stringify(res));
  return res.idToken;
}

function fileToBase64DataUrl(filePath, mimeType) {
  const bytes = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

/**
 * Patch specific fields on a Firestore document using field-level updateMask.
 */
async function patchDoc(token, docPath, fields) {
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const url = `${FIRESTORE_BASE}/${docPath}?${fieldPaths}`;
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => {
        if (typeof v === 'number') return [k, { integerValue: v }];
        return [k, { stringValue: String(v) }];
      })
    )
  };
  const res = await httpsRequest(url, 'PATCH', body, token);
  if (res.error) throw new Error(`Patch ${docPath} failed: ` + JSON.stringify(res.error));
  return res;
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔐 Authenticating…');
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated\n');

  // ── 1. Read photos as base64 data URLs ────────────────────────────────────
  console.log('📸 Reading executive photos…');
  const akshitPhotoPath = path.join(__dirname, '..', 'public', 'akshit_ujjain.jpg');
  const gauravPhotoPath = path.join(__dirname, '..', 'public', 'gaurav_kumar.png');

  const akshitPhotoUrl = fileToBase64DataUrl(akshitPhotoPath, 'image/jpeg');
  const gauravPhotoUrl = fileToBase64DataUrl(gauravPhotoPath, 'image/png');
  console.log(`  Akshit photo: ${akshitPhotoUrl.length} chars`);
  console.log(`  Gaurav photo: ${gauravPhotoUrl.length} chars`);

  // ── 2. Define updated fields ───────────────────────────────────────────────
  const gauravFields = {
    designation:     'Founder, Managing Director/CTO',
    profilePhotoUrl: gauravPhotoUrl,
    sortOrder:       1,   // Gaurav appears FIRST (left)
  };
  const akshitFields = {
    designation:     'Co-Founder, CEO',
    profilePhotoUrl: akshitPhotoUrl,
    sortOrder:       2,   // Akshit appears SECOND (right)
  };

  // ── 3. Patch all Gaurav documents ─────────────────────────────────────────
  const gauravDocs = [
    'employees/emp-KSS2407001',
    'employees/emp-1785844335966',
    'employees/hOjKhSAtZKN7igNaePAmPKprVbp1',
  ];
  console.log('\n👤 Updating Gaurav Kumar Tripathi documents…');
  for (const docPath of gauravDocs) {
    try {
      await patchDoc(token, docPath, gauravFields);
      console.log(`  ✅ Updated ${docPath}`);
    } catch (e) {
      console.warn(`  ⚠️  ${docPath}: ${e.message}`);
    }
  }

  // ── 4. Patch all Akshit documents ─────────────────────────────────────────
  const akshitDocs = [
    'employees/emp-KSS2407002',
    'employees/emp-1785847273632',
  ];
  console.log('\n👤 Updating Akshit Ujjain documents…');
  for (const docPath of akshitDocs) {
    try {
      await patchDoc(token, docPath, akshitFields);
      console.log(`  ✅ Updated ${docPath}`);
    } catch (e) {
      console.warn(`  ⚠️  ${docPath}: ${e.message}`);
    }
  }

  console.log('\n🎉 Done! Executive Leadership section updated:');
  console.log('   • Gaurav Kumar Tripathi → "Founder, Managing Director/CTO"  (left, sortOrder=1)');
  console.log('   • Akshit Ujjain        → "Co-Founder, CEO"                  (right, sortOrder=2)');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
