import test from 'node:test';
import assert from 'node:assert/strict';

// Helper simulating Presence Aggregator across multiple devices/tabs
function aggregateEmployeeSessions(sessions) {
  if (!sessions || typeof sessions !== 'object') {
    return { isOnline: false, workState: 'Offline', latestSeen: 0 };
  }

  let isOnline = false;
  let latestSeen = 0;
  let activeState = 'Offline';

  Object.values(sessions).forEach((sess) => {
    if (sess && sess.status === 'online') {
      isOnline = true;
      activeState = sess.workState || 'Working';
    }
    if (sess && typeof sess.lastSeen === 'number' && sess.lastSeen > latestSeen) {
      latestSeen = sess.lastSeen;
    }
  });

  return { isOnline, workState: activeState, latestSeen };
}

test('RTDB Presence: single active session resolves to online and correct work state', () => {
  const sessions = {
    sess_1: { status: 'online', workState: 'Working', lastSeen: 1700000000000 }
  };
  const result = aggregateEmployeeSessions(sessions);
  assert.equal(result.isOnline, true);
  assert.equal(result.workState, 'Working');
  assert.equal(result.latestSeen, 1700000000000);
});

test('RTDB Presence: multi-tab with 1 online and 1 offline resolves to online', () => {
  const sessions = {
    sess_tab_1: { status: 'offline', workState: 'Checked Out', lastSeen: 1700000000000 },
    sess_tab_2: { status: 'online', workState: 'On Break', lastSeen: 1700000500000 }
  };
  const result = aggregateEmployeeSessions(sessions);
  assert.equal(result.isOnline, true);
  assert.equal(result.workState, 'On Break');
  assert.equal(result.latestSeen, 1700000500000);
});

test('RTDB Presence: all disconnected sessions resolve to offline', () => {
  const sessions = {
    sess_tab_1: { status: 'offline', workState: 'Checked Out', lastSeen: 1700000000000 },
    sess_mobile: { status: 'offline', workState: 'Checked Out', lastSeen: 1700000200000 }
  };
  const result = aggregateEmployeeSessions(sessions);
  assert.equal(result.isOnline, false);
  assert.equal(result.workState, 'Offline');
  assert.equal(result.latestSeen, 1700000200000);
});
