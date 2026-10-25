import type { PassageNote, PlayingItem, PlayingMeasures } from '../schema';
import type { PianoEvent } from './capture';

/** One take: the events heard, the time of beat 0 and the tempo the click ran at (lower when slowed). */
export type Take = { startMs: number; bpm: number; events: readonly PianoEvent[] };
/** A stretch of the take with help on: a demo, guide keys, a slowed tempo or hands separate. */
export type HelpSegment = { startMs: number; endMs: number };
export type Verdict = { pass: boolean; measures: PlayingMeasures; off: string[] };

type Played = { pitch: number; velocity: number; onMs: number; offMs: number };

/** Notes struck this close together are one chord, so their order within it doesn't matter. */
const chordMs = 60;
/** A key let go this long before the next one goes down still counts as touching. */
const touchMs = 20;

/** The share of the take, 0 to 1, that had any help on. Overlapping segments count once. */
export function helpShare(segments: readonly HelpSegment[], startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;
  const clipped = segments
    .map((s) => [Math.max(s.startMs, startMs), Math.min(s.endMs, endMs)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let reach = startMs;
  for (const [a, b] of clipped) {
    covered += Math.max(0, b - Math.max(a, reach));
    reach = Math.max(reach, b);
  }
  return covered / (endMs - startMs);
}

/** Scores a take against the item's bars: what it measured, whether every bar was met, and what was off. */
export function scoreTake(item: PlayingItem, take: Take): Verdict {
  const beatMs = 60000 / take.bpm;
  const expected = [...item.notes].sort((a, b) => a.startBeat - b.startBeat || a.pitch - b.pitch);
  const played = notesOf(take.events);
  const matches = align(expected, played);
  const matched = [...matches.values()];
  const errors = [...matches].map(([i, p]) => p.onMs - take.startMs - expected[i].startBeat * beatMs);
  const measures: PlayingMeasures = {
    notesInOrder: matches.size / Math.max(expected.length, played.length, 1),
    timingSpreadMs: spread(errors),
    velocitySpread: spread(matched.map((p) => p.velocity)),
  };
  const off: string[] = [];
  const bar = item.pass;
  if (measures.notesInOrder < bar.notesInOrder) {
    off.push(`${matches.size} of ${expected.length} notes were right and in order` +
      `${played.length > expected.length ? `, with ${played.length - matches.size} extra` : ''}.`);
  }
  if (measures.timingSpreadMs > bar.timingSpreadMs) {
    off.push(`The timing wandered ${Math.round(measures.timingSpreadMs)} ms around the click; keep it within ${bar.timingSpreadMs} ms.`);
  }
  if (measures.velocitySpread > bar.velocitySpread) {
    off.push(`The loudness jumped around by ${Math.round(measures.velocitySpread)}; keep the touch even, within ${bar.velocitySpread}.`);
  }
  if (bar.legato !== undefined) {
    const joins = legatoJoins(expected, matches);
    measures.legato = share(joins);
    if (measures.legato < bar.legato) {
      off.push(`${joins.filter(Boolean).length} of ${joins.length} notes joined smoothly; hold each key until the next one goes down.`);
    }
  }
  if (bar.pedal !== undefined) {
    const changes = pedalChanges(expected, matches, take, beatMs);
    measures.pedal = share(changes);
    if (measures.pedal < bar.pedal) {
      off.push(`${changes.filter(Boolean).length} of ${changes.length} chord changes had a clean pedal change; lift the pedal just after the new chord sounds, then press it again.`);
    }
  }
  return { pass: off.length === 0, measures, off };
}

/** Pairs each key press with its release. A key still down when the take ends is held to the end. */
function notesOf(events: readonly PianoEvent[]): Played[] {
  const down = new Map<number, Played>();
  const notes: Played[] = [];
  for (const e of events) {
    if (e.type === 'on') {
      const held = down.get(e.pitch);
      if (held && held.offMs === Infinity) held.offMs = e.timeMs;
      const n = { pitch: e.pitch, velocity: e.velocity, onMs: e.timeMs, offMs: Infinity };
      down.set(e.pitch, n);
      notes.push(n);
    } else if (e.type === 'off') {
      const n = down.get(e.pitch);
      if (n && n.offMs === Infinity) n.offMs = e.timeMs;
    }
  }
  const chords: Played[][] = [];
  for (const n of notes.sort((a, b) => a.onMs - b.onMs)) {
    const last = chords.at(-1);
    if (last && n.onMs - last[0].onMs <= chordMs) last.push(n);
    else chords.push([n]);
  }
  return chords.flatMap((c) => c.sort((a, b) => a.pitch - b.pitch));
}

/** The longest in-order run of matching pitches (LCS): passage note index to the played note it was matched with. */
function align(expected: readonly PassageNote[], played: readonly Played[]): Map<number, Played> {
  const rows = expected.length + 1;
  const cols = played.length + 1;
  const best = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = expected.length - 1; i >= 0; i--) {
    for (let j = played.length - 1; j >= 0; j--) {
      best[i][j] = expected[i].pitch === played[j].pitch
        ? best[i + 1][j + 1] + 1
        : Math.max(best[i + 1][j], best[i][j + 1]);
    }
  }
  const matches = new Map<number, Played>();
  for (let i = 0, j = 0; i < expected.length && j < played.length;) {
    if (expected[i].pitch === played[j].pitch && best[i][j] === best[i + 1][j + 1] + 1) matches.set(i++, played[j++]);
    else if (best[i + 1][j] >= best[i][j + 1]) i++;
    else j++;
  }
  return matches;
}

/**
 * For each place a hand's note runs into its next one, whether the played notes overlapped or touched. A join with a
 * missed or wrong note is skipped: `notesInOrder` already counts it.
 */
function legatoJoins(expected: readonly PassageNote[], matches: Map<number, Played>): boolean[] {
  const joins: boolean[] = [];
  expected.forEach((a, i) => {
    const j = expected.findIndex((b, k) => k > i && b.hand === a.hand && b.startBeat > a.startBeat);
    const from = matches.get(i);
    const to = matches.get(j);
    if (j < 0 || a.startBeat + a.beats < expected[j].startBeat || !from || !to) return;
    joins.push(from.offMs >= to.onMs - touchMs);
  });
  return joins;
}

/**
 * For each chord change (an onset whose notes differ from the one before), whether the pedal came up after the new
 * chord sounded and went down again within the beat. A change before the chord blurs or breaks it, so it fails.
 */
function pedalChanges(expected: readonly PassageNote[], matches: Map<number, Played>, take: Take, beatMs: number): boolean[] {
  const onsets = new Map<number, number[]>();
  expected.forEach((n, i) => onsets.set(n.startBeat, [...(onsets.get(n.startBeat) ?? []), i]));
  const pedal: { down: boolean; timeMs: number }[] = [];
  for (const e of take.events) {
    if (e.type === 'pedal' && e.down !== (pedal.at(-1)?.down ?? false)) pedal.push(e);
  }
  const groups = [...onsets.values()];
  const pitches = (g: number[]) => g.map((i) => expected[i].pitch).join();
  return groups.slice(1).filter((g, k) => pitches(g) !== pitches(groups[k])).map((g) => {
    const struck = g.flatMap((i) => matches.get(i)?.onMs ?? []);
    const at = struck.length ? Math.min(...struck) : take.startMs + expected[g[0]].startBeat * beatMs;
    const up = pedal.findIndex((p) => !p.down && p.timeMs >= at - touchMs && p.timeMs <= at + beatMs / 2);
    const down = pedal[up + 1];
    return up >= 0 && !!down && down.timeMs <= at + beatMs;
  });
}

function share(flags: readonly boolean[]): number {
  return flags.length ? flags.filter(Boolean).length / flags.length : 1;
}

/** The population standard deviation; 0 for fewer than two values. */
function spread(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}
