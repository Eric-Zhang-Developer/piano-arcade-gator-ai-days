import { buildCandidates, fallbackPlan } from '../decide';
import { nextItem, shouldStop } from '../diagnostic/model';
import { colourOf, replay } from '../engine';
import { scoreTake } from '../piano/score';
import type { Activity, Attempt, Curriculum, Goals, Item, NextActivity, PlayingItem, TheoryItem } from '../schema';
import {
  ACCURACY,
  ACTIVITY_GAP_S,
  ANSWER_GAP_S,
  DIAGNOSTIC_QUIT_AFTER,
  DIAGNOSTIC_QUIT_SHARE,
  GOAL_COUNT_WEIGHTS,
  HELP_USE,
  LEARN_RATE,
  LEARN_STEP,
  LEVELS,
  MIDI_SHARE,
  type Range,
  SESSIONS_PER_WEEK,
  SIM_START,
  SITTING,
  SIM_STEPS,
  THEORY_SLIP_RATE,
  TIMING_NOISE_MS,
  VELOCITY_NOISE,
} from './params';
import { between, chance, mix, mulberry32, type Random, sample, uuid, weighted } from './random';
import { simulateTake } from './take';

/** One activity the decide fallback chose and the learner did, and whether it was right or passed. */
export type SimStep = { nodeId: string; activity: Activity; correct: boolean };

export type SyntheticLearner = {
  id: string;
  /** 1 to 200. */
  index: number;
  goals: Goals;
  input: 'midi' | 'keyboard';
  startingLevel: string;
  /** The simulated history, diagnostic first, every attempt's `learnerId` this learner's id. */
  attempts: readonly Attempt[];
  /** The learner's own seed, from the cohort seed and its index: anything else drawn for it (takes) starts here. */
  seed: number;
  sessionsPerWeek: number;
  accuracy: number;
  /** Onset spread around the beat and velocity spread on a fully known node; both grow as mastery falls. */
  timingNoiseMs: number;
  velocityNoise: number;
  /** The mean hidden mastery over every node before the diagnostic: what the learner really knows, never shown to the engine. */
  hiddenMastery: number;
  diagnosticAnswers: number;
  leftDiagnosticEarly: boolean;
  /** Every activity after the diagnostic, in order. */
  steps: readonly SimStep[];
  /** Node colours after the last step. */
  mastered: number;
  inProgress: number;
  /** Hidden mastery per node after the last step: what the learner now really knows. */
  knows: Readonly<Record<string, number>>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (index: number) => String(index).padStart(3, '0');
export const syntheticId = (index: number) => `synthetic-${pad(index)}`;

/** Each node's hidden mastery from the level: a known node high, an unknown one low. */
function hiddenMasteryOf(random: Random, curriculum: Curriculum, level: (typeof LEVELS)[number]): Map<string, number> {
  return new Map(curriculum.nodes.map(node => {
    const p = Math.min(1, level.knows[node.kind] * (level.regions?.[node.region] ?? 1));
    const range: Range = chance(random, p) ? level.known : level.unknown;
    return [node.id, between(random, range)];
  }));
}

/** The node's item for this activity this learner has done least, first in curriculum order on a tie. */
function itemFor(curriculum: Curriculum, nodeId: string, activity: Activity, used: ReadonlyMap<string, number>): Item | null {
  const type = activity === 'sandbox' || activity === 'test' ? 'theory' : 'playing';
  const ofNode = curriculum.items.filter(i => i.nodeId === nodeId);
  const pool = ofNode.some(i => i.type === type) ? ofNode.filter(i => i.type === type) : ofNode;
  let best: Item | null = null;
  for (const item of pool) if (!best || (used.get(item.id) ?? 0) < (used.get(best.id) ?? 0)) best = item;
  return best;
}

/**
 * One synthetic learner, drawn from its own seed and run through the real engine: the diagnostic picks its questions
 * with `nextItem` and stops with `shouldStop`, then each session is the decide fallback's plan (never the model or the
 * network), each take is judged by `scoreTake`, and the map is `replay` of the attempts. The learner's answers come
 * from hidden mastery the engine never sees.
 */
export function simulateLearner(curriculum: Curriculum, seed: number, index: number): SyntheticLearner {
  const random = mulberry32(seed);
  const ids = mulberry32(mix(seed, 0x1d));
  const id = syntheticId(index);

  const level = LEVELS[weighted(random, LEVELS.map(l => l.weight))];
  const input = chance(random, MIDI_SHARE) ? 'midi' : 'keyboard';
  const goals: Goals = {
    songIds: sample(random, curriculum.songs.map(s => s.songId), weighted(random, GOAL_COUNT_WEIGHTS)),
  };
  const sessionsPerWeek = Math.round(between(random, SESSIONS_PER_WEEK));
  const accuracy = between(random, ACCURACY);
  const timingNoiseMs = between(random, TIMING_NOISE_MS);
  const velocityNoise = between(random, VELOCITY_NOISE);
  const helpUse = between(random, HELP_USE);
  const learnRate = between(random, LEARN_RATE);
  const quitAfter = chance(random, DIAGNOSTIC_QUIT_SHARE) ? Math.round(between(random, DIAGNOSTIC_QUIT_AFTER)) : null;
  const hidden = hiddenMasteryOf(random, curriculum, level);
  const hiddenMastery = [...hidden.values()].reduce((sum, m) => sum + m, 0) / hidden.size;

  const attempts: Attempt[] = [];
  const used = new Map<string, number>();
  let now = SIM_START + Math.floor(random() * 14) * DAY_MS;

  /** One answer or take, its outcome drawn from hidden mastery. Returns null when the learner can't play it. */
  function attempt(item: Item, mode: Attempt['mode'], activity: Activity | null): Attempt | null {
    const mastery = hidden.get(item.nodeId) ?? 0;
    const unsure = 1 - mastery;
    const base = {
      id: uuid(ids),
      learnerId: id,
      at: new Date(now).toISOString(),
      itemId: item.id,
      nodeId: item.nodeId,
      mode,
      cold: !used.has(item.id),
    };
    let made: Attempt;
    if (item.type === 'theory') {
      made = theoryAnswer(random, item, mastery, base, activity === 'sandbox' && chance(random, helpUse * unsure));
    } else {
      if (input === 'keyboard') return null;
      const helped = activity === 'practice' && chance(random, helpUse * unsure);
      made = playingTake(random, item, { mastery, accuracy, timingNoiseMs, velocityNoise }, base, helped ? between(random, [0.2, 1]) : 0);
    }
    used.set(item.id, (used.get(item.id) ?? 0) + 1);
    attempts.push(made);
    if (mode === 'activity' && chance(random, learnRate)) hidden.set(item.nodeId, mastery + LEARN_STEP * unsure);
    return made;
  }

  // The diagnostic, exactly as /learn/diagnostic asks it: laptop keys skip every take.
  const skip = new Set<string>();
  let diagnosticAnswers = 0;
  let leftDiagnosticEarly = false;
  for (;;) {
    const item = nextItem(curriculum, attempts, skip);
    if (!item || shouldStop(curriculum, attempts, now, skip)) break;
    if (quitAfter !== null && diagnosticAnswers >= quitAfter) {
      leftDiagnosticEarly = true;
      break;
    }
    if (!attempt(item, 'diagnostic', null)) {
      skip.add(item.id);
      continue;
    }
    diagnosticAnswers++;
    now += between(random, ANSWER_GAP_S) * 1000;
  }

  // Sessions of 3-5 activities, spaced by how often the learner comes back. Like the map, which shows the first of a
  // fresh plan each time the learner returns to it, every activity is decided again from the attempts so far. Laptop
  // keys can't play a take, so a keyboard learner takes the first activity of the plan they can do.
  const steps: SimStep[] = [];
  const playable = (next: NextActivity) => input === 'midi' || next.activity === 'sandbox' || next.activity === 'test';
  sessions: while (steps.length < SIM_STEPS) {
    now += (7 / sessionsPerWeek) * DAY_MS * between(random, [0.6, 1.4]);
    const sitting = Math.round(between(random, SITTING));
    for (let i = 0; i < sitting && steps.length < SIM_STEPS; i++) {
      const plan = fallbackPlan(buildCandidates(curriculum, replay(curriculum, attempts), goals, new Date(now)));
      const next = plan.find(playable);
      const item = next && itemFor(curriculum, next.nodeId, next.activity, used);
      const made = item && attempt(item, 'activity', next.activity);
      if (!next || !made) {
        if (i === 0) break sessions;
        break;
      }
      steps.push({ nodeId: next.nodeId, activity: next.activity, correct: made.correct });
      now += between(random, ACTIVITY_GAP_S) * 1000;
    }
  }

  const colours = [...replay(curriculum, attempts).values()].map(colourOf);
  return {
    id,
    index,
    goals,
    input,
    startingLevel: level.name,
    attempts,
    seed,
    sessionsPerWeek,
    accuracy,
    timingNoiseMs,
    velocityNoise,
    hiddenMastery,
    diagnosticAnswers,
    leftDiagnosticEarly,
    steps,
    mastered: colours.filter(c => c === 'mastered').length,
    inProgress: colours.filter(c => c === 'in-progress').length,
    knows: Object.fromEntries(hidden),
  };
}

type Base = Pick<Attempt, 'id' | 'learnerId' | 'at' | 'itemId' | 'nodeId' | 'mode' | 'cold'>;

/** A known node is answered right unless it slips; an unknown one is a guess among the choices. */
function theoryAnswer(random: Random, item: TheoryItem, mastery: number, base: Base, revealed: boolean): Attempt {
  const knows = chance(random, mastery);
  const right = revealed || (knows ? !chance(random, THEORY_SLIP_RATE) : chance(random, 1 / (1 + item.wrong.length)));
  const choiceId = right ? item.answer.id : item.wrong[Math.floor(random() * item.wrong.length)].id;
  return { ...base, correct: right, helpShare: 0, revealed, kind: 'theory', details: { choiceId } };
}

/** A take judged by the real scorer; help on for some of it makes it practice, not evidence. */
function playingTake(random: Random, item: PlayingItem, hands: Parameters<typeof simulateTake>[2], base: Base, helpShare: number): Attempt {
  const verdict = scoreTake(item, simulateTake(random, item, hands));
  return { ...base, cold: base.cold && helpShare === 0, correct: verdict.pass, helpShare, revealed: false, kind: 'playing', details: verdict.measures };
}
