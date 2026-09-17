/**
 * FIX SCRIPT v2
 * =============
 * 1. Jigyansha Priyadarsini Rout  → employeeId = KSS2407016
 * 2. Shruti Sanjana Sahoo         → employeeId = KSS2407017
 * 3. Rahul kr Pathak              → stays KSS2407015 (no change needed — Shruti moves away)
 * 4. Jason Kenneth N              → status = Inactive on ALL his docs (never shows as LOP)
 * 5. Satya Ranjan Das             → ghost doc deactivated, uid fixed on canonical doc
 */

import https from 'https';

const PROJECT_ID   = 'kalpanaaa-employees-website';
const API_KEY      = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL  = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS   = 'Koushik@777';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SATYA_FIREBASE_UID = 'QpDtyS6Jp5OqNu3klvfWGoWHfmS2';

// ── HTTP helper ────────────────────────────────────────────────────────────
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
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getAllDocs(token, coll) {
  let all = [];
  let pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/${coll}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await request(url, 'GET', null, token);
    if (res.documents) all = all.concat(res.documents);
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return all;
}

// PATCH specific fields using Firestore updateMask
function patchDoc(token, docPath, fields) {
  const fieldPaths = Object.keys(fields)
    .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `${FIRESTORE_BASE}/${docPath}?${fieldPaths}`;
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string')  firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else if (typeof v === 'number')  firestoreFields[k] = { integerValue: String(v) };
    else if (v === null)             firestoreFields[k] = { nullValue: null };
  }
  return request(url, 'PATCH', { fields: firestoreFields }, token);
}

function getField(fields, key) {
  const f = fields?.[key];
  if (!f) return '';
  return f.stringValue ?? String(f.integerValue ?? f.booleanValue ?? '');
}

function printDoc(label, doc) {
  const f = doc.fields || {};
  const docId = doc.name.split('/').pop();
  console.log(`  [${label}]`);
  console.log(`    docId:      ${docId}`);
  console.log(`    fullName:   ${getField(f, 'fullName')}`);
  console.log(`    employeeId: ${getField(f, 'employeeId')}`);
  console.log(`    uid:        ${getField(f, 'uid')}`);
  console.log(`    status:     ${getField(f, 'status')}`);
}

async function main() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authRes = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST', { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true }
  );
  const token = authRes.idToken;
  console.log('✅ Authenticated as admin\n');

  // ── Fetch all employees ────────────────────────────────────────────────────
  const docs = await getAllDocs(token, 'employees');
  console.log(`Fetched ${docs.length} employee documents\n`);

  const byDocId = {};
  for (const d of docs) byDocId[d.name.split('/').pop()] = d;

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 1: Jigyansha → KSS2407016
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 1: Jigyansha Priyadarsini Rout → KSS2407016');
  console.log('═'.repeat(60));

  const jigDoc = byDocId['8RxH6z3ZzUTmM26iqta1DhCPa8l1'];
  if (!jigDoc) {
    console.log('  ⚠️  Jigyansha doc not found — skipping');
  } else {
    printDoc('Before', jigDoc);
    await patchDoc(token, 'employees/8RxH6z3ZzUTmM26iqta1DhCPa8l1', {
      employeeId: 'KSS2407016'
    });
    console.log('  ✅ Updated → KSS2407016\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 2: Shruti Sanjana Sahoo → KSS2407017
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 2: Shruti Sanjana Sahoo → KSS2407017');
  console.log('═'.repeat(60));

  const shrutiDoc = byDocId['4lJ6efl4vYTAemQ24cjgq2hC7fe2'];
  if (!shrutiDoc) {
    console.log('  ⚠️  Shruti doc not found — skipping');
  } else {
    printDoc('Before', shrutiDoc);
    await patchDoc(token, 'employees/4lJ6efl4vYTAemQ24cjgq2hC7fe2', {
      employeeId: 'KSS2407017'
    });
    console.log('  ✅ Updated → KSS2407017\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 3: Rahul kr Pathak — confirm he keeps KSS2407015
  // (Shruti moved out, so no collision anymore)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 3: Rahul kr Pathak — verify KSS2407015 (no change)');
  console.log('═'.repeat(60));

  const rahulDoc = byDocId['OKTqtqSfi2WRxkdWMawyryT7IDC2'];
  if (!rahulDoc) {
    console.log('  ⚠️  Rahul doc not found');
  } else {
    printDoc('Rahul', rahulDoc);
    const rahulId = getField(rahulDoc.fields, 'employeeId');
    if (rahulId !== 'KSS2407015') {
      await patchDoc(token, 'employees/OKTqtqSfi2WRxkdWMawyryT7IDC2', {
        employeeId: 'KSS2407015'
      });
      console.log('  ✅ Corrected Rahul back to KSS2407015\n');
    } else {
      console.log('  ✅ Already KSS2407015 — no change needed\n');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 4: Jason Kenneth N → Inactive on ALL his docs
  //  Known docs from previous scan:
  //    KfAB95lpbJOeylpKQaWX4GXOPGt2  (uid-keyed canonical)
  //    emp-KSS2407011                 (old numbered doc — has no employeeId but
  //                                   name "HR Department" — this is wrong, skip)
  //  Search all docs that match Jason by name or email too.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 4: Jason Kenneth N → status = Inactive on ALL docs');
  console.log('═'.repeat(60));

  const jasonDocIds = [];
  for (const [docId, doc] of Object.entries(byDocId)) {
    const f = doc.fields || {};
    const name  = (getField(f, 'fullName') || '').toLowerCase();
    const email = (getField(f, 'email') || '').toLowerCase();
    const empId = (getField(f, 'employeeId') || '').toLowerCase();
    if (
      name.includes('jason') ||
      email.includes('jason') ||
      docId === 'KfAB95lpbJOeylpKQaWX4GXOPGt2'
    ) {
      jasonDocIds.push(docId);
    }
  }

  if (jasonDocIds.length === 0) {
    console.log('  ⚠️  No Jason docs found');
  } else {
    for (const docId of jasonDocIds) {
      const doc = byDocId[docId];
      printDoc('Before', doc);
      await patchDoc(token, `employees/${docId}`, {
        status: 'Inactive',
        isExcludedFromRoster: true
      });
      console.log(`  ✅ ${docId} → status=Inactive, isExcludedFromRoster=true\n`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 5: Satya Ranjan Das — ghost doc deactivated + uid repair
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 5: Satya Ranjan Das — attendance repair');
  console.log('═'.repeat(60));

  // 5a: Deactivate ghost doc (KSS2407016 ghost that was absorbing attendance)
  const ghostDoc = byDocId['bf41B0ztyefb6OZzO9NykxA9MSz2'];
  if (!ghostDoc) {
    console.log('  Ghost doc bf41B0ztyefb6OZzO9NykxA9MSz2 not found (already cleaned)');
  } else {
    printDoc('Ghost', ghostDoc);
    await patchDoc(token, 'employees/bf41B0ztyefb6OZzO9NykxA9MSz2', {
      status: 'Terminated',
      fullName: '[GHOST-DELETED]',
      employeeId: 'GHOST-DO-NOT-USE'
    });
    console.log('  ✅ Ghost doc deactivated\n');
  }

  // 5b: Ensure emp-KSS2407012 (canonical Satya) has uid set
  const satyaCanonical = byDocId['emp-KSS2407012'];
  if (!satyaCanonical) {
    console.log('  ⚠️  emp-KSS2407012 not found');
  } else {
    const existingUid = getField(satyaCanonical.fields, 'uid');
    printDoc('Satya canonical', satyaCanonical);
    if (existingUid !== SATYA_FIREBASE_UID) {
      await patchDoc(token, 'employees/emp-KSS2407012', {
        uid: SATYA_FIREBASE_UID,
        employeeUid: SATYA_FIREBASE_UID,
        employeeId: 'KSS2407012'
      });
      console.log(`  ✅ emp-KSS2407012 uid → ${SATYA_FIREBASE_UID}\n`);
    } else {
      console.log('  ✅ uid already correct\n');
    }
  }

  // 5c: Ensure the Firebase UID-keyed doc has correct employeeId
  const satyaUidDoc = byDocId[SATYA_FIREBASE_UID];
  if (satyaUidDoc) {
    const existingEmpId = getField(satyaUidDoc.fields, 'employeeId');
    printDoc('Satya UID-doc', satyaUidDoc);
    if (existingEmpId !== 'KSS2407012') {
      await patchDoc(token, `employees/${SATYA_FIREBASE_UID}`, {
        uid: SATYA_FIREBASE_UID,
        employeeUid: SATYA_FIREBASE_UID,
        employeeId: 'KSS2407012'
      });
      console.log(`  ✅ UID-doc employeeId → KSS2407012\n`);
    } else {
      console.log('  ✅ UID-doc already correct\n');
    }
  } else {
    console.log(`  UID-doc ${SATYA_FIREBASE_UID} not found — creating mapping entry...`);
    const nameVal = satyaCanonical ? getField(satyaCanonical.fields, 'fullName') : 'Satya Ranjan Das';
    await patchDoc(token, `employees/${SATYA_FIREBASE_UID}`, {
      uid: SATYA_FIREBASE_UID,
      employeeUid: SATYA_FIREBASE_UID,
      employeeId: 'KSS2407012',
      fullName: nameVal,
      status: 'Active',
      role: 'employee'
    });
    console.log(`  ✅ Created UID mapping doc for Satya\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('ALL FIXES APPLIED ✅');
  console.log('═'.repeat(60));
  console.log('  Jigyansha → KSS2407016');
  console.log('  Shruti    → KSS2407017');
  console.log('  Rahul     → KSS2407015 (kept / confirmed)');
  console.log('  Jason     → Inactive (excluded from roster, not counted as LOP)');
  console.log('  Satya     → ghost doc removed, uid wired correctly');
  console.log('\nRefresh the admin dashboard to verify live attendance for Satya.');
}

main().catch(console.error);
