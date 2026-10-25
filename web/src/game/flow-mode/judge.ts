// Flow mode's judge (spec: flow-mode): it scores what a listener hears (wrong notes, skipped notes, stopping) and forgives
// what they don't (tempo drift, dynamics). Same shape as core's Judge and the same Results, so the page and the results
// panels take either. Pure: no React. It owns its clock, since the clock waits on the notes this judge marks.
import type { Chart, GameEvent, Judgment, NoteJudgment, Rank, Results } from "../../contracts";
import { type Gauge, emptyGauge, reduceGauge } from "../fever-gauge/gauge";
import { GOOD_WEIGHT, msPerBeat } from "../core/settings";
import type { HandsSetting } from "../hand-mode/hands";
import { flowClock, flowSettings, onsetsOf, type FlowClock, type Onset } from "./clock";

const LOOKAHEAD = 4; // onsets after the front that a press may skip ahead to

const isMilestone = (n: number) => n === 25 || n === 50 || (n >= 100 && n % 100 === 0);

// ponytail: core/judge.ts's rankFor, copied since it isn't exported; export it from core and import it if one changes.
function rankFor(accuracy: number): Rank {
  if (accuracy >= 0.95) return "S";
  if (accuracy >= 0.9) return "A";
  if (accuracy >= 0.8) return "B";
  if (accuracy >= 0.7) return "C";
  return "D";
}

export class FlowJudge {
  readonly noteState = new Map<string, Judgment>();
  readonly clock: FlowClock;
  readonly deviations: number[] = []; // each hit's signed distance from where the player's tempo put it, in beats
  slips = 0; // WRONG notes + skipped notes + lost stops: the results headline's count
  lost = 0; // stops past the free beats
  private readonly chart: Chart; // the judged hand's notes
  private readonly onsets: Onset[];
  private readonly mpb: number;
  private readonly index = new Map<string, number>(); // note id -> index in chart.notes
  private readonly judgments: (NoteJudgment | null)[];
  private readonly firstHit = new Map<number, number>(); // onset ms -> outer time of its first hit
  private readonly extras: { eventIndex: number }[] = [];
  private readonly wrong: { eventIndex: number }[] = [];
  private prev: { ms: number; outer: number } | null = null; // the last played onset
  private lostAt: number | null = null; // the front a lost stop was counted for
  private combo = 0;
  private maxCombo = 0;
  private gauge: Gauge;
  private results: Results | null = null;

  // The newest judge: plugins can't reach the page's judge, so flow mode's plugin reads its clock and slips here.
  static live: FlowJudge | null = null;

  // hands: R or L judges that hand only (hand-mode usually drops the other hand from the chart first). startRate is
  // ?tempo= as a fraction: the player's intended tempo, so steadiness is judged from the second onset.
  constructor(
    chart: Chart,
    private readonly onEvent: (e: GameEvent) => void = () => {},
    private readonly opts: { scored?: boolean; hands?: HandsSetting; startRate?: number } = {},
  ) {
    const hands = opts.hands ?? "both";
    this.chart = hands === "both" ? chart : { ...chart, notes: chart.notes.filter((n) => n.hand === hands) };
    this.chart.notes.forEach((n, i) => this.index.set(n.id, i));
    this.onsets = onsetsOf(this.chart);
    this.mpb = msPerBeat(chart.bpm);
    this.judgments = this.chart.notes.map(() => null);
    this.gauge = emptyGauge(this.chart.notes.length);
    this.clock = flowClock(this.chart, this.onsets, this.noteState, opts.startRate);
    FlowJudge.live = this;
  }

  // The test hook's front: the earliest onset with notes still unplayed, or null once every note is judged.
  get front(): number | null {
    return this.onsets[this.frontIndex()]?.ms ?? null;
  }

  // timeMs is chart time (the page's clock.now), outerMs the pause clock's time, which steadiness is measured in.
  press(pitch: number, timeMs: number, eventIndex: number, outerMs = timeMs): void {
    if (this.results) return;
    const f = this.frontIndex();
    // Outside the song (the count-in, after the last note): played to no note, never WRONG.
    if (f < 0 || timeMs < this.onsets[0].ms - this.mpb) return this.harmless(eventIndex, pitch, timeMs);
    const atFront = this.unplayed(f, pitch);
    if (atFront >= 0) return this.hit(atFront, f, timeMs, outerMs, eventIndex);
    // A pitch of the front already played (a re-strike in a chord) skips nothing and breaks nothing.
    if (this.onsets[f].ids.some((id) => this.chart.notes[this.index.get(id)!].pitch === pitch)) return this.harmless(eventIndex, pitch, timeMs);
    for (let k = f + 1; k < Math.min(this.onsets.length, f + 1 + LOOKAHEAD); k++) {
      const i = this.unplayed(k, pitch);
      if (i < 0) continue;
      for (let s = f; s < k; s++) this.passOver(s, timeMs);
      return this.hit(i, k, timeMs, outerMs, eventIndex);
    }
    // WRONG: it breaks the combo, and the note keeps waiting.
    this.extras.push({ eventIndex });
    this.onEvent({ type: "extra", pitch, atMs: timeMs });
    this.wrong.push({ eventIndex });
    this.slips++;
    this.breakCombo({ type: "wrongNote", pitch, atMs: timeMs });
  }

  // Timing never makes a MISS. A stop past the free beats breaks the combo once and counts as a slip; the song keeps
  // waiting, so the player can always rejoin.
  advance(nowMs: number): void {
    if (this.results) return;
    const at = this.clock.front;
    const free = (flowSettings.freeBeats * this.mpb) / this.clock.rate;
    // Before the first note is played there's no song to fall out of, so waiting there is never a slip.
    if (this.prev === null || !this.clock.holding || this.clock.heldMs <= free || at === this.lostAt) return;
    this.lostAt = at;
    this.lost++;
    this.slips++;
    this.combo = 0;
    this.onEvent({ type: "combo", count: 0, atMs: nowMs });
  }

  // Every note at or after fromMs is unplayed again, and the combo starts over.
  rewind(fromMs: number): void {
    if (this.results) return;
    for (const o of this.onsets) {
      if (o.ms < fromMs - 1e-6) continue;
      this.firstHit.delete(o.ms);
      for (const id of o.ids) {
        this.judgments[this.index.get(id)!] = null;
        this.noteState.delete(id);
      }
    }
    this.prev = null;
    this.lostAt = null;
    this.combo = 0;
    this.onEvent({ type: "combo", count: 0, atMs: fromMs });
  }

  // A take ended early: every still-unplayed note is a MISS (not a slip: nothing was played wrong).
  finish(atMs: number): Results {
    if (this.results) return this.results;
    this.chart.notes.forEach((_, i) => this.judgments[i] ?? this.miss(i, atMs));
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

  private frontIndex(): number {
    return this.onsets.findIndex((o) => o.ids.some((id) => !this.noteState.has(id)));
  }

  // The index of onset k's unplayed note of this pitch, or -1.
  private unplayed(k: number, pitch: number): number {
    for (const id of this.onsets[k].ids) {
      const i = this.index.get(id)!;
      if (!this.judgments[i] && this.chart.notes[i].pitch === pitch) return i;
    }
    return -1;
  }

  private hit(i: number, k: number, timeMs: number, outerMs: number, eventIndex: number): void {
    const o = this.onsets[k];
    const first = this.firstHit.get(o.ms);
    // Where the player's own tempo put this press: a chord's later notes against its first, an onset against the last
    // played onset at the current rate. Until the tempo is known (no sample yet and no ?tempo=), there's no place.
    let dev: number | null = null;
    if (first !== undefined) dev = ((outerMs - first) * this.clock.rate) / this.mpb;
    else if (this.prev && (this.clock.tempoKnown || this.opts.startRate !== undefined)) {
      const predicted = this.prev.outer + (o.ms - this.prev.ms) / this.clock.rate;
      dev = ((outerMs - predicted) * this.clock.rate) / this.mpb;
    }
    if (dev !== null) this.deviations.push(dev);
    const d = Math.abs(dev ?? 0);
    const judgment = d <= flowSettings.perfectBeats ? "PERFECT" : d <= flowSettings.greatBeats ? "GREAT" : "GOOD";
    if (first === undefined) {
      this.firstHit.set(o.ms, outerMs);
      this.clock.played(o.ms, outerMs);
      this.prev = { ms: o.ms, outer: outerMs };
    }
    this.mark(i, judgment, dev === null ? 0 : (dev * this.mpb) / this.clock.rate, eventIndex, timeMs);
  }

  private mark(i: number, judgment: Exclude<Judgment, "MISS">, offsetMs: number, eventIndex: number | null, timeMs: number): void {
    const note = this.chart.notes[i];
    this.judgments[i] = { noteId: note.id, judgment, offsetMs, eventIndex };
    this.noteState.set(note.id, judgment);
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const hit: GameEvent = { type: "noteHit", noteId: note.id, pitch: note.pitch, judgment, offsetMs, atMs: timeMs };
    const wasFever = this.gauge.fever;
    this.gauge = reduceGauge(this.gauge, hit);
    this.onEvent(hit);
    this.onEvent({ type: "combo", count: this.combo, atMs: timeMs });
    if (!this.scored) return;
    if (isMilestone(this.combo)) this.onEvent({ type: "comboMilestone", count: this.combo, atMs: timeMs });
    if (this.gauge.fever && !wasFever) this.onEvent({ type: "feverStart", atMs: timeMs });
  }

  // The player moved past onset k: its unplayed notes are skipped (MISS, a slip each), except a chord's inner note
  // when the chord's lowest and highest notes were played: a listener hears the chord, so it's GOOD.
  private passOver(k: number, timeMs: number): void {
    for (const id of this.onsets[k].ids) {
      const i = this.index.get(id)!;
      if (this.judgments[i]) continue;
      if (this.innerOfPlayedChord(i, k)) this.mark(i, "GOOD", 0, null, timeMs);
      else {
        this.slips++;
        this.miss(i, timeMs);
      }
    }
  }

  // A chord is at least 3 notes in one hand at one beat (chord-sync's grouping, which counts 2 as a chord).
  private innerOfPlayedChord(i: number, k: number): boolean {
    const note = this.chart.notes[i];
    const chord = this.onsets[k].ids.map((id) => this.index.get(id)!).filter((j) => this.chart.notes[j].hand === note.hand);
    if (chord.length < 3) return false;
    const pitches = chord.map((j) => this.chart.notes[j].pitch);
    const lo = chord[pitches.indexOf(Math.min(...pitches))];
    const hi = chord[pitches.indexOf(Math.max(...pitches))];
    const played = (j: number) => this.judgments[j] !== null && this.judgments[j]!.judgment !== "MISS";
    return i !== lo && i !== hi && played(lo) && played(hi);
  }

  private harmless(eventIndex: number, pitch: number, timeMs: number): void {
    this.extras.push({ eventIndex });
    this.onEvent({ type: "extra", pitch, atMs: timeMs });
  }

  private miss(i: number, atMs: number): void {
    const note = this.chart.notes[i];
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
