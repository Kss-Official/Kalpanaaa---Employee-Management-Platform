import https from 'https';

const PROJECT_ID   = 'kalpanaaa-employees-website';
const API_KEY      = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL  = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS   = 'Koushik@777';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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

async function signIn(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await request(url, 'POST', { email, password, returnSecureToken: true });
  return { token: res.idToken, uid: res.localId };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      fields[k] = { nullValue: null };
    } else if (typeof v === 'string') {
      if (v.endsWith('Z') && v.includes('T')) {
        fields[k] = { timestampValue: v };
      } else {
        fields[k] = { stringValue: v };
      }
    } else if (typeof v === 'number') {
      if (Number.isInteger(v)) {
        fields[k] = { integerValue: v.toString() };
      } else {
        fields[k] = { doubleValue: v };
      }
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map(item => typeof item === 'object' ? { mapValue: { fields: toFirestoreFields(item) } } : { stringValue: String(item) })
        }
      };
    } else if (typeof v === 'object') {
      fields[k] = { mapValue: { fields: toFirestoreFields(v) } };
    }
  }
  return fields;
}

async function main() {
  console.log('Authenticating as D. Koushik...');
  const { token, uid } = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log(`Authenticated. UID: ${uid}`);

  // 1. Update /employees/emp-KSS2407003 to link real Firebase Auth UID
  console.log('\n1. Updating employees/emp-KSS2407003 with auth UID...');
  const empUpdate = {
    uid: uid,
    authUid: uid
  };
  const empPatchUrl = `${FIRESTORE_BASE}/employees/emp-KSS2407003?updateMask.fieldPaths=uid&updateMask.fieldPaths=authUid`;
  await request(empPatchUrl, 'PATCH', { fields: toFirestoreFields(empUpdate) }, token);
  console.log('  Updated employees/emp-KSS2407003 successfully.');

  // 2. Update /users/vhKLIJCVZoTncqVtmh14paMbiXk2 to point to emp-KSS2407003
  console.log('\n2. Updating users/' + uid + ' employeeDocId...');
  const userUpdate = {
    employeeDocId: 'emp-KSS2407003',
    employeeId: 'KSS2407003',
    role: 'PROJECT_MANAGER'
  };
  const userPatchUrl = `${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=employeeDocId&updateMask.fieldPaths=employeeId&updateMask.fieldPaths=role`;
  await request(userPatchUrl, 'PATCH', { fields: toFirestoreFields(userUpdate) }, token);
  console.log('  Updated users/' + uid + ' successfully.');

  // 3. Create attendance for Monday 2026-09-07 and Tuesday 2026-09-08
  const dates = [
    {
      date: '2026-09-07',
      checkIn: '2026-09-07T04:15:00.000Z', // 09:45 AM IST
      checkOut: '2026-09-07T13:20:00.000Z', // 06:50 PM IST
      workMins: 545
    },
    {
      date: '2026-09-08',
      checkIn: '2026-09-08T04:12:00.000Z', // 09:42 AM IST
      checkOut: '2026-09-08T13:18:00.000Z', // 06:48 PM IST
      workMins: 546
    }
  ];

  for (const d of dates) {
    console.log(`\n3. Writing attendance record for ${d.date}...`);
    const docData = {
      id: `${uid}_${d.date}`,
      date: d.date,
      employeeId: 'emp-KSS2407003',
      employeeCode: 'KSS2407003',
      employeeName: 'D. Koushik',
      department: 'IT',
      status: 'Present',
      attendanceMethod: 'Self Portal',
      checkInAt: d.checkIn,
      checkOutAt: d.checkOut,
      workingMinutes: d.workMins,
      breaks: [],
      totalBreakMinutes: 0,
      isWfh: false,
      locationVerified: true,
      distanceFromOffice: 8,
      locationAccuracy: 25,
      latitude: 13.014333,
      longitude: 77.646000,
      officeLatitude: 13.014333,
      officeLongitude: 77.646000,
      officeRadiusMeters: 100,
      uid: uid,
      employeeUid: uid,
      authUid: uid,
      pmUid: '',
      deviceInfo: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0.0.0',
      createdAt: d.checkIn,
      updatedAt: d.checkOut,
      notes: 'Shift completed & verified (Project Management Duty)'
    };

    // Write under uid_{date}
    const docUrl1 = `${FIRESTORE_BASE}/attendance/${uid}_${d.date}`;
    await request(docUrl1, 'PATCH', { fields: toFirestoreFields(docData) }, token);
    console.log(`  ✓ Saved attendance/${uid}_${d.date}`);

    // Also write under uid-KSS2407003_{date} for dual-indexed safety
    const docData2 = {
      ...docData,
      id: `uid-KSS2407003_${d.date}`,
      uid: 'uid-KSS2407003',
      employeeUid: 'uid-KSS2407003'
    };
    const docUrl2 = `${FIRESTORE_BASE}/attendance/uid-KSS2407003_${d.date}`;
    await request(docUrl2, 'PATCH', { fields: toFirestoreFields(docData2) }, token);
    console.log(`  ✓ Saved attendance/uid-KSS2407003_${d.date}`);
  }

  console.log('\nAll Firestore records created and linked successfully!');
}

main().catch(console.error);
