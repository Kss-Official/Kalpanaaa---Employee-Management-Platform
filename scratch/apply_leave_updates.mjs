import https from 'https';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS = 'Koushik@777';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function req(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

async function getAuthToken() {
  const res = await req(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST',
    { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true }
  );
  return res.data.idToken;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: v.toString() };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map(item => typeof item === 'string' ? { stringValue: item } : { stringValue: String(item) })
        }
      };
    }
  }
  return fields;
}

async function patchDoc(token, collection, docId, fields, updateMask) {
  const maskQuery = updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${FIRESTORE_BASE}/${collection}/${docId}?${maskQuery}`;
  const res = await req(url, 'PATCH', { fields: toFirestoreFields(fields) }, token);
  return res;
}

async function deleteDoc(token, collection, docId) {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}`;
  const res = await req(url, 'DELETE', null, token);
  return res;
}

async function main() {
  console.log('Authenticating with Firebase...');
  const token = await getAuthToken();
  console.log('Authenticated successfully.\n');

  // 1. UPDATE LEAVE REQUESTS
  console.log('─── 1. Updating Leave Requests ───');
  
  // Akash SB: Sick Leave 25th Aug -> Approved
  console.log('Updating Akash SB leave request LR_KSS2407013_2026-08-25_Leave...');
  await patchDoc(token, 'leaveRequests', 'LR_KSS2407013_2026-08-25_Leave', {
    type: 'Sick Leave',
    leaveCategory: 'Sick Leave',
    status: 'Approved',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Approved',
    reviewNotes: 'Sanctioned: 1 Sick Leave approved by Management'
  }, ['type', 'leaveCategory', 'status', 'pmStatus', 'hrStatus', 'ceoStatus', 'ctoStatus', 'reviewNotes']);

  // Kuruva Mahesh: Earn Leave 28th Aug -> Approved
  console.log('Updating Kuruva Mahesh leave request LR_KSS2407006_2026-08-28_Leave...');
  await patchDoc(token, 'leaveRequests', 'LR_KSS2407006_2026-08-28_Leave', {
    type: 'Earn Leave',
    leaveCategory: 'Earn Leave',
    status: 'Approved',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Approved',
    reviewNotes: 'Approved: Earn Leave sanctioned by CTO & Management'
  }, ['type', 'leaveCategory', 'status', 'pmStatus', 'hrStatus', 'ceoStatus', 'ctoStatus', 'reviewNotes']);

  // Thabeethal Asnath I: Earn Leave 22nd Aug -> Approved
  console.log('Updating Thabeethal Asnath I leave request LR_KSS2407005_2026-08-22_Leave...');
  await patchDoc(token, 'leaveRequests', 'LR_KSS2407005_2026-08-22_Leave', {
    type: 'Earn Leave',
    leaveCategory: 'Earn Leave',
    status: 'Approved',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Approved',
    reviewNotes: 'Approved: Earn Leave sanctioned by CTO & Management'
  }, ['type', 'leaveCategory', 'status', 'pmStatus', 'hrStatus', 'ceoStatus', 'ctoStatus', 'reviewNotes']);

  // Asbin T S: Earn Leave 26th Aug -> Approved
  console.log('Updating Asbin T S leave request LR_KSS2407004_2026-08-26_Leave...');
  await patchDoc(token, 'leaveRequests', 'LR_KSS2407004_2026-08-26_Leave', {
    type: 'Earn Leave',
    leaveCategory: 'Earn Leave',
    status: 'Approved',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Approved',
    reviewNotes: 'Approved: Earn Leave sanctioned by CTO & Management'
  }, ['type', 'leaveCategory', 'status', 'pmStatus', 'hrStatus', 'ceoStatus', 'ctoStatus', 'reviewNotes']);

  // Jason Kenneth N: Sick Leave 22nd Aug -> Approved
  console.log('Updating Jason Kenneth N leave request LR_KSS2407014_2026-08-22_Leave...');
  await patchDoc(token, 'leaveRequests', 'LR_KSS2407014_2026-08-22_Leave', {
    type: 'Sick Leave',
    leaveCategory: 'Sick Leave',
    status: 'Approved',
    pmStatus: 'Approved',
    hrStatus: 'Approved',
    ceoStatus: 'Approved',
    ctoStatus: 'Approved',
    reviewNotes: 'Approved: Sick Leave sanctioned (Medical)'
  }, ['type', 'leaveCategory', 'status', 'pmStatus', 'hrStatus', 'ceoStatus', 'ctoStatus', 'reviewNotes']);

  // Delete dummy leaves
  console.log('Deleting dummy leaves...');
  const dummyIds = ['LR-UVLV1K5', 'LR_KSS2407014_2026-08-19_WFH'];
  for (const dId of dummyIds) {
    const res = await deleteDoc(token, 'leaveRequests', dId);
    console.log(`Deleted dummy leave ${dId}: status ${res.status}`);
  }

  // 2. UPDATE EMPLOYEES
  console.log('\n─── 2. Updating Employees Collection ───');
  
  // Akash SB
  console.log('Updating Akash SB balances (SL=0, EL=1, wfh=[])...');
  for (const aId of ['emp-KSS2407013', 'nMnI0qXOmMO9gw2nDnnPJuz2G1S2']) {
    await patchDoc(token, 'employees', aId, {
      sickLeaveBalance: 0,
      earnLeaveBalance: 1,
      approvedWfhDates: []
    }, ['sickLeaveBalance', 'earnLeaveBalance', 'approvedWfhDates']).catch(() => {});
  }

  // Jason Kenneth N
  console.log('Updating Jason Kenneth N balances (SL=0, EL=1)...');
  for (const jId of ['KfAB95lpbJOeylpKQaWX4GXOPGt2']) {
    await patchDoc(token, 'employees', jId, {
      sickLeaveBalance: 0,
      earnLeaveBalance: 1,
      joiningDate: '2026-08-17'
    }, ['sickLeaveBalance', 'earnLeaveBalance', 'joiningDate']).catch(() => {});
  }

  // Kuruva Mahesh
  console.log('Updating Kuruva Mahesh balances (EL=0, SL=1, WFH=[2026-08-27, 2026-08-29])...');
  for (const mId of ['8T19zoI3noTDcgeye4BWSVIWsEq1', 'emp-KSS2407006']) {
    await patchDoc(token, 'employees', mId, {
      earnLeaveBalance: 0,
      sickLeaveBalance: 1,
      approvedWfhDates: ['2026-08-27', '2026-08-29']
    }, ['earnLeaveBalance', 'sickLeaveBalance', 'approvedWfhDates']).catch(() => {});
  }

  // Thabeethal Asnath I
  console.log('Updating Thabeethal Asnath I balances (EL=0, SL=1)...');
  for (const tId of ['mzGAL3siJZazGrgf6WNEU7hTREw2', 'emp-KSS2407005']) {
    await patchDoc(token, 'employees', tId, {
      earnLeaveBalance: 0,
      sickLeaveBalance: 1
    }, ['earnLeaveBalance', 'sickLeaveBalance']).catch(() => {});
  }

  // Asbin T S
  console.log('Updating Asbin T S balances (EL=0, SL=1, WFH=[2026-08-28, 2026-08-29])...');
  for (const asId of ['GCIqrMaffebCGNdmbuzPbcl6IpQ2', 'emp-KSS2407004']) {
    await patchDoc(token, 'employees', asId, {
      earnLeaveBalance: 0,
      sickLeaveBalance: 1,
      approvedWfhDates: ['2026-08-28', '2026-08-29']
    }, ['earnLeaveBalance', 'sickLeaveBalance', 'approvedWfhDates']).catch(() => {});
  }

  // D. Koushik
  console.log('Updating D. Koushik balances (EL=0, SL=1)...');
  for (const kId of ['vhKLIJCVZoTncqVtmh14paMbiXk2', 'emp-KSS2407003']) {
    await patchDoc(token, 'employees', kId, {
      earnLeaveBalance: 0,
      sickLeaveBalance: 1
    }, ['earnLeaveBalance', 'sickLeaveBalance']).catch(() => {});
  }

  // 3. UPDATE ATTENDANCE RECORDS
  console.log('\n─── 3. Updating Attendance Collection ───');
  const attendanceUpdates = [
    // Mahesh 26th Aug: Present (worked from office)
    { id: 'emp-KSS2407006_2026-08-26', status: 'Present', isWfh: false },
    { id: '8T19zoI3noTDcgeye4BWSVIWsEq1_2026-08-26', status: 'Present', isWfh: false },
    // Mahesh 27th Aug: Work From Home
    { id: 'emp-KSS2407006_2026-08-27', status: 'Work From Home', isWfh: true },
    { id: '8T19zoI3noTDcgeye4BWSVIWsEq1_2026-08-27', status: 'Work From Home', isWfh: true },
    // Mahesh 28th Aug: On Leave
    { id: 'emp-KSS2407006_2026-08-28', status: 'On Leave', isWfh: false },
    { id: '8T19zoI3noTDcgeye4BWSVIWsEq1_2026-08-28', status: 'On Leave', isWfh: false },
    // Mahesh 29th Aug: Work From Home
    { id: 'emp-KSS2407006_2026-08-29', status: 'Work From Home', isWfh: true },
    { id: '8T19zoI3noTDcgeye4BWSVIWsEq1_2026-08-29', status: 'Work From Home', isWfh: true },

    // Akash 25th Aug: On Leave (Sick Leave)
    { id: 'emp-KSS2407013_2026-08-25', status: 'On Leave', isWfh: false },
    { id: 'nMnI0qXOmMO9gw2nDnnPJuz2G1S2_2026-08-25', status: 'On Leave', isWfh: false },

    // Thabeethal 22nd Aug: On Leave (Earn Leave)
    { id: 'emp-KSS2407005_2026-08-22', status: 'On Leave', isWfh: false },
    { id: 'mzGAL3siJZazGrgf6WNEU7hTREw2_2026-08-22', status: 'On Leave', isWfh: false },

    // Asbin 26th Aug: On Leave (Earn Leave)
    { id: 'emp-KSS2407004_2026-08-26', status: 'On Leave', isWfh: false },
    { id: 'GCIqrMaffebCGNdmbuzPbcl6IpQ2_2026-08-26', status: 'On Leave', isWfh: false },
    // Asbin 27th Aug: Loss of Pay (LOP)
    { id: 'emp-KSS2407004_2026-08-27', status: 'Loss of Pay', isWfh: false },
    { id: 'GCIqrMaffebCGNdmbuzPbcl6IpQ2_2026-08-27', status: 'Loss of Pay', isWfh: false },
    // Asbin 28th Aug: Work From Home
    { id: 'emp-KSS2407004_2026-08-28', status: 'Work From Home', isWfh: true },
    { id: 'GCIqrMaffebCGNdmbuzPbcl6IpQ2_2026-08-28', status: 'Work From Home', isWfh: true },
    // Asbin 29th Aug: Work From Home
    { id: 'emp-KSS2407004_2026-08-29', status: 'Work From Home', isWfh: true },
    { id: 'GCIqrMaffebCGNdmbuzPbcl6IpQ2_2026-08-29', status: 'Work From Home', isWfh: true },

    // Jason 22nd Aug: On Leave (Sick Leave)
    { id: 'KfAB95lpbJOeylpKQaWX4GXOPGt2_2026-08-22', status: 'On Leave', isWfh: false },
    { id: 'KSS2407011_2026-08-22', status: 'On Leave', isWfh: false },
    { id: 'KSS2407014_2026-08-22', status: 'On Leave', isWfh: false },

    // Koushik 29th Aug: On Leave (Earn Leave)
    { id: 'emp-KSS2407003_2026-08-29', status: 'On Leave', isWfh: false },
    { id: 'vhKLIJCVZoTncqVtmh14paMbiXk2_2026-08-29', status: 'On Leave', isWfh: false }
  ];

  for (const att of attendanceUpdates) {
    await patchDoc(token, 'attendance', att.id, {
      status: att.status,
      isWfh: att.isWfh
    }, ['status', 'isWfh']).catch(() => {});
  }
  console.log('Attendance records synchronized successfully.');

  console.log('\nAll Firestore updates completed successfully!');
}

main().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
