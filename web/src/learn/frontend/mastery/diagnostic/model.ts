import { isCorrect } from '../../theory';
import { replay } from '../engine';
import type { Verdict } from '../piano/score';
import type { Attempt, Curriculum, Item, Node, NodeState, PlayingItem, TheoryItem } from '../schema';

/** The diagnostic stops at this much active time, even with backbone nodes still unsettled. */
export const DIAGNOSTIC_MINUTES = 15;
/** A backbone node is settled once its belief is below the low line or above the high one. */
export const SETTLED_LOW = 0.2;
export const SETTLED_HIGH = 0.8;
/** A gap between answers counts as active time up to this long, so a break or a resume next week doesn't end it. */
export const GAP_CAP_MS = 5 * 60_000;

const LAYERS: readonly Node['layer'][] = ['backbone', 'concept', 'detail'];

export const diagnosticAttempts = (attempts: readonly Attempt[]): Attempt[] =>
  attempts.filter((a) => a.mode === 'diagnostic').sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));

/** The prior alone settles nothing: a node needs its own evidence before the diagnostic leaves it. */
export const isSettled = (state: NodeState | undefined): boolean =>
  !!state && state.counted > 0 && (state.belief < SETTLED_LOW || state.belief > SETTLED_HIGH);

/** Time spent in the diagnostic: the gaps between answers, and since the last one, each capped at `GAP_CAP_MS`. */
export function activeMs(attempts: readonly Attempt[], now: number): number {
  const times = diagnosticAttempts(attempts).map((a) => Date.parse(a.at));
  if (!times.length) return 0;
  let total = 0;
  for (let i = 1; i < times.length; i++) total += Math.min(times[i] - times[i - 1], GAP_CAP_MS);
  return total + Math.min(Math.max(now - times[times.length - 1], 0), GAP_CAP_MS);
}

/** The item to ask next, or null when no unsettled node has an item left. */
export function nextItem(curriculum: Curriculum, attempts: readonly Attempt[], skip: ReadonlySet<string> = new Set()): Item | null {
  const states = replay(curriculum, attempts);
  const asked = new Set(diagnosticAttempts(attempts).map((a) => a.itemId));
  const last = diagnosticAttempts(attempts).at(-1)?.kind;
  const open = (item: Item) => !asked.has(item.id) && !skip.has(item.id);

  for (const layer of LAYERS) {
    const candidates = curriculum.nodes.flatMap((node, order) => {
      if (node.layer !== layer || isSettled(states.get(node.id))) return [];
      const item = curriculum.items.find((i) => i.nodeId === node.id && open(i));
      return item ? [{ item, order, distance: Math.abs((states.get(node.id)?.belief ?? 0) - 0.5) }] : [];
    });
    if (!candidates.length) continue;
    const other = candidates.filter((c) => c.item.type !== last);
    const pool = last && other.length ? other : candidates;
    pool.sort((a, b) => a.distance - b.distance || a.order - b.order);
    return pool[0].item;
  }
  return null;
}

/** Done when every backbone node is settled, the active time is up, or there is nothing left to ask. */
export function shouldStop(
  curriculum: Curriculum,
  attempts: readonly Attempt[],
  now: number,
  skip: ReadonlySet<string> = new Set(),
): boolean {
  if (activeMs(attempts, now) >= DIAGNOSTIC_MINUTES * 60_000) return true;
  const states = replay(curriculum, attempts);
  const backbone = curriculum.nodes.filter((n) => n.layer === 'backbone');
  if (backbone.every((n) => isSettled(states.get(n.id)))) return true;
  return nextItem(curriculum, attempts, skip) === null;
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/** A diagnostic answer is cold, unhelped and unrevealed: nothing was shown before it. */
const base = (learnerId: string, item: Item, at: Date) => ({
  id: newId(),
  learnerId,
  at: at.toISOString(),
  itemId: item.id,
  nodeId: item.nodeId,
  mode: 'diagnostic' as const,
  cold: true,
  helpShare: 0,
  revealed: false,
});

export const theoryAttempt = (learnerId: string, item: TheoryItem, choiceId: string, at = new Date()): Attempt => ({
  ...base(learnerId, item, at),
  kind: 'theory',
  correct: isCorrect(item, choiceId),
  details: { choiceId },
});

export const playingAttempt = (learnerId: string, item: PlayingItem, verdict: Verdict, at = new Date()): Attempt => ({
  ...base(learnerId, item, at),
  kind: 'playing',
  correct: verdict.pass,
  details: verdict.measures,
});
