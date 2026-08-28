import { FeedbackQuiz, QuizResponse, UserRole } from '../types';
import { db, cleanFirestorePayload, subscribeWithRecovery } from './firebase';
import {
  collection, doc, setDoc, deleteDoc, getDocs,
  query, where, orderBy, increment, updateDoc
} from 'firebase/firestore';

import { isAuthorizedTechLead } from './hierarchy';

/** Roles that may create, schedule, and view results. */
export const QUIZ_SCHEDULER_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'HR_ADMIN',
  'PROJECT_MANAGER'
];

export function canScheduleQuiz(role: UserRole | string, emp?: any): boolean {
  if (emp && isAuthorizedTechLead(emp)) return true;
  return QUIZ_SCHEDULER_ROLES.includes(role as UserRole);
}

// Timing Engine

function quizWindowDate(dateStr: string, timeStr: string): Date {
  const cleanTime = (timeStr || '').trim();
  const timePart = cleanTime.length === 5 ? `${cleanTime}:00` : cleanTime;
  return new Date(`${dateStr}T${timePart}+05:30`);
}

export function getQuizLiveStatus(quiz: FeedbackQuiz): FeedbackQuiz['status'] {
  const now = new Date();

  if (quiz.repeatDaily) {
    const todayIST = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
    const open = quizWindowDate(todayIST, quiz.openTime);
    const close = quizWindowDate(todayIST, quiz.closeTime);
    if (now >= open && now < close) return 'active';
    if (now >= close) return 'closed';
    return 'scheduled';
  }

  const open = quizWindowDate(quiz.scheduledDate, quiz.openTime);
  const close = quizWindowDate(quiz.scheduledDate, quiz.closeTime);

  if (now < open) return 'scheduled';
  if (now >= open && now < close) return 'active';
  return 'closed';
}

export function isQuizOpenNow(quiz: FeedbackQuiz): boolean {
  return getQuizLiveStatus(quiz) === 'active';
}

export function quizCountdownSeconds(quiz: FeedbackQuiz): { label: string; seconds: number } {
  const now = new Date();
  const status = getQuizLiveStatus(quiz);

  const todayIST = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);

  const dateToUse = quiz.repeatDaily ? todayIST : quiz.scheduledDate;
  const open = quizWindowDate(dateToUse, quiz.openTime);
  const close = quizWindowDate(dateToUse, quiz.closeTime);

  if (status === 'scheduled') {
    return { label: 'Opens in', seconds: Math.max(0, Math.floor((open.getTime() - now.getTime()) / 1000)) };
  }
  if (status === 'active') {
    return { label: 'Closes in', seconds: Math.max(0, Math.floor((close.getTime() - now.getTime()) / 1000)) };
  }
  return { label: 'Closed', seconds: 0 };
}

// Firestore References
const QUIZ_COLLECTION = 'feedbackQuizzes';
const quizRef = (id: string) => doc(db, QUIZ_COLLECTION, id);
const responsesRef = (quizId: string) => collection(db, QUIZ_COLLECTION, quizId, 'responses');
const responseDocRef = (quizId: string, responseId: string) =>
  doc(db, QUIZ_COLLECTION, quizId, 'responses', responseId);

// CRUD

export async function saveQuiz(quiz: FeedbackQuiz): Promise<{ success: boolean; message: string }> {
  try {
    const payload = cleanFirestorePayload({ ...quiz, updatedAt: new Date().toISOString() });
    await setDoc(quizRef(quiz.id), payload, { merge: true });
    return { success: true, message: 'Quiz saved successfully!' };
  } catch (error: any) {
    console.error('[quizService] saveQuiz error:', error);
    const code = String(error?.code || '');
    if (code === 'permission-denied') {
      return { success: false, message: 'Not permitted: only CEO, CTO, HR, and Project Managers can schedule quizzes.' };
    }
    return { success: false, message: 'Failed to save quiz. Please try again.' };
  }
}

export async function deleteQuiz(quizId: string): Promise<boolean> {
  try {
    await deleteDoc(quizRef(quizId));
    return true;
  } catch (error) {
    console.error('[quizService] deleteQuiz error:', error);
    return false;
  }
}

export function subscribeToQuizzes(
  role: UserRole | string,
  employeeDepartment: string | undefined,
  onData: (quizzes: FeedbackQuiz[]) => void,
  onError?: (err: any) => void,
  activeEmployee?: any
): () => void {
  const base = collection(db, QUIZ_COLLECTION);
  const q = query(base, orderBy('createdAt', 'desc'));

  return subscribeWithRecovery(
    q,
    (snapshot) => {
      const quizzes: FeedbackQuiz[] = [];
      snapshot.forEach(d => quizzes.push(d.data() as FeedbackQuiz));
      const filtered = canScheduleQuiz(role, activeEmployee)
        ? quizzes
        : quizzes.filter(qz =>
            qz.targetAudience === 'ALL_EMPLOYEES' ||
            qz.targetAudience === employeeDepartment
          );
      onData(filtered);
    },
    onError
  );
}

export async function hasEmployeeResponded(quizId: string, employeeId: string): Promise<boolean> {
  try {
    if (!quizId || !employeeId) return false;
    const q = query(responsesRef(quizId), where('employeeId', '==', employeeId));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (error) {
    console.error('[quizService] hasEmployeeResponded error:', error);
    return false;
  }
}

export async function submitQuizResponse(response: QuizResponse): Promise<{ success: boolean; message: string }> {
  try {
    if (!response.quizId || !response.employeeId) {
      return { success: false, message: 'Invalid submission: missing quiz or employee identifier.' };
    }
    const alreadyDone = await hasEmployeeResponded(response.quizId, response.employeeId);
    if (alreadyDone) {
      return { success: false, message: 'You have already submitted this quiz.' };
    }
    const payload = cleanFirestorePayload({ ...response, submittedAt: new Date().toISOString() });
    await setDoc(responseDocRef(response.quizId, response.id), payload);
    try {
      await updateDoc(quizRef(response.quizId), {
        responseCount: increment(1),
        updatedAt: new Date().toISOString()
      });
    } catch (countErr) {
      console.warn('[quizService] Could not increment responseCount on quiz document:', countErr);
    }
    return { success: true, message: 'Your response has been recorded. Thank you!' };
  } catch (error: any) {
    console.error('[quizService] submitQuizResponse error:', error);
    const code = String(error?.code || '');
    if (code === 'permission-denied') {
      return { success: false, message: 'Submission not permitted at this time.' };
    }
    return { success: false, message: error?.message || 'Failed to submit response. Please try again.' };
  }
}

export function subscribeToQuizResponses(
  quizId: string,
  onData: (responses: QuizResponse[]) => void,
  onError?: (err: any) => void
): () => void {
  const q = query(responsesRef(quizId), orderBy('submittedAt', 'desc'));
  return subscribeWithRecovery(
    q,
    (snapshot) => {
      const responses: QuizResponse[] = [];
      snapshot.forEach(d => responses.push(d.data() as QuizResponse));
      onData(responses);
    },
    onError
  );
}

export async function fetchQuizResponses(quizId: string): Promise<QuizResponse[]> {
  try {
    const snap = await getDocs(responsesRef(quizId));
    const responses: QuizResponse[] = [];
    snap.forEach(d => responses.push(d.data() as QuizResponse));
    return responses;
  } catch (error) {
    console.error('[quizService] fetchQuizResponses error:', error);
    return [];
  }
}
