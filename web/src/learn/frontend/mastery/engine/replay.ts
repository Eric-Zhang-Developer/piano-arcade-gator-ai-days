import type { Attempt, Colour, Curriculum, Edge, Item, NodeState } from '../schema';
import {
  BELIEF_CEILING,
  CHECK_DAYS,
  DEFAULT_PRIOR,
  DEMOTE_BELOW,
  LEARN,
  MAX_HELP_SHARE,
  NUDGE_PER_WEIGHT,
  NUDGE_TARGET_FAILURE,
  NUDGE_TARGET_SUCCESS,
  PLAYING_GUESS,
  PLAYING_SLIP,
  PROMOTE_AT,
  PROMOTE_MIN_COUNTED,
  PROMOTE_MIN_ITEMS,
  PROMOTED_BELIEF,
  RETRIEVAL_SLIP,
  THEORY_SLIP,
} from './constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A node no counting attempt has touched yet. */
export function freshState(belief = DEFAULT_PRIOR): NodeState {
  return { phase: 'encoding', belief, counted: 0, itemsSeen: [], nextCheckAt: null };
}

/**
 * Whether an attempt is evidence: no hint was revealed and help was on for at most 30% of it. A theory answer has no
 * help share, so only a reveal stops it counting.
 */
export function counts(attempt: Attempt): boolean {
  return !attempt.revealed && attempt.helpShare <= MAX_HELP_SHARE;
}

/** Unknown until a counting attempt lands, mastered in retrieval, in progress otherwise. */
export function colourOf(state: NodeState): Colour {
  if (state.counted === 0) return 'unknown';
  return state.phase === 'retrieval' ? 'mastered' : 'in-progress';
}

/** A theory item's guess is one over its number of choices. */
function guessOf(item: Item): number {
  return item.type === 'theory' ? 1 / (1 + item.wrong.length) : PLAYING_GUESS;
}

/** The knowledge-tracing posterior after one observed answer. */
function observe(belief: number, correct: boolean, guess: number, slip: number): number {
  const known = belief * (correct ? 1 - slip : slip);
  const unknown = (1 - belief) * (correct ? guess : 1 - guess);
  return known / (known + unknown);
}

function addDays(at: number, days: number): string {
  return new Date(at + days * DAY_MS).toISOString();
}

/**
 * Pulls every untouched node linked to `nodeId` toward 0.8 on a diagnostic success or 0.02 on a failure, by the
 * edge's weight. Only the belief moves: phase, counts and colour stay, so an untouched node stays unknown.
 */
export function nudgePriors(
  graph: { edges: readonly Edge[] },
  nodeId: string,
  success: boolean,
  states: ReadonlyMap<string, NodeState>,
): Map<string, NodeState> {
  const target = success ? NUDGE_TARGET_SUCCESS : NUDGE_TARGET_FAILURE;
  const next = new Map(states);
  for (const { from, to, weight } of graph.edges) {
    const other = from === nodeId ? to : to === nodeId ? from : null;
    const state = other === null || other === nodeId ? undefined : next.get(other);
    if (other === null || !state || state.counted > 0) continue;
    next.set(other, { ...state, belief: state.belief + (target - state.belief) * weight * NUDGE_PER_WEIGHT });
  }
  return next;
}

/**
 * Every node's state, replayed from the attempts in time order (ties by id, so any input order gives the same result).
 * Attempts that don't count, or whose item isn't in the curriculum under that node, change nothing. Time alone never
 * lowers a belief: there is no decay, only the next check coming due.
 *
 * Encoding: each counting attempt updates the belief, then the node may learn. It moves to retrieval at 0.95 with at
 * least three counting attempts on two items, starting there at 0.99 with a check due in a day.
 * Retrieval: no learning, and a failure is rarely a slip. A success moves the next check out a step, a failure brings
 * it back to the first; below 0.6 the node goes back to encoding.
 */
export function replay(curriculum: Curriculum, attempts: readonly Attempt[]): ReadonlyMap<string, NodeState> {
  let states = new Map<string, NodeState>(curriculum.nodes.map(n => [n.id, freshState()]));
  const items = new Map(curriculum.items.map(i => [i.id, i]));
  const step = new Map<string, number>();

  const ordered = attempts
    .map(a => ({ a, at: Date.parse(a.at) }))
    .filter(({ at }) => Number.isFinite(at))
    .sort((x, y) => x.at - y.at || (x.a.id < y.a.id ? -1 : x.a.id > y.a.id ? 1 : 0));

  for (const { a, at } of ordered) {
    const item = items.get(a.itemId);
    const state = states.get(a.nodeId);
    if (!item || !state || item.nodeId !== a.nodeId || !counts(a)) continue;

    const guess = guessOf(item);
    const counted = state.counted + 1;
    const itemsSeen = state.itemsSeen.includes(item.id) ? state.itemsSeen : [...state.itemsSeen, item.id];
    let next: NodeState;

    if (state.phase === 'encoding') {
      const observed = observe(state.belief, a.correct, guess, item.type === 'theory' ? THEORY_SLIP : PLAYING_SLIP);
      const belief = Math.min(BELIEF_CEILING, observed + (1 - observed) * LEARN);
      const promote = belief >= PROMOTE_AT && counted >= PROMOTE_MIN_COUNTED && itemsSeen.length >= PROMOTE_MIN_ITEMS;
      if (promote) step.set(a.nodeId, 0);
      next = promote
        ? { phase: 'retrieval', belief: PROMOTED_BELIEF, counted, itemsSeen, nextCheckAt: addDays(at, CHECK_DAYS[0]) }
        : { phase: 'encoding', belief, counted, itemsSeen, nextCheckAt: null };
    } else {
      const belief = Math.min(BELIEF_CEILING, observe(state.belief, a.correct, guess, RETRIEVAL_SLIP));
      const s = a.correct ? Math.min((step.get(a.nodeId) ?? 0) + 1, CHECK_DAYS.length - 1) : 0;
      step.set(a.nodeId, s);
      next =
        belief < DEMOTE_BELOW
          ? { phase: 'encoding', belief, counted, itemsSeen, nextCheckAt: null }
          : { phase: 'retrieval', belief, counted, itemsSeen, nextCheckAt: addDays(at, CHECK_DAYS[s]) };
    }

    states.set(a.nodeId, next);
    if (a.mode === 'diagnostic') states = nudgePriors(curriculum, a.nodeId, a.correct, states);
  }
  return states;
}
