// Veritas's test players (spec: veritas): each plays a chart with planted mistakes and lists what it planted, so a
// test knows the answer before the judge does. Pure: chart in, take and plants out. The judge, chords and windows are
// the game's own, imported read-only.
import type { Chart, Hand, Results, Take, TakeEvent } from "../contracts";
import { findChords, isRolled, scoreChords } from "../game/chord-sync/chords";
import { noteTimeMs } from "../game/core/judge";
import { KEYS_VELOCITY, msPerBeat, NEAR_MISS_MS, PERFECT_MS } from "../game/core/settings";
import { seededRandom } from "../game/sim/fake";

export type Plant =
  | { kind: "wrong"; note: number; pitch: number; event: number } // `note` left unplayed, `pitch` pressed instead
  | { kind: "early" | "late"; note: number; offsetMs: number }
  | { kind: "rolled"; hand: Hand; beat: number; notes: number[] }
  | { kind: "tempo"; factor: number };
export type Run = { take: Take; planted: Plant[] };

export const ROLL_MS = 60; // a rolled chord's spread, low note to high: twice chord-sync's 30 ms
export const JITTER_MS = 60;
export const RUSH = 1.15;

const times = (chart: Chart) => chart.notes.map((n) => noteTimeMs(chart, n));

// No other note of the same pitch within NEAR_MISS_MS, so the judge can't pair a press with a neighbour. A rule of
// the chart, never of the judge's output.
function safeNotes(chart: Chart): boolean[] {
  const t = times(chart);
  return chart.notes.map((n, i) => !chart.notes.some((m, j) => j !== i && m.pitch === n.pitch && Math.abs(t[j] - t[i]) <= NEAR_MISS_MS));
}

// The pitch a fumble presses: a semitone up, else down, whichever has no chart note within NEAR_MISS_MS (so the
// press is WRONG, not some note's timing). null: neither is free.
function fumble(chart: Chart, i: number): number | null {
  const t = times(chart);
  const free = (p: number) => !chart.notes.some((m, j) => m.pitch === p && Math.abs(t[j] - t[i]) <= NEAR_MISS_MS);
  const p = chart.notes[i].pitch;
  return free(p + 1) ? p + 1 : free(p - 1) ? p - 1 : null;
}

// A take with every note pressed on time, then `edit` moves or swaps presses. Event i is note i's press.
function play(chart: Chart, edit: (events: TakeEvent[], t: number[]) => Plant[] = () => []): Run {
  const t = times(chart);
  const beat = msPerBeat(chart.bpm);
  const events = chart.notes.map((n, i) => ({ pitch: n.pitch, velocity: KEYS_VELOCITY, timeMs: t[i], offTimeMs: t[i] + n.duration * beat }));
  const planted = edit(events, t);
  return { take: { chartId: chart.id, startedAt: new Date(0).toISOString(), latencyOffsetMs: 0, inputDevice: "test", events }, planted };
}

const wrongAt = (events: TakeEvent[], i: number, pitch: number): Plant => {
  events[i] = { ...events[i], pitch };
  return { kind: "wrong", note: i, pitch, event: i };
};

// The whole take at 115%: every press at t / 1.15.
export const rusher = (chart: Chart): Run =>
  play(chart, (events) => {
    for (const e of events) [e.timeMs, e.offTimeMs] = [e.timeMs / RUSH, e.offTimeMs! / RUSH];
    return [{ kind: "tempo", factor: RUSH }];
  });

// Each safe note off by up to ±60 ms. Planted: those past PERFECT. Chord notes are left on time, since a jittered
// chord is a rolled one (decision veritas-jitter-chords).
export const jitter = (chart: Chart, seed = 1): Run =>
  play(chart, (events, t) => {
    const r = seededRandom(seed);
    const safe = safeNotes(chart);
    const inChord = new Set(findChords(chart).flatMap((c) => c.notes));
    const planted: Plant[] = [];
    chart.notes.forEach((_, i) => {
      if (!safe[i] || inChord.has(i)) return;
      const offsetMs = (r() * 2 - 1) * JITTER_MS;
      events[i] = { ...events[i], timeMs: t[i] + offsetMs, offTimeMs: events[i].offTimeMs! + offsetMs };
      if (Math.abs(offsetMs) > PERFECT_MS) planted.push({ kind: offsetMs < 0 ? "early" : "late", note: i, offsetMs });
    });
    return planted;
  });

// Every 10th note (index 9, 19, …) pressed a semitone off, when it's safe and a semitone is free.
export const fumbler = (chart: Chart): Run =>
  play(chart, (events) => {
    const safe = safeNotes(chart);
    return chart.notes.flatMap((_, i) => {
      const pitch = (i + 1) % 10 === 0 && safe[i] ? fumble(chart, i) : null;
      return pitch === null ? [] : [wrongAt(events, i, pitch)];
    });
  });

// The writeup's golden test: Fumbler's rule on exactly two notes, the 10th and 20th it could plant on.
export const golden = (chart: Chart): Run =>
  play(chart, (events) => {
    const safe = safeNotes(chart);
    const could = chart.notes.map((_, i) => i).filter((i) => safe[i] && fumble(chart, i) !== null);
    return [could[9], could[19]].filter((i) => i !== undefined).map((i) => wrongAt(events, i, fumble(chart, i)!));
  });

// Each chord whose notes are all safe, rolled low to high: note k of m at +60 × k / (m - 1) ms.
export const chordRoller = (chart: Chart): Run =>
  play(chart, (events, t) => {
    const safe = safeNotes(chart);
    return findChords(chart)
      .filter((c) => c.notes.every((i) => safe[i]))
      .map((c) => {
        const low = [...c.notes].sort((a, b) => chart.notes[a].pitch - chart.notes[b].pitch);
        low.forEach((i, k) => {
          const d = (ROLL_MS * k) / (low.length - 1);
          events[i] = { ...events[i], timeMs: t[i] + d, offTimeMs: events[i].offTimeMs! + d };
        });
        return { kind: "rolled", hand: c.hand, beat: c.beat, notes: c.notes } as Plant;
      });
  });

export const PLAYERS = { golden, rusher, jitter, fumbler, chordRoller };

export type Mark = { plant: Plant; found: boolean | null }; // null: the judge has no flag for it (tempo)
export type Tally = { planted: number; found: number | null; falseAlarms: number; marks: Mark[] };

// What the judge marked, against what was planted. Found: a wrong note is MISS with its press among results.wrong;
// an early/late note is GREAT or GOOD at exactly the planted offset; a rolled chord is one chord-sync calls rolled.
// A false alarm is any unplanted note not PERFECT, any WRONG not planted, any unplanted chord rolled. A rushed take
// plants on every note, so nothing in it is a false alarm, and nothing in the judge flags it (spec: Gaps).
export function tally(chart: Chart, run: Run, results: Results): Tally {
  const chords = scoreChords(chart, run.take, results);
  const rolled = new Set(chords.filter(isRolled).map((c) => `${c.hand}@${c.beat}`));
  const wrongEvents = new Set((results.wrong ?? []).map((w) => w.eventIndex));
  const marks: Mark[] = run.planted.map((plant) => {
    if (plant.kind === "tempo") return { plant, found: null };
    if (plant.kind === "rolled") return { plant, found: rolled.has(`${plant.hand}@${plant.beat}`) };
    const j = results.judgments[plant.note];
    if (plant.kind === "wrong") return { plant, found: j.judgment === "MISS" && wrongEvents.has(plant.event) };
    const hit = (j.judgment === "GREAT" || j.judgment === "GOOD") && j.offsetMs !== null && Math.abs(j.offsetMs - plant.offsetMs) < 1e-6;
    return { plant, found: hit && (j.offsetMs! < 0) === (plant.kind === "early") };
  });
  const found = marks.some((m) => m.found === null) ? null : marks.filter((m) => m.found).length;
  if (run.planted.some((p) => p.kind === "tempo")) return { planted: marks.length, found, falseAlarms: 0, marks };

  const covered = new Set(run.planted.flatMap((p) => (p.kind === "rolled" ? p.notes : p.kind === "tempo" ? [] : [p.note])));
  const plantedWrong = new Set(run.planted.flatMap((p) => (p.kind === "wrong" ? [p.event] : [])));
  const plantedChords = new Set(run.planted.flatMap((p) => (p.kind === "rolled" ? [`${p.hand}@${p.beat}`] : [])));
  const falseAlarms =
    results.judgments.filter((j, i) => !covered.has(i) && j.judgment !== "PERFECT").length +
    [...wrongEvents].filter((e) => !plantedWrong.has(e)).length +
    [...rolled].filter((k) => !plantedChords.has(k)).length;
  return { planted: marks.length, found, falseAlarms, marks };
}
