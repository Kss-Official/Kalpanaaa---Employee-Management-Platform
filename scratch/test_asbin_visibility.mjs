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
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const b = body ? JSON.stringify(body) : null;
    if (b) headers['Content-Length'] = Buffer.byteLength(b);
    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    r.on('error', reject);
    if (b) r.write(b);
    r.end();
  });
}

function parseFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) res[k] = v.stringValue;
    else if (v.integerValue !== undefined) res[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) res[k] = parseFloat(v.doubleValue);
    else if (v.booleanValue !== undefined) res[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) res[k] = v.timestampValue;
    else if (v.nullValue !== undefined) res[k] = null;
    else if (v.mapValue !== undefined) res[k] = parseFields(v.mapValue.fields);
    else if (v.arrayValue !== undefined) res[k] = (v.arrayValue.values || []).map(i => i.stringValue || i.integerValue || i);
    else res[k] = v;
  }
  return res;
}

async function main() {
  const auth = await req(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, 'POST', {email: HR_EMAIL, password: HR_PASS, returnSecureToken: true});
  const token = auth.body.idToken;

  // 1. Fetch live employees
  const empRes = await req(`${BASE}/employees?pageSize=300`, 'GET', null, token);
  const docs = empRes.body.documents || [];
  const fetched = docs.map(d => ({
    id: d.name.split('/').pop(),
    ...parseFields(d.fields)
  }));

  // Deduplication as done in AuthContext:
  const deduplicated = [];
  const seen = new Set();
  fetched.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
  for (const emp of fetched) {
    if (!emp.fullName || emp.fullName.trim() === '') continue;
    const emailKey = (emp.email || '').toLowerCase().trim();
    const idKey = emp.employeeId?.trim();
    if ((emailKey && seen.has(emailKey)) || (idKey && seen.has(idKey))) continue;
    if (emailKey) seen.add(emailKey);
    if (idKey) seen.add(idKey);
    deduplicated.push(emp);
  }
  deduplicated.reverse();

  console.log('=== TEST ASBIN VISIBILITY ACROSS PM PORTAL VIEWS ===\n');

  const asbin = deduplicated.find(e =>
    e.employeeId === 'KSS2407004' ||
    (e.fullName && e.fullName.toLowerCase().includes('asbin')) ||
    (e.email && e.email.toLowerCase().includes('asbin'))
  );

  console.log('1. Deduplicated Asbin Record:');
  console.log('   Doc ID:', asbin?.id);
  console.log('   Employee ID:', asbin?.employeeId);
  console.log('   Name:', asbin?.fullName);
  console.log('   Role:', asbin?.role);
  console.log('   Status:', asbin?.status);
  console.log('   Department:', asbin?.department);
  console.log('   Designation:', asbin?.designation);
  console.log('   isDeleted:', asbin?.isDeleted);

  // 2. PMDashboard: operationalEmployees
  // employees.filter(e => e.status !== 'Terminated' && e.status !== 'Inactive' && !isAttendanceExempt(e))
  console.log('\n2. PMDashboard -> operationalEmployees (Roster, Heatmap, Turnout):');
  const inOperational = deduplicated.filter(e => e.status !== 'Terminated' && e.status !== 'Inactive');
  const asbinInOperational = inOperational.find(e => e.employeeId === 'KSS2407004');
  console.log('   Asbin in operationalEmployees:', !!asbinInOperational);

  // 3. PMLeaveManagement: teamEmployees
  // employees.filter(e => e.status !== 'Terminated' && e.status !== 'Inactive' && e.role !== 'SUPER_ADMIN' && e.role !== 'HR_ADMIN')
  console.log('\n3. PMLeaveManagement -> teamEmployees:');
  const inLeaveMgmt = deduplicated.filter(e => e.status !== 'Terminated' && e.status !== 'Inactive' && e.role !== 'SUPER_ADMIN' && e.role !== 'HR_ADMIN');
  const asbinInLeaveMgmt = inLeaveMgmt.find(e => e.employeeId === 'KSS2407004');
  console.log('   Asbin in PMLeaveManagement:', !!asbinInLeaveMgmt);

  // 4. PMWorkSchedule: teamEmployees
  // employees.filter(e => e.status !== 'Terminated' && e.status !== 'Inactive' && e.role !== 'SUPER_ADMIN')
  console.log('\n4. PMWorkSchedule -> teamEmployees:');
  const inWorkSchedule = deduplicated.filter(e => e.status !== 'Terminated' && e.status !== 'Inactive' && e.role !== 'SUPER_ADMIN');
  const asbinInWorkSchedule = inWorkSchedule.find(e => e.employeeId === 'KSS2407004');
  console.log('   Asbin in PMWorkSchedule:', !!asbinInWorkSchedule);

  // 5. PMAttendanceCycleSection:
  // filterEmployeesForCycleExport(employees, { departmentFilter: selectedDept, employmentTypeFilter: selectedEmpType, searchFilter: searchTerm, includeInactive: false })
  console.log('\n5. PMAttendanceCycleSection (Salary & Attendance Cycle):');
  console.log('   Asbin Department in Firestore:', asbin?.department);
  console.log('   DEPARTMENTS list in PMAttendanceCycleSection:', ['ALL', 'IT', 'HR', 'Product & Design', 'Management', 'Sales', 'Marketing', 'Finance', 'Operations']);
  console.log('   Does DEPARTMENTS have Engineering?', ['ALL', 'IT', 'HR', 'Product & Design', 'Management', 'Sales', 'Marketing', 'Finance', 'Operations'].includes('Engineering'));

  // 6. PMProjectsView: tasks
  console.log('\n6. PMProjectsView (Projects & Kanban):');
  const tasksRes = await req(`${BASE}/projectTasks`, 'GET', null, token);
  const tasks = (tasksRes.body.documents || []).map(d => ({ id: d.name.split('/').pop(), ...parseFields(d.fields) }));
  const asbinTasks = tasks.filter(t => t.assigneeId === 'emp-KSS2407004' || t.assigneeId === 'GCIqrMaffebCGNdmbuzPbcl6IpQ2' || (t.assigneeName && t.assigneeName.includes('Asbin')));
  console.log('   Total tasks in Firestore:', tasks.length);
  console.log('   Tasks assigned to Asbin:', asbinTasks.length);
  asbinTasks.forEach(t => console.log('     -', t.id, t.title, 'deleted:', t.deleted, '_cleared:', t._cleared, 'status:', t.status));

  // 7. Team Directory (EmployeeTeamDirectory):
  console.log('\n7. EmployeeTeamDirectory (Team Directory tab):');
  // In EmployeeTeamDirectory:
  // selectedDept defaults to 'ALL', selectedRole defaults to null, specializationFilter defaults to 'ALL'
  console.log('   Asbin in allFilteredMembers:', !!asbin);

  // 8. WorkSchedules in Firestore:
  console.log('\n8. /workSchedules in Firestore:');
  const wsRes = await req(`${BASE}/workSchedules`, 'GET', null, token);
  const schedules = (wsRes.body.documents || []).map(d => ({ id: d.name.split('/').pop(), ...parseFields(d.fields) }));
  const asbinSchedule = schedules.find(s => s.id === 'GCIqrMaffebCGNdmbuzPbcl6IpQ2' || s.id === 'emp-KSS2407004' || s.employeeId === 'KSS2407004');
  console.log('   Work schedule for Asbin exists?', !!asbinSchedule, asbinSchedule ? asbinSchedule.id : 'none');
}

main().catch(console.error);
