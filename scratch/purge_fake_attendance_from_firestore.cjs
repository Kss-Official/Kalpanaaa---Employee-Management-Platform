const https = require('https');

const projectId = 'kalpanaaa-employees-website';
const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/attendance`;

console.log('📡 Fetching all attendance documents to purge synthetic att-hist-* fake data...');

https.get(getUrl, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const docs = data.documents || [];
      console.log(`📊 Found ${docs.length} total attendance documents.`);

      const fakeDocs = docs.filter(d => {
        const id = d.name.split('/').pop();
        return id.startsWith('att-hist-');
      });

      console.log(`\n🗑️ Deleting ${fakeDocs.length} synthetic att-hist-* fake documents from Firestore...`);

      let deletedCount = 0;
      for (const doc of fakeDocs) {
        const docName = doc.name; // full resource path
        await new Promise((resolve) => {
          const req = https.request(`https://firestore.googleapis.com/v1/${docName}`, { method: 'DELETE' }, (delRes) => {
            deletedCount++;
            resolve();
          });
          req.on('error', () => resolve());
          req.end();
        });
      }

      console.log(`\n✅ PURGE COMPLETE! Successfully deleted ${deletedCount} fake documents from Firebase Cloud Firestore.`);
      
      // Now list remaining real attendance documents
      https.get(getUrl, (res2) => {
        let body2 = '';
        res2.on('data', chunk => body2 += chunk);
        res2.on('end', () => {
          const data2 = JSON.parse(body2);
          const remaining = data2.documents || [];
          console.log(`\n💎 REMAINING REAL LIVE ATTENDANCE DOCUMENTS IN CLOUD: ${remaining.length}`);
          remaining.forEach(r => {
            const id = r.name.split('/').pop();
            const f = r.fields || {};
            console.log(`   📌 Real Record ID: ${id} | Emp: ${f.employeeName?.stringValue} (${f.employeeCode?.stringValue}) | Date: ${f.date?.stringValue} | CheckIn: ${f.checkInAt?.stringValue}`);
          });
        });
      });

    } catch (e) {
      console.error('Error during purge:', e.message);
    }
  });
});
