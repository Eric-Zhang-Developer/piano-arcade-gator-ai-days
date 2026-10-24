// Judging, exactly mission.md's rule. Pure: no React, no clock. Live play and judgeTake share this one class.
import type { Chart, ChartNote, GameEvent, Judgment, NoteJudgment, Rank, Results, Take } from "../../contracts";
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

  // scored: false (wait mode) judges as usual but sends none of the score's moments: no combo milestones, no fever
  // and no full combo. songEnd still goes out, since records, piano-out and the rest need it.
  constructor(
    private readonly chart: Chart,
    private readonly onEvent: (e: GameEvent) => void = () => {},
    private readonly opts: { scored?: boolean } = {},
  ) {
    this.times = chart.notes.map((n) => noteTimeMs(chart, n));
    this.byTime = chart.notes.map((_, i) => i).sort((a, b) => this.times[a] - this.times[b]);
    this.judgments = chart.notes.map(() => null);
    this.gauge = emptyGauge(chart.notes.length);
  }

  press(pitch: number, timeMs: number, eventIndex: number): void {
    if (this.results) return;
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

  advance(nowMs: number): void {
    if (this.results) return;
    for (const i of this.byTime) {
      if (this.times[i] + GOOD_MS >= nowMs) break;
      if (!this.judgments[i]) this.miss(i);
    }
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
  const judge = new Judge(chart);
  const order = take.events.map((_, i) => i).sort((a, b) => take.events[a].timeMs - take.events[b].timeMs);
  for (const i of order) {
    judge.advance(take.events[i].timeMs);
    judge.press(take.events[i].pitch, take.events[i].timeMs, i);
  }
  const lastNote = Math.max(0, ...chart.notes.map((n) => noteTimeMs(chart, n)));
  const lastEvent = order.length ? take.events[order[order.length - 1]].timeMs : 0;
  return judge.finish(Math.max(lastNote + GOOD_MS, lastEvent));
}
