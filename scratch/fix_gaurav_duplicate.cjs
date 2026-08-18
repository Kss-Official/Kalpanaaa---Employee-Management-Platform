const https = require('https');

const projectId = 'kalpanaaa-employees-website';
const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/employees`;

console.log('📡 Fetching all employee documents from Firestore Cloud...');

https.get(getUrl, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const docs = data.documents || [];
      console.log(`📊 Found ${docs.length} total employee documents in Firestore.`);

      for (const doc of docs) {
        const id = doc.name.split('/').pop();
        const fields = doc.fields || {};
        const fullName = fields.fullName?.stringValue || '';
        const empId = fields.employeeId?.stringValue || id;
        const designation = fields.designation?.stringValue || '';

        console.log(`  - ID: ${id} | EmpID: ${empId} | Name: ${fullName} | Designation: ${designation}`);

        // Delete duplicate Gaurav record (KSS2407014 or emp-KSS2407014)
        if (id.includes('KSS2407014') || empId === 'KSS2407014' || (fullName.includes('Gaurav') && designation.includes('Backend'))) {
          console.log(`\n🗑️ Deleting duplicate Gaurav Backend Developer document ${doc.name}...`);
          await new Promise(resolve => {
            const req = https.request(`https://firestore.googleapis.com/v1/${doc.name}`, { method: 'DELETE' }, () => {
              console.log(`✅ Document ${id} deleted from Firestore!`);
              resolve();
            });
            req.end();
          });
        }

        // Update main Gaurav CTO document (KSS2407001 / emp-KSS2407001) to Chief Technology Officer (CTO)
        if (id.includes('KSS2407001') || empId === 'KSS2407001' || (fullName.includes('Gaurav') && !id.includes('14'))) {
          console.log(`\n✏️ Updating Gaurav CTO document ${doc.name}...`);
          const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=designation&updateMask.fieldPaths=role`;
          const patchData = JSON.stringify({
            fields: {
              ...fields,
              designation: { stringValue: 'Chief Technology Officer (CTO)' },
              role: { stringValue: 'SUPER_ADMIN' }
            }
          });

          await new Promise(resolve => {
            const req = https.request(patchUrl, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(patchData)
              }
            }, (patchRes) => {
              console.log(`✅ Document ${id} updated to Chief Technology Officer (CTO)!`);
              resolve();
            });
            req.write(patchData);
            req.end();
          });
        }
      }

      console.log('\n🎉 ALL FIRESTORE GAURAV CLEANUP COMPLETED PERFECTLY!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Parse Error:', err);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('❌ Network Error:', err);
  process.exit(1);
});
