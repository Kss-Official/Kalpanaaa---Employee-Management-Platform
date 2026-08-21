// Kalpanaaa KSS — FCM Push Relay (Firebase Blaze plan)
// When a notification document is written to Firestore, this Cloud Function sends
// real push notifications to every registered FCM token whose role matches the
// notification's audience (e.g. admins get attendance / leave / payroll alerts).
//
// Deploy with: firebase deploy --only functions
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

const BATCH_SIZE = 500;

exports.sendFcmPushOnNotification = onDocumentCreated(
  'notifications/{notificationId}',
  async (event) => {
    const notifId = event.params.notificationId;
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    if (!data || data._fcmStatus === 'sent' || data._fcmStatus === 'skipped') return;

    const title = data.title || 'Kalpanaaa HR Alert';
    const body = data.body || 'You have a new notification from KSS HR System.';
    const audience =
      Array.isArray(data.audience) && data.audience.length > 0
        ? data.audience
        : ['SUPER_ADMIN'];

    try {
      // Fetch all tokens and match against audience (supports 'ALL', specific roles, and individual employeeIds)
      const allTokensSnap = await db.collection('fcmTokens').get();
      const uniqueTokens = [];
      const seen = new Set();

      allTokensSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const t = d.token;
        if (!t || typeof t !== 'string' || seen.has(t)) return;

        const isMatch = audience.includes('ALL') ||
          (d.role && audience.includes(d.role)) ||
          (d.employeeId && audience.includes(d.employeeId));

        if (isMatch) {
          seen.add(t);
          uniqueTokens.push(t);
        }
      });

      if (uniqueTokens.length === 0) {
        await snap.ref.update({
          _fcmStatus: 'skipped',
          _fcmSentTo: 0,
          _fcmAttemptedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const messageBase = {
        notification: { title, body },
        data: {
          type: String(data.type || 'SYSTEM_ALERT'),
          url: '/',
          notificationId: notifId,
        },
        webpush: {
          fcm_options: { link: '/' },
        },
      };

      let sent = 0;
      const invalidTokens = new Set();

      for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
        const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
        try {
          const result = await getMessaging().sendEachForMulticast({
            ...messageBase,
            tokens: batch,
          });
          sent += result.successCount || 0;
          (result.responses || []).forEach((resp, idx) => {
            const err = resp && resp.error;
            if (
              err &&
              (err.code === 'messaging/invalid-registration-token' ||
                err.code === 'messaging/registration-token-not-registered')
            ) {
              invalidTokens.add(batch[idx]);
            }
          });
        } catch (e) {
          console.warn('[KSS FCM] Batch send failed:', e && e.message);
        }
      }

      // Garbage collect dead tokens so future sends stay clean
      if (invalidTokens.size > 0) {
        try {
          const allTokens = await db.collection('fcmTokens').get();
          const dead = [];
          allTokens.forEach((d) => {
            if (invalidTokens.has(d.data().token)) dead.push(d);
          });
          for (const d of dead) {
            await d.ref.delete();
          }
        } catch (e) {
          console.warn('[KSS FCM] Token cleanup failed:', e && e.message);
        }
      }

      await snap.ref.update({
        _fcmStatus: 'sent',
        _fcmSentTo: sent,
        _fcmAttemptedAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error('[KSS FCM] Push relay error:', e);
      await snap.ref
        .update({
          _fcmStatus: 'error',
          _fcmError: String((e && e.message) || e),
          _fcmAttemptedAt: FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    }
  }
);

// ── Enterprise Disaster Recovery: Automated Daily Firestore Backup to Cloud Storage ──
// Runs every night at 02:00 AM IST (20:30 UTC) to archive whole database snapshots.
// Can be triggered manually or via Cloud Scheduler on Blaze plan.
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.scheduledFirestoreBackup = onSchedule(
  {
    schedule: '30 20 * * *', // 02:00 AM IST daily
    timeZone: 'Asia/Kolkata',
    retryCount: 3,
    memory: '512MiB'
  },
  async () => {
    try {
      const { v1 } = require('@google-cloud/firestore');
      const client = new v1.FirestoreAdminClient();
      const projectId = process.env.GCLOUD_PROJECT || 'kalpanaaa-employees-website';
      const databaseName = client.databasePath(projectId, '(default)');
      const bucketName = `gs://${projectId}-backups`;

      console.info(`[KSS Backup] Starting automated Firestore export to ${bucketName}...`);
      const [response] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: `${bucketName}/${new Date().toISOString().split('T')[0]}`,
        collectionIds: ['employees', 'attendance', 'leaveRequests', 'salaryDisbursements', 'projects', 'settings', 'auditLogs', 'companyRules']
      });
      console.info(`[KSS Backup] Firestore export initiated: ${response.name}`);
    } catch (err) {
      console.warn('[KSS Backup] Cloud Firestore export note: Ensure Firestore Admin API and Cloud Storage bucket are provisioned:', err.message);
    }
  }
);

// ── Scheduled Morning Attendance Reminder (09:00 AM IST Mon-Sat) ──
exports.scheduledMorningAttendanceReminder = onSchedule(
  {
    schedule: '0 9 * * 1-6', // 09:00 AM IST Mon-Sat
    timeZone: 'Asia/Kolkata',
    retryCount: 2,
    memory: '256MiB'
  },
  async () => {
    try {
      await db.collection('notifications').add({
        type: 'SYSTEM_ALERT',
        title: '☀️ Good Morning! Shift Check-In',
        body: 'Morning shift check-in is now open. Please complete your face biometrics / GPS check-in on the portal.',
        audience: ['ALL'],
        actorName: 'KSS Automated Scheduler',
        createdAt: new Date().toISOString(),
        _fcmStatus: 'pending'
      });
      console.info('[Scheduler] Morning attendance reminder notification posted.');
    } catch (e) {
      console.error('[Scheduler] Morning attendance reminder failed:', e);
    }
  }
);

// ── Scheduled Evening Checkout Reminder (06:50 PM IST Mon-Sat) ──
exports.scheduledEveningCheckoutReminder = onSchedule(
  {
    schedule: '50 18 * * 1-6', // 06:50 PM IST Mon-Sat
    timeZone: 'Asia/Kolkata',
    retryCount: 2,
    memory: '256MiB'
  },
  async () => {
    try {
      await db.collection('notifications').add({
        type: 'SYSTEM_ALERT',
        title: '🏁 Shift End Checkout Reminder',
        body: 'Office hours conclude at 07:00 PM IST. Please remember to complete your check-out before leaving.',
        audience: ['ALL'],
        actorName: 'KSS Automated Scheduler',
        createdAt: new Date().toISOString(),
        _fcmStatus: 'pending'
      });
      console.info('[Scheduler] Evening checkout reminder notification posted.');
    } catch (e) {
      console.error('[Scheduler] Evening checkout reminder failed:', e);
    }
  }
);
