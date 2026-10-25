import type { Attempt, Curriculum, Hand, Node, PassageNote, PlayingItem } from '../mastery/schema';
import type { Verdict } from '../mastery/piano/score';

/** Which hands a take asks for: both, or one while practising hands separate. */
export type Hands = 'both' | Hand;
/** What a playing screen needs of a node, resolved on the server so the curriculum stays out of the browser. */
export type PlayingNode = { node: Pick<Node, 'id' | 'title'>; items: readonly PlayingItem[] };

/** The node and its playing items, or null when the node is unknown or has nothing to play. */
export function playingNode({ nodes, items }: Pick<Curriculum, 'nodes' | 'items'>, id: string): PlayingNode | null {
  const node = nodes.find((n) => n.id === id);
  if (!node || node.kind !== 'procedural') return null;
  const playing = items.filter((i): i is PlayingItem => i.type === 'playing' && i.nodeId === id);
  return playing.length ? { node: { id: node.id, title: node.title }, items: playing } : null;
}

/** The passage's length in beats: the end of its last note. */
export function passageBeats(notes: readonly PassageNote[]): number {
  return notes.reduce((end, n) => Math.max(end, n.startBeat + n.beats), 0);
}

/** The hands the passage uses, right first. */
export function handsOf(item: PlayingItem): Hand[] {
  return (['right', 'left'] as const).filter((h) => item.notes.some((n) => n.hand === h));
}

/** The notes a take with these hands plays. */
export function notesFor(item: PlayingItem, hands: Hands): readonly PassageNote[] {
  return hands === 'both' ? item.notes : item.notes.filter((n) => n.hand === hands);
}

/** The append-only record of one take. It is cold only with no help at all; whether it counts is the engine's call. */
export function playingAttempt(a: { learnerId: string; item: PlayingItem; verdict: Verdict; helpShare: number; id: string; at: string }): Attempt {
  return {
    id: a.id,
    learnerId: a.learnerId,
    at: a.at,
    itemId: a.item.id,
    nodeId: a.item.nodeId,
    mode: 'activity',
    correct: a.verdict.pass,
    cold: a.helpShare === 0,
    helpShare: a.helpShare,
    revealed: false,
    kind: 'playing',
    details: a.verdict.measures,
  };
}

const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** A key's name with its octave, middle C being C4. */
export function keyName(pitch: number): string {
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

/** The notes no key press answered: a press of the same key within half a beat of the start (or half the note). */
export function missedNotes(notes: readonly PassageNote[], played: readonly { pitch: number; from: number }[]): Set<PassageNote> {
  return new Set(notes.filter((n) => !played.some((p) => p.pitch === n.pitch && Math.abs(p.from - n.startBeat) < Math.min(.5, n.beats / 2))));
}
