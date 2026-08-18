// KSS Firebase Notification System
// Replaces Discord webhook with Firestore-backed in-app + FCM push notifications
// All events are stored in Firestore 'notifications' collection for real-time sync

import { db, cleanFirestorePayload } from './firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export type NotificationEventType =
  | 'ATTENDANCE_CHECKIN'
  | 'ATTENDANCE_CHECKOUT'
  | 'ATTENDANCE_BREAK_START'
  | 'ATTENDANCE_BREAK_END'
  | 'LEAVE_REQUEST_SUBMITTED'
  | 'LEAVE_REQUEST_APPROVED'
  | 'LEAVE_REQUEST_REJECTED'
  | 'WFH_REQUEST_SUBMITTED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_DELETED'
  | 'EMPLOYEE_UPDATED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'PAYROLL_RUN'
  | 'SECURITY_ALERT'
  | 'ADMIN_BROADCAST'
  | 'SYSTEM_ALERT';

export type NotificationAudience = 'ALL' | 'SUPER_ADMIN' | 'HR_ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE';

export interface KssNotification {
  id?: string;
  type: NotificationEventType;
  title: string;
  body: string;
  audience: NotificationAudience[];  // who should see this notification
  actorId?: string;
  actorName?: string;
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  metadata?: Record<string, any>;
  isRead?: boolean;
  createdAt?: any;  // Firestore Timestamp
}

// ----- Icon & color helpers for UI rendering -----
export const notificationIcon = (type: NotificationEventType): string => {
  switch (type) {
    case 'ATTENDANCE_CHECKIN':      return '🟢';
    case 'ATTENDANCE_CHECKOUT':     return '🔴';
    case 'ATTENDANCE_BREAK_START':  return '🟡';
    case 'ATTENDANCE_BREAK_END':    return '🟡';
    case 'LEAVE_REQUEST_SUBMITTED': return '📋';
    case 'LEAVE_REQUEST_APPROVED':  return '✅';
    case 'LEAVE_REQUEST_REJECTED':  return '❌';
    case 'WFH_REQUEST_SUBMITTED':   return '🏠';
    case 'EMPLOYEE_CREATED':        return '👤';
    case 'EMPLOYEE_DELETED':        return '🗑️';
    case 'EMPLOYEE_UPDATED':        return '✏️';
    case 'USER_LOGIN':              return '🔐';
    case 'USER_LOGOUT':             return '🚪';
    case 'PAYROLL_RUN':             return '💰';
    case 'SECURITY_ALERT':          return '🚨';
    case 'ADMIN_BROADCAST':         return '📢';
    case 'SYSTEM_ALERT':            return 'ℹ️';
    default:                        return '🔔';
  }
};

export const notificationColor = (type: NotificationEventType): string => {
  switch (type) {
    case 'ATTENDANCE_CHECKIN':
    case 'LEAVE_REQUEST_APPROVED':
    case 'EMPLOYEE_CREATED':        return 'emerald';
    case 'ATTENDANCE_CHECKOUT':
    case 'LEAVE_REQUEST_REJECTED':
    case 'EMPLOYEE_DELETED':
    case 'SECURITY_ALERT':          return 'rose';
    case 'ATTENDANCE_BREAK_START':
    case 'ATTENDANCE_BREAK_END':
    case 'LEAVE_REQUEST_SUBMITTED':
    case 'WFH_REQUEST_SUBMITTED':   return 'amber';
    case 'ADMIN_BROADCAST':         return 'blue';
    case 'PAYROLL_RUN':             return 'purple';
    default:                        return 'slate';
  }
};

// ----- Map event types to required audiences -----
const AUDIENCE_MAP: Partial<Record<NotificationEventType, NotificationAudience[]>> = {
  ATTENDANCE_CHECKIN:       ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'],
  ATTENDANCE_CHECKOUT:      ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'],
  ATTENDANCE_BREAK_START:   ['HR_ADMIN', 'PROJECT_MANAGER'],
  ATTENDANCE_BREAK_END:     ['HR_ADMIN', 'PROJECT_MANAGER'],
  LEAVE_REQUEST_SUBMITTED:  ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'],
  LEAVE_REQUEST_APPROVED:   ['EMPLOYEE'],
  LEAVE_REQUEST_REJECTED:   ['EMPLOYEE'],
  WFH_REQUEST_SUBMITTED:    ['SUPER_ADMIN', 'HR_ADMIN', 'PROJECT_MANAGER'],
  EMPLOYEE_CREATED:         ['SUPER_ADMIN', 'HR_ADMIN'],
  EMPLOYEE_DELETED:         ['SUPER_ADMIN', 'HR_ADMIN'],
  EMPLOYEE_UPDATED:         ['SUPER_ADMIN', 'HR_ADMIN'],
  USER_LOGIN:               ['SUPER_ADMIN', 'HR_ADMIN'],
  USER_LOGOUT:              ['SUPER_ADMIN'],
  PAYROLL_RUN:              ['SUPER_ADMIN', 'HR_ADMIN'],
  SECURITY_ALERT:           ['SUPER_ADMIN'],
  ADMIN_BROADCAST:          ['ALL'],
  SYSTEM_ALERT:             ['SUPER_ADMIN', 'HR_ADMIN'],
};

// ----- Core: write a notification to Firestore -----
export const sendKssNotification = async (
  type: NotificationEventType,
  title: string,
  body: string,
  options?: {
    actorId?: string;
    actorName?: string;
    targetEmployeeId?: string;
    targetEmployeeName?: string;
    metadata?: Record<string, any>;
    overrideAudience?: NotificationAudience[];
  }
): Promise<void> => {
  try {
    const audience = options?.overrideAudience ?? AUDIENCE_MAP[type] ?? ['SUPER_ADMIN'];

    const rawNotification: Record<string, any> = {
      type,
      title,
      body,
      audience,
      actorId: options?.actorId ?? '',
      actorName: options?.actorName ?? '',
      targetEmployeeId: options?.targetEmployeeId ?? '',
      targetEmployeeName: options?.targetEmployeeName ?? '',
      metadata: options?.metadata ?? {},
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Strip undefined/NaN keys recursively to prevent Firestore write failure
    const cleanNotification = cleanFirestorePayload(rawNotification);

    await addDoc(collection(db, 'notifications'), cleanNotification);
  } catch {
    // Silent fail — notifications should never block core operations or clutter console
  }
};

// ----- Broadcast helper: Admin sends to all employees -----
export const sendAdminBroadcast = async (
  title: string,
  message: string,
  actorId: string,
  actorName: string
): Promise<void> => {
  await sendKssNotification('ADMIN_BROADCAST', title, message, {
    actorId,
    actorName,
    overrideAudience: ['ALL'],
    metadata: { isBroadcast: true }
  });
};

// ----- FCM Token Registration -----
// Registers current browser's FCM push token to Firestore under 'fcmTokens' collection
export const registerFcmToken = async (
  employeeId: string,
  role: string
): Promise<void> => {
  try {
    // Dynamically import FCM to avoid breaking non-supported environments
    const { getMessaging, getToken } = await import('firebase/messaging');
    const { getApp } = await import('firebase/app');
    
    const messaging = getMessaging(getApp());
    
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey || vapidKey.includes('YOUR_')) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

    if (token) {
      await addDoc(collection(db, 'fcmTokens'), {
        employeeId,
        role,
        token,
        userAgent: navigator.userAgent,
        registeredAt: serverTimestamp()
      });
      console.info('[FCM] Token registered for employee:', employeeId);
    }
  } catch (err) {
    console.warn('[FCM] Token registration failed (safe to ignore in dev/unsupported browsers):', err);
  }
};
