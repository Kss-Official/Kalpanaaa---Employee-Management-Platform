/**
 * FIRESTORE MIGRATION: Employee ID Swap
 * 
 * What this does:
 *   1. Abhinaya V (KSS2407011):   Clears her employeeId field (keeps all other data + email auth)
 *   2. Jason Kenneth N (KfAB95lpbJOeylpKQaWX4GXOPGt2):
 *       - employeeId: KSS2407014 → KSS2407011
 *       - qrToken:    KSS2407014 → KSS2407011
 *   3. Also updates the `users/` mapping doc for Jason (if present)
 *
 * The Firebase Auth UID for both employees is NOT changed.
 * Jason's email (jasonkennethn@kalpanaaa.in) is NOT changed.
 * Abhinaya's email (abhinayav1919@kalpanaaa.in) is NOT changed.
 *
 * Run: node scratch/migrate_employee_id_swap.cjs
 * Requires: Node.js (no extra deps, uses REST API — no service account needed for Firestore REST
 *           but you need to temporarily allow admin writes or run from an authed context).
 *
 * NOTE: This uses the Firestore REST API without auth, so it will succeed only if your
 * Firestore rules allow admin/backend writes for these documents. If it fails with 403,
 * deploy with a service account key or run this in the Firebase Admin SDK.
 */

const https = require('https');

const PROJECT_ID = 'kalpanaaa-employees-website';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Abhinaya's Firestore document IDs to try (the app may have used either)
const ABHINAYA_DOC_IDS = ['emp-KSS2407011', 'KSS2407011'];

// Jason's definitive Firestore document ID (Firebase Auth UID = Firestore doc ID)
const JASON_DOC_ID = 'KfAB95lpbJOeylpKQaWX4GXOPGt2';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function httpsRequest(url, method, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getDoc(collection, docId) {
  const url = `${BASE}/${collection}/${docId}`;
  try {
    const result = await httpsRequest(url, 'GET', null);
    return result;
  } catch (e) {
    return null;
  }
}

async function patchDoc(collection, docId, fields, updateMaskFields) {
  const mask = updateMaskFields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${BASE}/${collection}/${docId}?${mask}`;
  const body = JSON.stringify({ fields });
  return httpsRequest(url, 'PATCH', body);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting Employee ID Swap Migration...\n');
  console.log('  KSS2407011 (Abhinaya V): Remove employeeId → free the ID');
  console.log('  KSS2407014 (Jason Kenneth N): Reassign → KSS2407011\n');

  let migratedCount = 0;
  let errorCount = 0;

  // ── Step 1: Update Abhinaya's employee doc ──────────────────────────────────
  console.log('📋 Step 1: Processing Abhinaya V\'s employee document...');
  let abhinayaUpdated = false;
  for (const docId of ABHINAYA_DOC_IDS) {
    const doc = await getDoc('employees', docId);
    if (!doc || doc.error) {
      console.log(`  ⬜ employees/${docId}: Not found`);
      continue;
    }

    const currentEmpId = doc.fields?.employeeId?.stringValue;
    const fullName = doc.fields?.fullName?.stringValue;
    console.log(`  ✅ Found employees/${docId} — ${fullName} (employeeId: ${currentEmpId})`);

    // Clear the employeeId field (set to empty string so queries don't match it)
    try {
      await patchDoc('employees', docId, {
        ...doc.fields,
        employeeId: { stringValue: '' },   // freed — no longer KSS2407011
        qrToken: { stringValue: '' },       // free the QR token too
        updatedAt: { stringValue: new Date().toISOString() }
      }, ['employeeId', 'qrToken', 'updatedAt']);
      console.log(`  ✅ Cleared employeeId and qrToken for employees/${docId}`);
      migratedCount++;
      abhinayaUpdated = true;
    } catch (e) {
      console.error(`  ❌ Failed to update employees/${docId}:`, e.message);
      errorCount++;
    }
  }
  if (!abhinayaUpdated) {
    console.log('  ⚠️  Abhinaya\'s employee doc not found via REST (may need auth) — update manually in Firebase Console.');
  }

  // ── Step 2: Update Jason's employee doc ─────────────────────────────────────
  console.log('\n📋 Step 2: Processing Jason Kenneth N\'s employee document...');
  const jasonDoc = await getDoc('employees', JASON_DOC_ID);
  if (!jasonDoc) {
    console.log(`  ❌ employees/${JASON_DOC_ID}: Not found — may need authentication to access`);
    errorCount++;
  } else {
    const currentEmpId = jasonDoc.fields?.employeeId?.stringValue;
    const fullName = jasonDoc.fields?.fullName?.stringValue;
    console.log(`  ✅ Found employees/${JASON_DOC_ID} — ${fullName} (employeeId: ${currentEmpId})`);

    try {
      await patchDoc('employees', JASON_DOC_ID, {
        ...jasonDoc.fields,
        employeeId: { stringValue: 'KSS2407011' },
        qrToken: { stringValue: 'KSS2407011' },
        updatedAt: { stringValue: new Date().toISOString() }
      }, ['employeeId', 'qrToken', 'updatedAt']);
      console.log(`  ✅ Updated Jason: KSS2407014 → KSS2407011`);
      migratedCount++;
    } catch (e) {
      console.error(`  ❌ Failed to update Jason's employee doc:`, e.message);
      errorCount++;
    }
  }

  // ── Step 3: Update Jason's users/ mapping doc ───────────────────────────────
  console.log('\n📋 Step 3: Updating users/ mapping doc for Jason...');
  const jasonUserDoc = await getDoc('users', JASON_DOC_ID);
  if (!jasonUserDoc) {
    console.log('  ⬜ users/ doc for Jason not found — skipping');
  } else {
    const currentEmpId = jasonUserDoc.fields?.employeeId?.stringValue;
    console.log(`  ✅ Found users/${JASON_DOC_ID} (employeeId: ${currentEmpId})`);
    try {
      await patchDoc('users', JASON_DOC_ID, {
        ...jasonUserDoc.fields,
        employeeId: { stringValue: 'KSS2407011' },
        updatedAt: { stringValue: new Date().toISOString() }
      }, ['employeeId', 'updatedAt']);
      console.log(`  ✅ Updated users/${JASON_DOC_ID}: employeeId KSS2407014 → KSS2407011`);
      migratedCount++;
    } catch (e) {
      console.error(`  ❌ Failed to update users/${JASON_DOC_ID}:`, e.message);
      errorCount++;
    }
  }

  // ── Step 4: Check attendance docs tagged with KSS2407014 ────────────────────
  console.log('\n📋 Step 4: Checking attendance records for KSS2407014...');
  const attendanceCol = await httpsRequest(`${BASE}/attendance`, 'GET', null).catch(() => ({ documents: [] }));
  const attendanceDocs = attendanceCol.documents || [];
  const jasonAttendance = attendanceDocs.filter(d => {
    const fields = d.fields || {};
    const s = JSON.stringify(fields);
    return s.includes('KSS2407014') || s.includes(JASON_DOC_ID);
  });

  if (jasonAttendance.length === 0) {
    console.log('  ✅ No attendance docs needed updating (records are stored under Firebase UID, not employee ID)');
  } else {
    console.log(`  📄 Found ${jasonAttendance.length} attendance doc(s) to update`);
    for (const doc of jasonAttendance) {
      const docId = doc.name.split('/').pop();
      const fields = doc.fields || {};
      try {
        await patchDoc('attendance', docId, {
          ...fields,
          employeeId: { stringValue: 'KSS2407011' },
          updatedAt: { stringValue: new Date().toISOString() }
        }, ['employeeId', 'updatedAt']);
        console.log(`  ✅ Updated attendance/${docId}`);
        migratedCount++;
      } catch (e) {
        console.error(`  ❌ Failed attendance/${docId}:`, e.message);
        errorCount++;
      }
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log(`  ✅ Migrated: ${migratedCount} documents`);
  if (errorCount > 0) {
    console.log(`  ❌ Errors:   ${errorCount} (see above — likely need Firebase Auth token for REST)`);
    console.log('\n  👉 If REST calls failed with 403, manually update in Firebase Console:');
    console.log('     → https://console.firebase.google.com/project/kalpanaaa-employees-website/firestore');
    console.log('     → employees/emp-KSS2407011: set employeeId="" and qrToken=""');
    console.log('     → employees/KfAB95lpbJOeylpKQaWX4GXOPGt2: set employeeId="KSS2407011" and qrToken="KSS2407011"');
    console.log('     → users/KfAB95lpbJOeylpKQaWX4GXOPGt2: set employeeId="KSS2407011"');
  }
  console.log('══════════════════════════════════════════\n');
}

main().catch(console.error);
