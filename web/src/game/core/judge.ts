// Judging, exactly mission.md's rule. Pure: no React, no clock. Live play and judgeTake share this one class.
import type { Chart, ChartNote, GameEvent, Judgment, NoteJudgment, Rank, Results, Take, TakeEvent } from "../../contracts";
import { evaluateSustain } from "./sustain";
import { type Gauge, emptyGauge, reduceGauge } from "../fever-gauge/gauge";
import { GOOD_MS, GOOD_WEIGHT, GREAT_MS, NEAR_MISS_MS, PERFECT_MS, msPerBeat } from "./settings";

export function noteTimeMs(chart: Chart, note: ChartNote): number {
  return note.beat * msPerBeat(chart.bpm);
}

const isMilestone = (n: number) => n === 25 || n === 50 || (n >= 100 && n % 100 === 0);

function rankFor(accuracy: number): Rank {
  if (accuracy >= 0.95) return "S";
  if (accuracy >= 0.9) return "A";
  if (accuracy >= 0.8) return "B";
  if (accuracy >= 0.7) return "C";
  return "D";
}

export class Judge {
  readonly noteState = new Map<string, Judgment>();
  private readonly times: number[];
  private readonly byTime: number[]; // note indices, earliest first
  private readonly judgments: (NoteJudgment | null)[];
  private readonly extras: { eventIndex: number }[] = [];
  private readonly wrong: { eventIndex: number }[] = [];
  private combo = 0;
  private maxCombo = 0;
  private gauge: Gauge;
  private results: Results | null = null;
  private presses = new Map<number, TakeEvent>();
  private held = new Map<number, number>();

  // scored: false (wait mode) judges as usual but sends none of the score's moments: no combo milestones, no fever
  // and no full combo. songEnd still goes out, since records, piano-out and the rest need it.
  constructor(
    private readonly chart: Chart,
    private readonly onEvent: (e: GameEvent) => void = () => {},
    private readonly opts: { scored?: boolean; scoringVersion?: 1 | 2 } = {},
  ) {
    this.times = chart.notes.map((n) => noteTimeMs(chart, n));
    this.byTime = chart.notes.map((_, i) => i).sort((a, b) => this.times[a] - this.times[b]);
    this.judgments = chart.notes.map(() => null);
    this.gauge = emptyGauge(chart.notes.length);
  }

  press(pitch: number, timeMs: number, eventIndex: number): void {
    if (this.results) return;
    this.release(pitch, timeMs); // retrigger closes the preceding hold
    this.presses.set(eventIndex, { pitch, velocity: 80, timeMs, offTimeMs: null });
    this.held.set(pitch, eventIndex);
    let best = -1;
    for (const i of this.byTime) {
      if (this.judgments[i] || this.chart.notes[i].pitch !== pitch) continue;
      const d = Math.abs(timeMs - this.times[i]);
      if (d <= GOOD_MS && (best < 0 || d < Math.abs(timeMs - this.times[best]))) best = i;
    }
    if (best < 0) return this.extra(pitch, timeMs, eventIndex);
    const note = this.chart.notes[best];
    const offsetMs = timeMs - this.times[best];
    const d = Math.abs(offsetMs);
    const judgment = d <= PERFECT_MS ? "PERFECT" : d <= GREAT_MS ? "GREAT" : "GOOD";
    this.judgments[best] = { noteId: note.id, judgment, offsetMs, eventIndex };
    this.noteState.set(note.id, judgment);
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const hit: GameEvent = { type: "noteHit", noteId: note.id, pitch, judgment, offsetMs, atMs: timeMs };
    const wasFever = this.gauge.fever;
    this.gauge = reduceGauge(this.gauge, hit);
    this.onEvent(hit);
    this.onEvent({ type: "combo", count: this.combo, atMs: timeMs });
    if (!this.scored) return;
    if (isMilestone(this.combo)) this.onEvent({ type: "comboMilestone", count: this.combo, atMs: timeMs });
    if (this.gauge.fever && !wasFever) this.onEvent({ type: "feverStart", atMs: timeMs });
  }

  release(pitch: number, timeMs: number, eventIndex?: number): void {
    if (this.results) return;
    const index = this.held.get(pitch);
    if (eventIndex !== undefined && index !== eventIndex) return;
    const press = index === undefined ? undefined : this.presses.get(index);
    if (press) press.offTimeMs = Math.max(press.timeMs, timeMs);
    this.held.delete(pitch);
  }

  cancel(pitch: number): void { this.held.delete(pitch); }

  sustainAt(nowMs: number, final = false) {
    const active = new Set(this.held.values());
    const evidence = new Map([...this.presses].filter(([i, e]) => e.offTimeMs !== null || active.has(i)));
    return this.opts.scoringVersion === 2 ? evaluateSustain(this.chart, this.judgments.filter((j): j is NoteJudgment => j !== null), evidence, nowMs, final) : undefined;
  }

  advance(nowMs: number): void {
    if (this.results) return;
    for (const i of this.byTime) {
      if (this.times[i] + GOOD_MS >= nowMs) break;
      if (!this.judgments[i]) this.miss(i);
    }
  }

  // rewind (wait mode's ←): every note at or after fromMs is unjudged again and pressable, and the combo starts over.
  rewind(fromMs: number): void {
    if (this.results) return;
    for (const [i, t] of this.times.entries()) {
      if (t < fromMs - 1e-6 || !this.judgments[i]) continue;
      this.judgments[i] = null;
      this.noteState.delete(this.chart.notes[i].id);
    }
    this.combo = 0;
    this.onEvent({ type: "combo", count: 0, atMs: fromMs });
  }

  finish(atMs: number): Results {
    if (this.results) return this.results;
    for (const i of this.byTime) if (!this.judgments[i]) this.miss(i);
    const judgments = this.judgments as NoteJudgment[];
    const counts: Results["counts"] = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, extra: this.extras.length, wrong: this.wrong.length };
    for (const j of judgments) counts[j.judgment] = (counts[j.judgment] ?? 0) + 1;
    const scored = counts.PERFECT + 0.5 * counts.GREAT + GOOD_WEIGHT * (counts.GOOD ?? 0);
    const accuracy = judgments.length ? scored / (judgments.length + this.wrong.length) : 0;
    this.results = {
      chartId: this.chart.id,
      judgments,
      extras: this.extras,
      wrong: this.wrong,
      counts,
      accuracy,
      maxCombo: this.maxCombo,
      rank: rankFor(accuracy),
      ...(this.opts.scoringVersion === 2 ? { sustain: this.sustainAt(atMs, true) } : {}),
    };
    if (this.scored && counts.MISS === 0 && this.wrong.length === 0) this.onEvent({ type: "fullCombo", atMs });
    this.onEvent({ type: "songEnd", results: this.results, atMs });
    return this.results;
  }

  // A press that matched no note. It's WRONG, breaking the combo, unless it's near a note of its own pitch (that
  // note's timing) or outside the song (count-in, after the end).
  private extra(pitch: number, timeMs: number, eventIndex: number): void {
    this.extras.push({ eventIndex });
    this.onEvent({ type: "extra", pitch, atMs: timeMs });
    const first = this.times[this.byTime[0]];
    const last = this.times[this.byTime[this.byTime.length - 1]];
    if (timeMs < first - GOOD_MS || timeMs > last + GOOD_MS) return;
    if (this.chart.notes.some((n, i) => n.pitch === pitch && Math.abs(timeMs - this.times[i]) <= NEAR_MISS_MS)) return;
    this.wrong.push({ eventIndex });
    this.breakCombo({ type: "wrongNote", pitch, atMs: timeMs });
  }

  private miss(i: number): void {
    const note = this.chart.notes[i];
    const atMs = this.times[i] + GOOD_MS;
    this.judgments[i] = { noteId: note.id, judgment: "MISS", offsetMs: null, eventIndex: null };
    this.noteState.set(note.id, "MISS");
    this.breakCombo({ type: "noteMiss", noteId: note.id, pitch: note.pitch, atMs });
  }

  // A MISS or WRONG: sends it, resets the combo and steps the fever gauge, which ends fever if it was on.
  private breakCombo(e: GameEvent & { type: "noteMiss" | "wrongNote" }): void {
    this.onEvent(e);
    this.combo = 0;
    const wasFever = this.gauge.fever;
    this.gauge = reduceGauge(this.gauge, e);
    if (wasFever && this.scored) this.onEvent({ type: "feverEnd", atMs: e.atMs });
  }

  private get scored(): boolean {
    return this.opts.scored !== false;
  }
}

export function judgeTake(chart: Chart, take: Take): Results {
  const judge = new Judge(chart, undefined, { scoringVersion: take.scoringVersion ?? 1 });
  const timeline = take.events.flatMap((e, i) => [
    { time: e.timeMs, i, off: false },
    ...(take.scoringVersion === 2 && e.offTimeMs !== null ? [{ time: e.offTimeMs, i, off: true }] : []),
  ]).sort((a, b) => a.time - b.time || a.i - b.i || Number(a.off) - Number(b.off));
  const active = new Map<number, number>();
  for (const e of timeline) {
    judge.advance(e.time);
    const pitch = take.events[e.i].pitch;
    if (e.off) {
      judge.release(pitch, e.time, e.i);
      if (active.get(pitch) === e.i) active.delete(pitch);
    } else {
      const previous = active.get(pitch);
      // Canonical live retriggers already have an offTime. A still-null
      // predecessor may be an unplugged/unconfirmed key; never fill its gap.
      if (take.scoringVersion === 2 && previous !== undefined && take.events[previous].offTimeMs === null) judge.cancel(pitch);
      judge.press(pitch, e.time, e.i);
      active.set(pitch, e.i);
    }
  }
  const lastNote = Math.max(0, ...chart.notes.map((n) => noteTimeMs(chart, n)));
  const lastEvent = timeline.at(-1)?.time ?? 0;
  return judge.finish(Math.max(lastNote + GOOD_MS, lastEvent));
}
