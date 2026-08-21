import test from 'node:test';
import assert from 'node:assert/strict';

// Helper simulating FCM Multicast Audience Matcher
function matchFcmAudience(tokenDoc, audience) {
  if (!audience || audience.length === 0) return false;
  if (audience.includes('ALL')) return true;
  if (tokenDoc.role && audience.includes(tokenDoc.role)) return true;
  if (tokenDoc.employeeId && audience.includes(tokenDoc.employeeId)) return true;
  return false;
}

// Helper simulating Multicast Batch Chunking
function chunkBatch(tokens, batchSize = 500) {
  const batches = [];
  for (let i = 0; i < tokens.length; i += batchSize) {
    batches.push(tokens.slice(i, i + batchSize));
  }
  return batches;
}

// Helper simulating Token ID Hash Suffix
function getDeterministicTokenDocId(token) {
  return token.slice(-32).replace(/[^a-zA-Z0-9_-]/g, '_');
}

test('FCM: token doc ID is deterministic and safe for Firestore', () => {
  const token = 'c8Y9q1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_1234567890';
  const id1 = getDeterministicTokenDocId(token);
  const id2 = getDeterministicTokenDocId(token);
  assert.equal(id1, id2);
  assert.equal(id1.length, 32);
  assert.match(id1, /^[a-zA-Z0-9_-]+$/);
});

test('FCM: audience matching matches ALL, specific role, and specific employeeId', () => {
  const empToken = { token: 'tok-1', role: 'EMPLOYEE', employeeId: 'KSS2407004' };
  const hrToken = { token: 'tok-2', role: 'HR_ADMIN', employeeId: 'KSS2407002' };
  const pmToken = { token: 'tok-3', role: 'PROJECT_MANAGER', employeeId: 'KSS2407003' };

  // Broadcast to ALL
  assert.equal(matchFcmAudience(empToken, ['ALL']), true);
  assert.equal(matchFcmAudience(hrToken, ['ALL']), true);

  // Role targeted (Admins only)
  assert.equal(matchFcmAudience(empToken, ['SUPER_ADMIN', 'HR_ADMIN']), false);
  assert.equal(matchFcmAudience(hrToken, ['SUPER_ADMIN', 'HR_ADMIN']), true);

  // Direct Employee targeted
  assert.equal(matchFcmAudience(empToken, ['KSS2407004']), true);
  assert.equal(matchFcmAudience(pmToken, ['KSS2407004']), false);
});

test('FCM: multicast chunking correctly splits large token lists at batchSize 500', () => {
  const tokens = Array.from({ length: 1250 }, (_, i) => `fcm-token-${i}`);
  const chunks = chunkBatch(tokens, 500);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 500);
  assert.equal(chunks[1].length, 500);
  assert.equal(chunks[2].length, 250);
});

test('FCM: handles invalid registration error codes for dead token GC', () => {
  const deadCodes = ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'];
  const isDeadTokenError = (code) => deadCodes.includes(code);

  assert.equal(isDeadTokenError('messaging/registration-token-not-registered'), true);
  assert.equal(isDeadTokenError('messaging/invalid-registration-token'), true);
  assert.equal(isDeadTokenError('messaging/server-unavailable'), false);
});
