import { PerformanceFeedback, UserRole, Employee } from '../types';
import { db, cleanFirestorePayload, subscribeWithRecovery } from './firebase';
import { collection, setDoc, doc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';

/**
 * There is deliberately no seeded feedback list.
 *
 * This module previously shipped three fully-written appraisals -- named
 * employees, star ratings, "high potential candidate" leadership notes, dated
 * acknowledgements -- and `getStoredFeedbacks()` returned them whenever
 * localStorage was empty. Every employee therefore opened a brand-new install
 * and found an invented performance review of themselves, signed by the CEO.
 * Appraisal records must originate from a real reviewer submission and nowhere
 * else.
 */

const LOCAL_STORAGE_KEY = 'kss_performance_feedbacks';

/**
 * Filter feedbacks according to organizational hierarchy & RBAC confidentiality:
 *  - Super Admin (CEO / CTO) & HR Admin: can view ALL feedbacks across company.
 *  - Project Manager: can view feedbacks given by PM, feedbacks given to PM, and feedbacks for team members.
 *  - Employee: can ONLY view feedbacks specifically addressed to them.
 */
export function filterFeedbacksByRole(
  feedbacks: PerformanceFeedback[],
  activeEmployee: Employee | null,
  role: UserRole | string
): PerformanceFeedback[] {
  if (!activeEmployee) return [];

  const effectiveRole = activeEmployee.role || role;
  const isSuperAdmin = effectiveRole === 'SUPER_ADMIN';
  const isHrAdmin = effectiveRole === 'HR_ADMIN';
  const isPm = effectiveRole === 'PROJECT_MANAGER';

  // 1. Executive Leadership & HR can view all feedbacks
  if (isSuperAdmin || isHrAdmin) {
    return feedbacks;
  }

  // 2. Project Manager can view:
  //    - Feedbacks authored by this PM
  //    - Feedbacks given by Executives (CEO/CTO) to this PM
  if (isPm) {
    return feedbacks.filter(fb => 
      fb.reviewerId === activeEmployee.id || 
      fb.targetEmployeeId === activeEmployee.id ||
      fb.targetEmployeeCode === activeEmployee.employeeId
    );
  }

  // 3. Regular Employees: STRICT PRIVACY — only see their own feedback.
  //    Matched on identity only. The removed `targetEmployeeName` equality
  //    fallback meant two employees who share a name read each other's
  //    appraisals, and it is not a condition the security rules accept either.
  return feedbacks.filter(fb =>
    fb.targetEmployeeId === activeEmployee.id ||
    fb.targetEmployeeCode === activeEmployee.employeeId
  );
}

/**
 * Save new or updated performance feedback to Firestore and LocalStorage
 */
export async function savePerformanceFeedback(feedback: PerformanceFeedback): Promise<{ success: boolean; message: string }> {
  try {
    const payload = cleanFirestorePayload({
      ...feedback,
      updatedAt: new Date().toISOString()
    });

    await setDoc(doc(db, 'performanceFeedbacks', feedback.id), payload, { merge: true });

    // Update local cache
    const existing = getStoredFeedbacks();
    const updated = [payload as PerformanceFeedback, ...existing.filter(f => f.id !== feedback.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    return { success: true, message: 'Performance feedback successfully recorded & sent!' };
  } catch (error: any) {
    console.error('Error saving performance feedback:', error);

    // A rejected write is NOT an offline write. Reporting success for
    // permission-denied told the reviewer their appraisal had been delivered
    // while the server had refused it outright, and it would never reach the
    // employee. Only queue genuinely transient failures.
    const code = String(error?.code || '');
    if (code === 'permission-denied' || code === 'invalid-argument' || code === 'failed-precondition') {
      return {
        success: false,
        message: code === 'permission-denied'
          ? 'Not permitted: you can only file a review under your own account, and not about yourself.'
          : 'Rejected by the server. Check the rating (1-5) and that a valid employee is selected.'
      };
    }

    const existing = getStoredFeedbacks();
    const updated = [feedback, ...existing.filter(f => f.id !== feedback.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return { success: false, message: 'Offline — feedback queued locally and not yet delivered.' };
  }
}

/**
 * Acknowledge feedback by the target employee
 */
export async function acknowledgePerformanceFeedback(feedbackId: string): Promise<boolean> {
  try {
    const ackDate = new Date().toISOString();
    await updateDoc(doc(db, 'performanceFeedbacks', feedbackId), {
      isAcknowledged: true,
      acknowledgedAt: ackDate,
      updatedAt: ackDate
    });

    const existing = getStoredFeedbacks();
    const updated = existing.map(f => f.id === feedbackId ? { ...f, isAcknowledged: true, acknowledgedAt: ackDate } : f);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Error acknowledging feedback:', err);
    return false;
  }
}

/**
 * Delete feedback (Only Author or Super Admin)
 */
export async function deletePerformanceFeedback(feedbackId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'performanceFeedbacks', feedbackId));
    const existing = getStoredFeedbacks();
    const updated = existing.filter(f => f.id !== feedbackId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Error deleting feedback:', err);
    return false;
  }
}

/** Last-known feedback, used only to paint the first frame before Firestore answers. */
export function getStoredFeedbacks(): PerformanceFeedback[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

/**
 * Subscribe to the feedback this viewer is actually allowed to read.
 *
 * P0 FIX: both views listened to the whole `performanceFeedbacks` COLLECTION.
 * Firestore rejects a query outright when the rules cannot be satisfied for
 * every document it could return, and an employee may only read reviews about
 * themselves -- so the employee-facing listener was permission-denied in
 * production and the view fell back to whatever localStorage happened to hold.
 * Admins and PMs have a blanket read, so they may listen collection-wide;
 * everyone else gets a query narrowed to their own employee code, which
 * satisfies the rule for every returned document.
 */
export function feedbackQueryFor(activeEmployee: Employee | null, role: UserRole | string) {
  const base = collection(db, 'performanceFeedbacks');
  const effectiveRole = activeEmployee?.role || role;
  if (effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'HR_ADMIN' || effectiveRole === 'PROJECT_MANAGER') {
    return base;
  }
  const code = activeEmployee?.employeeId;
  // No code means no provably-readable subset: listening would only produce a
  // permission-denied loop, so the caller must skip the subscription.
  if (!code) return null;
  return query(base, where('targetEmployeeCode', '==', code));
}
