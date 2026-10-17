import https from 'https';

const PROJECT_ID  = 'kalpanaaa-employees-website';
const API_KEY     = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS  = 'Koushik@777';
const ASBIN_AUTH_UID   = 'GCIqrMaffebCGNdmbuzPbcl6IpQ2';
const ASBIN_EMAIL      = 'asbin.t.s@kalpanaaa.in';
const ASBIN_EMP_DOC_ID = 'emp-KSS2407004';
const ASBIN_EMP_CODE   = 'KSS2407004';
const FS_BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

function request(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {'Content-Type': 'application/json'};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request({hostname: u.hostname, path: u.pathname + u.search, method, headers}, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({status: res.statusCode, body: JSON.parse(data)}); }
        catch { resolve({status: res.statusCode, body: data}); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
async function signIn(email, password) {
  const res = await request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY, 'POST', {email, password, returnSecureToken: true});
  if (res.status !== 200) throw new Error('Sign-in failed: ' + JSON.stringify(res.body));
  return res.body.idToken;
}
function toFSVal(val) {
  if (val === null) return {nullValue: null};
  if (typeof val === 'boolean') return {booleanValue: val};
  if (typeof val === 'number') return {integerValue: String(val)};
  if (typeof val === 'string') return {stringValue: val};
  if (Array.isArray(val)) return {arrayValue: {values: val.map(toFSVal)}};
  if (typeof val === 'object') return {mapValue: {fields: toFields(val)}};
  return {stringValue: String(val)};
}
function toFields(obj) {
  const f = {};
  for (const [k,v] of Object.entries(obj)) f[k] = toFSVal(v);
  return f;
}
function fromFields(fields) {
  if (!fields) return {};
  const obj = {};
  for (const [k,v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) obj[k] = v.doubleValue;
    else if (v.nullValue !== undefined) obj[k] = null;
    else if (v.arrayValue) obj[k] = (v.arrayValue.values||[]).map(i=>i.stringValue??i.integerValue??null);
    else if (v.mapValue) obj[k] = fromFields(v.mapValue.fields);
    else obj[k] = v;
  }
  return obj;
}
async function getDoc2(path, token) { return request(FS_BASE + '/' + path, 'GET', null, token); }
async function setDoc2(path, data, token) {
  const fields = toFields(data);
  const mask = Object.keys(fields).map(k=>'updateMask.fieldPaths='+encodeURIComponent(k)).join('&');
  return request(FS_BASE + '/' + path + '?' + mask, 'PATCH', {fields}, token);
}
async function listDocs(col, token) { return request(FS_BASE + '/' + col + '?pageSize=300', 'GET', null, token); }

async function main() {
  console.log('=== ASBIN T S - EMERGENCY RESTORE ===');
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('Auth OK');
  const empsRes = await listDocs('employees', token);
  const empDocs = empsRes.body.documents || [];
  console.log('Total employee docs: ' + empDocs.length);
  let foundAny = false;
  for (const doc of empDocs) {
    const docId = doc.name.split('/').pop();
    const f = fromFields(doc.fields);
    const isAsbin = docId === ASBIN_EMP_DOC_ID || f.employeeId === ASBIN_EMP_CODE ||
      (f.email||'').toLowerCase() === ASBIN_EMAIL.toLowerCase() ||
      f.uid === ASBIN_AUTH_UID || (f.fullName||'').toLowerCase().includes('asbin');
    if (isAsbin) {
      foundAny = true;
      console.log('FOUND Asbin doc: ' + docId + ' name=' + f.fullName + ' email=' + f.email + ' uid=' + f.uid + ' status=' + f.status + ' isDeleted=' + f.isDeleted);
    }
  }
  if (!foundAny) console.log('ROOT CAUSE CONFIRMED: No Asbin employee doc in Firestore!');
  const userRes = await getDoc2('users/' + ASBIN_AUTH_UID, token);
  if (userRes.status === 200) {
    const ud = fromFields(userRes.body.fields);
    console.log('users/' + ASBIN_AUTH_UID + ' EXISTS: role=' + ud.role + ' email=' + ud.email + ' employeeDocId=' + ud.employeeDocId);
  } else {
    console.log('ROOT CAUSE CONFIRMED: users/' + ASBIN_AUTH_UID + ' MISSING (HTTP ' + userRes.status + ')');
  }
  console.log('Restoring employee doc...');
  const now = new Date().toISOString();
  const empData = {
    id: ASBIN_EMP_DOC_ID, employeeId: ASBIN_EMP_CODE, uid: ASBIN_AUTH_UID,
    fullName: 'Asbin T S', email: ASBIN_EMAIL, phone: '7603872359',
    gender: 'Male', dateOfBirth: '1998-11-05', department: 'Engineering',
    designation: 'Frontend Developer', skills: ['Frontend Development'],
    specialization: 'Frontend Development', joiningDate: '2024-03-01',
    employmentType: 'Full-Time', reportingManager: 'D. Koushik',
    reportingManagerUid: 'uid-KSS2407003', pmUid: 'uid-KSS2407003',
    workLocation: 'Main Office HQ', status: 'Active',
    shift: 'Day Shift (10:00 - 19:00)', permanentAddress: 'Bengaluru HQ Campus',
    currentAddress: 'Bengaluru HQ Campus', city: 'Bengaluru', state: 'Karnataka',
    postalCode: '560102', emergencyContact: '7603872359', emergencyRelationship: 'Family',
    role: 'EMPLOYEE', qrToken: 'QR-KSS2407004', earnLeaveBalance: 0, sickLeaveBalance: 1,
    approvedWfhDates: ['2026-08-28', '2026-08-29'],
    profilePhotoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300',
    createdAt: '2024-03-01T10:00:00Z', updatedAt: now, isDeleted: false
  };
  const ew = await setDoc2('employees/' + ASBIN_EMP_DOC_ID, empData, token);
  console.log('Employee doc: HTTP ' + ew.status + ' ' + (ew.status>=200&&ew.status<300?'OK':'FAILED: '+JSON.stringify(ew.body).substring(0,300)));
  console.log('Restoring users mapping doc...');
  const uData = {uid: ASBIN_AUTH_UID, email: ASBIN_EMAIL, role: 'EMPLOYEE',
    employeeId: ASBIN_EMP_CODE, employeeDocId: ASBIN_EMP_DOC_ID,
    fullName: 'Asbin T S', updatedAt: now};
  const uw = await setDoc2('users/' + ASBIN_AUTH_UID, uData, token);
  console.log('Users doc: HTTP ' + uw.status + ' ' + (uw.status>=200&&uw.status<300?'OK':'FAILED: '+JSON.stringify(uw.body).substring(0,300)));
  console.log('Verifying...');
  const ve = await getDoc2('employees/' + ASBIN_EMP_DOC_ID, token);
  if (ve.status===200) { const d=fromFields(ve.body.fields); console.log('VERIFIED employees: name=' + d.fullName + ' uid=' + d.uid + ' status=' + d.status); }
  else console.log('VERIFY FAILED employee HTTP ' + ve.status);
  const vu = await getDoc2('users/' + ASBIN_AUTH_UID, token);
  if (vu.status===200) { const d=fromFields(vu.body.fields); console.log('VERIFIED users: role=' + d.role + ' employeeDocId=' + d.employeeDocId); }
  else console.log('VERIFY FAILED users HTTP ' + vu.status);
  console.log('RESTORE COMPLETE');
}
main().catch(e => { console.error('FAILED:', e.message||e); process.exit(1); });
