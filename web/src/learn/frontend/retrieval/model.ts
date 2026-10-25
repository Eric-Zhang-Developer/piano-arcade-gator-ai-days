import { choiceById, firstTry, isCorrect, theoryGates, type Attempt, type ClosedQuestion, type Gate } from '../theory';

/** One question of the test and the gate it belongs to, in content order. */
export type Item = { gateId: string; question: ClosedQuestion };
/** Where the student is: the current question, the option they picked, whether it was checked, and every answer so far. */
export type RetrievalState = { index: number; selected: string | null; checked: boolean; attempts: readonly Attempt[] };
export type RetrievalEvent = { type: 'select'; choiceId: string } | { type: 'check' } | { type: 'next' };

export function items(gates: readonly Gate[] = theoryGates): readonly Item[] {
  return gates.flatMap(g => g.questions.map(question => ({ gateId: g.id, question })));
}
export const theoryItems = items();

export const initialRetrieval: RetrievalState = { index: 0, selected: null, checked: false, attempts: [] };

export function current(state: RetrievalState, list: readonly Item[] = theoryItems): Item | undefined {
  return list[state.index];
}

/**
 * One answer per question: pick, Check, then Next. A checked answer is final, so the
 * end summary is judged on exactly what the student answered the first time.
 */
export function retrievalReducer(state: RetrievalState, event: RetrievalEvent, list: readonly Item[] = theoryItems): RetrievalState {
  const item = current(state, list);
  if (!item) return state;
  switch (event.type) {
    case 'select':
      if (state.checked || !choiceById(item.question, event.choiceId)) return state;
      return { ...state, selected: event.choiceId };
    case 'check':
      if (state.checked || state.selected === null) return state;
      return {
        ...state,
        checked: true,
        attempts: [...state.attempts, { type: 'answer', gateId: item.gateId, questionId: item.question.id, choiceId: state.selected }],
      };
    case 'next':
      if (!state.checked) return state;
      return { ...state, index: state.index + 1, selected: null, checked: false };
  }
}

/** The checked answer's verdict, or null before Check. */
export function verdict(state: RetrievalState, list: readonly Item[] = theoryItems) {
  const item = current(state, list);
  if (!item || !state.checked || state.selected === null) return null;
  const choice = choiceById(item.question, state.selected);
  return choice ? { correct: isCorrect(item.question, choice.id), choice } : null;
}

/** Counted only from answers given in this round: questions never answered are left out of both lists. */
export function summary(attempts: readonly Attempt[], gates: readonly Gate[] = theoryGates) {
  const { right, revisit } = firstTry(attempts, gates);
  return { right, revisit, answered: right.length + revisit.length };
}
