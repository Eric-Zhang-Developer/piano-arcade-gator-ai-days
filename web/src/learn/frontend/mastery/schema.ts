import type { ClosedQuestion } from '../theory/model';

/** The six regions of the curriculum, one JSON file each. */
export type Region = 'pitch' | 'rhythm' | 'keys' | 'chords' | 'expression' | 'pieces';
export type Layer = 'backbone' | 'concept' | 'detail';
/** Declarative nodes are known (theory items); procedural nodes are played (playing items). */
export type Kind = 'declarative' | 'procedural';
export type Source = { title: string; url: string };

export type Node = {
  id: string;
  region: Region;
  layer: Layer;
  kind: Kind;
  title: string;
  whyImportant: string;
  sources: readonly Source[];
};

export type Relation = 'in-context' | 'analogous' | 'contradicts';
/** A link between two nodes. It is not a prerequisite: the graph has no order. */
export type Edge = { from: string; to: string; relation: Relation; weight: 1 | 2 | 3 | 4 | 5; rationale: string };

/** A closed question that credits one node. */
export type TheoryItem = ClosedQuestion & { type: 'theory'; nodeId: string };

export type Hand = 'left' | 'right';
/** One note of a passage: a MIDI pitch (60 is middle C), placed and sized in beats. */
export type PassageNote = { pitch: number; startBeat: number; beats: number; hand: Hand };
/**
 * What the piano measures on a take, and the bars a take must meet to pass.
 * `notesInOrder` is the share of the passage's notes played right and in order (bar: at least).
 * `timingSpreadMs` is the standard deviation of onset error against the click (bar: at most).
 * `velocitySpread` is the standard deviation of MIDI velocity across the notes (bar: at most).
 * `legato` is the share of note joins that overlap or touch (bar: at least).
 * `pedal` is the share of chord changes with a pedal change on them (bar: at least).
 */
export type PlayingMeasures = {
  notesInOrder: number;
  timingSpreadMs: number;
  velocitySpread: number;
  legato?: number;
  pedal?: number;
};
/** A short passage that credits one node. */
export type PlayingItem = {
  type: 'playing';
  id: string;
  nodeId: string;
  prompt: string;
  notes: readonly PassageNote[];
  bpm: number;
  pass: PlayingMeasures;
};
export type Item = TheoryItem | PlayingItem;

/** The nodes a library song needs. */
export type SongTag = { songId: string; nodeIds: readonly string[] };

export type Curriculum = {
  nodes: readonly Node[];
  edges: readonly Edge[];
  items: readonly Item[];
  songs: readonly SongTag[];
};

/**
 * One answer or take, appended and never changed. `cold` and `helpShare` (0-1) say how much help was on;
 * `revealed` says a hint was shown. Whether it counts as evidence is derived from these, never stored.
 */
export type Attempt = {
  id: string;
  learnerId: string;
  at: string;
  itemId: string;
  nodeId: string;
  mode: 'diagnostic' | 'activity';
  correct: boolean;
  cold: boolean;
  helpShare: number;
  revealed: boolean;
} & ({ kind: 'theory'; details: { choiceId: string } } | { kind: 'playing'; details: PlayingMeasures });

/** The 1-3 library songs the student is working towards. */
export type Goals = { songIds: readonly string[] };

export type Phase = 'encoding' | 'retrieval';
/** A node's state, computed by replaying attempts. `nextCheckAt` is when the next cold check is due, if any. */
export type NodeState = {
  phase: Phase;
  belief: number;
  counted: number;
  itemsSeen: readonly string[];
  nextCheckAt: string | null;
};
export type Colour = 'unknown' | 'in-progress' | 'mastered';

/** The activity a node's quadrant (kind x phase) calls for. */
export type Activity = 'sandbox' | 'test' | 'practice' | 'playCheck';
export type NextActivity = { nodeId: string; activity: Activity; keywords: readonly string[]; reason: string };
/** The body of `POST /learn/api/next`: the device keeps the attempts, so it sends them. */
export type NextRequest = { attempts: readonly Attempt[]; goals: Goals };
/** 3-5 activities, from the model or, without a key or with a rejected reply, from the top candidates. */
export type NextSession = { activities: readonly NextActivity[]; source: 'model' | 'fallback' };
