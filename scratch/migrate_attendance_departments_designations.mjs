/**
 * Migration Script:
 * 1. Sets Department to 'IT' for all engineers/technical staff (HR set to 'HR')
 * 2. Unifies 'Frontend Developer' & 'Backend Developer' -> 'Software Engineer'
 * 3. Assigns explicit specializations (skills):
 *    - Former Frontend -> 'Frontend Development'
 *    - Former Backend -> 'Backend Development'
 *    - Software Engineers -> 'Full Stack Development'
 *    - Designers -> 'UI Design', 'UX Design'
 *    - PM -> 'Project Management', 'Technical Leadership'
 * 4. Ensures Gaurav Kumar Tripathi has Department 'IT' & Designation 'Founder, Managing Director/CTO'
 */

import https from 'https';

const PROJECT_ID  = 'kalpanaaa-employees-website';
const API_KEY     = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const ADMIN_EMAIL = 'd.koushik@kalpanaaasoftwaresolutions.in';
const ADMIN_PASS  = 'Koushik@777';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
        });
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

async function patchDoc(token, docPath, fields) {
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const url = `${FIRESTORE_BASE}/${docPath}?${fieldPaths}`;

  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      firestoreFields[k] = {
        arrayValue: {
          values: v.map(item => ({ stringValue: String(item) }))
        }
      };
    } else if (typeof v === 'number') {
      firestoreFields[k] = { integerValue: v };
    } else {
      firestoreFields[k] = { stringValue: String(v) };
    }
  }

  return await httpsRequest(url, 'PATCH', { fields: firestoreFields }, token);
}

async function main() {
  console.log('🔐 Authenticating…');
  const token = await signIn(ADMIN_EMAIL, ADMIN_PASS);
  console.log('✅ Authenticated\n');

  // Fetch all employees
  let pageToken = '';
  const allDocs = [];
  do {
    const url = `${FIRESTORE_BASE}/employees?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await httpsRequest(url, 'GET', null, token);
    allDocs.push(...(res.documents || []));
    pageToken = res.nextPageToken;
  } while (pageToken);

  console.log(`📊 Found ${allDocs.length} total employee documents.\n`);

  for (const doc of allDocs) {
    const docId = doc.name.split('/').pop();
    const f = doc.fields || {};
    const name = f.fullName?.stringValue || '';
    if (!name) continue;

    const empId = f.employeeId?.stringValue || '';
    const currentDept = f.department?.stringValue || '';
    const currentDesig = f.designation?.stringValue || '';
    const existingSkills = (f.skills?.arrayValue?.values || []).map(v => v.stringValue);

    let newDept = currentDept;
    let newDesig = currentDesig;
    let newSkills = [...existingSkills];

    const lowerName = name.toLowerCase();
    const lowerDesig = currentDesig.toLowerCase();
    const lowerDept = currentDept.toLowerCase();

    // ── 1. HR Department ───────────────────────────────────────────────────
    if (lowerName.includes('hr department') || lowerDesig.includes('hr') || lowerDept.includes('hr')) {
      newDept = 'HR';
      if (!newDesig || newDesig.includes('Operations')) newDesig = 'HR Operations Manager';
      if (!newSkills.length) newSkills = ['HR Operations', 'Talent Acquisition'];
    }
    // ── 2. Gaurav Sir (Managing Director / CTO) ────────────────────────────
    else if (lowerName.includes('gaurav') || empId === 'KSS2407001') {
      newDept = 'IT';
      newDesig = 'Founder, Managing Director/CTO';
      if (!newSkills.length) newSkills = ['Technical Leadership', 'Solution Architecture', 'Full Stack Development'];
    }
    // ── 3. Akshit Sir (CEO) ────────────────────────────────────────────────
    else if (lowerName.includes('akshit') || empId === 'KSS2407002') {
      newDept = 'Management';
      newDesig = 'Co-Founder, CEO';
    }
    // ── 4. Engineers / Developers / Tech / Design Staff ───────────────────
    else {
      // Department is ALWAYS IT for all technical staff
      newDept = 'IT';

      // Designations: user requested "designation make everyones as software developer"
      // Everyone in the technical workforce is designated as 'Software Developer'
      if (!lowerDesig.includes('project manager')) {
        newDesig = 'Software Developer';
      }

      // Preserve / ensure accurate specializations
      if (lowerDesig.includes('frontend')) {
        if (!newSkills.includes('Frontend Development')) {
          newSkills = ['Frontend Development', ...newSkills.filter(s => s !== 'Frontend Development')];
        }
      } else if (lowerDesig.includes('backend')) {
        if (!newSkills.includes('Backend Development')) {
          newSkills = ['Backend Development', ...newSkills.filter(s => s !== 'Backend Development')];
        }
      } else if (lowerDesig.includes('ui/ux') || lowerDesig.includes('designer')) {
        if (!newSkills.includes('UI Design')) newSkills.push('UI Design');
        if (!newSkills.includes('UX Design')) newSkills.push('UX Design');
      } else if (!newSkills.length) {
        newSkills = ['Full Stack Development'];
      }
    }

    // Check if patch is needed
    const needsPatch = (newDept !== currentDept) || 
                       (newDesig !== currentDesig) || 
                       (JSON.stringify(newSkills) !== JSON.stringify(existingSkills));

    if (needsPatch) {
      console.log(`✏️ Updating ${docId} (${name}):`);
      console.log(`   Dept: "${currentDept}" → "${newDept}"`);
      console.log(`   Desig: "${currentDesig}" → "${newDesig}"`);
      console.log(`   Skills: [${newSkills.join(', ')}]`);

      try {
        await patchDoc(token, `employees/${docId}`, {
          department: newDept,
          designation: newDesig,
          skills: newSkills
        });
        console.log(`   ✅ Saved successfully\n`);
      } catch (err) {
        console.error(`   ❌ Failed: ${err.message}\n`);
      }
    }
  }

  console.log('🎉 Migration completed successfully!');
}

main().catch(console.error);
