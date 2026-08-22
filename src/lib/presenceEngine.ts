/**
 * Kalpanaaa HRMS — Realtime Database Presence & Live Status Engine
 * Provides sub-100ms employee online/offline tracking, auto-disconnect on tab close,
 * and live work status with zero Firestore query costs.
 */

export interface EmployeePresenceInfo {
  status: 'online' | 'offline';
  workState: 'Working' | 'On Break' | 'Checked Out' | 'Idle';
  lastSeen: number;
  role?: string;
  userAgent?: string;
}

export interface LiveAnnouncement {
  id: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: number;
  expiresAt: number;
}

// Module state exists only so the exported updateLiveWorkStatus() can address the
// caller's own node. Teardown logic must NEVER read these — see initPresence.
let activeSessionId: string | null = null;
let currentEmployeeId: string | null = null;

export const initPresence = async (
  employeeId: string,
  role: string,
  initialWorkState: 'Working' | 'On Break' | 'Checked Out' | 'Idle' = 'Working'
): Promise<() => void> => {
  if (typeof window === 'undefined' || !employeeId) {
    return () => {};
  }

  // P1 FIX: these are captured in locals and the teardown closure below uses the
  // LOCALS, not the module-level variables. Previously the cleanup read
  // `currentEmployeeId` / `activeSessionId`, which a second initPresence() call
  // had already overwritten — so under React StrictMode's double-invoke (and on
  // any fast re-login) teardown deleted the NEW live session and left the old one
  // stranded as permanently "online".
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ownerEmployeeId = employeeId;

  currentEmployeeId = ownerEmployeeId;
  activeSessionId = sessionId;

  try {
    const { getDatabase, ref, onValue, set, remove, onDisconnect, serverTimestamp } = await import('firebase/database');
    const { getApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');

    const uid = getAuth(getApp()).currentUser?.uid;
    if (!uid) {
      // Presence writes are bound to the writer's uid by database.rules.json; with
      // no Firebase credential the write would be rejected. Bail out quietly rather
      // than emit a guaranteed PERMISSION_DENIED.
      console.warn('[PresenceEngine] No authenticated Firebase user — presence tracking skipped.');
      return () => {};
    }

    const db = getDatabase(getApp());
    const connectedRef = ref(db, '.info/connected');
    const myPresenceRef = ref(db, `presence/${ownerEmployeeId}/${sessionId}`);

    const unsub = onValue(
      connectedRef,
      async (snap) => {
        if (snap.val() !== true) return;
        try {
          // P0 FIX: onDisconnect().set({status:'offline'}) LEAKED A NODE PER SESSION.
          // Every tab, refresh and navigation minted a new `sess_*` key and left an
          // "offline" record behind forever, so /presence/{employeeId} grew without
          // bound — inflating the directory payload every dashboard downloads and
          // permanently skewing lastSeen aggregation. remove() is the correct
          // primitive: the node should cease to exist when the socket drops.
          await onDisconnect(myPresenceRef).remove();

          await set(myPresenceRef, {
            status: 'online',
            workState: initialWorkState,
            role,
            uid, // required by database.rules.json to bind the write to this user
            lastSeen: serverTimestamp(),
            userAgent: navigator.userAgent.substring(0, 80)
          });
        } catch (err) {
          console.warn('[PresenceEngine] Presence write rejected:', err);
        }
      },
      (err) => {
        // P1 FIX: onValue previously had no error callback, so a rules rejection or
        // dropped connection failed completely silently.
        console.warn('[PresenceEngine] Connection state listener error:', err);
      }
    );

    return () => {
      unsub();
      try {
        // Uses the captured locals, so the correct session is always torn down.
        remove(ref(db, `presence/${ownerEmployeeId}/${sessionId}`)).catch(() => {});
      } catch {}
      if (activeSessionId === sessionId) {
        activeSessionId = null;
        currentEmployeeId = null;
      }
    };
  } catch (err) {
    console.warn('[PresenceEngine] RTDB presence initialization note (gracefully bypassed):', err);
    return () => {};
  }
};

export const updateLiveWorkStatus = async (
  workState: 'Working' | 'On Break' | 'Checked Out' | 'Idle'
): Promise<void> => {
  if (!currentEmployeeId || !activeSessionId) return;

  try {
    const { getDatabase, ref, update, serverTimestamp } = await import('firebase/database');
    const { getApp } = await import('firebase/app');

    const db = getDatabase(getApp());
    const myPresenceRef = ref(db, `presence/${currentEmployeeId}/${activeSessionId}`);

    await update(myPresenceRef, {
      workState,
      lastSeen: serverTimestamp()
    });
  } catch (err) {
    console.warn('[PresenceEngine] Work state update ignored:', err);
  }
};

export const subscribeToPresenceDirectory = async (
  onUpdate: (presenceMap: Record<string, { isOnline: boolean; workState: string; lastSeen: number }>) => void
): Promise<() => void> => {
  try {
    const { getDatabase, ref, onValue } = await import('firebase/database');
    const { getApp } = await import('firebase/app');

    const db = getDatabase(getApp());
    const allPresenceRef = ref(db, 'presence');

    const unsub = onValue(
      allPresenceRef,
      (snapshot) => {
        const result: Record<string, { isOnline: boolean; workState: string; lastSeen: number }> = {};
        if (snapshot.exists()) {
          const data = snapshot.val() || {};
          Object.keys(data).forEach((empId) => {
            const sessions = data[empId] || {};
            let isOnline = false;
            let latestSeen = 0;
            let activeState = 'Checked Out';

            Object.values(sessions).forEach((sess: any) => {
              if (sess && sess.status === 'online') {
                isOnline = true;
                activeState = sess.workState || 'Working';
              }
              if (sess && typeof sess.lastSeen === 'number' && sess.lastSeen > latestSeen) {
                latestSeen = sess.lastSeen;
              }
            });

            result[empId] = {
              isOnline,
              workState: activeState,
              lastSeen: latestSeen
            };
          });
        }
        onUpdate(result);
      },
      (err) => {
        // P0 FIX: this listener previously had NO error callback. The deployed RTDB
        // rules granted '.read' only at /presence/$employeeId, and RTDB read
        // permission does not cascade upward, so this whole-tree read was rejected
        // on every single load with nobody notified — the live dashboards simply
        // showed everyone offline forever. database.rules.json now grants '.read'
        // at /presence, and a failure here is at least reported.
        console.warn('[PresenceEngine] Presence directory subscription failed:', err);
        onUpdate({});
      }
    );

    return () => unsub();
  } catch (err) {
    console.warn('[PresenceEngine] Directory subscription bypassed:', err);
    return () => {};
  }
};
