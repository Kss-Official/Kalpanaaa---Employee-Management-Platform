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
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
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
  return res.idToken;
}

async function patchLeave(token, docId, status) {
  const url = `${FIRESTORE_BASE}/leaveRequests/${docId}?updateMask.fieldPaths=status&updateMask.fieldPaths=pmStatus&updateMask.fieldPaths=hrStatus&updateMask.fieldPaths=ceoStatus&updateMask.fieldPaths=ctoStatus`;
  const body = { fields: { status:{stringValue:status}, pmStatus:{stringValue:status}, hrStatus:{stringValue:status}, ceoStatus:{stringValue:status}, ctoStatus:{stringValue:status} } };
  return request(url, 'PATCH', body, token);
}

async function patchAtt(token, docId, status) {
  const url = `${FIRESTORE_BASE}/attendance/${docId}?updateMask.fieldPaths=status`;
  return request(url, 'PATCH', { fields: { status:{stringValue:status} } }, token);
}

async function fetchAll(token, col) {
  let docs = []; let pt = null;
  do {
    const url = `${FIRESTORE_BASE}/${col}?pageSize=300${pt?`&pageToken=${pt}`:''}`;
    const res = await request(url,'GET',null,token);
    docs = docs.concat(res.documents||[]);
    pt = res.nextPageToken||null;
  } while(pt);
  return docs;
}

const TARGETS = {
  'KSS2407005': { name:'Thabeetha', fixEL:true,  fixSL:false },
  'KSS2407004': { name:'Asbin',     fixEL:true,  fixSL:false },
  'KSS2407006': { name:'Mahesh',    fixEL:true,  fixSL:false },
  'KSS2407011': { name:'Jason',     fixEL:false, fixSL:true  },
  'KSS2407013': { name:'Akash',     fixEL:true,  fixSL:false },
};

async function main() {
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('Authenticated\n');

  const leaveDocs = await fetchAll(token,'leaveRequests');
  console.log('=== Leave Requests ===');
  for (const doc of leaveDocs) {
    const id = doc.name.split('/').pop();
    const f = doc.fields||{};
    const empId = f.employeeId?.stringValue||'';
    const t = targets[empId]; if(!t) continue;
    const type = f.type?.stringValue||'';
    const status = f.status?.stringValue||'';
    const isApproved = status==='Approved' || (
      ['Approved','N/A','Bypassed'].includes(f.pmStatus?.stringValue) &&
      ['Approved','N/A','Bypassed'].includes(f.hrStatus?.stringValue) &&
      f.ceoStatus?.stringValue==='Approved' && f.ctoStatus?.stringValue==='Approved');
    const isEL = ['Leave','Earn Leave','Earned Leave'].includes(type);
    const isSL = type==='Sick Leave';
    if((t.fixEL && isEL && isApproved)||(t.fixSL && isSL && isApproved)) {
      console.log(`REJECT ${id} [${t.name}] ${type}`);
      await patchLeave(token, id, 'Rejected');
    } else {
      console.log(`SKIP   ${id} [${t.name}] ${type} / ${status}`);
    }
  }

  const attDocs = await fetchAll(token,'attendance');
  console.log('\n=== Attendance ===');
  const EL_ST = ['Leave','Earn Leave','Earned Leave'];
  for (const doc of attDocs) {
    const id = doc.name.split('/').pop();
    const f = doc.fields||{};
    const empId = f.employeeId?.stringValue||'';
    const t = targets[empId]; if(!t) continue;
    const status = f.status?.stringValue||'';
    if(!['Leave','Earn Leave','Earned Leave','Sick Leave'].includes(status)) continue;
    const fix = (t.fixEL && EL_ST.includes(status)) || (t.fixSL && status==='Sick Leave');
    if(fix) {
      console.log(`FIX-ATT ${id} [${t.name}] ${status} -> Absent`);
      await patchAtt(token, id, 'Absent');
    }
  }
  console.log('\nDone.');
}

const targets = TARGETS;
main().catch(console.error);
