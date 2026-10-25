'use client';

import { createContext, useCallback, useContext, useReducer, useState, type Dispatch, type SetStateAction } from 'react';
import { evaluateAnswer, questions, reviewQuestions } from './lesson';
import { initialPractice, practiceReducer, takeTransition, type PracticeEvent, type PracticeState, type TakePhase } from './playing/model';

export const activities = [
  { id: 'learn-theory', group: 'Learn', title: 'Theory', href: '/learn/understand', description: 'Explore a musical idea with questions, a score and a reference.' },
  { id: 'learn-practice', group: 'Learn', title: 'Practice', href: '/learn/practice', description: 'Work on a short passage with guidance, then gradually remove support.' },
  { id: 'review-theory', group: 'Review', title: 'Theory', href: '/learn/review/theory', description: 'Recall the idea before opening the reference.' },
  { id: 'review-practice', group: 'Review', title: 'Practice', href: '/learn/play-through', description: 'Play the whole melody, with feedback after the final bar.' },
] as const;
export type ActivityId = typeof activities[number]['id'];
export type AnswerResult = { prompt: string; answer: string; explanation: string; outcome: ReturnType<typeof evaluateAnswer> };
type TheoryState = { index: number; answer: string; checked: boolean; hint: boolean; tab: 'music' | 'page'; history: AnswerResult[]; paneWidth: number };
const emptyTheory = (): TheoryState => ({ index: 0, answer: '', checked: false, hint: false, tab: 'music', history: [], paneWidth: 40 });
type Sessions = {
  theory: TheoryState; setTheory: Dispatch<SetStateAction<TheoryState>>;
  review: TheoryState; setReview: Dispatch<SetStateAction<TheoryState>>;
  practice: PracticeState; dispatchPractice: Dispatch<PracticeEvent>;
  playThrough: TakePhase; dispatchPlayThrough: Dispatch<'start' | 'counted' | 'finish' | 'stop' | 'again'>;
  started: Partial<Record<ActivityId, boolean>>;
  markStarted: (id: ActivityId) => void; restart: (id: ActivityId) => void;
};
const SessionContext = createContext<Sessions | null>(null);

// The learning layout owns real session state across hub navigation. Nothing is saved to an account or disk.
export function LearningSessionsProvider({ children }: { children: React.ReactNode }) {
  const [theory, setTheory] = useState(emptyTheory);
  const [review, setReview] = useState(emptyTheory);
  const [practice, setPractice] = useState(initialPractice);
  const dispatchPractice = useCallback((event: PracticeEvent) => setPractice(state => practiceReducer(state, event)), []);
  const [playThrough, dispatchPlayThrough] = useReducer(takeTransition, 'ready' as TakePhase);
  const [started, setStarted] = useState<Sessions['started']>({});
  const markStarted = useCallback((id: ActivityId) => { setStarted(current => current[id] ? current : { ...current, [id]: true }); }, []);
  const restart = (id: ActivityId) => {
    if (id === 'learn-theory') setTheory(emptyTheory());
    if (id === 'review-theory') setReview(emptyTheory());
    if (id === 'learn-practice') setPractice(initialPractice);
    if (id === 'review-practice') dispatchPlayThrough('again');
  };
  return <SessionContext value={{ theory, setTheory, review, setReview, practice, dispatchPractice, playThrough, dispatchPlayThrough, started, markStarted, restart }}>{children}</SessionContext>;
}
export function useLearningSessions() {
  const sessions = useContext(SessionContext);
  if (!sessions) throw new Error('Learning sessions require the learning layout.');
  return sessions;
}
export function useTheorySession(isReview: boolean) {
  const sessions = useLearningSessions();
  const setState = isReview ? sessions.setReview : sessions.setTheory;
  const update = useCallback((patch: Partial<TheoryState>) => setState(state => ({ ...state, ...patch })), [setState]);
  const setPaneWidth = useCallback((value: SetStateAction<number>) => setState(state => ({ ...state, paneWidth: typeof value === 'function' ? value(state.paneWidth) : value })), [setState]);
  return { state: isReview ? sessions.review : sessions.theory, update, setPaneWidth };
}
export function isSessionComplete(id: ActivityId, sessions: Sessions) {
  if (id === 'learn-theory') return sessions.theory.index >= questions.length;
  if (id === 'review-theory') return sessions.review.index >= reviewQuestions.length;
  if (id === 'learn-practice') return sessions.practice.stage === 'complete';
  return sessions.playThrough === 'result';
}
