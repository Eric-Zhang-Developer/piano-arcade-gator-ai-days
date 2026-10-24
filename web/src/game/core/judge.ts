// Judging, exactly mission.md's rule. Pure: no React, no clock. Live play and judgeTake share this one class.
import type { Chart, ChartNote, GameEvent, Judgment, NoteJudgment, Rank, Results, Take } from "../../contracts";
import { FEVER_COMBO, GREAT_MS, PERFECT_MS, msPerBeat } from "./settings";

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
  private combo = 0;
  private maxCombo = 0;
  private fever = false;
  private results: Results | null = null;

  constructor(
    private readonly chart: Chart,
    private readonly onEvent: (e: GameEvent) => void = () => {},
  ) {
    this.times = chart.notes.map((n) => noteTimeMs(chart, n));
    this.byTime = chart.notes.map((_, i) => i).sort((a, b) => this.times[a] - this.times[b]);
    this.judgments = chart.notes.map(() => null);
  }

  press(pitch: number, timeMs: number, eventIndex: number): void {
    if (this.results) return;
    let best = -1;
    for (const i of this.byTime) {
      if (this.judgments[i] || this.chart.notes[i].pitch !== pitch) continue;
      const d = Math.abs(timeMs - this.times[i]);
      if (d <= GREAT_MS && (best < 0 || d < Math.abs(timeMs - this.times[best]))) best = i;
    }
    if (best < 0) {
      this.extras.push({ eventIndex });
      this.onEvent({ type: "extra", pitch, atMs: timeMs });
      return;
    }
    const note = this.chart.notes[best];
    const offsetMs = timeMs - this.times[best];
    const judgment = Math.abs(offsetMs) <= PERFECT_MS ? "PERFECT" : "GREAT";
    this.judgments[best] = { noteId: note.id, judgment, offsetMs, eventIndex };
    this.noteState.set(note.id, judgment);
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.onEvent({ type: "noteHit", noteId: note.id, pitch, judgment, offsetMs, atMs: timeMs });
    this.onEvent({ type: "combo", count: this.combo, atMs: timeMs });
    if (isMilestone(this.combo)) this.onEvent({ type: "comboMilestone", count: this.combo, atMs: timeMs });
    if (this.combo === FEVER_COMBO && !this.fever) {
      this.fever = true;
      this.onEvent({ type: "feverStart", atMs: timeMs });
    }
  }

  advance(nowMs: number): void {
    if (this.results) return;
    for (const i of this.byTime) {
      if (this.times[i] + GREAT_MS >= nowMs) break;
      if (!this.judgments[i]) this.miss(i);
    }
  }

  finish(atMs: number): Results {
    if (this.results) return this.results;
    for (const i of this.byTime) if (!this.judgments[i]) this.miss(i);
    const judgments = this.judgments as NoteJudgment[];
    const counts: Results["counts"] = { PERFECT: 0, GREAT: 0, MISS: 0, extra: this.extras.length };
    for (const j of judgments) counts[j.judgment] = (counts[j.judgment] ?? 0) + 1; // tolerates judgments added later
    const accuracy = judgments.length ? (counts.PERFECT + 0.5 * counts.GREAT) / judgments.length : 0;
    this.results = {
      chartId: this.chart.id,
      judgments,
      extras: this.extras,
      counts,
      accuracy,
      maxCombo: this.maxCombo,
      rank: rankFor(accuracy),
    };
    if (counts.MISS === 0) this.onEvent({ type: "fullCombo", atMs });
    this.onEvent({ type: "songEnd", results: this.results, atMs });
    return this.results;
  }

  private miss(i: number): void {
    const note = this.chart.notes[i];
    const atMs = this.times[i] + GREAT_MS;
    this.judgments[i] = { noteId: note.id, judgment: "MISS", offsetMs: null, eventIndex: null };
    this.noteState.set(note.id, "MISS");
    this.combo = 0;
    this.onEvent({ type: "noteMiss", noteId: note.id, pitch: note.pitch, atMs });
    if (this.fever) {
      this.fever = false;
      this.onEvent({ type: "feverEnd", atMs });
    }
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
  return judge.finish(Math.max(lastNote + GREAT_MS, lastEvent));
}
