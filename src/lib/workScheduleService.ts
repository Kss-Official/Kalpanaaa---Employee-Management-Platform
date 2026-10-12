/**
 * Work Schedule & Break Management Service
 * Manages per-employee configurable work schedules including shift times,
 * meal breaks, snack breaks, and weekly working days.
 * Stores data in Firestore under /workSchedules/{employeeId}
 */

import { db, cleanFirestorePayload } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';

export interface WorkSchedule {
  /** Employee Firestore document ID (matches /employees/{id}) */
  employeeId: string;
  employeeCode: string; // e.g. KSS2407004
  employeeName: string;

  /** Shift timing */
  startTime: string; // HH:MM, e.g. "10:00"
  endTime: string;   // HH:MM, e.g. "19:00"

  /** Computed total rostered minutes (endTime - startTime) */
  scheduledMinutes: number;

  /** Meal / Lunch break */
  mealBreakMinutes: number;   // duration in minutes
  mealBreakPaid: boolean;     // if false → subtracted from net working time

  /** Snacks / Tea break */
  snacksBreakMinutes: number;     // duration per snacks break in minutes
  snacksBreakCount: number;       // number of permitted snacks breaks per day
  snacksBreakPaid: boolean;       // if false → subtracted from net working time

  /** Weekly working days (0=Sun, 1=Mon, ... 6=Sat) */
  workingDays: number[]; // e.g. [1,2,3,4,5,6] for Mon-Sat

  /** Effective date of this schedule (YYYY-MM-DD) */
  effectiveDate: string;

  /** Is this schedule currently active? */
  active: boolean;

  /** Audit fields */
  updatedBy: string;        // UID of who last saved
  updatedByName: string;
  updatedAt: string;        // ISO timestamp
  createdAt?: string;
}

/** Default schedule for company-wide standard shift */
export const DEFAULT_WORK_SCHEDULE: Omit<WorkSchedule, 'employeeId' | 'employeeCode' | 'employeeName' | 'updatedBy' | 'updatedByName' | 'updatedAt' | 'createdAt'> = {
  startTime: '10:00',
  endTime: '19:00',
  scheduledMinutes: 540, // 9 hours
  mealBreakMinutes: 60,
  mealBreakPaid: false,
  snacksBreakMinutes: 15,
  snacksBreakCount: 2,
  snacksBreakPaid: true,
  workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
  effectiveDate: '2026-07-27',
  active: true,
};

/**
 * Calculates net required working minutes from a schedule.
 * Only unpaid breaks are subtracted from scheduled office time.
 */
export function calcNetRequiredMinutes(schedule: Partial<WorkSchedule>): number {
  const scheduled = schedule.scheduledMinutes ?? 540;
  let deductions = 0;
  if (!schedule.mealBreakPaid) {
    deductions += schedule.mealBreakMinutes ?? 0;
  }
  if (!schedule.snacksBreakPaid) {
    const count = schedule.snacksBreakCount ?? 0;
    const dur = schedule.snacksBreakMinutes ?? 0;
    deductions += count * dur;
  }
  return Math.max(0, scheduled - deductions);
}

/**
 * Computes scheduledMinutes from startTime and endTime strings (HH:MM).
 */
export function calcScheduledMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + (sm || 0);
  const endMins = eh * 60 + (em || 0);
  const diff = endMins - startMins;
  return diff > 0 ? diff : 0;
}

/**
 * Validates a WorkSchedule for contradictory or invalid values.
 * Returns null if valid, or an error message string.
 */
export function validateWorkSchedule(s: Partial<WorkSchedule>): string | null {
  if (!s.startTime || !s.endTime) return 'Start time and end time are required.';
  const scheduled = calcScheduledMinutes(s.startTime, s.endTime);
  if (scheduled <= 0) return 'End time must be after start time.';
  if (scheduled < 60) return 'Scheduled office duration must be at least 1 hour.';

  const mealMins = s.mealBreakMinutes ?? 0;
  const snacksMins = (s.snacksBreakMinutes ?? 0) * (s.snacksBreakCount ?? 0);
  const totalBreak = mealMins + snacksMins;
  if (totalBreak >= scheduled) return 'Total break duration cannot exceed scheduled office duration.';

  if ((s.mealBreakMinutes ?? 0) < 0) return 'Meal break duration cannot be negative.';
  if ((s.snacksBreakMinutes ?? 0) < 0) return 'Snacks break duration cannot be negative.';
  if ((s.snacksBreakCount ?? 0) < 0) return 'Snacks break count cannot be negative.';
  if (!s.workingDays || s.workingDays.length === 0) return 'At least one working day must be selected.';
  if (!s.effectiveDate) return 'Effective date is required.';

  return null;
}

/**
 * Saves a work schedule for a single employee to Firestore.
 */
export async function saveWorkSchedule(
  schedule: WorkSchedule
): Promise<{ success: boolean; message: string }> {
  const validationError = validateWorkSchedule(schedule);
  if (validationError) {
    return { success: false, message: validationError };
  }

  const scheduled = calcScheduledMinutes(schedule.startTime, schedule.endTime);
  const payload: WorkSchedule = {
    ...schedule,
    scheduledMinutes: scheduled,
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(
      doc(db, 'workSchedules', schedule.employeeId),
      cleanFirestorePayload(payload),
      { merge: true }
    );
    return { success: true, message: 'Work schedule saved successfully.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to save work schedule.' };
  }
}

/**
 * Saves the same schedule to multiple employees using a batch write.
 */
export async function bulkSaveWorkSchedules(
  employeeIds: string[],
  scheduleTemplate: Omit<WorkSchedule, 'employeeId' | 'employeeCode' | 'employeeName'>,
  employeeMap: Record<string, { code: string; name: string }>
): Promise<{ success: boolean; message: string; failed: string[] }> {
  const validationError = validateWorkSchedule(scheduleTemplate);
  if (validationError) {
    return { success: false, message: validationError, failed: employeeIds };
  }

  const scheduled = calcScheduledMinutes(scheduleTemplate.startTime, scheduleTemplate.endTime);
  const failed: string[] = [];

  // Firestore batches are limited to 500 ops; chunk if needed
  const BATCH_SIZE = 400;
  for (let i = 0; i < employeeIds.length; i += BATCH_SIZE) {
    const chunk = employeeIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const empId of chunk) {
      const info = employeeMap[empId] || { code: empId, name: '' };
      const payload: WorkSchedule = {
        ...scheduleTemplate,
        employeeId: empId,
        employeeCode: info.code,
        employeeName: info.name,
        scheduledMinutes: scheduled,
        updatedAt: new Date().toISOString(),
      };
      batch.set(doc(db, 'workSchedules', empId), cleanFirestorePayload(payload), { merge: true });
    }
    try {
      await batch.commit();
    } catch (err: any) {
      failed.push(...chunk);
    }
  }

  if (failed.length > 0) {
    return { success: false, message: `Failed to update ${failed.length} employee(s).`, failed };
  }
  return { success: true, message: `Updated schedules for ${employeeIds.length} employee(s).`, failed: [] };
}

/**
 * Fetches a single employee's work schedule from Firestore.
 */
export async function fetchWorkSchedule(employeeId: string): Promise<WorkSchedule | null> {
  try {
    const snap = await getDoc(doc(db, 'workSchedules', employeeId));
    if (snap.exists()) {
      return snap.data() as WorkSchedule;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Subscribes to real-time updates for all work schedules.
 */
export function subscribeToWorkSchedules(
  onData: (schedules: WorkSchedule[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'workSchedules'),
    (snap) => {
      const schedules: WorkSchedule[] = [];
      snap.forEach((d) => schedules.push(d.data() as WorkSchedule));
      onData(schedules);
    },
    (err) => {
      console.warn('[WorkScheduleService] listener error:', err);
      onError?.(err);
    }
  );
}
