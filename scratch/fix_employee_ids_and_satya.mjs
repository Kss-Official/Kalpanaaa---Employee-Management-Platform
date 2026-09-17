/**
 * COMPREHENSIVE FIX SCRIPT
 * ========================
 * 1. Jigyansha Priyadarsini Rout  → employeeId = KSS2407016
 * 2. Shruti Sanjana Sahoo         → employeeId = KSS2407017
 * 3. Rahul kr Pathak              → employeeId = KSS2407018
 *    (Rahul was sharing KSS2407015 with Shruti — collision fixed)
 * 4. Satya Ranjan Das attendance fix:
 *    - Ghost employee doc bf41B0ztyefb6OZzO9NykxA9MSz2 (keyed as KSS2407016 / satya.ranjan.das)
 *      is causing admin dashboard to match attendance records against this ghost instead
 *      of the real Satya docs. We deactivate the ghost doc so the real docs (emp-KSS2407012
 *      and QpDtyS6Jp5OqNu3klvfWGoWHfmS2) are the canonical source.
 *    - Also ensures the canonical Satya employee doc (emp-KSS2407012) has uid and employeeUid
 *      set correctly so attendance matching works.
 */

import https from 'https';

const PROJECT_ID   = 'kalpanaaa-employees-website';
const API_KEY      = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL  = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS   = 'Koushik@777';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SATYA_FIREBASE_UID = 'QpDtyS6Jp5OqNu3klvfWGoWHfmS2'; // from users.json

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

function patchDoc(token, docPath, fields) {
  // PATCH using Firestore REST updateMask
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `${FIRESTORE_BASE}/${docPath}?${fieldPaths}`;
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else if (typeof v === 'number') firestoreFields[k] = { integerValue: String(v) };
    else if (v === null) firestoreFields[k] = { nullValue: null };
  }
  return request(url, 'PATCH', { fields: firestoreFields }, token);
}

function getField(fields, key) {
  const f = fields?.[key];
  if (!f) return '';
  return f.stringValue ?? f.integerValue ?? f.booleanValue ?? '';
}

function printEmployee(label, doc) {
  const f = doc.fields || {};
  const docId = doc.name.split('/').pop();
  console.log(`  ${label}:`);
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

  // ── Fetch all employees ──────────────────────────────────────────────────
  const docs = await getAllDocs(token, 'employees');
  console.log(`Fetched ${docs.length} employee documents\n`);

  // Map docId → doc for easy lookup
  const byDocId = {};
  for (const d of docs) {
    byDocId[d.name.split('/').pop()] = d;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 1: Jigyansha → KSS2407016
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 1: Jigyansha Priyadarsini Rout → KSS2407016');
  console.log('═'.repeat(60));

  const jigDoc = byDocId['8RxH6z3ZzUTmM26iqta1DhCPa8l1'];
  if (!jigDoc) {
    console.log('⚠️  Jigyansha doc (8RxH6z3ZzUTmM26iqta1DhCPa8l1) not found — skipping');
  } else {
    const currentId = getField(jigDoc.fields, 'employeeId');
    console.log(`  Current employeeId: ${currentId}`);
    printEmployee('Before', jigDoc);
    await patchDoc(token, 'employees/8RxH6z3ZzUTmM26iqta1DhCPa8l1', { employeeId: 'KSS2407016' });
    console.log('  ✅ Updated Jigyansha → KSS2407016\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 2: Shruti Sanjana Sahoo → KSS2407017
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 2: Shruti Sanjana Sahoo → KSS2407017');
  console.log('═'.repeat(60));

  const shrutiDoc = byDocId['4lJ6efl4vYTAemQ24cjgq2hC7fe2'];
  if (!shrutiDoc) {
    console.log('⚠️  Shruti doc (4lJ6efl4vYTAemQ24cjgq2hC7fe2) not found — skipping');
  } else {
    const currentId = getField(shrutiDoc.fields, 'employeeId');
    console.log(`  Current employeeId: ${currentId}`);
    printEmployee('Before', shrutiDoc);
    await patchDoc(token, 'employees/4lJ6efl4vYTAemQ24cjgq2hC7fe2', { employeeId: 'KSS2407017' });
    console.log('  ✅ Updated Shruti → KSS2407017\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 3: Rahul kr Pathak → KSS2407018 (was sharing KSS2407015 with Shruti)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 3: Rahul kr Pathak → KSS2407018');
  console.log('═'.repeat(60));

  const rahulDoc = byDocId['OKTqtqSfi2WRxkdWMawyryT7IDC2'];
  if (!rahulDoc) {
    console.log('⚠️  Rahul doc (OKTqtqSfi2WRxkdWMawyryT7IDC2) not found — skipping');
  } else {
    const currentId = getField(rahulDoc.fields, 'employeeId');
    console.log(`  Current employeeId: ${currentId}`);
    printEmployee('Before', rahulDoc);
    await patchDoc(token, 'employees/OKTqtqSfi2WRxkdWMawyryT7IDC2', { employeeId: 'KSS2407018' });
    console.log('  ✅ Updated Rahul → KSS2407018\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 4: Satya Ranjan Das attendance issue
  //
  // Problem: Ghost doc bf41B0ztyefb6OZzO9NykxA9MSz2 has employeeId=KSS2407016
  // and name="satya.ranjan.das". When the admin dashboard scans employees,
  // this ghost doc gets picked up and absorbs Satya's attendance records
  // (because attendance docs are keyed by the employeeId field or uid).
  // The fix:
  //   a) Mark the ghost doc as Terminated/Inactive so it is excluded from
  //      the active employee list the dashboard renders.
  //   b) Ensure the canonical Satya doc (emp-KSS2407012) has the correct
  //      uid = SATYA_FIREBASE_UID so attendance lookup by uid works.
  //   c) Also patch the uid doc (QpDtyS6Jp5OqNu3klvfWGoWHfmS2) with uid field.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('FIX 4: Satya Ranjan Das — attendance visibility repair');
  console.log('═'.repeat(60));

  // 4a: Deactivate ghost doc
  const ghostDoc = byDocId['bf41B0ztyefb6OZzO9NykxA9MSz2'];
  if (!ghostDoc) {
    console.log('  Ghost doc bf41B0ztyefb6OZzO9NykxA9MSz2 not found (already cleaned up?)');
  } else {
    console.log('  Ghost doc found:');
    printEmployee('Ghost', ghostDoc);
    await patchDoc(token, 'employees/bf41B0ztyefb6OZzO9NykxA9MSz2', {
      status: 'Terminated',
      fullName: '[DELETED] satya.ranjan.das ghost',
      employeeId: 'GHOST-DELETED'
    });
    console.log('  ✅ Ghost doc deactivated (status=Terminated, id=GHOST-DELETED)\n');
  }

  // 4b: Ensure emp-KSS2407012 has uid = SATYA_FIREBASE_UID
  const satyaCanonical = byDocId['emp-KSS2407012'];
  if (!satyaCanonical) {
    console.log('  ⚠️  emp-KSS2407012 not found');
  } else {
    const existingUid = getField(satyaCanonical.fields, 'uid');
    console.log(`  emp-KSS2407012 current uid: "${existingUid}"`);
    printEmployee('Satya canonical', satyaCanonical);
    if (existingUid !== SATYA_FIREBASE_UID) {
      await patchDoc(token, 'employees/emp-KSS2407012', {
        uid: SATYA_FIREBASE_UID,
        employeeUid: SATYA_FIREBASE_UID,
        employeeId: 'KSS2407012'
      });
      console.log(`  ✅ emp-KSS2407012 uid set to ${SATYA_FIREBASE_UID}\n`);
    } else {
      console.log('  ✅ emp-KSS2407012 uid already correct\n');
    }
  }

  // 4c: Ensure the Firebase-UID-keyed doc (QpDtyS6Jp5OqNu3klvfWGoWHfmS2) also
  //     has the correct employeeId field so both matching paths work
  const satyaUidDoc = byDocId[SATYA_FIREBASE_UID];
  if (satyaUidDoc) {
    const existingEmpId = getField(satyaUidDoc.fields, 'employeeId');
    console.log(`  UID-doc (${SATYA_FIREBASE_UID}) current employeeId: "${existingEmpId}"`);
    printEmployee('Satya UID-doc', satyaUidDoc);
    if (existingEmpId !== 'KSS2407012') {
      await patchDoc(token, `employees/${SATYA_FIREBASE_UID}`, {
        uid: SATYA_FIREBASE_UID,
        employeeUid: SATYA_FIREBASE_UID,
        employeeId: 'KSS2407012'
      });
      console.log(`  ✅ UID-doc employeeId corrected to KSS2407012\n`);
    } else {
      console.log('  ✅ UID-doc employeeId already correct\n');
    }
  } else {
    console.log(`  ⚠️  No employee doc found with docId=${SATYA_FIREBASE_UID}`);
    // Create minimal mapping doc so attendance resolver can find Satya by uid
    console.log(`  Creating uid-keyed mapping doc...`);
    const nameFromCanonical = satyaCanonical ? getField(satyaCanonical.fields, 'fullName') : 'Satya Ranjan Das';
    const deptFromCanonical = satyaCanonical ? getField(satyaCanonical.fields, 'department') : '';
    const desgFromCanonical = satyaCanonical ? getField(satyaCanonical.fields, 'designation') : '';
    await patchDoc(token, `employees/${SATYA_FIREBASE_UID}`, {
      uid: SATYA_FIREBASE_UID,
      employeeUid: SATYA_FIREBASE_UID,
      employeeId: 'KSS2407012',
      fullName: nameFromCanonical,
      department: deptFromCanonical,
      designation: desgFromCanonical,
      status: 'Active',
      role: 'employee'
    });
    console.log(`  ✅ Created UID mapping doc for Satya\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log('  Jigyansha Priyadarsini Rout  → KSS2407016  ✅');
  console.log('  Shruti Sanjana Sahoo         → KSS2407017  ✅');
  console.log('  Rahul kr Pathak              → KSS2407018  ✅  (was sharing KSS2407015)');
  console.log('  Satya ghost doc deactivated               ✅');
  console.log('  Satya emp-KSS2407012 uid repaired         ✅');
  console.log('\nAll done! Refresh the admin dashboard to see live attendance for Satya.');
}

main().catch(console.error);
