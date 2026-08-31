/**
 * AUDIT SCRIPT: Checks all Firestore documents that reference KSS2407011 or KSS2407014
 * across all collections, so we know exactly what would be affected by the ID swap.
 * READ-ONLY — makes no changes.
 */
const https = require('https');

const projectId = 'kalpanaaa-employees-website';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

const COLLECTIONS_TO_SCAN = [
  'employees',
  'attendance',
  'leaves',
  'leaveRequests',
  'payroll',
  'payslips',
  'notifications',
  'auditLogs',
  'feedback',
  'performance',
  'presence',
];

const TARGET_IDS = ['KSS2407011', 'KSS2407014', 'emp-KSS2407011', 'emp-KSS2407014'];

function fetchCollection(collection) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}/${collection}`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ collection, docs: data.documents || [], error: null });
        } catch (e) {
          resolve({ collection, docs: [], error: e.message });
        }
      });
    }).on('error', (e) => {
      resolve({ collection, docs: [], error: e.message });
    });
  });
}

function stringContainsTarget(str) {
  return TARGET_IDS.some(id => str.includes(id));
}

function docContainsTarget(fields) {
  const serialized = JSON.stringify(fields);
  return stringContainsTarget(serialized);
}

async function main() {
  console.log('🔍 AUDITING Firestore for KSS2407011 and KSS2407014 references...\n');
  const summary = {};

  for (const col of COLLECTIONS_TO_SCAN) {
    const { collection, docs, error } = await fetchCollection(col);

    if (error) {
      console.log(`  ⚠️  ${collection}: Error (${error})`);
      continue;
    }

    const hits = [];
    for (const docData of docs) {
      const docId = docData.name.split('/').pop();
      const fields = docData.fields || {};
      const serialized = JSON.stringify(fields);

      const matchedIds = TARGET_IDS.filter(id => serialized.includes(id) || docId.includes(id));
      if (matchedIds.length > 0) {
        hits.push({
          docId,
          matchedIds,
          fields: Object.fromEntries(
            Object.entries(fields).map(([k, v]) => [k, v.stringValue ?? v.integerValue ?? v.booleanValue ?? v.timestampValue ?? '[complex]'])
          )
        });
      }
    }

    summary[collection] = hits;
    if (hits.length > 0) {
      console.log(`\n📂 ${collection} — ${hits.length} affected document(s):`);
      hits.forEach(h => {
        console.log(`  📄 docId: ${h.docId}`);
        console.log(`     Matched IDs: ${h.matchedIds.join(', ')}`);
        const relevantFields = ['fullName','employeeId','email','status','employeeCode','date','type'];
        relevantFields.forEach(f => {
          if (h.fields[f]) console.log(`     ${f}: ${h.fields[f]}`);
        });
      });
    } else {
      console.log(`  ✅ ${collection}: No matches (${docs.length} docs checked)`);
    }
  }

  console.log('\n\n========= SUMMARY =========');
  let total = 0;
  for (const [col, hits] of Object.entries(summary)) {
    if (hits.length > 0) {
      console.log(`  ${col}: ${hits.length} document(s) need updating`);
      total += hits.length;
    }
  }
  console.log(`\n  TOTAL: ${total} documents would be affected by the ID swap.\n`);
  console.log('No changes were made. Run the migration script after reviewing.\n');
}

main().catch(console.error);
