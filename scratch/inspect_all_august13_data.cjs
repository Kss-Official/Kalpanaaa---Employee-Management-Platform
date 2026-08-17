const https = require('https');

const projectId = 'kalpanaaa-employees-website';

function queryCollection(collName) {
  return new Promise((resolve) => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collName}`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.documents || []);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function run() {
  console.log('🔍 DEEP AUDIT: Searching Firestore for yesterday\'s records (2026-08-13)...');
  
  const attDocs = await queryCollection('attendance');
  console.log(`\n📌 ATTENDANCE Collection Total Documents: ${attDocs.length}`);
  attDocs.forEach(d => {
    const id = d.name.split('/').pop();
    const f = d.fields || {};
    const date = f.date?.stringValue;
    const emp = f.employeeName?.stringValue || f.employeeCode?.stringValue || f.employeeId?.stringValue;
    const checkIn = f.checkInAt?.stringValue;
    if (date === '2026-08-13' || (checkIn && checkIn.includes('2026-08-13'))) {
      console.log(`   ⭐ MATCH FOUND on 2026-08-13: ID = ${id} | Emp = ${emp} | CheckIn = ${checkIn}`);
    } else {
      console.log(`   - Document ID = ${id} | Date = ${date} | Emp = ${emp}`);
    }
  });

  const auditDocs = await queryCollection('auditLogs');
  console.log(`\n📌 AUDIT LOGS Collection Total Documents: ${auditDocs.length}`);
  auditDocs.forEach(d => {
    const id = d.name.split('/').pop();
    const f = d.fields || {};
    const ts = f.timestamp?.stringValue;
    const actor = f.actorName?.stringValue;
    const action = f.action?.stringValue;
    if (ts && ts.includes('2026-08-13')) {
      console.log(`   ⭐ AUDIT MATCH: ${id} | ${actor} | ${action} | ${ts}`);
    }
  });
}

run();
