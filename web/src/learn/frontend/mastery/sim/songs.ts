import type { Chart, Results, Take, TakeEvent } from '../../../../contracts';
import { judgeTake, noteTimeMs } from '../../../../game/core/judge';
import { curriculum } from '../curriculum';
import type { SyntheticLearner } from './learner';
import {
  TAKE_ACCURACY_SLIP,
  TAKE_PRACTICE_GAIN,
  TAKE_QUIT_SHARE,
  TAKE_SLIP,
  TAKE_START_MIN,
  TAKE_TIMING_SHARE,
  TAKES_PER_SONG,
} from './params';
import { between, chance, mix, mulberry32, normal, type Random } from './random';

/** Laptop keys strike every note at 80 (the Take contract). */
const KEYS_VELOCITY = 80;
const MIDI_VELOCITY = 72;
const MINUTE_MS = 60_000;

const hash = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0, 0x811c9dc5);

/** How well the learner plays a song: their hidden mastery over the nodes the song needs. */
export function songSkill(learner: Pick<SyntheticLearner, 'knows'>, songId: string): number {
  const nodes = curriculum.songs.find(s => s.songId === songId)?.nodeIds ?? [];
  const known = nodes.map(id => learner.knows[id]).filter((m): m is number => m !== undefined);
  return known.length ? known.reduce((sum, m) => sum + m, 0) / known.length : 0;
}

/** The key presses of one game take: missed and wrong notes and timing spread grow as skill falls. */
function playChart(random: Random, chart: Chart, learner: SyntheticLearner, skill: number): TakeEvent[] {
  const keys = learner.input === 'keyboard';
  const slip = (1 - skill) * TAKE_SLIP + (1 - learner.accuracy) * TAKE_ACCURACY_SLIP;
  const timingSd = learner.timingNoiseMs * TAKE_TIMING_SHARE * (1 + 2.5 * (1 - skill));
  const velocitySd = learner.velocityNoise * (1 + 1.5 * (1 - skill));
  const stopAt = chance(random, TAKE_QUIT_SHARE) ? Math.floor(random() * chart.notes.length) : chart.notes.length;
  const beatMs = 60000 / chart.bpm;
  const events: TakeEvent[] = [];
  for (const note of chart.notes.slice(0, stopAt)) {
    if (chance(random, slip) && chance(random, 0.5)) continue; // missed
    const pitch = chance(random, slip) ? note.pitch + (chance(random, 0.5) ? 1 : -1) : note.pitch;
    const timeMs = noteTimeMs(chart, note) + normal(random) * timingSd;
    const velocity = keys ? KEYS_VELOCITY : Math.round(Math.min(127, Math.max(1, MIDI_VELOCITY + normal(random) * velocitySd)));
    events.push({ pitch, velocity, timeMs, offTimeMs: timeMs + Math.max(30, note.duration * beatMs * 0.9) });
  }
  return events.sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * The learner's game takes of one song, oldest first, each judged by the game's own `judgeTake`: what /progress
 * reads. They start a few minutes into sittings the learner had, and improve a little with each take. Pure and
 * seeded by the learner and the song, so the same chart always gives the same takes. To store one, map it with
 * `takeRows` from `web/src/data/mapping.ts` (ids, player and the chart's sha256 come from the loader).
 */
export function syntheticTakes(learner: SyntheticLearner, chart: Chart): { take: Take; results: Results }[] {
  const random = mulberry32(mix(learner.seed, hash(chart.id)));
  const count = Math.round(between(random, TAKES_PER_SONG) + (learner.sessionsPerWeek - 1) / 5);
  const sittings = [...new Set(learner.attempts.filter(a => a.mode === 'activity').map(a => a.at.slice(0, 10)))];
  const days = sittings.length ? sittings : [learner.attempts[0]?.at.slice(0, 10) ?? '2026-05-04'];
  const starts = Array.from({ length: count }, () => {
    const day = days[Math.floor(random() * days.length)];
    const sitting = learner.attempts.find(a => a.at.startsWith(day))?.at ?? `${day}T17:00:00.000Z`;
    return Date.parse(sitting) + between(random, TAKE_START_MIN) * MINUTE_MS;
  }).sort((a, b) => a - b);
  const skill = songSkill(learner, chart.id);
  return starts.map((start, k) => {
    const startedAt = new Date(start + k * MINUTE_MS).toISOString();
    const practiced = skill + (1 - skill) * TAKE_PRACTICE_GAIN * k;
    const take: Take = {
      chartId: chart.id,
      startedAt,
      latencyOffsetMs: 0,
      inputDevice: learner.input === 'keyboard' ? 'keys' : 'midi',
      events: playChart(random, chart, learner, practiced),
    };
    return { take, results: judgeTake(chart, take) };
  });
}
