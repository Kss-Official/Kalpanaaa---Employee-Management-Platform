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
