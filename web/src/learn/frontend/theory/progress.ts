import { theoryGates } from './content';
import { type Attempt, type ClosedQuestion, type Gate, choiceById, findGate, isCorrect, parseAttempt } from './model';

/** Everything a learner did, in order. Pass state is replayed from it, so nothing derived is ever saved. */
export type TheoryProgress = { attempts: readonly Attempt[] };
export const emptyProgress: TheoryProgress = { attempts: [] };
export type ProgressEvent = Attempt | { type: 'reset' };

/** Where a gate stands. `round` counts the current question's earlier attempts, so its options reshuffle when it comes back. */
export type GateProgress =
  | { status: 'open'; current: ClosedQuestion; round: number; passed: number; total: number }
  | { status: 'passed'; total: number };

/**
 * A gate is a queue in question order. A correct answer passes the question at its head; a miss or a reveal sends it
 * to the back, so it comes back after the others. With one question left, "after the others" is next.
 */
export function gateProgress(gate: Gate, attempts: readonly Attempt[]): GateProgress {
  let queue: readonly ClosedQuestion[] = gate.questions;
  const tries = new Map<string, number>();
  for (const a of attempts) {
    const [head, ...rest] = queue;
    if (!head || a.gateId !== gate.id || a.questionId !== head.id) continue;
    tries.set(head.id, (tries.get(head.id) ?? 0) + 1);
    queue = a.type === 'answer' && isCorrect(head, a.choiceId) ? rest : [...rest, head];
  }
  const total = gate.questions.length;
  const [current] = queue;
  if (!current) return { status: 'passed', total };
  return { status: 'open', current, round: tries.get(current.id) ?? 0, passed: total - queue.length, total };
}

/** Keeps only attempts on the question a gate is showing, with an option that question has. Anything else is ignored. */
export function progressReducer(s: TheoryProgress, e: ProgressEvent, gates: readonly Gate[] = theoryGates): TheoryProgress {
  if (e.type === 'reset') return emptyProgress;
  const gate = findGate(gates, e.gateId);
  const g = gate && gateProgress(gate, s.attempts);
  if (g?.status !== 'open' || g.current.id !== e.questionId) return s;
  if (e.type === 'answer' && !choiceById(g.current, e.choiceId)) return s;
  return { attempts: [...s.attempts, e] };
}

/** The first gate not yet passed, in content order, or undefined once every gate has passed. */
export function openGate(attempts: readonly Attempt[], gates: readonly Gate[] = theoryGates): Gate | undefined {
  return gates.find(g => gateProgress(g, attempts).status === 'open');
}
export function allPassed(attempts: readonly Attempt[], gates: readonly Gate[] = theoryGates): boolean {
  return !openGate(attempts, gates);
}

/** Questions by how their first attempt went, in content order. A question never attempted is in neither list. */
export function firstTry(attempts: readonly Attempt[], gates: readonly Gate[] = theoryGates) {
  const right: ClosedQuestion[] = [];
  const revisit: ClosedQuestion[] = [];
  for (const gate of gates) {
    for (const q of gate.questions) {
      const first = attempts.find(a => a.gateId === gate.id && a.questionId === q.id);
      if (first) (first.type === 'answer' && isCorrect(q, first.choiceId) ? right : revisit).push(q);
    }
  }
  return { right, revisit };
}

export const PROGRESS_KEY = 'pianoArcade.theory.v1';

/** This device's saved progress, replayed through the reducer so an attempt that no longer fits the content drops out. */
export function loadProgress(gates: readonly Gate[] = theoryGates): TheoryProgress {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PROGRESS_KEY);
  } catch {
    // No storage here (server render, blocked, sandboxed): start fresh.
    return emptyProgress;
  }
  if (raw === null) return emptyProgress;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    // Not JSON: start fresh rather than fail the screen.
    return emptyProgress;
  }
  const list = typeof saved === 'object' && saved !== null ? (saved as { attempts?: unknown }).attempts : undefined;
  if (!Array.isArray(list)) return emptyProgress;
  return list.reduce<TheoryProgress>((s, value) => {
    const a = parseAttempt(value);
    return a ? progressReducer(s, a, gates) : s;
  }, emptyProgress);
}

/** Saves progress on this device. Returns false when storage refuses, so the caller can say it won't be kept. */
export function saveProgress(progress: TheoryProgress): boolean {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
