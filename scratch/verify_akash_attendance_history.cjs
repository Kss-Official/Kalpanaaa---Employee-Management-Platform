const https = require('https');

const projectId = 'kalpanaaa-employees-website';
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/attendance`;

https.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const docs = data.documents || [];
      console.log(`📊 Total Firestore Documents in Cloud: ${docs.length}`);

      const akashDocs = docs.filter(doc => {
        const fields = doc.fields || {};
        const empId = fields.employeeId?.stringValue || '';
        const empCode = fields.employeeCode?.stringValue || '';
        const empName = fields.employeeName?.stringValue || '';
        return empId.includes('KSS2407013') || empCode.includes('KSS2407013') || empName.toLowerCase().includes('akash');
      });

      console.log(`\n🎯 FOUND ${akashDocs.length} ATTENDANCE RECORDS FOR AKASH SB IN FIRESTORE CLOUD:`);
      akashDocs.forEach(d => {
        const docId = d.name.split('/').pop();
        const f = d.fields || {};
        console.log(`   📅 Date: ${f.date?.stringValue} | Status: ${f.status?.stringValue} | CheckIn: ${f.checkInAt?.stringValue || 'N/A'} | ID: ${docId}`);
      });
    } catch (e) {
      console.error('Error:', e);
    }
  });
});
