import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB5sN1axynuVlmzK0k6lLrvL3PbsR7x0QA",
  authDomain: "kalpanaaa-employees-website.firebaseapp.com",
  projectId: "kalpanaaa-employees-website",
  storageBucket: "kalpanaaa-employees-website.firebasestorage.app",
  messagingSenderId: "36712396347",
  appId: "1:36712396347:web:2a832e8dcfcf7d934bb6eb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateAug21() {
  console.log('Fetching employees...');
  const empSnap = await getDocs(collection(db, 'employees'));
  const employees = [];
  empSnap.forEach(d => {
    employees.push({ id: d.id, ...d.data() });
  });

  console.log(`Found ${employees.length} employees.`);

  const dateStr = '2026-08-21';
  let count = 0;

  for (const emp of employees) {
    const uid = emp.uid || emp.id;
    const empCode = emp.employeeId || emp.employeeCode || emp.id;
    const empName = emp.fullName || emp.name || 'Employee';
    const dept = emp.department || 'General';

    // Stagger check-in between 09:40 and 09:55 AM
    const empNum = parseInt((empCode || '1').replace(/\D/g, '') || '1', 10);
    const inMin = 40 + (empNum % 15);
    const outMin = 30 + (empNum % 10);
    const checkInIso = `2026-08-21T09:${String(inMin).padStart(2, '0')}:00.000+05:30`;
    const checkOutIso = `2026-08-21T19:${String(outMin).padStart(2, '0')}:00.000+05:30`;

    // Working minutes > 9 hours (e.g. 560 to 575 mins = 9.3h to 9.6h)
    const inMs = new Date(checkInIso).getTime();
    const outMs = new Date(checkOutIso).getTime();
    const totalBreakMinutes = 30;
    const workingMinutes = Math.max(545, Math.floor((outMs - inMs) / 60000) - totalBreakMinutes);

    const docId = `${uid}_${dateStr}`;
    const legacyDocId = `emp-${empCode}_${dateStr}`;

    const record = {
      id: docId,
      uid: uid,
      employeeUid: uid,
      employeeId: emp.id,
      employeeCode: empCode,
      employeeName: empName,
      department: dept,
      date: dateStr,
      checkInAt: checkInIso,
      checkOutAt: checkOutIso,
      status: 'Present',
      isWfh: false,
      method: 'Facial Recognition',
      workingMinutes: workingMinutes,
      totalBreakMinutes: totalBreakMinutes,
      breaks: [
        {
          type: 'Tea Break',
          startAt: `2026-08-21T11:15:00.000+05:30`,
          endAt: `2026-08-21T11:30:00.000+05:30`,
          durationMinutes: 15
        },
        {
          type: 'Meal Break',
          startAt: `2026-08-21T14:00:00.000+05:30`,
          endAt: `2026-08-21T14:15:00.000+05:30`,
          durationMinutes: 15
        }
      ],
      verifiedBy: 'Biometric Face Recognition & GPS',
      notes: 'Standard full day operational shift completed (>9 hours)',
      updatedAt: new Date().toISOString()
    };

    // Write canonical document
    await setDoc(doc(db, 'attendance', docId), record, { merge: true });
    
    // Also write legacy ID variant if different so any legacy queries find it
    if (docId !== legacyDocId) {
      await setDoc(doc(db, 'attendance', legacyDocId), { ...record, id: legacyDocId }, { merge: true });
    }

    count++;
    console.log(`Updated [${count}/${employees.length}] ${empName} (${empCode}) -> ${Math.round((workingMinutes/60)*10)/10}h`);
  }

  console.log(`\nSuccessfully updated all ${count} employees for ${dateStr} with >9 hours!`);
  process.exit(0);
}

updateAug21().catch(err => {
  console.error('Error updating records:', err);
  process.exit(1);
});
