// Takes for one synthetic learner: real chart notes, played with the learner's timing, misses, wrong notes and hand
// bias, judged by the game's own judgeTake and turned into rows by takeRows, exactly as /api/takes stores a take.
// Pure and deterministic: the same learner and the same `now` give the same rows. Nothing here touches the network.
import type { Chart, Take, TakeEvent } from "../../contracts";
import { judgeTake, noteTimeMs } from "../../game/core/judge";
import { songSkill, type SyntheticLearner } from "../../learn/frontend/mastery/sim";
import { barOf, songRow, takeRows, type NoteRow, type SongRow, type TakeRow } from "../mapping";

// Every range below is made up for the simulation, not measured from students: they only make the learners differ.

/** A committed chart and the SHA-256 of its file, as /api/takes hashes it. */
export type ChartSource = { chart: Chart; sha256: string };
export type SyntheticTake = { take: TakeRow; notes: NoteRow[] };
export type SyntheticRows = { handle: string; takes: SyntheticTake[]; songs: SongRow[] };

/** The calendar's span: no take is older than this. */
export const SPAN_DAYS = 83;
/** A whole-song take is played only below this many notes; longer songs are practiced a few bars at a time. */
const FULL_SONG_MAX_NOTES = 180;
/** A bar-range drill aims for about this many notes. */
const DRILL_NOTES: readonly [number, number] = [16, 56];
/** Sittings kept per learner, the newest: a lapsed learner played a few times, an active one more. The ranges keep the
 * whole cohort near 200k judged notes. */
const SITTINGS = { lapsed: [3, 8], active: [8, 16] } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: Random, low: number, high: number) => low + (high - low) * r();
const int = (r: Random, low: number, high: number) => Math.floor(between(r, low, high + 1));
const clamp = (x: number, low: number, high: number) => Math.min(high, Math.max(low, x));
const normal = (r: Random) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const hex = (r: Random, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("");
/** A v4-shaped uuid from the learner's own stream, so a rerun makes the same ids. */
const uuid = (r: Random) => `${hex(r, 8)}-${hex(r, 4)}-4${hex(r, 3)}-${"89ab"[Math.floor(r() * 4)]}${hex(r, 3)}-${hex(r, 12)}`;

/** `synthetic 042`: the players.handle every synthetic learner gets (the CHECK allows letters, digits and spaces). */
export const handleOf = (learner: Pick<SyntheticLearner, "index">) => `synthetic ${String(learner.index).padStart(3, "0")}`;

/** How hard a chart is to play, 0 to 1, from its notes per second. */
export function difficulty(chart: Chart): number {
  const last = Math.max(...chart.notes.map((n) => n.beat + n.duration));
  const seconds = (last * 60) / chart.bpm;
  return clamp((chart.notes.length / Math.max(seconds, 1) - 1) / 9, 0, 1);
}

/** What the learner's hands can do: a playing skill from what they know and how cleanly they play. */
function traitsOf(learner: SyntheticLearner, r: Random) {
  const cleanHands = clamp((learner.accuracy - 0.6) / 0.38, 0, 1);
  const skill = clamp(0.06 + 0.72 * learner.hiddenMastery + 0.24 * cleanHands + 0.05 * normal(r), 0.04, 0.95);
  const weak: "L" | "R" = r() < 0.8 ? "L" : "R";
  return {
    skill,
    /** Where practice takes them on a song they keep playing. */
    ceiling: skill + (1 - skill) * between(r, 0.25, 0.65),
    /** Takes on one song until most of the gain is in. */
    pace: between(r, 2, 6),
    weak,
    /** Mean timing per hand, ms (+ late): the weaker hand drags. */
    bias: { [weak]: between(r, 6, 32), [weak === "L" ? "R" : "L"]: between(r, -10, 8) } as Record<"L" | "R", number>,
    /** The weaker hand also misses more. */
    weakMiss: between(r, 1.1, 1.8),
    latency: Math.round(between(r, -20, 45)),
    timingMs: learner.timingNoiseMs,
    velocityNoise: learner.velocityNoise,
    /** A MIDI player who sometimes plays on laptop keys instead. */
    keysShare: learner.input === "midi" ? between(r, 0, 0.2) : 1,
  };
}

/** The days (0 = today) the learner sat down to play, newest first. Some play today or yesterday, some have lapsed. */
function sittingDays(learner: SyntheticLearner, r: Random): number[] {
  const lapsed = r() < 0.55 - learner.sessionsPerWeek * 0.07;
  const last = lapsed ? int(r, 6, 40) : r() < 0.55 ? 0 : 1;
  const first = Math.min(SPAN_DAYS, last + int(r, 14, SPAN_DAYS));
  const days: number[] = [];
  // An active learner's current run: a few days in a row ending at their last sitting.
  const run = lapsed ? 1 : int(r, 1, Math.max(1, Math.round(learner.sessionsPerWeek * 1.4)));
  for (let d = last; d < last + run && d <= first; d++) days.push(d);
  let d = last + run;
  while (d <= first) {
    days.push(d);
    d += Math.max(1, Math.round(-Math.log(1 - r()) * (7 / learner.sessionsPerWeek)));
  }
  const [low, high] = SITTINGS[lapsed ? "lapsed" : "active"];
  return days.slice(0, int(r, low, high));
}

/** The songs the learner works on: their goal songs first, then a few near their level. */
function repertoire(learner: SyntheticLearner, sources: readonly ChartSource[], skill: number, r: Random): ChartSource[] {
  const byId = new Map(sources.map((s) => [s.chart.id, s]));
  const goals = learner.goals.songIds.flatMap((id) => byId.get(id) ?? []);
  const rest = sources
    .filter((s) => !goals.includes(s))
    .map((s) => ({ s, fit: Math.abs(difficulty(s.chart) - skill * 0.85) + r() * 0.25 }))
    .sort((a, b) => a.fit - b.fit)
    .map((x) => x.s);
  return [...goals, ...rest.slice(0, int(r, 1, goals.length ? 3 : 4))];
}

/** Bars to drill: a short stretch of the chart with some notes in it. */
function drillBars(chart: Chart, r: Random): [number, number] {
  const bars = chart.notes.map((n) => barOf(n.beat, chart.beatsPerBar));
  const lastBar = Math.max(...bars);
  const perBar = chart.notes.length / lastBar;
  const length = clamp(Math.round(between(r, DRILL_NOTES[0], DRILL_NOTES[1]) / perBar), 1, lastBar);
  for (;;) {
    const from = int(r, 1, lastBar - length + 1);
    if (bars.some((b) => b >= from && b < from + length)) return [from, from + length - 1];
  }
}

/** One take of the chart (or of bars `from`-`to` of it, played from their first beat) at quality `q` (0 to 1). */
function play(
  chart: Chart,
  q: number,
  traits: ReturnType<typeof traitsOf>,
  input: "midi" | "keys",
  r: Random,
): TakeEvent[] {
  const events: TakeEvent[] = [];
  const msPerBeat = 60000 / chart.bpm;
  const missBase = 0.01 + 0.5 * (1 - q) ** 1.6;
  const spread = traits.timingMs * (1 + 2.5 * (1 - q));
  for (const n of chart.notes) {
    const at = noteTimeMs(chart, n);
    const miss = missBase * (n.hand === traits.weak ? traits.weakMiss : 1);
    if (r() < miss) {
      // A miss is either silence or the neighbouring key.
      if (r() < 0.35) events.push(press(n.pitch + (r() < 0.5 ? -1 : 1), n.velocity, at + normal(r) * spread, 0.3 * msPerBeat));
      continue;
    }
    events.push(press(n.pitch, n.velocity, at + traits.bias[n.hand] * (1.3 - q) + normal(r) * spread, n.duration * msPerBeat * 0.85));
    if (r() < 0.06 * (1 - q)) events.push(press(n.pitch + (r() < 0.5 ? -2 : 2), n.velocity, at + normal(r) * spread, 0.25 * msPerBeat));
  }
  return events.sort((a, b) => a.timeMs - b.timeMs);

  // Laptop keys always send 80; a piano follows the score's dynamics, less evenly the less sure the learner is.
  function press(pitch: number, scored: number | undefined, timeMs: number, holdMs: number): TakeEvent {
    const base = input === "keys" ? 80 : (scored ?? 70) + normal(r) * traits.velocityNoise * (1 + 1.5 * (1 - q));
    const t = Math.max(0, Math.round(timeMs));
    return { pitch: clamp(pitch, 21, 108), velocity: Math.round(clamp(base, 1, 127)), timeMs: t, offTimeMs: t + Math.max(60, Math.round(holdMs)) };
  }
}

/** Bars `from`-`to` of the chart as a chart of their own starting at beat 0, which is how a bar loop plays them. */
function excerpt(chart: Chart, [from, to]: [number, number]): { chart: Chart; shift: number } {
  const shift = (from - 1) * chart.beatsPerBar;
  const notes = chart.notes
    .filter((n) => barOf(n.beat, chart.beatsPerBar) >= from && barOf(n.beat, chart.beatsPerBar) <= to)
    .map((n) => ({ ...n, beat: n.beat - shift }));
  return { chart: { ...chart, notes }, shift };
}

/**
 * Every take the learner played over the last {@link SPAN_DAYS} days, newest last. Ids, songs, bars and notes depend
 * only on the learner; `now` only places them in time, so a later rerun moves the same takes forward.
 */
export function synthesize(learner: SyntheticLearner, sources: readonly ChartSource[], now: Date): SyntheticRows {
  const r = mulberry32(learner.seed ^ 0x7a4e5);
  const traits = traitsOf(learner, r);
  const songs = repertoire(learner, sources, traits.skill, r);
  const days = sittingDays(learner, r).reverse(); // oldest first, so practice builds up in order
  const played = new Map<string, number>();
  const takes: SyntheticTake[] = [];

  for (const day of days) {
    let at = now.getTime() - day * DAY_MS - between(r, 1, 9) * 3600_000;
    const count = int(r, 1, 2);
    for (let i = 0; i < count; i++) {
      // Each song gets a second take before the learner moves on, so the songs table can show a change.
      const pending = songs.find((s) => played.get(s.chart.id) === 1);
      const source = pending ?? songs[Math.floor(r() * songs.length)];
      const { chart, sha256 } = source;
      const n = played.get(chart.id) ?? 0;
      played.set(chart.id, n + 1);

      const drill = chart.notes.length > FULL_SONG_MAX_NOTES || r() < 0.3;
      const bars = drill ? drillBars(chart, r) : null;
      const part = bars ? excerpt(chart, bars) : { chart, shift: 0 };
      // Where the learner starts on this song: their hands, and what they know of the nodes the song needs.
      const start = 0.55 * traits.skill + 0.45 * songSkill(learner, chart.id);
      const progress = start + (traits.ceiling - start) * (1 - Math.exp(-n / traits.pace));
      const q = clamp(progress - 0.3 * difficulty(chart) + (bars ? 0.05 : 0) + 0.12 + 0.05 * normal(r), 0.03, 0.995);
      const input = r() < traits.keysShare ? "keys" : "midi";
      const events = play(part.chart, q, traits, input, r);

      const durationMs = Math.max(0, ...events.map((e) => e.offTimeMs ?? e.timeMs));
      const created = new Date(at);
      const take: Take = {
        chartId: chart.id,
        startedAt: new Date(at - durationMs - int(r, 4, 25) * 1000).toISOString(),
        latencyOffsetMs: input === "keys" ? 0 : traits.latency,
        inputDevice: input,
        events,
      };
      const rows = takeRows({ takeId: uuid(r), playerId: learner.playerId, chartSha256: sha256 }, part.chart, take, judgeTake(part.chart, take));
      const original = new Map(chart.notes.map((n) => [n.id, n]));
      takes.push({
        take: { ...rows.take, bar_from: bars?.[0] ?? null, bar_to: bars?.[1] ?? null, created_at: created.toISOString() },
        // Back to the song's own bars and beats: the drill was judged from its first beat.
        notes: rows.notes.map((row) => {
          const note = original.get(row.note_id)!;
          return { ...row, bar: barOf(note.beat, chart.beatsPerBar), beat: note.beat };
        }),
      });
      at += durationMs + int(r, 40, 300) * 1000;
    }
  }
  const used = new Set(takes.map((t) => t.take.song_id));
  return {
    handle: handleOf(learner),
    takes,
    songs: sources.filter((s) => used.has(s.chart.id)).map((s) => songRow(s.chart, s.sha256)),
  };
}
