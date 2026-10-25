import type { Kind, Region } from '../schema';

// Every range below is made up for the simulation, not measured from students: they only make the learners differ.

/** The one seed the cohort is drawn from. */
export const COHORT_SEED = 0x5eed_2026;
export const COHORT_SIZE = 200;
/** Activities each learner works through after the diagnostic. */
export const SIM_STEPS = 40;
/** Activities in one sitting. */
export const SITTING: Range = [3, 5];
/** The earliest first diagnostic answer: early enough that even a once-a-week learner's last activity is in the past. */
export const SIM_START = Date.parse('2026-05-04T17:00:00.000Z');
/** Seconds between two diagnostic answers, and between two activities in one sitting. */
export const ANSWER_GAP_S: Range = [20, 90];
export const ACTIVITY_GAP_S: Range = [120, 480];

export type Range = readonly [number, number];

/**
 * A starting level: the chance the learner already knows a node, by its kind and region. A known node has hidden
 * mastery drawn from `known`, an unknown one from `unknown`; `weight` is how often the level is drawn.
 */
export type Level = {
  name: string;
  weight: number;
  knows: Record<Kind, number>;
  /** Regions the level knows better or worse than its base chance: multiplies it, capped at 1. */
  regions?: Partial<Record<Region, number>>;
  known: Range;
  unknown: Range;
};

export const LEVELS: readonly Level[] = [
  { name: 'New to music', weight: 3, knows: { declarative: 0.03, procedural: 0.03 }, known: [0.7, 0.9], unknown: [0, 0.1] },
  {
    name: 'Reads music, rarely plays',
    weight: 2,
    knows: { declarative: 0.45, procedural: 0.08 },
    regions: { pitch: 1.8, rhythm: 1.4, expression: 0.5, pieces: 0.4 },
    known: [0.8, 0.97],
    unknown: [0, 0.15],
  },
  {
    name: 'Plays by ear',
    weight: 2,
    knows: { declarative: 0.08, procedural: 0.5 },
    regions: { rhythm: 1.5, chords: 1.3, keys: 0.6 },
    known: [0.75, 0.95],
    unknown: [0.05, 0.2],
  },
  { name: 'Returning after years away', weight: 2, knows: { declarative: 0.35, procedural: 0.3 }, known: [0.55, 0.85], unknown: [0.05, 0.25] },
  { name: 'Advanced', weight: 1, knows: { declarative: 0.8, procedural: 0.75 }, known: [0.85, 0.98], unknown: [0.2, 0.4] },
];

/** The share of learners with a MIDI piano; the rest have only laptop keys, which never count as playing evidence. */
export const MIDI_SHARE = 0.6;
/** How many goal songs a learner picks, 0 to 3, by weight. */
export const GOAL_COUNT_WEIGHTS = [1, 4, 3, 2] as const;
export const SESSIONS_PER_WEEK: Range = [1, 6];
/** How cleanly the hands do what the learner knows: scales wrong notes and timing. */
export const ACCURACY: Range = [0.6, 0.98];
/** Onset spread around the click when a node is fully known, in ms; it grows as hidden mastery falls. */
export const TIMING_NOISE_MS: Range = [18, 45];
/** Velocity spread when a node is fully known; it grows as hidden mastery falls. */
export const VELOCITY_NOISE: Range = [6, 14];
/** The chance an unsure learner turns on help in practice or reveals a hint in theory. */
export const HELP_USE: Range = [0.05, 0.5];
/** The chance one attempt on a node raises its hidden mastery, and by how much of what is left. */
export const LEARN_RATE: Range = [0.15, 0.45];
export const LEARN_STEP = 0.35;
/** Some learners leave the diagnostic early: the share who do, and after how many answers. */
export const DIAGNOSTIC_QUIT_SHARE = 0.25;
export const DIAGNOSTIC_QUIT_AFTER: Range = [4, 14];
/** A theory answer from a node the learner doesn't know is a guess; one they know can still slip. */
export const THEORY_SLIP_RATE = 0.06;

/** Game takes of a song: how many a learner plays, the share stopped partway, and minutes into a sitting they start. */
export const TAKES_PER_SONG: Range = [1, 6];
export const TAKE_QUIT_SHARE = 0.3;
export const TAKE_START_MIN: Range = [5, 40];
/** A take's skill climbs this share of what is left with each earlier take of the song. */
export const TAKE_PRACTICE_GAIN = 0.06;
/**
 * In a game take, the per-note chance of a slip at skill 0 and from imperfect accuracy, and how much of the learner's
 * timing noise reaches a whole song, which they rehearse more than a diagnostic passage.
 */
export const TAKE_SLIP = 0.3;
export const TAKE_ACCURACY_SLIP = 0.04;
export const TAKE_TIMING_SHARE = 0.7;
