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
  return res.idToken;
}

async function main() {
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated.');

  // 1. Check all leave requests
  const leavesRes = await request(`${FIRESTORE_BASE}/leaveRequests?pageSize=100`, 'GET', null, token);
  const leaveDocs = leavesRes.documents || [];

  for (const doc of leaveDocs) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    const empName = (f.employeeName?.stringValue || f.fullName?.stringValue || '').toLowerCase();
    const empId = f.employeeId?.stringValue || '';

    // Thabeethal: make taken earn leave zero -> update doc to Rejected/Cancelled or Delete
    if (empName.includes('thabeetha') || empId === 'KSS2407005') {
      if (f.type?.stringValue === 'Leave' || f.leaveCategory?.stringValue === 'Earn Leave') {
        console.log(`Setting Thabeetha leave ${docId} to Rejected...`);
        await request(`${FIRESTORE_BASE}/leaveRequests/${docId}?updateMask.fieldPaths=status&updateMask.fieldPaths=pmStatus&updateMask.fieldPaths=hrStatus&updateMask.fieldPaths=ceoStatus&updateMask.fieldPaths=ctoStatus`, 'PATCH', {
          fields: {
            ...f,
            status: { stringValue: 'Rejected' },
            pmStatus: { stringValue: 'Rejected' },
            hrStatus: { stringValue: 'Rejected' },
            ceoStatus: { stringValue: 'Rejected' },
            ctoStatus: { stringValue: 'Rejected' }
          }
        }, token);
      }
    }

    // Asbin: make taken earn leave zero
    if (empName.includes('asbin') || empId === 'KSS2407004') {
      if (f.type?.stringValue === 'Leave' || f.leaveCategory?.stringValue === 'Earn Leave') {
        console.log(`Setting Asbin leave ${docId} to Rejected...`);
        await request(`${FIRESTORE_BASE}/leaveRequests/${docId}?updateMask.fieldPaths=status&updateMask.fieldPaths=pmStatus&updateMask.fieldPaths=hrStatus&updateMask.fieldPaths=ceoStatus&updateMask.fieldPaths=ctoStatus`, 'PATCH', {
          fields: {
            ...f,
            status: { stringValue: 'Rejected' },
            pmStatus: { stringValue: 'Rejected' },
            hrStatus: { stringValue: 'Rejected' },
            ceoStatus: { stringValue: 'Rejected' },
            ctoStatus: { stringValue: 'Rejected' }
          }
        }, token);
      }
    }

    // Mahesh: make taken earn leave zero
    if (empName.includes('mahesh') || empId === 'KSS2407006') {
      if (f.type?.stringValue === 'Leave' || f.leaveCategory?.stringValue === 'Earn Leave') {
        console.log(`Setting Mahesh leave ${docId} to Rejected...`);
        await request(`${FIRESTORE_BASE}/leaveRequests/${docId}?updateMask.fieldPaths=status&updateMask.fieldPaths=pmStatus&updateMask.fieldPaths=hrStatus&updateMask.fieldPaths=ceoStatus&updateMask.fieldPaths=ctoStatus`, 'PATCH', {
          fields: {
            ...f,
            status: { stringValue: 'Rejected' },
            pmStatus: { stringValue: 'Rejected' },
            hrStatus: { stringValue: 'Rejected' },
            ceoStatus: { stringValue: 'Rejected' },
            ctoStatus: { stringValue: 'Rejected' }
          }
        }, token);
      }
    }

    // Jason: make taken sick leave zero
    if (empName.includes('jason') || empId === 'KSS2407011' || empId === 'KSS2407014') {
      if (f.type?.stringValue === 'Leave' || f.type?.stringValue === 'Sick Leave' || f.leaveCategory?.stringValue === 'Sick Leave') {
        console.log(`Setting Jason leave ${docId} to Rejected...`);
        await request(`${FIRESTORE_BASE}/leaveRequests/${docId}?updateMask.fieldPaths=status&updateMask.fieldPaths=pmStatus&updateMask.fieldPaths=hrStatus&updateMask.fieldPaths=ceoStatus&updateMask.fieldPaths=ctoStatus`, 'PATCH', {
          fields: {
            ...f,
            status: { stringValue: 'Rejected' },
            pmStatus: { stringValue: 'Rejected' },
            hrStatus: { stringValue: 'Rejected' },
            ceoStatus: { stringValue: 'Rejected' },
            ctoStatus: { stringValue: 'Rejected' }
          }
        }, token);
      }
    }

    // Akash: has taken 1 earn leave -> make it Approved
    if (empName.includes('akash') || empId === 'KSS2407013') {
      if (f.type?.stringValue === 'Leave' || f.leaveCategory?.stringValue === 'Earn Leave' || f.startDate?.stringValue === '2026-08-25') {
        console.log(`Setting Akash leave ${docId} to Approved...`);
        await request(`${FIRESTORE_BASE}/leaveRequests/${docId}?updateMask.fieldPaths=status&updateMask.fieldPaths=pmStatus&updateMask.fieldPaths=hrStatus&updateMask.fieldPaths=ceoStatus&updateMask.fieldPaths=ctoStatus`, 'PATCH', {
          fields: {
            ...f,
            status: { stringValue: 'Approved' },
            pmStatus: { stringValue: 'Approved' },
            hrStatus: { stringValue: 'Approved' },
            ceoStatus: { stringValue: 'Approved' },
            ctoStatus: { stringValue: 'Approved' }
          }
        }, token);
      }
    }
  }

  console.log('✨ All leave statuses successfully adjusted in Firestore!');
}

main().catch(console.error);
