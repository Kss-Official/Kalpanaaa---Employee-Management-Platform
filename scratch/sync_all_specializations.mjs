import https from 'https';

const PROJECT_ID = 'kalpanaaa-employees-website';
const API_KEY    = 'AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA';
const HR_EMAIL   = 'hr@kalpanaaa.in';
const HR_PASS    = 'Hr@123456';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function req(url, method, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const b = body ? JSON.stringify(body) : null;
    if (b) headers['Content-Length'] = Buffer.byteLength(b);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (b) r.write(b);
    r.end();
  });
}

function parseFields(fields) {
  const res = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.arrayValue !== undefined) res[k] = (v.arrayValue.values || []).map(item => item.stringValue || item.integerValue || item);
    else res[k] = v;
  }
  return res;
}

const EMP_SKILLS_MAP = {
  'KSS2407001': { skills: ['Technical Leadership', 'Solution Architecture', 'Full Stack Development'], spec: 'Technical Leadership' },
  'KSS2407002': { skills: ['Project Management', 'Client Management'], spec: 'Project Management' },
  'KSS2407003': { skills: ['Project Management'], spec: 'Project Management' },
  'KSS2407004': { skills: ['Frontend Development'], spec: 'Frontend Development' },
  'KSS2407005': { skills: ['Backend Development'], spec: 'Backend Development' },
  'KSS2407006': { skills: ['UI/UX Design', 'UI Design', 'UX Design'], spec: 'UI/UX Design' },
  'KSS2407007': { skills: ['UI/UX Design', 'UI Design', 'UX Design'], spec: 'UI/UX Design' },
  'KSS2407008': { skills: ['Full Stack Development'], spec: 'Full Stack Development' },
  'KSS2407009': { skills: ['Full Stack Development'], spec: 'Full Stack Development' },
  'KSS2407010': { skills: ['Frontend Development'], spec: 'Frontend Development' },
  'KSS2407011': { skills: ['Technical Leadership'], spec: 'Technical Leadership' },
  'KSS2407012': { skills: ['Technical Leadership'], spec: 'Technical Leadership' },
  'KSS2407013': { skills: ['Backend Development'], spec: 'Backend Development' },
  'KSS2407014': { skills: ['Generative AI'], spec: 'Generative AI' },
  'KSS2407015': { skills: ['Full Stack Development', 'Solution Architecture'], spec: 'Solution Architecture' },
  'KSS2407016': { skills: ['Generative AI'], spec: 'Generative AI' },
  'KSS2407017': { skills: ['Full Stack Development'], spec: 'Full Stack Development' }
};

async function main() {
  console.log('--- SYNCING SPECIALIZATIONS & SKILLS TO FIRESTORE ---');
  const authRes = await req(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    'POST',
    { email: HR_EMAIL, password: HR_PASS, returnSecureToken: true }
  );
  if (authRes.status !== 200) {
    throw new Error('HR Auth failed: ' + JSON.stringify(authRes.body));
  }
  const token = authRes.body.idToken;
  console.log('✅ HR Authenticated');

  let allDocs = [];
  let pageToken = null;
  do {
    const url = `${BASE}/employees?pageSize=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await req(url, 'GET', null, token);
    if (res.body?.documents) allDocs = allDocs.concat(res.body.documents);
    pageToken = res.body?.nextPageToken || null;
  } while (pageToken);
  console.log(`Fetched ${allDocs.length} employee documents across all pages.`);

  let updatedCount = 0;
  for (const doc of allDocs) {
    const docId = doc.name.split('/').pop();
    const data = parseFields(doc.fields);
    const empId = data.employeeId;
    const name = (data.fullName || '').toLowerCase();

    let target = EMP_SKILLS_MAP[empId];
    if (!target) {
      if (name.includes('pratiksha')) target = EMP_SKILLS_MAP['KSS2407008'];
      else if (name.includes('priyanka')) target = EMP_SKILLS_MAP['KSS2407009'];
      else if (name.includes('prahlad')) target = EMP_SKILLS_MAP['KSS2407010'];
      else if (name.includes('thabeethal')) target = EMP_SKILLS_MAP['KSS2407005'];
      else if (name.includes('akash')) target = EMP_SKILLS_MAP['KSS2407013'];
      else if (name.includes('asbin')) target = EMP_SKILLS_MAP['KSS2407004'];
      else if (name.includes('kuruva') || name.includes('mahesh')) target = EMP_SKILLS_MAP['KSS2407006'];
      else if (name.includes('ritish')) target = EMP_SKILLS_MAP['KSS2407007'];
      else if (name.includes('jigyansha') || name.includes('jingyasha')) target = EMP_SKILLS_MAP['KSS2407016'];
      else if (name.includes('koushik')) target = EMP_SKILLS_MAP['KSS2407003'];
      else if (name.includes('shruti')) target = EMP_SKILLS_MAP['KSS2407017'];
      else if (name.includes('hr')) target = { skills: ['HR Operations'], spec: 'HR Operations' };
    }

    if (target) {
      const payload = {
        fields: {
          skills: { arrayValue: { values: target.skills.map(s => ({ stringValue: s })) } },
          specialization: { stringValue: target.spec }
        }
      };
      const mask = 'updateMask.fieldPaths=skills&updateMask.fieldPaths=specialization';
      const patchRes = await req(`${BASE}/employees/${docId}?${mask}`, 'PATCH', payload, token);
      if (patchRes.status === 200) {
        console.log(`✅ [${docId}] ${data.fullName || 'No Name'} -> ${target.spec}`);
        updatedCount++;
      } else {
        console.warn(`❌ [${docId}] Update failed:`, patchRes.status, patchRes.body?.error?.message);
      }
    }
  }

  console.log(`\n🎉 Total documents updated: ${updatedCount}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
