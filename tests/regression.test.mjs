// Regression suite for the production-hardening fixes (Phases 5, 18, 19 + safeStorage).
// Run via: node tests/run.mjs
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = process.env.KSS_TEST_OUT;
if (!OUT) {
  console.error('Run this suite through tests/run.mjs');
  process.exit(1);
}

const errors = await import(pathToFileURL(join(OUT, 'errors.cjs')));
const safeStorageMod = await import(pathToFileURL(join(OUT, 'safeStorage.cjs')));
const engine = await import(pathToFileURL(join(OUT, 'attendanceEngine.cjs')));

// ── Phase 19: error classification ──────────────────────────────────────────
test('classifyError maps permission-denied to PERMISSION_DENIED', () => {
  const r = errors.classifyError({ code: 'permission-denied' });
  assert.equal(r.category, 'PERMISSION_DENIED');
  assert.ok(r.userMessage.length > 0);
});

test('classifyError maps firebase availability codes to NETWORK_ERROR', () => {
  for (const code of ['unavailable', 'deadline-exceeded', 'cancelled']) {
    assert.equal(errors.classifyError({ code }).category, 'NETWORK_ERROR');
  }
});

test('classifyError maps auth/* codes to AUTH_FAILED', () => {
  assert.equal(errors.classifyError({ code: 'auth/wrong-password' }).category, 'AUTH_FAILED');
});

test('classifyError detects network fragments including dynamic-import fetch failures', () => {
  assert.equal(errors.classifyError(new Error('Failed to fetch')).category, 'NETWORK_ERROR');
  assert.equal(
    errors.classifyError(new Error('TypeError: Failed to fetch dynamically imported module: /assets/x.js')).category,
    'NETWORK_ERROR'
  );
});

test('classifyError maps timeouts and unknown errors', () => {
  assert.equal(errors.classifyError(new Error('signal timed out')).category, 'TIMEOUT');
  assert.equal(errors.classifyError({ code: 'internal' }).category, 'FIREBASE_ERROR');
  assert.equal(errors.classifyError('boom').category, 'UNKNOWN_ERROR');
});

test('isChunkLoadError detects all known chunk failure signatures', () => {
  const positives = [
    'Failed to fetch dynamically imported module: http://x/assets/y.js',
    'Importing a module script failed.',
    'Loading chunk 5 failed. (missing: /assets/5.js)',
    new Error('ChunkLoadError: Loading chunk failed'),
    'error loading dynamically imported module'
  ];
  for (const p of positives) assert.ok(errors.isChunkLoadError(p), `should detect: ${String(p).slice(0, 40)}`);
  const negatives = ['Permission denied', new Error('Cannot read properties of undefined'), ''];
  for (const n of negatives) assert.equal(errors.isChunkLoadError(n), false);
});

// ── safeStorage: corrupted data must never crash boot ───────────────────────
function makeStorageMock(behavior = {}) {
  const store = new Map();
  return {
    store,
    getItem(k) { if (behavior.getItemThrows) throw new Error('SecurityError'); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { if (behavior.setItemThrows) throw new Error('QuotaExceededError'); store.set(k, String(v)); },
    removeItem(k) { if (behavior.removeItemThrows) throw new Error('SecurityError'); store.delete(k); }
  };
}

test('safeGetJson roundtrips objects', () => {
  globalThis.localStorage = makeStorageMock();
  assert.deepEqual(safeStorageMod.safeGetJson('k', { a: 1 }), { a: 1 });
  safeStorageMod.safeSetJson('k', { b: [1, 2] });
  assert.deepEqual(safeStorageMod.safeGetJson('k', null), { b: [1, 2] });
});

test('safeGetJson returns fallback and self-heals on corrupted JSON', () => {
  const mockStore = makeStorageMock();
  mockStore.store.set('bad', '{"oops');
  globalThis.localStorage = mockStore;
  assert.equal(safeStorageMod.safeGetJson('bad', 'fallback'), 'fallback');
  assert.equal(mockStore.store.has('bad'), false, 'corrupted key must be removed');
});

test('safeGetJson handles missing values', () => {
  globalThis.localStorage = makeStorageMock();
  assert.equal(safeStorageMod.safeGetJson('missing', 42), 42);
  assert.equal(safeStorageMod.safeGetString('missing'), null);
});

test('safeSetJson returns false instead of throwing on quota errors', () => {
  globalThis.localStorage = makeStorageMock({ setItemThrows: true });
  assert.equal(safeStorageMod.safeSetJson('k', { x: 1 }), false);
});

test('string helpers survive throwing storage implementations', () => {
  globalThis.localStorage = makeStorageMock({ getItemThrows: true, setItemThrows: true, removeItemThrows: true });
  assert.doesNotThrow(() => safeStorageMod.safeSetString('a', 'b'));
  assert.equal(safeStorageMod.safeGetString('a'), null);
  assert.doesNotThrow(() => safeStorageMod.safeRemoveItem('a'));
});

// ── Phase 18: date & time hardening ─────────────────────────────────────────
test('getLocalDateString formats local dates without UTC drift', () => {
  // 2026-01-31 23:30 local in a UTC+X timezone must stay the 31st
  const d = new Date(2026, 0, 31, 23, 30);
  assert.equal(engine.getLocalDateString(d), '2026-01-31');
});

test('getLocalDateString falls back safely on invalid input', () => {
  const out = engine.getLocalDateString('not-a-date');
  assert.match(out, /^\d{4}-\d{2}-\d{2}$/);
});

// ── Phase 4: identity matching across ID representations ────────────────────
test('isRecordForEmployee matches across id and employeeCode representations', () => {
  const emp = { id: 'abc123', employeeId: 'KSS2407003' };
  assert.ok(engine.isRecordForEmployee({ employeeId: 'abc123' }, emp));
  assert.ok(engine.isRecordForEmployee({ employeeCode: 'KSS2407003' }, emp));
  assert.ok(engine.isRecordForEmployee({ employeeId: 'KSS2407003' }, emp));
  assert.equal(engine.isRecordForEmployee({ employeeId: 'other' }, emp), false);
  assert.equal(engine.isRecordForEmployee(null, emp), false);
  assert.equal(engine.isRecordForEmployee({ employeeId: 'abc123' }, null), false);
});

// ── Phase 18: shift-window capping ──────────────────────────────────────────
test('computeShiftWorkingMinutes caps post-midnight checkout at 7:00 PM of record date', () => {
  const checkIn = new Date(2026, 7, 20, 10, 0).toISOString();      // Aug 20 10:00 local
  const lateOut = new Date(2026, 7, 21, 2, 0).toISOString();       // Aug 21 02:00 local
  const mins = engine.computeShiftWorkingMinutes('2026-08-20', checkIn, lateOut, 0);
  assert.equal(mins, 540, 'must count only 10:00→19:00 regardless of checkout time');
});

test('computeShiftWorkingMinutes subtracts breaks and floors at zero', () => {
  const checkIn = new Date(2026, 7, 20, 10, 0).toISOString();
  const checkOut = new Date(2026, 7, 20, 14, 0).toISOString();
  // 240 elapsed minutes − 60 break = 180 worked
  assert.equal(engine.computeShiftWorkingMinutes('2026-08-20', checkIn, checkOut, 60), 180);
  assert.equal(engine.computeShiftWorkingMinutes('2026-08-20', checkIn, checkOut, 999), 0);
  assert.equal(engine.computeShiftWorkingMinutes('2026-08-20', null, checkOut, 0), 0);
});

// ── Phase 5: attendance state machine ───────────────────────────────────────
const baseSettings = {
  gpsRequired: false,
  officeLatitude: 17.44,
  officeLongitude: 78.38,
  allowedRadiusMeters: 150
};

test('state machine: checked-in record allows CHECK_OUT', () => {
  const rec = { checkInAt: new Date(2026, 7, 20, 10, 5).toISOString(), checkOutAt: null, status: 'Present' };
  const r = engine.evaluateAttendanceScan({}, rec, baseSettings);
  assert.equal(r.action, 'CHECK_OUT');
  assert.equal(r.allowed, true);
});

test('state machine: completed record is idempotent (ALREADY_CHECKED_OUT)', () => {
  const rec = {
    checkInAt: new Date(2026, 7, 20, 10, 5).toISOString(),
    checkOutAt: new Date(2026, 7, 20, 18, 0).toISOString(),
    status: 'Present'
  };
  const r = engine.evaluateAttendanceScan({}, rec, baseSettings);
  assert.equal(r.action, 'ALREADY_CHECKED_OUT');
  assert.equal(r.allowed, false);
});

test('state machine: checkout falls back to verified check-in location when GPS is lost/outside', () => {
  const settings = { ...baseSettings, gpsRequired: true };
  const rec = {
    checkInAt: new Date(2026, 7, 20, 10, 5).toISOString(),
    checkOutAt: null,
    status: 'Present',
    locationVerified: true,
    distanceFromOffice: 42
  };
  // Employee now 50km away with a valid fix — checkout must still succeed
  const r = engine.evaluateAttendanceScan({}, rec, settings, 12.0, 77.0);
  assert.equal(r.action, 'CHECK_OUT');
  assert.equal(r.allowed, true);
  assert.equal(r.locationVerified, true);
});

test('state machine: check-in blocked before shift start and after shift end', () => {
  // Freeze the clock deterministically
  const t = mock.timers;
  t.enable({ apis: ['Date'] });

  try {
    t.setTime(new Date(2026, 7, 20, 8, 30).getTime()); // 8:30 AM — before 9:30 AM
    let r = engine.evaluateAttendanceScan({}, undefined, baseSettings);
    assert.equal(r.allowed, false);
    assert.match(r.message, /09:30 AM/);

    t.setTime(new Date(2026, 7, 20, 19, 30).getTime()); // 7:30 PM — after strict end
    r = engine.evaluateAttendanceScan({}, undefined, baseSettings);
    assert.equal(r.allowed, false);
    assert.match(r.message, /ended/);

    t.setTime(new Date(2026, 7, 20, 11, 30).getTime()); // 11:30 AM — late but allowed
    r = engine.evaluateAttendanceScan({}, undefined, baseSettings);
    assert.equal(r.allowed, true);
    assert.equal(r.status, 'Late');

    t.setTime(new Date(2026, 7, 20, 10, 15).getTime()); // normal check-in
    r = engine.evaluateAttendanceScan({}, undefined, baseSettings);
    assert.equal(r.allowed, true);
    assert.equal(r.status, 'Present');
  } finally {
    t.reset();
  }
});

// ── P0 incident regression: listener recovery & auth fallback policy ─────────

test('listener policy: permission-denied and unauthenticated are NOT retryable', () => {
  for (const code of ['permission-denied', 'unauthenticated']) {
    assert.equal(errors.isRetryableListenerError({ code }), false, code);
  }
  // Message-based variants (Firestore SDK surfaces 'Missing or insufficient permissions.')
  assert.equal(errors.isRetryableListenerError(new Error('Missing or insufficient permissions.')), false);
});

test('listener policy: transient codes are retryable', () => {
  for (const code of ['unavailable', 'deadline-exceeded', 'cancelled', 'internal', 'unknown']) {
    assert.equal(errors.isRetryableListenerError({ code }), true, code);
  }
  assert.equal(errors.isRetryableListenerError(new Error('Failed to fetch')), true);
});

test('listener policy: backoff grows exponentially and caps at 30s', () => {
  assert.equal(errors.nextBackoffMs(1), 1000);
  assert.equal(errors.nextBackoffMs(2), 2000);
  assert.equal(errors.nextBackoffMs(3), 4000);
  assert.equal(errors.nextBackoffMs(5), 16000);
  assert.equal(errors.nextBackoffMs(6), 30000);
  assert.equal(errors.nextBackoffMs(50), 30000);
  assert.equal(errors.nextBackoffMs(0), 1000); // defensive floor
});

test('login fallback: only genuine credential rejections may fall back to local login', () => {
  const safe = [
    'auth/invalid-credential',
    'auth/invalid-login-credentials',
    'auth/wrong-password',
    'auth/user-not-found',
    'auth/invalid-email'
  ];
  for (const code of safe) {
    assert.equal(errors.shouldFallbackToLocalLogin(code), true, code);
  }
  // Config/environment failures must surface instead of silently degrading
  const unsafe = [
    'auth/operation-not-allowed',
    'auth/api-key-not-valid',
    'auth/unauthorized-domain',
    'auth/network-request-failed',
    'auth/user-disabled',
    'auth/too-many-requests',
    'auth/admin-restricted-operation'
  ];
  for (const code of unsafe) {
    assert.equal(errors.shouldFallbackToLocalLogin(code), false, code);
  }
  // Non-Firebase exceptions preserve legacy behavior
  assert.equal(errors.shouldFallbackToLocalLogin(undefined), true);
});

// ── P0 incident regression: SHIFT_COMPLETE truth & fabrication signatures ────

test('shift completion: true ONLY when checkout exists and is not in the future', () => {
  const now = new Date(2026, 7, 21, 15, 0).getTime(); // Aug 21 15:00 local
  const open = { checkInAt: '2026-08-21T04:30:00.000Z', checkOutAt: null };
  assert.equal(engine.isShiftComplete(open, now), false);
  assert.equal(engine.isShiftComplete({ checkInAt: null, checkOutAt: 'x' }, now), false);
  assert.equal(engine.isShiftComplete(undefined, now), false);

  // Fabricated FUTURE checkout (e.g. pre-written 19:30 IST) must NOT complete shift
  const futureOut = { checkInAt: '2026-08-21T04:30:00.000Z', checkOutAt: '2026-08-21T14:00:00.000Z' }; // 19:30 IST
  assert.equal(engine.isShiftComplete(futureOut, now), false);

  // Real past checkout completes the shift (08:00Z = 13:30 IST < 15:00 IST now)
  const done = { checkInAt: '2026-08-21T04:30:00.000Z', checkOutAt: '2026-08-21T08:00:00.000Z' };
  assert.equal(engine.isShiftComplete(done, now), true);
});

test('fabrication signatures: migration literals match; genuine timestamps never do', () => {
  // Exactly what the buggy migration wrote
  assert.equal(engine.isFabricatedShiftPair('2026-08-21T09:45:00.000+05:30', '2026-08-21T19:30:00.000+05:30'), true);
  assert.equal(engine.isFabricatedCheckoutOnly('2026-08-21T19:30:00.000+05:30'), true);

  // Genuine system auto-checkout stores UTC "Z" strings — must NOT match
  assert.equal(engine.isFabricatedCheckoutOnly('2026-08-21T14:00:00.000Z'), false);
  // Genuine manual checkout is a Firestore Timestamp object — must NOT match
  assert.equal(engine.isFabricatedCheckoutOnly({ seconds: 1779000000, nanoseconds: 0 }), false);
  assert.equal(engine.isFabricatedCheckoutOnly(null), false);
  // Real check-in with fabricated checkout → checkout-only repair path
  assert.equal(engine.isFabricatedShiftPair('2026-08-21T04:35:00.000Z', '2026-08-21T19:30:00.000+05:30'), false);
});

// ── Production bug-scan regressions (B2, B3, B14, B17, B25) ──────────────────

test('B2 getEmployeeKey: subject identity wins over actor fallback uid', () => {
  // A seeded employee has NO uid/employeeUid, only a synthetic doc id + bare code.
  // The actor (logged-in HR admin) uid must NOT be allowed to key the subject's doc,
  // or two such subjects checked in by one admin collapse into ONE {actorUid}_{date}.
  const seeded = { id: 'emp-KSS2407003', employeeId: 'KSS2407003' };
  const actorUid = 'hr-admin-uid-xyz';
  assert.equal(engine.getEmployeeKey(seeded, actorUid), 'emp-KSS2407003');
  // A real account with its own uid still prefers that uid.
  assert.equal(engine.getEmployeeKey({ uid: 'realuid', id: 'realuid' }, actorUid), 'realuid');
  // Only a bare/empty subject may fall back to the actor uid (last resort).
  assert.equal(engine.getEmployeeKey(null, actorUid), actorUid);
  assert.equal(engine.getEmployeeKey({}, actorUid), actorUid);
});

test('B3 isAttendanceForEmployee: name match is exact, never substring', () => {
  // Distinct people, no shared identity tokens, substring-overlapping names.
  const ram = { fullName: 'Ram' };
  assert.equal(engine.isAttendanceForEmployee({ employeeName: 'Ramesh' }, ram), false,
    '"ram" ⊄ "ramesh" — must not cross-link distinct employees');
  assert.equal(engine.isAttendanceForEmployee({ employeeName: 'Ramkumar Reddy' }, { fullName: 'Ramkumar' }), false);
  // Exact normalized equality still matches (punctuation/spacing tolerant).
  assert.ok(engine.isAttendanceForEmployee({ employeeName: 'R.A.M' }, ram));
  // Identity-token match is unaffected by the name tightening.
  assert.ok(engine.isAttendanceForEmployee({ employeeCode: 'KSS2407003' }, { id: 'x', employeeId: 'KSS2407003' }));
});

test('B14 MAX_BREAK_MINUTES: single shared break cap', () => {
  // Canary: all break-close paths clamp against this one constant (was 120 vs 180).
  assert.equal(engine.MAX_BREAK_MINUTES, 180);
});

test('B17 calculateBreakBreakdown: counts legacy startTime/endTime-only breaks', () => {
  const start = new Date(2026, 7, 20, 13, 0).toISOString();
  const end = new Date(2026, 7, 20, 13, 30).toISOString(); // 30 minutes
  // Legacy shape: only startTime/endTime, no startAt/endAt, no durationMinutes.
  const legacy = [{ type: 'lunch', startTime: start, endTime: end }];
  const bd = engine.calculateBreakBreakdown(legacy, 0);
  assert.equal(bd.mealSecs, 1800, 'legacy meal break must contribute its 30 minutes');
  assert.equal(bd.totalBreakMinutes, 30);
  // The breakdown total must now agree with calculateTotalBreakMinutes on the same input.
  assert.equal(engine.calculateTotalBreakMinutes(legacy), 30);
});

test('B25 isLateCheckIn: grace through 10:15 AM IST, late afterwards', () => {
  // IST-anchored instants — Intl formats in Asia/Kolkata, so the assertions are
  // independent of the machine timezone running the suite.
  assert.equal(engine.isLateCheckIn('2026-08-20T10:00:00+05:30'), false);
  assert.equal(engine.isLateCheckIn('2026-08-20T10:15:00+05:30'), false, '10:15 boundary is on time');
  assert.equal(engine.isLateCheckIn('2026-08-20T10:16:00+05:30'), true);
  assert.equal(engine.isLateCheckIn('2026-08-20T11:30:00+05:30'), true);
  assert.equal(engine.isLateCheckIn('2026-08-20T09:45:00+05:30'), false);
  assert.equal(engine.isLateCheckIn(null), false);
  assert.equal(engine.isLateCheckIn(''), false);
});

test('P0 resolveAttendanceRecord: canonical doc wins even while updatedAt is a pending serverTimestamp', () => {
  // Reproduces the PM report "clicking Break rewrites my check-in time and my
  // working hours drop to 0".
  //
  // startBreak writes `updatedAt: serverTimestamp()`. In the latency-compensated
  // local snapshot Firestore materialises a pending server timestamp as NULL, so
  // the canonical doc's sort key fell back to its checkInAt while a stale
  // duplicate kept a real (later) updatedAt — and the duplicate won the
  // "most recently updated" ranking. The widget then rendered the duplicate's
  // checkInAt and its absent workingMinutes.
  const emp = { id: 'emp-KSS2407009', employeeId: 'KSS2407009', uid: 'uid-KSS2407009' };
  const date = '2026-08-20';
  const canonicalId = engine.getAttendanceDocId('uid-KSS2407009', date);

  const canonical = {
    id: canonicalId,
    employeeId: 'emp-KSS2407009',
    uid: 'uid-KSS2407009',
    date,
    checkInAt: '2026-08-20T04:35:00.000Z', // 10:05 IST — the real check-in
    workingMinutes: 180,
    updatedAt: null                        // pending serverTimestamp mid-break-write
  };
  const staleDuplicate = {
    id: 'legacy-KSS2407009-aug20',
    employeeId: 'emp-KSS2407009',
    date,
    checkInAt: '2026-08-20T09:45:00.000Z', // migration-written, wrong
    updatedAt: '2026-08-20T10:00:00.000Z'  // fresher than the canonical fallback key
  };

  const winner = engine.resolveAttendanceRecord([staleDuplicate, canonical], emp, date);
  assert.equal(winner.id, canonicalId, 'canonical {uid}_{date} doc must win the tie-break');
  assert.equal(winner.checkInAt, '2026-08-20T04:35:00.000Z', 'check-in time must not flap to the duplicate');
  assert.equal(winner.workingMinutes, 180, 'working hours must not collapse to 0');

  // Ordering of the input array must not matter.
  assert.equal(
    engine.resolveAttendanceRecord([canonical, staleDuplicate], emp, date).id,
    canonicalId
  );

  // A blank canonical doc must still NOT mask a duplicate that holds a real shift.
  const blankCanonical = { id: canonicalId, employeeId: 'emp-KSS2407009', date, updatedAt: null };
  assert.equal(
    engine.resolveAttendanceRecord([blankCanonical, staleDuplicate], emp, date).id,
    'legacy-KSS2407009-aug20',
    'a checked-in duplicate still beats a blank canonical doc'
  );
});

// ── Daily roster derivation (absentees / WFH visibility) ─────────────────────

test('P1 buildDailyRoster: absentees are materialised, not silently dropped', () => {
  // The admin portal showed "only presentees" because absence is the ABSENCE of
  // a document — nothing ever writes an 'Absent' record, so filtering the
  // attendance collection by status could never surface a no-show.
  const employees = [
    { id: 'emp-A', employeeId: 'KSS001', fullName: 'Alice', department: 'Eng', status: 'Active', uid: 'uid-A' },
    { id: 'emp-B', employeeId: 'KSS002', fullName: 'Bob', department: 'Eng', status: 'Active', uid: 'uid-B' },
    { id: 'emp-C', employeeId: 'KSS003', fullName: 'Cara', department: 'Ops', status: 'Active', uid: 'uid-C' },
    { id: 'emp-X', employeeId: 'KSS009', fullName: 'Gone', department: 'Ops', status: 'Terminated', uid: 'uid-X' }
  ];
  const date = '2026-08-20'; // a Thursday — a working day
  const attendance = [
    { id: 'uid-A_2026-08-20', employeeId: 'emp-A', employeeCode: 'KSS001', employeeName: 'Alice',
      date, checkInAt: '2026-08-20T04:35:00.000Z', status: 'Present' }
  ];

  // nowMs well after the shift-start grace window so absence is knowable.
  const nowMs = new Date('2026-08-20T14:00:00.000Z').getTime();
  const roster = engine.buildDailyRoster(employees, attendance, date, { nowMs });

  assert.equal(roster.length, 3, 'terminated staff are excluded; the other three appear');
  const byName = Object.fromEntries(roster.map(r => [r.employeeName, r]));
  assert.equal(byName.Alice.status, 'Present');
  assert.equal(byName.Alice.isSynthetic, undefined, 'a real record is passed through untouched');
  assert.equal(byName.Bob.status, 'Absent');
  assert.equal(byName.Bob.isSynthetic, true);
  assert.equal(byName.Bob.checkInAt, null);
  assert.equal(byName.Cara.status, 'Absent');
  assert.ok(!roster.some(r => r.employeeName === 'Gone'), 'terminated employee is not on the roster');
});

test('P1 buildDailyRoster: leave, weekly off and future dates never read as Absent', () => {
  const employees = [
    { id: 'emp-A', employeeId: 'KSS001', fullName: 'Alice', department: 'Eng', status: 'Active', uid: 'uid-A' }
  ];
  const nowMs = new Date('2026-08-20T14:00:00.000Z').getTime();

  // Approved leave covering the day → On Leave, not Absent.
  const leaveRequests = [
    { type: 'Leave', status: 'Approved', employeeId: 'KSS001', startDate: '2026-08-20', endDate: '2026-08-21' }
  ];
  assert.equal(
    engine.buildDailyRoster(employees, [], '2026-08-20', { nowMs, leaveRequests })[0].status,
    'On Leave'
  );

  // 2026-08-23 is a Sunday — the weekly off. Nobody is absent on a non-working day.
  assert.equal(engine.isNonWorkingDay('2026-08-23'), true, 'Sunday is the weekly off');
  assert.equal(engine.isNonWorkingDay('2026-08-22'), false, 'Saturday is a working day (Mon-Sat week)');
  const sunday = engine.buildDailyRoster(employees, [], '2026-08-23', {
    nowMs: new Date('2026-08-23T14:00:00.000Z').getTime()
  });
  assert.equal(sunday[0].status, 'Holiday');

  // A declared holiday behaves the same way.
  assert.equal(
    engine.buildDailyRoster(employees, [], '2026-08-20', { nowMs, holidayDates: ['2026-08-20'] })[0].status,
    'Holiday'
  );

  // A future date yields no absence rows at all.
  assert.equal(engine.buildDailyRoster(employees, [], '2026-08-25', { nowMs }).length, 0);

  // Today, before 10:15 IST, is not yet knowable — 03:00 UTC is 08:30 IST.
  const earlyMorning = new Date('2026-08-20T03:00:00.000Z').getTime();
  assert.equal(engine.buildDailyRoster(employees, [], '2026-08-20', { nowMs: earlyMorning }).length, 0,
    'nobody is absent before the shift-start grace window has elapsed');
});

test('P1 summarizeRoster: present is inclusive of Late and Work From Home', () => {
  const roster = [
    { status: 'Present', checkInAt: 'x' },
    { status: 'Late', checkInAt: 'x' },
    { status: 'Work From Home', checkInAt: 'x' },
    { status: 'Present', checkInAt: 'x', isWfh: true },
    { status: 'Absent' },
    { status: 'Absent' },
    { status: 'On Leave' },
    { status: 'Holiday' }
  ];
  const c = engine.summarizeRoster(roster);
  assert.equal(c.total, 8);
  assert.equal(c.present, 4, 'Present + Late + WFH all count as at-work');
  assert.equal(c.late, 1);
  assert.equal(c.wfh, 2, 'status WFH and the isWfh flag both count');
  assert.equal(c.absent, 2);
  assert.equal(c.onLeave, 1);
  assert.equal(c.holiday, 1);
  // The buckets must partition the roster exactly — no double counting, no gaps.
  assert.equal(c.present + c.absent + c.onLeave + c.holiday, c.total);
});

// ── P2: proficiency / shift timer accuracy ──────────────────────────────────

test('P2 apportionPercentages: buckets always sum to exactly 100, never to a zero bucket', () => {
  // Three equal thirds — naive Math.round gives 33+33+33 = 99, leaving a 1% hole
  // that the old code dumped into "Activity".
  const thirds = engine.apportionPercentages([100, 100, 100]);
  assert.equal(thirds.reduce((a, b) => a + b, 0), 100);

  // Seven buckets of awkward sizes: still exactly 100.
  const awkward = engine.apportionPercentages([3601, 137, 89, 41, 17, 7, 3]);
  assert.equal(awkward.reduce((a, b) => a + b, 0), 100);

  // THE PHANTOM-SEGMENT GUARD: a bucket with zero seconds must never be handed a
  // leftover point, because the UI renders any non-zero percent as a slice.
  const withZeros = engine.apportionPercentages([100, 100, 100, 0, 0, 0, 0]);
  assert.equal(withZeros.reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(withZeros.slice(3), [0, 0, 0, 0], 'zero-second buckets stay at 0%');

  // All-zero input must not divide by zero or fabricate 100%.
  assert.deepEqual(engine.apportionPercentages([0, 0, 0]), [0, 0, 0]);

  // Deterministic for identical inputs — no tie-break jitter between renders.
  assert.deepEqual(
    engine.apportionPercentages([100, 100, 100]),
    engine.apportionPercentages([100, 100, 100])
  );
});

test('P2 computeLiveShiftBreakdown: break seconds are timestamp-exact, not minute-rounded', () => {
  const base = Date.parse('2026-08-22T04:30:00.000Z'); // 10:00 IST
  const now = base + 60 * 60 * 1000;                   // one hour later

  // Three 20-second breaks. The stored durationMinutes field rounds each one UP
  // to a full minute (Math.max(1, Math.round(20000/60000)) === 1), so the old
  // work timer subtracted 180s of break for 60s actually taken — a 2-minute lie
  // that grew with every short break.
  const record = {
    checkInAt: new Date(base).toISOString(),
    checkOutAt: null,
    totalBreakMinutes: 3,
    breaks: [0, 1, 2].map(i => ({
      type: 'Tea Break',
      startAt: new Date(base + (i + 1) * 600000).toISOString(),
      endAt: new Date(base + (i + 1) * 600000 + 20000).toISOString(),
      durationMinutes: 1
    }))
  };

  const r = engine.computeLiveShiftBreakdown(record, now);
  assert.equal(r.elapsedSecs, 3600);
  assert.equal(r.breakSecs, 60, 'timestamps win over the rounded durationMinutes field');
  assert.equal(r.teaSecs, 60);
  assert.equal(r.workSecs, 3540, 'work is elapsed minus the EXACT break time');
  assert.equal(r.workSecs + r.breakSecs, r.elapsedSecs, 'work + break reconstructs elapsed exactly');

  // durationMinutes is still honoured when timestamps are unusable (legacy rows).
  const legacy = engine.computeLiveShiftBreakdown(
    { checkInAt: new Date(base).toISOString(), breaks: [{ type: 'Meal Break', durationMinutes: 30 }] },
    now
  );
  assert.equal(legacy.mealSecs, 1800);
  assert.equal(legacy.workSecs, 1800);
});

test('P2 computeLiveShiftBreakdown: no phantom Activity segment and percentages total 100', () => {
  const base = Date.parse('2026-08-22T04:30:00.000Z');
  const now = base + 3 * 60 * 60 * 1000; // 3h elapsed

  // Exactly three equal 20-minute breaks + work. Under the old arithmetic the six
  // independently rounded percentages left a remainder that rendered as a cyan
  // "Activity" slice even though no activity break was ever taken.
  const record = {
    checkInAt: new Date(base).toISOString(),
    breaks: [
      { type: 'Tea Break', startAt: new Date(base + 1000).toISOString(), endAt: new Date(base + 1000 + 1200000).toISOString() },
      { type: 'Meal Break', startAt: new Date(base + 3600000).toISOString(), endAt: new Date(base + 3600000 + 1200000).toISOString() },
      { type: 'Team Huddle', startAt: new Date(base + 7200000).toISOString(), endAt: new Date(base + 7200000 + 1200000).toISOString() }
    ]
  };

  const r = engine.computeLiveShiftBreakdown(record, now);
  assert.equal(r.activitySecs, 0);
  assert.ok(!r.segments.some(s => s.key === 'activity'), 'no activity slice without an activity break');
  assert.equal(r.segments.reduce((a, s) => a + s.percent, 0), 100, 'slices tile the pie exactly');
  assert.deepEqual(r.segments.map(s => s.key), ['work', 'tea', 'meal', 'huddle'], 'work first, then breaks in order');
  assert.equal(r.workSecs, 10800 - 3600);
  assert.equal(r.productivityPercent, 67);

  // Every non-zero segment must carry a non-zero percent, or it renders invisible.
  for (const s of r.segments) assert.ok(s.percent > 0, `${s.key} has time but 0%`);
});

test('P2 computeLiveShiftBreakdown: open breaks tick live, closed shifts freeze, garbage never goes negative', () => {
  const base = Date.parse('2026-08-22T04:30:00.000Z');

  // An open break must be counted up to `now` and mark the shift as on-break.
  const open = {
    checkInAt: new Date(base).toISOString(),
    breaks: [{ type: 'Meal Break', startAt: new Date(base + 3600000).toISOString() }]
  };
  const live = engine.computeLiveShiftBreakdown(open, base + 3600000 + 90000);
  assert.equal(live.isOnBreak, true);
  assert.equal(live.activeBreakType, 'Meal Break');
  assert.equal(live.activeBreakSecs, 90);
  assert.equal(live.mealSecs, 90);
  assert.equal(live.workSecs, 3600, 'the work timer pauses for the whole open break');

  // A checked-out shift is frozen: advancing the clock must not move any number.
  const closed = {
    checkInAt: new Date(base).toISOString(),
    checkOutAt: new Date(base + 8 * 3600000).toISOString(),
    breaks: [{ type: 'Tea Break', startAt: new Date(base + 3600000).toISOString(), endAt: new Date(base + 3600000 + 900000).toISOString() }]
  };
  const a = engine.computeLiveShiftBreakdown(closed, base + 8 * 3600000 + 1000);
  const b = engine.computeLiveShiftBreakdown(closed, base + 30 * 3600000);
  assert.equal(a.isShiftComplete, true);
  assert.equal(a.elapsedSecs, 8 * 3600);
  assert.equal(a.workSecs, 8 * 3600 - 900);
  assert.equal(b.workSecs, a.workSecs, 'a closed shift does not keep accruing');
  assert.equal(b.isOnBreak, false);

  // A break left open when the shift closed must not outlive the shift.
  const forgotten = engine.computeLiveShiftBreakdown(
    {
      checkInAt: new Date(base).toISOString(),
      checkOutAt: new Date(base + 3600000).toISOString(),
      breaks: [{ type: 'Tea Break', startAt: new Date(base + 1800000).toISOString() }]
    },
    base + 100 * 3600000
  );
  assert.equal(forgotten.elapsedSecs, 3600);
  assert.equal(forgotten.teaSecs, 1800, 'the open break is capped at check-out, not at now');
  assert.equal(forgotten.workSecs, 1800);

  // Corrupted data: breaks longer than the shift must clamp, never produce
  // negative work or a percent total above 100.
  const corrupt = engine.computeLiveShiftBreakdown(
    {
      checkInAt: new Date(base).toISOString(),
      breaks: [{ type: 'Meal Break', durationMinutes: 600 }]
    },
    base + 3600000
  );
  assert.equal(corrupt.workSecs, 0);
  assert.equal(corrupt.breakSecs, 3600);
  assert.ok(corrupt.segments.reduce((s, x) => s + x.percent, 0) <= 100);

  // No check-in at all: everything zero, nothing thrown.
  const none = engine.computeLiveShiftBreakdown({ checkInAt: null, breaks: [] }, base);
  assert.equal(none.isCheckedIn, false);
  assert.equal(none.elapsedSecs, 0);
  assert.deepEqual(none.segments, []);
  assert.equal(engine.computeLiveShiftBreakdown(null, base).workSecs, 0);
});

test('P2 formatDuration / formatClock / buildPieSlices render safely at the edges', () => {
  assert.equal(engine.formatDuration(0), '0h 00m');
  assert.equal(engine.formatDuration(3661, true), '1h 01m 01s');
  assert.equal(engine.formatDuration(-500), '0h 00m', 'never renders a negative duration');
  assert.equal(engine.formatDuration(NaN, true), '0h 00m 00s');
  assert.equal(engine.formatClock(59), '00:59');
  assert.equal(engine.formatClock(3600), '1:00:00');

  // A single 100% slice cannot be drawn as one 360° arc (it collapses to a
  // zero-length path), so it must come back as two half-arcs.
  const solo = engine.buildPieSlices([{ key: 'work', label: 'Work', seconds: 100, percent: 100, color: '#000' }], 42, 26);
  assert.equal(solo.length, 1);
  assert.ok(solo[0].d.split(' A ').length - 1 >= 2, 'full circle is drawn with multiple arcs');

  // Multi-slice: one path per segment, all non-empty.
  const many = engine.buildPieSlices([
    { key: 'work', label: 'Work', seconds: 60, percent: 60, color: '#0f0' },
    { key: 'meal', label: 'Meal Break', seconds: 30, percent: 30, color: '#f00' },
    { key: 'tea', label: 'Tea Break', seconds: 10, percent: 10, color: '#ff0' }
  ], 42, 26);
  assert.equal(many.length, 3);
  for (const s of many) assert.ok(s.d.startsWith('M ') && s.d.length > 20, `${s.key} path is malformed`);
  assert.deepEqual(engine.buildPieSlices([], 42, 26), []);
});

test('P2 classifyBreakType buckets every real break label used by the portal', () => {
  assert.equal(engine.classifyBreakType('Tea Break'), 'tea');
  assert.equal(engine.classifyBreakType('Coffee'), 'tea');
  assert.equal(engine.classifyBreakType('Meal Break'), 'meal');
  assert.equal(engine.classifyBreakType('Lunch'), 'meal');
  assert.equal(engine.classifyBreakType('Team Huddle'), 'huddle');
  assert.equal(engine.classifyBreakType('Team Meeting'), 'meeting');
  assert.equal(engine.classifyBreakType('Training'), 'training');
  assert.equal(engine.classifyBreakType('Skill Attainment'), 'training');
  // Unknown / missing labels fall into activity rather than being dropped, so no
  // logged break can ever vanish from the totals.
  assert.equal(engine.classifyBreakType('Something Else'), 'activity');
  assert.equal(engine.classifyBreakType(undefined), 'activity');
});

test('P2 calculateBreakBreakdown: team breaks no longer leak into the tea bucket', () => {
  const base = Date.parse('2026-08-22T04:30:00.000Z');
  const mk = (type, mins) => ({
    type,
    startAt: new Date(base).toISOString(),
    endAt: new Date(base + mins * 60000).toISOString(),
    durationMinutes: mins
  });
  // "Team Huddle" and "Team Meeting" both contain the substring 'tea'. The old
  // inlined includes('tea') check ran first, so huddle/meeting were always 0.
  const r = engine.calculateBreakBreakdown([mk('Team Huddle', 10), mk('Team Meeting', 20), mk('Tea Break', 5)]);
  assert.equal(r.huddleSecs, 600);
  assert.equal(r.meetingSecs, 1200);
  assert.equal(r.teaSecs, 300, 'only the genuine tea break lands in tea');
  assert.equal(r.totalBreakSecs, 2100);
});

// ── Items #6 / #10: month roster + calendar ─────────────────────────────────

test('#6 buildEmployeeMonthRoster: one row per elapsed working day, absences included', () => {
  const emp = { id: 'emp-A', employeeId: 'KSS001', fullName: 'Alice A', uid: 'uid-A', status: 'Active', department: 'Eng' };
  // August 2026: the 1st is a Saturday, so the 2nd/9th/16th/23rd/30th are Sundays.
  const attendance = [
    { id: 'r1', employeeId: 'emp-A', date: '2026-08-03', status: 'Present', checkInAt: '2026-08-03T04:30:00.000Z', workingMinutes: 480, totalBreakMinutes: 45 },
    { id: 'r2', employeeId: 'emp-A', date: '2026-08-04', status: 'Late', checkInAt: '2026-08-04T05:10:00.000Z', workingMinutes: 450, totalBreakMinutes: 30 },
    { id: 'r3', employeeId: 'emp-A', date: '2026-08-05', status: 'Work From Home', isWfh: true, checkInAt: '2026-08-05T04:30:00.000Z', workingMinutes: 470, totalBreakMinutes: 20 }
  ];
  // Freeze "now" at 2026-08-08 18:00 IST so the 8th has fully elapsed but the
  // rest of the month has not happened yet.
  const nowMs = Date.parse('2026-08-08T12:30:00.000Z');

  const roster = engine.buildEmployeeMonthRoster(emp, attendance, '2026-08', { nowMs });
  const dates = roster.map(r => r.date);

  // Every elapsed day Aug 1 (Sat) .. Aug 8 (Sat), plus the remaining Sundays:
  // a future day is materialised ONLY when it carries positive information (a
  // weekly off, a declared holiday, or approved upcoming leave). A future
  // WORKING day is never materialised, because absence cannot be asserted for a
  // day nobody has lived through yet.
  assert.deepEqual(dates, [
    '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04',
    '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08',
    '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30'
  ]);
  for (const d of dates.filter(x => x > '2026-08-08')) {
    assert.equal(
      roster.find(r => r.date === d).status, 'Holiday',
      `future day ${d} may only appear as a non-working day`
    );
  }

  const byDate = Object.fromEntries(roster.map(r => [r.date, r]));
  assert.equal(byDate['2026-08-02'].status, 'Holiday', 'Sunday is the weekly off');
  assert.equal(byDate['2026-08-01'].status, 'Absent', 'Saturday IS a working day here');
  assert.equal(byDate['2026-08-03'].status, 'Present');
  assert.equal(byDate['2026-08-04'].status, 'Late');
  assert.equal(byDate['2026-08-05'].status, 'Work From Home');
  assert.equal(byDate['2026-08-06'].status, 'Absent');
  assert.equal(byDate['2026-08-03'].isSynthetic, undefined, 'real records are not marked synthetic');
  assert.equal(byDate['2026-08-06'].isSynthetic, true, 'derived absences are marked synthetic');

  // An unknown month key must not throw or invent rows.
  assert.deepEqual(engine.buildEmployeeMonthRoster(emp, attendance, 'garbage', { nowMs }), []);
  assert.deepEqual(engine.buildEmployeeMonthRoster(null, attendance, '2026-08', { nowMs }), []);
});

test('#6 summarizeMonthRoster: attendance rate excludes holidays from the denominator', () => {
  const emp = { id: 'emp-A', employeeId: 'KSS001', fullName: 'Alice A', uid: 'uid-A', status: 'Active' };
  const attendance = [
    { id: 'r1', employeeId: 'emp-A', date: '2026-08-03', status: 'Present', checkInAt: '2026-08-03T04:30:00.000Z', workingMinutes: 480, totalBreakMinutes: 45 },
    { id: 'r2', employeeId: 'emp-A', date: '2026-08-04', status: 'Late', checkInAt: '2026-08-04T05:10:00.000Z', workingMinutes: 450, totalBreakMinutes: 30 },
    { id: 'r3', employeeId: 'emp-A', date: '2026-08-05', status: 'Work From Home', isWfh: true, checkInAt: '2026-08-05T04:30:00.000Z', workingMinutes: 470, totalBreakMinutes: 20 }
  ];
  const nowMs = Date.parse('2026-08-08T12:30:00.000Z');
  const roster = engine.buildEmployeeMonthRoster(emp, attendance, '2026-08', { nowMs });
  const s = engine.summarizeMonthRoster(roster, '2026-08', { nowMs });

  assert.equal(s.monthKey, '2026-08');
  // 8 elapsed rows, one of them a Sunday => 7 elapsed working days. The four
  // UPCOMING Sundays in the roster must not inflate this.
  assert.equal(s.workingDays, 7);
  assert.equal(s.holiday, 5, 'holiday reports the whole month, upcoming Sundays included');
  assert.equal(s.present, 3, 'Present + Late + WFH all count as attended');
  assert.equal(s.late, 1);
  assert.equal(s.wfh, 1);
  assert.equal(s.absent, 4);
  // 3 of 7 elapsed working days, NOT 3 of 12 — future days and Sundays must not
  // count against attendance.
  assert.equal(s.attendanceRate, Math.round((3 / 7) * 100));
  assert.equal(s.totalWorkedMinutes, 1400);
  assert.equal(s.totalBreakMinutes, 95);
  assert.equal(s.averageWorkedMinutes, Math.round(1400 / 3));

  // Approved UPCOMING leave must be reported without being charged as an elapsed
  // working day — otherwise booking leave silently lowers this month's rate.
  const withFutureLeave = engine.summarizeMonthRoster(
    roster.concat([
      { id: 'f1', date: '2026-08-20', status: 'On Leave', isSynthetic: true, workingMinutes: 0, totalBreakMinutes: 0 },
      { id: 'f2', date: '2026-08-21', status: 'On Leave', isSynthetic: true, workingMinutes: 0, totalBreakMinutes: 0 }
    ]),
    '2026-08',
    { nowMs }
  );
  assert.equal(withFutureLeave.onLeave, 2, 'upcoming leave is still surfaced');
  assert.equal(withFutureLeave.workingDays, 7, 'upcoming leave adds no elapsed working days');
  assert.equal(withFutureLeave.attendanceRate, s.attendanceRate, 'booking leave cannot lower the rate');

  // An empty month must not divide by zero.
  const zero = engine.summarizeMonthRoster([], '2026-01', { nowMs });
  assert.equal(zero.attendanceRate, 0);
  assert.equal(zero.averageWorkedMinutes, 0);
  assert.equal(zero.workingDays, 0);
});

test('#10 buildMonthCalendar: Monday-first grid, rectangular, days land on the right weekday', () => {
  const roster = [
    { id: 'r1', date: '2026-08-03', status: 'Present', workingMinutes: 480 },
    { id: 'r2', date: '2026-08-06', status: 'Absent', isSynthetic: true }
  ];
  const cells = engine.buildMonthCalendar('2026-08', roster, { todayStr: '2026-08-08' });

  // Rectangular grid, whole weeks only.
  assert.equal(cells.length % 7, 0);

  // 2026-08-01 is a Saturday. Monday-first => index 5 within the first week.
  const first = cells.findIndex(c => c.dateStr === '2026-08-01');
  assert.equal(first, 5, 'Aug 1 2026 is a Saturday and must sit in the 6th column');
  assert.equal(cells.slice(0, 5).every(c => c.dateStr === null), true, 'leading cells are padding');

  // All 31 days present exactly once.
  const real = cells.filter(c => c.dateStr);
  assert.equal(real.length, 31);
  assert.equal(new Set(real.map(c => c.dateStr)).size, 31);

  const byDate = Object.fromEntries(real.map(c => [c.dateStr, c]));
  assert.equal(byDate['2026-08-03'].record.status, 'Present', 'roster rows are attached to their day');
  assert.equal(byDate['2026-08-06'].record.status, 'Absent');
  assert.equal(byDate['2026-08-04'].record, null, 'days with no roster row carry null, not undefined');
  assert.equal(byDate['2026-08-08'].isToday, true);
  assert.equal(byDate['2026-08-09'].isFuture, true);
  assert.equal(byDate['2026-08-08'].isFuture, false);
  assert.equal(byDate['2026-08-02'].isNonWorking, true, 'Aug 2 2026 is a Sunday');
  assert.equal(byDate['2026-08-03'].isNonWorking, false);

  assert.deepEqual(engine.buildMonthCalendar('nope', roster, {}), []);
});

test('#10 month key helpers roll over years and are timezone-independent', () => {
  assert.equal(engine.getMonthKey('2026-08-22'), '2026-08');
  assert.equal(engine.shiftMonthKey('2026-01', -1), '2025-12');
  assert.equal(engine.shiftMonthKey('2026-12', 1), '2027-01');
  assert.equal(engine.shiftMonthKey('2026-08', -8), '2025-12');
  assert.equal(engine.formatMonthKey('2026-08'), 'August 2026');

  // Weekday names must not shift with the host timezone: 'YYYY-MM-DD' parses as
  // UTC midnight, so any device behind UTC would otherwise read a day early.
  assert.equal(engine.getDayName('2026-08-22'), 'Sat');
  assert.equal(engine.getDayName('2026-08-23', true), 'Sunday');
  assert.equal(engine.getDayName(''), '');

  assert.equal(engine.listDatesInMonth('2026-02').length, 28);
  assert.equal(engine.listDatesInMonth('2024-02').length, 29, 'leap year');
  assert.equal(engine.listDatesInMonth('2026-08').length, 31);
  assert.deepEqual(engine.listDatesInMonth('2026-13'), [], 'invalid month yields nothing');
});

// ── Item #15: PM work-duration table (Mon–Sat, live + checked-out) ───────────
const IST = 5.5 * 60 * 60 * 1000;
/** Build an epoch ms for a wall-clock IST time on a date, device-timezone-proof. */
const ist = (dateStr, h, m = 0, s = 0) => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, h, m, s, 0) - IST;
};

test('#15 buildWorkWeek spans Monday to Saturday and carries date + day name', () => {
  // 2026-08-20 is a Thursday; its work week is Mon 17th → Sat 22nd.
  const week = engine.buildWorkWeek('2026-08-20', { nowMs: ist('2026-08-20', 14) });
  assert.equal(week.length, 6, 'Saturday is a working day and must not be dropped');
  assert.deepEqual(week.map(d => d.dateStr), [
    '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22'
  ]);
  assert.deepEqual(week.map(d => d.dayName), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

  // The exact compact format the table header asks for: 17-8-26.
  assert.equal(week[0].shortDate, '17-8-26');
  assert.equal(engine.formatShortDate('2026-12-05'), '5-12-26');
  assert.equal(engine.formatShortDate('garbage'), 'garbage');

  assert.deepEqual(week.map(d => d.isToday), [false, false, false, true, false, false]);
  assert.deepEqual(week.map(d => d.isFuture), [false, false, false, false, true, true]);
  // Sunday is the only weekly off, so no Mon–Sat day is non-working by default.
  assert.ok(week.every(d => !d.isNonWorking));

  // Sunday belongs to the week that just ENDED, not the one starting next day.
  const sun = engine.buildWorkWeek('2026-08-23', { nowMs: ist('2026-08-23', 12) });
  assert.equal(sun[0].dateStr, '2026-08-17', 'Sunday anchors back to the preceding Monday');

  // A declared holiday inside the work week is flagged.
  const withHoliday = engine.buildWorkWeek('2026-08-20', {
    nowMs: ist('2026-08-20', 14), holidayDates: ['2026-08-19']
  });
  assert.deepEqual(withHoliday.map(d => d.isNonWorking), [false, false, true, false, false, false]);
});

test('#15 resolveDayWorkSummary: checking out updates the duration and the status', () => {
  const now = ist('2026-08-20', 15, 0);

  // Live shift: in at 10:00, on-screen at 15:00, one closed 30m meal break.
  const live = {
    checkInAt: new Date(ist('2026-08-20', 10, 0)).toISOString(),
    breaks: [{
      type: 'Meal Break',
      startAt: new Date(ist('2026-08-20', 13, 0)).toISOString(),
      endAt: new Date(ist('2026-08-20', 13, 30)).toISOString()
    }],
    status: 'Present'
  };
  const a = engine.resolveDayWorkSummary(live, '2026-08-20', now);
  assert.equal(a.state, 'live');
  assert.equal(a.isLive, true, 'an open shift today is still accruing');
  assert.equal(a.workedMinutes, 4 * 60 + 30, '5h elapsed minus 30m break');
  assert.equal(a.breakMinutes, 30);
  assert.equal(a.workedHours, 4.5);

  // Checking out at 15:00 must FREEZE the same number, not zero it and not keep
  // climbing: this is the "once checked out the data must update" contract.
  const closed = { ...live, checkOutAt: new Date(ist('2026-08-20', 15, 0)).toISOString() };
  const later = ist('2026-08-20', 18, 30);
  const b = engine.resolveDayWorkSummary(closed, '2026-08-20', later);
  assert.equal(b.state, 'complete');
  assert.equal(b.isLive, false);
  assert.equal(b.workedMinutes, a.workedMinutes, 'checkout freezes the duration');
  assert.ok(b.checkOutMs !== null);

  // A stale stored workingMinutes must never win over the timestamps -- it is
  // only written at check-out, so trusting it made live shifts read 0h all day.
  const stale = { ...closed, workingMinutes: 0 };
  assert.equal(engine.resolveDayWorkSummary(stale, '2026-08-20', later).workedMinutes, 270);

  // No record at all: zeroed, and explicitly NOT fabricated into a full day.
  const none = engine.resolveDayWorkSummary(null, '2026-08-20', now);
  assert.equal(none.state, 'none');
  assert.equal(none.workedMinutes, 0);
  assert.equal(none.checkInMs, null);
});

test('#15 resolveDayWorkSummary caps a forgotten check-out at its own 7 PM', () => {
  // Checked in Monday, never checked out. Viewed on Saturday.
  const rec = { checkInAt: new Date(ist('2026-08-17', 10, 0)).toISOString(), breaks: [] };
  const saturday = ist('2026-08-22', 16, 0);
  const s = engine.resolveDayWorkSummary(rec, '2026-08-17', saturday);

  assert.equal(s.state, 'missing-checkout');
  assert.equal(s.isLive, false, 'a past open shift is not live');
  assert.equal(s.workedMinutes, engine.SHIFT_TOTAL_MINUTES,
    'capped at one rostered shift, not the 126 hours since Monday morning');

  // Today's shift after 7 PM stops growing too.
  const todayLate = ist('2026-08-22', 21, 0);
  const t = engine.resolveDayWorkSummary(
    { checkInAt: new Date(ist('2026-08-22', 10, 0)).toISOString(), breaks: [] },
    '2026-08-22', todayLate
  );
  assert.equal(t.isLive, false, 'past the 7 PM cap it is no longer ticking');
  assert.equal(t.workedMinutes, engine.SHIFT_TOTAL_MINUTES);

  assert.equal(engine.getShiftEndMs('2026-08-17'), ist('2026-08-17', 19, 0));
  assert.equal(engine.getShiftStartMs('2026-08-17'), ist('2026-08-17', 10, 0));
  assert.equal(engine.getShiftEndMs('nope'), null);
});

test('#15 resolveDayWorkSummary flags an open break and never over-bills it', () => {
  const now = ist('2026-08-20', 14, 0);
  const rec = {
    checkInAt: new Date(ist('2026-08-20', 10, 0)).toISOString(),
    breaks: [{ type: 'Team Huddle', startAt: new Date(ist('2026-08-20', 13, 45)).toISOString() }]
  };
  const s = engine.resolveDayWorkSummary(rec, '2026-08-20', now);
  assert.equal(s.state, 'on-break');
  assert.equal(s.isOnBreak, true);
  assert.equal(s.activeBreakType, 'Team Huddle');
  // 4h elapsed, 15m of it inside the still-open break.
  assert.equal(s.breakMinutes, 15);
  assert.equal(s.workedMinutes, 225);

  // A break left open across check-out cannot outlive the shift.
  const closed = { ...rec, checkOutAt: new Date(ist('2026-08-20', 14, 0)).toISOString() };
  const s2 = engine.resolveDayWorkSummary(closed, '2026-08-20', ist('2026-08-20', 23, 0));
  assert.equal(s2.breakMinutes, 15);
  assert.equal(s2.workedMinutes, 225);
  assert.equal(s2.isOnBreak, false, 'a closed shift has no active break');
});

test('#15 buildWeekWorkRow totals six days and ignores days that have not happened', () => {
  const emp = { id: 'emp-KSS2407003', uid: 'uid-KSS2407003', employeeId: 'KSS2407003', fullName: 'Asha R' };
  const now = ist('2026-08-20', 15, 0); // Thursday afternoon
  const week = engine.buildWorkWeek('2026-08-20', { nowMs: now });

  const day = (dateStr, inH, outH) => ({
    id: `${emp.uid}_${dateStr}`,
    employeeId: emp.id,
    employeeCode: emp.employeeId,
    date: dateStr,
    status: 'Present',
    breaks: [],
    checkInAt: new Date(ist(dateStr, inH, 0)).toISOString(),
    ...(outH ? { checkOutAt: new Date(ist(dateStr, outH, 0)).toISOString() } : {})
  });

  const attendance = [
    day('2026-08-17', 10, 19),  // 9h
    day('2026-08-18', 10, 19),  // 9h
    // Wednesday absent
    day('2026-08-20', 10, null) // live, 5h so far
  ];

  const row = engine.buildWeekWorkRow(week, emp, attendance, { nowMs: now });
  assert.equal(row.days.length, 6);
  assert.equal(row.totalWorkedMinutes, 9 * 60 + 9 * 60 + 5 * 60);
  assert.equal(row.totalWorkedHours, 23);
  assert.equal(row.daysPresent, 3);
  assert.equal(row.isLive, true);

  // Fri + Sat have not happened: they are neither absences nor expected hours.
  assert.equal(row.daysAbsent, 1, 'only Wednesday is an absence');
  assert.equal(row.expectedMinutes, 4 * engine.SHIFT_TOTAL_MINUTES, 'Mon–Thu only');

  // Approved leave removes the day from the denominator instead of counting as
  // an absence, so taking sanctioned leave cannot look like truancy.
  const leave = [{
    status: 'Approved', type: 'Leave', employeeId: emp.employeeId,
    startDate: '2026-08-19', endDate: '2026-08-19'
  }];
  const onLeave = engine.buildWeekWorkRow(week, emp, attendance, { nowMs: now, leaveRequests: leave });
  assert.equal(onLeave.daysAbsent, 0);
  assert.equal(onLeave.expectedMinutes, 3 * engine.SHIFT_TOTAL_MINUTES);
  assert.ok(onLeave.utilizationPercent > row.utilizationPercent);

  // Nothing expected yet (Monday 9 AM, before the shift) must not divide by zero.
  const monday = engine.buildWorkWeek('2026-08-17', { nowMs: ist('2026-08-17', 9, 0) });
  const empty = engine.buildWeekWorkRow(monday, emp, [], { nowMs: ist('2026-08-17', 9, 0) });
  assert.equal(empty.utilizationPercent, 0);
  assert.equal(empty.totalWorkedMinutes, 0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Item #17 — "hr remove all the mock data and update on from this month"
 * ──────────────────────────────────────────────────────────────────────────── */

test('#17 payroll basis is scoped to its own month, not to all history', () => {
  const emp = { id: 'emp-KSS2407003', uid: 'uid-KSS2407003', employeeId: 'KSS2407003', fullName: 'Asha R' };
  const day = dateStr => ({
    id: `${emp.uid}_${dateStr}`,
    employeeId: emp.id,
    employeeCode: emp.employeeId,
    date: dateStr,
    status: 'Present',
    breaks: [],
    checkInAt: new Date(ist(dateStr, 10, 0)).toISOString(),
    checkOutAt: new Date(ist(dateStr, 19, 0)).toISOString()
  });

  // Two July days and two August days. The old view filtered by employee but
  // never by month, so August payroll counted all four.
  const attendance = [day('2026-07-20'), day('2026-07-21'), day('2026-08-17'), day('2026-08-18')];
  const now = ist('2026-08-20', 15, 0);

  const aug = engine.buildPayrollAttendanceBasis(emp, attendance, '2026-08', { nowMs: now });
  assert.equal(aug.presentDays, 2, 'July must not leak into August');
  assert.equal(aug.payableDays, 2);
  assert.equal(aug.monthKey, '2026-08');

  const jul = engine.buildPayrollAttendanceBasis(emp, attendance, '2026-07', { nowMs: now });
  assert.equal(jul.presentDays, 2);
  assert.equal(jul.isPartialMonth, false, 'a month that has ended is final');
  assert.equal(aug.isPartialMonth, true, 'the current month is still provisional');
});

test('#17 an employee with no records is never credited with days', () => {
  const emp = { id: 'emp-KSS2407009', uid: 'uid-KSS2407009', employeeId: 'KSS2407009', fullName: 'Ravi K' };
  const now = ist('2026-08-20', 15, 0);
  const basis = engine.buildPayrollAttendanceBasis(emp, [], '2026-08', { nowMs: now });

  // The old fallback paid `22 - (idx % 2)` days to someone who never checked in.
  assert.equal(basis.hasNoData, true);
  assert.equal(basis.presentDays, 0);
  assert.equal(basis.payableDays, 0);

  // Only ELAPSED rostered days can be absences; the rest of the month is unknown.
  assert.equal(basis.absentDays, basis.workingDays);
  assert.equal(basis.lossOfPayDays, basis.workingDays);
  assert.ok(basis.workingDays > 0 && basis.workingDays < basis.rosteredDays,
    'mid-month, elapsed rostered days are a strict subset of the month');
});

test('#17 approved leave and holidays are paid; only absence is loss of pay', () => {
  const emp = { id: 'emp-KSS2407004', uid: 'uid-KSS2407004', employeeId: 'KSS2407004', fullName: 'Meera S' };
  const now = ist('2026-08-20', 20, 0); // Thursday, after the shift closed

  const day = (dateStr, status) => ({
    id: `${emp.uid}_${dateStr}`,
    employeeId: emp.id,
    employeeCode: emp.employeeId,
    date: dateStr,
    status,
    breaks: [],
    checkInAt: new Date(ist(dateStr, status === 'Late' ? 10 : 10, 0)).toISOString(),
    checkOutAt: new Date(ist(dateStr, status === 'Half Day' ? 14 : 19, 0)).toISOString()
  });

  // Aug 2026: 1st..20th elapsed. Mon–Sat rostered, Sundays (2,9,16) off.
  const attendance = [
    day('2026-08-17', 'Present'),
    day('2026-08-18', 'Late'),
    day('2026-08-19', 'Work From Home'),
    day('2026-08-20', 'Half Day')
  ];
  const leaveRequests = [{
    status: 'Approved', type: 'Leave', employeeId: emp.employeeId,
    startDate: '2026-08-13', endDate: '2026-08-14'
  }];
  const holidayDates = ['2026-08-15']; // Independence Day, a rostered Saturday

  const basis = engine.buildPayrollAttendanceBasis(emp, attendance, '2026-08', {
    nowMs: now, leaveRequests, holidayDates
  });

  // `present` is inclusive of Late, WFH and Half Day everywhere in the engine.
  assert.equal(basis.presentDays, 4);
  assert.equal(basis.lateDays, 1);
  assert.equal(basis.wfhDays, 1);
  assert.equal(basis.halfDays, 1);
  assert.equal(basis.leaveDays, 2);
  // Elapsed non-working days only: Sundays Aug 2, 9, 16 plus the declared 15th.
  // Counting the whole month here would report 6 against 15 working days.
  assert.equal(basis.holidayDays, 4);

  // 4 attended (one of them a half) + 2 paid leave = 5.5 payable days.
  assert.equal(basis.payableDays, 5.5);
  // The holiday is excluded from the roster entirely, so it is neither payable
  // nor deductible -- it must not appear in loss of pay.
  assert.equal(basis.lossOfPayDays, basis.absentDays);
  assert.ok(basis.lossOfPayDays > 0, 'earlier August days really are unaccounted');

  // Every elapsed rostered *working* day is either attended or an absence.
  // `workingDays` already excludes leave and holidays (it is total − holiday −
  // onLeave), so leave must NOT appear in this identity.
  assert.equal(
    basis.presentDays + basis.absentDays,
    basis.workingDays,
    'no elapsed working day is double-counted or dropped'
  );

  // A declared holiday shrinks the pro-rata denominator rather than the numerator.
  const noHoliday = engine.buildPayrollAttendanceBasis(emp, attendance, '2026-08', { nowMs: now, leaveRequests });
  assert.equal(basis.rosteredDays, noHoliday.rosteredDays - 1);
});

test('#17 listPayrollMonths starts at the current month and walks backwards', () => {
  const now = ist('2026-08-20', 15, 0);
  const months = engine.listPayrollMonths(3, now);
  assert.deepEqual(months.map(m => m.key), ['2026-08', '2026-07', '2026-06']);
  assert.equal(months[0].label, 'August 2026');

  // Crossing a year boundary must not produce month 0 or 13.
  const jan = engine.listPayrollMonths(3, ist('2026-01-05', 9, 0));
  assert.deepEqual(jan.map(m => m.key), ['2026-01', '2025-12', '2025-11']);
  assert.equal(jan[1].label, 'December 2025');

  // The list always contains the month it was asked about, so "this month's
  // payroll" is reachable on any date -- the hardcoded two-option selector was
  // unable to open September 2026 at all.
  assert.equal(engine.listPayrollMonths(12, ist('2026-09-01', 10, 0))[0].key, '2026-09');
  assert.equal(engine.listPayrollMonths(0, now).length, 1, 'never returns an empty selector');
});

test('#17 the seeded historical-attendance generator is gone', () => {
  // It fabricated 90 days of check-ins, breaks and Late/WFH statuses from
  // Math.sin(seed). Nothing imported it, but any future import would have fed
  // invented history straight into payroll.
  assert.equal(typeof engine.generateHistoricalAttendance, 'undefined');
});
