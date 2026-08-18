const https = require('https');

// Query Firestore REST API directly for project: kalpanaaa-employees-website
const projectId = 'kalpanaaa-employees-website';
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/attendance`;

console.log(`📡 Fetching live Firestore attendance collection directly from Firebase cloud: ${url}`);

https.get(url, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.documents) {
        console.log(`\n✅ FOUND ${data.documents.length} LIVE DOCUMENTS IN FIRESTORE ATTENDANCE COLLECTION:`);
        data.documents.forEach((doc, idx) => {
          const docId = doc.name.split('/').pop();
          const fields = doc.fields || {};
          const empId = fields.employeeId?.stringValue || fields.employeeCode?.stringValue || 'N/A';
          const empName = fields.employeeName?.stringValue || 'N/A';
          const date = fields.date?.stringValue || 'N/A';
          const checkIn = fields.checkInAt?.stringValue || 'N/A';
          console.log(`  [${idx + 1}] ID: ${docId} | Date: ${date} | Emp: ${empName} (${empId}) | CheckIn: ${checkIn}`);
        });
      } else {
        console.log('⚠️ Firestore returned NO documents or empty collection response:', data);
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message, body);
    }
  });
}).on('error', (e) => {
  console.error('❌ HTTP Error:', e.message);
});
