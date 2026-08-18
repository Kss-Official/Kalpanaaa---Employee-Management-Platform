import { db, cleanFirestorePayload } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  runTransaction,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { LeaveRequest, LeaveLockEntry } from '../types';

export class LeaveService {
  /**
   * Generates a date range array [YYYY-MM-DD] between start and end inclusive.
   */
  static getDateRangeArray(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  /**
   * Subscribes to an individual employee's own requests (Scoped for zero data leakage).
   */
  static subscribeToOwnRequests(
    employeeUid: string,
    onUpdate: (requests: LeaveRequest[]) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    if (!employeeUid) {
      onUpdate([]);
      return () => {};
    }

    const q = query(
      collection(db, 'leaveRequests'),
      where('employeeUid', '==', employeeUid)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const list: LeaveRequest[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as LeaveRequest);
        });
        list.sort(
          (a, b) =>
            new Date(b.requestDate || b.startDate).getTime() -
            new Date(a.requestDate || a.startDate).getTime()
        );
        onUpdate(list);
      },
      (error) => {
        console.warn('[LeaveService] Own requests listener error:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Subscribes to a Project Manager's scoped team requests (Scoped by pmUid).
   */
  static subscribeToPmRequests(
    pmUid: string,
    onUpdate: (requests: LeaveRequest[]) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    if (!pmUid) {
      onUpdate([]);
      return () => {};
    }

    const q = query(
      collection(db, 'leaveRequests'),
      where('pmUid', '==', pmUid)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const list: LeaveRequest[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as LeaveRequest);
        });
        list.sort(
          (a, b) =>
            new Date(b.requestDate || b.startDate).getTime() -
            new Date(a.requestDate || a.startDate).getTime()
        );
        onUpdate(list);
      },
      (error) => {
        console.warn('[LeaveService] PM requests listener error:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Subscribes to all company leave requests (For HR_ADMIN and SUPER_ADMIN).
   */
  static subscribeToAllRequests(
    onUpdate: (requests: LeaveRequest[]) => void,
    onError?: (error: any) => void
  ): Unsubscribe {
    const q = collection(db, 'leaveRequests');

    return onSnapshot(
      q,
      (snapshot) => {
        const list: LeaveRequest[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as LeaveRequest);
        });
        list.sort(
          (a, b) =>
            new Date(b.requestDate || b.startDate).getTime() -
            new Date(a.requestDate || a.startDate).getTime()
        );
        onUpdate(list);
      },
      (error) => {
        console.warn('[LeaveService] All requests listener error:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Submits a new Leave or WFH request atomically with date locks and overlap checks.
   */
  static async submitLeaveRequest(
    data: Omit<LeaveRequest, 'id' | 'status' | 'requestDate' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; id: string; message: string }> {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (start > end) {
      throw new Error('Start date cannot be after end date');
    }

    const dateRange = this.getDateRangeArray(data.startDate, data.endDate);
    if (dateRange.length > 30) {
      throw new Error('Requests spanning more than 30 consecutive calendar days are restricted. Please split into monthly requests.');
    }

    const cleanEmpId = (data.employeeId || 'EMP').replace(/[^a-zA-Z0-9_-]/g, '');
    const deterministicId = `LR_${cleanEmpId}_${data.startDate}_${data.type}`;
    const nowIso = new Date().toISOString();

    const newRequest: LeaveRequest = {
      ...data,
      id: deterministicId,
      status: 'Pending',
      pmStatus: data.pmStatus || 'Pending',
      hrStatus: data.hrStatus || 'Waiting PM',
      ceoStatus: data.ceoStatus || 'Waiting HR',
      ctoStatus: data.ctoStatus || 'Waiting CEO',
      requestDate: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Execute atomic transaction for overlapping date lock validation
    await runTransaction(db, async (txn) => {
      // Step 1: Read all date lock documents for the requested range
      for (const dStr of dateRange) {
        const lockRef = doc(db, 'employees', data.employeeId, 'leaveLocks', dStr);
        const lockDoc = await txn.get(lockRef);
        if (lockDoc.exists()) {
          const lockData = lockDoc.data() as LeaveLockEntry;
          if (lockData.active && lockData.requestId !== deterministicId) {
            throw new Error(`Date Conflict: An active request (${lockData.requestId}) already covers ${dStr}.`);
          }
        }
      }

      // Step 2: Atomic Write Phase
      const requestRef = doc(db, 'leaveRequests', deterministicId);
      txn.set(requestRef, cleanFirestorePayload(newRequest));

      for (const dStr of dateRange) {
        const lockRef = doc(db, 'employees', data.employeeId, 'leaveLocks', dStr);
        const lockPayload: LeaveLockEntry = {
          id: dStr,
          requestId: deterministicId,
          employeeUid: data.employeeUid || '',
          employeeId: data.employeeId,
          type: data.type,
          active: true,
          reservedAt: nowIso,
        };
        txn.set(lockRef, cleanFirestorePayload(lockPayload));
      }
    });

    return {
      success: true,
      id: deterministicId,
      message: `${data.type} request submitted successfully.`,
    };
  }

  /**
   * Releases atomic date locks for a given employee and date range.
   */
  static async releaseDateLocks(employeeId: string, startDate: string, endDate: string): Promise<void> {
    if (!employeeId || !startDate || !endDate) return;
    try {
      const dates = this.getDateRangeArray(startDate, endDate);
      const batch = writeBatch(db);
      for (const dStr of dates) {
        const lockRef = doc(db, 'employees', employeeId, 'leaveLocks', dStr);
        batch.delete(lockRef);
      }
      await batch.commit();
    } catch (e) {
      console.warn('[LeaveService] Error releasing date locks:', e);
    }
  }

  /**
   * Cancels a pending request and releases its date locks atomically.
   */
  static async cancelRequest(
    requestId: string,
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    await setDoc(
      doc(db, 'leaveRequests', requestId),
      { status: 'Cancelled', updatedAt: nowIso },
      { merge: true }
    );
    await this.releaseDateLocks(employeeId, startDate, endDate);
  }

  /**
   * Tier 1: Project Manager stage review.
   */
  static async reviewPmStage(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    const updates: Partial<LeaveRequest> = {
      pmStatus: decision,
      pmRecommendation: decision,
      pmReviewedBy: reviewerUid,
      pmReviewedAt: nowIso,
      pmNotes: notes || '',
      hrStatus: isApproved ? 'Pending' : 'Waiting PM',
      ceoStatus: 'Waiting HR',
      ctoStatus: 'Waiting CEO',
      status: isApproved ? 'Pending' : 'Rejected',
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'leaveRequests', requestId), cleanFirestorePayload(updates), { merge: true });

    if (!isApproved && employeeId && startDate && endDate) {
      await this.releaseDateLocks(employeeId, startDate, endDate);
    }
  }

  /**
   * Tier 2: HR Admin stage review.
   */
  static async reviewHrStage(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    const updates: Partial<LeaveRequest> = {
      hrStatus: decision,
      hrReviewedBy: reviewerUid,
      hrReviewedAt: nowIso,
      hrNotes: notes || '',
      ceoStatus: isApproved ? 'Pending' : 'Waiting HR',
      status: isApproved ? 'Pending' : 'Rejected',
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'leaveRequests', requestId), cleanFirestorePayload(updates), { merge: true });

    if (!isApproved && employeeId && startDate && endDate) {
      await this.releaseDateLocks(employeeId, startDate, endDate);
    }
  }

  /**
   * Tier 3: CEO stage review.
   */
  static async reviewCeoStage(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    const updates: Partial<LeaveRequest> = {
      ceoStatus: decision,
      ceoReviewedBy: reviewerUid,
      ceoReviewedAt: nowIso,
      ceoNotes: notes || '',
      ctoStatus: isApproved ? 'Pending' : 'Waiting CEO',
      status: isApproved ? 'Pending' : 'Rejected',
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'leaveRequests', requestId), cleanFirestorePayload(updates), { merge: true });

    if (!isApproved && employeeId && startDate && endDate) {
      await this.releaseDateLocks(employeeId, startDate, endDate);
    }
  }

  /**
   * Tier 4: CTO final sanction.
   */
  static async reviewCtoStage(
    requestId: string,
    decision: 'Approved' | 'Rejected',
    reviewerUid: string,
    reviewerName: string,
    notes?: string,
    employeeId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const isApproved = decision === 'Approved';

    const updates: Partial<LeaveRequest> = {
      ctoStatus: decision,
      ctoReviewedBy: reviewerUid,
      ctoReviewedAt: nowIso,
      ctoNotes: notes || '',
      status: isApproved ? 'Approved' : 'Rejected',
      reviewedBy: reviewerName,
      reviewNotes: notes || (isApproved ? 'Final sanction granted by CTO' : 'Rejected at CTO stage'),
      updatedAt: nowIso,
    };

    await setDoc(doc(db, 'leaveRequests', requestId), cleanFirestorePayload(updates), { merge: true });

    if (!isApproved && employeeId && startDate && endDate) {
      await this.releaseDateLocks(employeeId, startDate, endDate);
    }
  }
}
