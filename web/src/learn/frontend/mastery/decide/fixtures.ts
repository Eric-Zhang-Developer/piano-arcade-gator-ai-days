// A small graph for the decide tests, in the style of engine/replay.test.ts.
import type { Attempt, Curriculum, Edge, Node, PlayingItem, TheoryItem } from '../schema';

const node = (id: string, layer: Node['layer'], kind: Node['kind'] = 'declarative'): Node => ({
  id,
  region: 'pitch',
  layer,
  kind,
  title: `T-${id}`,
  whyImportant: '',
  sources: [],
});
const choice = (id: string) => ({ id, text: id, explanation: '' });
const theory = (id: string, nodeId: string): TheoryItem => ({
  type: 'theory',
  id,
  nodeId,
  prompt: id,
  answer: choice('right'),
  wrong: [choice('w0'), choice('w1')],
});
const playing = (id: string, nodeId: string): PlayingItem => ({
  type: 'playing',
  id,
  nodeId,
  prompt: id,
  notes: [],
  bpm: 80,
  pass: { notesInOrder: 0.9, timingSpreadMs: 40, velocitySpread: 12 },
});
const edge = (from: string, to: string, weight: Edge['weight']): Edge => ({
  from,
  to,
  relation: 'in-context' as const,
  weight,
  rationale: '',
});

/**
 * `scale` is the node the tests master. `keys`, `octave`, `chords` and `steps` link to it, `rhythm` links only to
 * `steps`, and `far` links to nothing. `song-a` needs `chords`; `song-b` needs `chords` and `steps`.
 */
export const curriculum: Curriculum = {
  nodes: [
    node('scale', 'concept', 'procedural'),
    node('keys', 'backbone'),
    node('octave', 'concept'),
    node('chords', 'concept', 'procedural'),
    node('steps', 'detail'),
    node('rhythm', 'detail'),
    node('far', 'backbone'),
  ],
  edges: [
    edge('scale', 'keys', 4),
    edge('octave', 'scale', 3),
    edge('scale', 'chords', 2),
    edge('keys', 'chords', 1),
    edge('steps', 'scale', 5),
    edge('steps', 'rhythm', 3),
  ],
  items: [
    playing('scale-1', 'scale'),
    playing('scale-2', 'scale'),
    theory('keys-1', 'keys'),
    theory('octave-1', 'octave'),
    playing('chords-1', 'chords'),
    theory('steps-1', 'steps'),
    theory('rhythm-1', 'rhythm'),
    theory('far-1', 'far'),
  ],
  songs: [
    { songId: 'song-a', nodeIds: ['chords'] },
    { songId: 'song-b', nodeIds: ['chords', 'steps'] },
  ],
};

export const start = Date.parse('2026-10-01T12:00:00.000Z');
export const hour = 60 * 60 * 1000;
export const day = 24 * hour;

let seq = 0;
type Opts = Partial<Pick<Attempt, 'correct' | 'helpShare' | 'revealed'>> & { at?: number };
/** A cold, correct activity attempt on an item, a minute after the last one unless `at` says otherwise. */
export function attempt(itemId: string, { at = start + seq * 60_000, ...o }: Opts = {}): Attempt {
  const item = curriculum.items.find(i => i.id === itemId)!;
  const base = {
    id: `a${String(seq++).padStart(3, '0')}`,
    learnerId: 'me',
    at: new Date(at).toISOString(),
    itemId,
    nodeId: item.nodeId,
    mode: 'activity' as const,
    correct: o.correct ?? true,
    cold: (o.helpShare ?? 0) === 0,
    helpShare: o.helpShare ?? 0,
    revealed: o.revealed ?? false,
  };
  return item.type === 'theory'
    ? { ...base, kind: 'theory', details: { choiceId: base.correct ? 'right' : 'w0' } }
    : { ...base, kind: 'playing', details: { notesInOrder: 1, timingSpreadMs: 20, velocitySpread: 8 } };
}

/** Promotes `scale` with three cold successes on its two playing items; its cold check is due a day later. */
export const masterScale = () => [
  attempt('scale-1', { at: start }),
  attempt('scale-1', { at: start + 60_000 }),
  attempt('scale-2', { at: start + 120_000 }),
];
