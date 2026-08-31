/**
 * FIRESTORE FULL MIGRATION — Employee ID Swap (Authenticated)
 * 
 * Uses Firebase Auth REST API to get an ID token, then updates all Firestore collections.
 *
 * What it does:
 *   1. emp-KSS2407011 (Abhinaya V)  → clear employeeId, qrToken
 *   2. KfAB95lpbJOeylpKQaWX4GXOPGt2 (Jason)  → employeeId + qrToken: KSS2407014→KSS2407011
 *   3. users/KfAB95lpbJOeylpKQaWX4GXOPGt2 → employeeId: KSS2407014→KSS2407011
 *   4. ALL attendance/leave/payslip docs with KSS2407014 → updated to KSS2407011
 *
 * Run:
 *   set FIREBASE_PASS=yourpassword && node scratch/migrate_id_swap_auth.mjs
 *   or set password inline below.
 */

import https from 'https';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PROJECT_ID   = 'kalpanaaa-employees-website';
const API_KEY      = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL  = process.env.FIREBASE_EMAIL  || 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS   = process.env.FIREBASE_PASS   || 'Koushik@777';

// Jason's identifiers
const JASON_UID    = 'KfAB95lpbJOeylpKQaWX4GXOPGt2';
const OLD_EMP_ID   = 'KSS2407014';
const NEW_EMP_ID   = 'KSS2407011';

// Abhinaya's possible doc IDs
const ABHINAYA_DOC_IDS = ['emp-KSS2407011'];

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Collections to scan for old employee ID references
const SCAN_COLLECTIONS = [
  'attendance', 'leaveRequests', 'leaves', 'payslips', 'payroll',
  'notifications', 'feedback', 'performance', 'presence', 'auditLogs',
  'quizResults', 'faceDescriptors'
];

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
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
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch { resolve(data); }
          } else {
            reject(new Error(`HTTP ${res.statusCode} ${method} ${url}\n${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Firebase Auth: sign in and get ID token ──────────────────────────────────
async function signIn(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await request(url, 'POST', { email, password, returnSecureToken: true });
  return res.idToken;
}

// ─── Firestore REST helpers ───────────────────────────────────────────────────
async function getDoc(collection, docId, token) {
  try {
    return await request(`${FIRESTORE_BASE}/${collection}/${docId}`, 'GET', null, token);
  } catch {
    return null;
  }
}

async function listCollection(collection, token) {
  try {
    const res = await request(`${FIRESTORE_BASE}/${collection}?pageSize=300`, 'GET', null, token);
    return res.documents || [];
  } catch {
    return [];
  }
}

async function patchDoc(collection, docId, fieldsToUpdate, token) {
  const mask = Object.keys(fieldsToUpdate)
    .map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?${mask}`;
  // Build proper Firestore field value format
  const fields = {};
  for (const [k, v] of Object.entries(fieldsToUpdate)) {
    if (v === null || v === '') fields[k] = { nullValue: null };
    else fields[k] = { stringValue: String(v) };
  }
  return request(url, 'PATCH', { fields }, token);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!ADMIN_PASS) {
    console.error('❌ Set FIREBASE_PASS env variable or fill in the password in the script.');
    console.error('   Run: $env:FIREBASE_PASS="yourpassword"; node scratch/migrate_id_swap_auth.mjs');
    process.exit(1);
  }

  console.log(`\n🔐 Signing in as ${ADMIN_EMAIL}...`);
  let token;
  try {
    token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
    console.log('✅ Signed in successfully!\n');
  } catch (e) {
    console.error('❌ Login failed:', e.message);
    process.exit(1);
  }

  let updated = 0;
  let skipped = 0;
  let errors  = 0;

  // ── 1. Clear Abhinaya's employeeId ──────────────────────────────────────────
  console.log('══ STEP 1: Clear Abhinaya V\'s employeeId (emp-KSS2407011) ══');
  for (const docId of ABHINAYA_DOC_IDS) {
    const doc = await getDoc('employees', docId, token);
    if (!doc?.fields) {
      console.log(`  ⬜ employees/${docId} not found`);
      continue;
    }
    const name = doc.fields.fullName?.stringValue || docId;
    const curId = doc.fields.employeeId?.stringValue || '(none)';
    console.log(`  Found: ${name} | employeeId: ${curId}`);
    try {
      await patchDoc('employees', docId, {
        employeeId: '',
        qrToken: '',
        updatedAt: new Date().toISOString()
      }, token);
      console.log(`  ✅ Cleared employeeId and qrToken for employees/${docId}`);
      updated++;
    } catch (e) {
      console.error(`  ❌ Error:`, e.message);
      errors++;
    }
  }

  // ── 2. Update Jason's employee doc ──────────────────────────────────────────
  console.log('\n══ STEP 2: Update Jason\'s employee doc ══');
  const jasonEmpDoc = await getDoc('employees', JASON_UID, token);
  if (!jasonEmpDoc?.fields) {
    console.log(`  ⬜ employees/${JASON_UID} not found`);
    errors++;
  } else {
    const curId = jasonEmpDoc.fields.employeeId?.stringValue || '?';
    console.log(`  Found: Jason Kenneth N | employeeId: ${curId}`);
    if (curId === NEW_EMP_ID) {
      console.log(`  ✅ Already updated to ${NEW_EMP_ID} — skipping`);
      skipped++;
    } else {
      try {
        await patchDoc('employees', JASON_UID, {
          employeeId: NEW_EMP_ID,
          qrToken: NEW_EMP_ID,
          updatedAt: new Date().toISOString()
        }, token);
        console.log(`  ✅ Updated employees/${JASON_UID}: ${curId} → ${NEW_EMP_ID}`);
        updated++;
      } catch (e) {
        console.error(`  ❌ Error:`, e.message);
        errors++;
      }
    }
  }

  // ── 3. Update Jason's users/ mapping doc ────────────────────────────────────
  console.log('\n══ STEP 3: Update users/ mapping doc for Jason ══');
  const jasonUserDoc = await getDoc('users', JASON_UID, token);
  if (!jasonUserDoc?.fields) {
    console.log(`  ⬜ users/${JASON_UID} not found — skipping`);
  } else {
    const curId = jasonUserDoc.fields.employeeId?.stringValue || '?';
    console.log(`  Found: users/${JASON_UID} | employeeId: ${curId}`);
    if (curId === NEW_EMP_ID) {
      console.log(`  ✅ Already updated — skipping`);
      skipped++;
    } else {
      try {
        await patchDoc('users', JASON_UID, {
          employeeId: NEW_EMP_ID,
          updatedAt: new Date().toISOString()
        }, token);
        console.log(`  ✅ Updated users/${JASON_UID}: ${curId} → ${NEW_EMP_ID}`);
        updated++;
      } catch (e) {
        console.error(`  ❌ Error:`, e.message);
        errors++;
      }
    }
  }

  // ── 4. Scan all collections for KSS2407014 references ───────────────────────
  console.log('\n══ STEP 4: Scanning all collections for KSS2407014 / Jason UID ══');
  for (const col of SCAN_COLLECTIONS) {
    const docs = await listCollection(col, token);
    if (docs.length === 0) {
      console.log(`  ⬜ ${col}: empty / not found`);
      continue;
    }

    const jasonDocs = docs.filter(d => {
      const s = JSON.stringify(d.fields || {});
      return s.includes(OLD_EMP_ID) || s.includes(JASON_UID);
    });

    if (jasonDocs.length === 0) {
      console.log(`  ✅ ${col}: ${docs.length} docs checked — no matches`);
      continue;
    }

    console.log(`  📂 ${col}: Found ${jasonDocs.length} doc(s) to update`);
    for (const doc of jasonDocs) {
      const docId = doc.name.split('/').pop();
      const fields = doc.fields || {};
      const updates = {};

      // Update any field that contains the old employee ID
      if (fields.employeeId?.stringValue === OLD_EMP_ID) updates.employeeId = NEW_EMP_ID;
      if (fields.employeeCode?.stringValue === OLD_EMP_ID) updates.employeeCode = NEW_EMP_ID;
      if (fields.qrToken?.stringValue === OLD_EMP_ID) updates.qrToken = NEW_EMP_ID;
      updates.updatedAt = new Date().toISOString();

      try {
        await patchDoc(col, docId, updates, token);
        console.log(`    ✅ Updated ${col}/${docId}`);
        updated++;
      } catch (e) {
        console.error(`    ❌ Failed ${col}/${docId}:`, e.message);
        errors++;
      }
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log(`  ✅ Documents updated: ${updated}`);
  console.log(`  ⬜ Already correct:   ${skipped}`);
  console.log(`  ❌ Errors:            ${errors}`);
  console.log('════════════════════════════════════════\n');
  if (errors === 0) {
    console.log('🎉 Migration complete! Jason Kenneth N is now KSS2407011 across ALL Firestore collections.');
  } else {
    console.log('⚠️  Some errors occurred — check output above.');
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
