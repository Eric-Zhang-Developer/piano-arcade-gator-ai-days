// Shared formats for both lanes. Frozen once merged: change only through a `contract:` PR.
// Times are ms on the chart clock: 0 is beat 0 of bar 1. Pitches are MIDI note numbers.

import type { ReactNode } from "react";

export type Hand = "R" | "L";

export interface ChartNote {
  id: string;
  pitch: number; // 21–108
  beat: number; // start, from beat 0 of bar 1
  duration: number; // beats
  hand: Hand;
  velocity?: number; // 1–127, from the score's notation export (dynamics); absent: the score gives none
}

export interface Chart {
  id: string;
  title: string;
  composer: string;
  catalog?: string;
  source: string; // public-domain score (URL or citation), or "Eric"
  bpm: number;
  beatsPerBar: number;
  voice?: number; // General MIDI program, 1–128 as the GM table numbers them; absent: leave the piano's voice alone
  notes: ChartNote[];
}

export type InputKind = "midi" | "keys" | "test";

export interface TakeEvent {
  pitch: number;
  velocity: number; // 1–127; laptop keys use 80
  timeMs: number;
  offTimeMs: number | null;
}

export interface Take {
  // Missing/1 is the original onset-only policy. Only explicit 2 earns sustain
  // credit; old files/outbox entries must never be silently reinterpreted.
  scoringVersion?: 1 | 2;
  chartId: string;
  startedAt: string; // ISO
  latencyOffsetMs: number;
  inputDevice: InputKind;
  events: TakeEvent[];
}

export type Judgment = "PERFECT" | "GREAT" | "GOOD" | "MISS";
export type Rank = "S" | "A" | "B" | "C" | "D";

export interface NoteJudgment {
  noteId: string;
  judgment: Judgment;
  offsetMs: number | null; // signed: negative is early
  eventIndex: number | null; // index into Take.events
}

export interface Results {
  // Additive local policy v2. Timing judgments/rank remain onset-only;
  // bounded long-note credit is a separately labelled score component.
  sustain?: SustainSummary;
  chartId: string;
  judgments: NoteJudgment[];
  extras: { eventIndex: number }[];
  wrong?: { eventIndex: number }[]; // the extras that are WRONG notes (judging-tiers); absent in older results
  counts: { PERFECT: number; GREAT: number; GOOD?: number; MISS: number; extra: number; wrong?: number };
  accuracy: number; // 0–1: (PERFECT + 0.5 × GREAT + 0.25 × GOOD) / (notes + wrong)
  maxCombo: number;
  rank: Rank;
}

export interface SustainNote {
  noteId: string;
  heldMs: number;
  targetMs: number;
  earnedPoints: number;
  possiblePoints: number;
  releasedEarly: boolean;
}

export interface SustainSummary {
  version: 2;
  earnedPoints: number;
  possiblePoints: number;
  notes: SustainNote[];
}

// Optional matched wall-clock reading for phase events. Receivers may run after
// expensive audio initialization, so dispatch time is not the chart epoch.
type At = { atMs: number; performanceMs?: number };
export type GameEvent = At &
  (
    | { type: "songStart" }
    | { type: "countInBeat"; beat: number }
    | { type: "noteHit"; noteId: string; pitch: number; judgment: "PERFECT" | "GREAT" | "GOOD"; offsetMs: number }
    | { type: "noteMiss"; noteId: string; pitch: number }
    | { type: "extra"; pitch: number }
    | { type: "wrongNote"; pitch: number } // an extra that breaks the combo (judging-tiers)
    | { type: "combo"; count: number }
    | { type: "comboMilestone"; count: number }
    | { type: "feverStart" }
    | { type: "feverEnd" }
    | { type: "fullCombo" }
    | { type: "songEnd"; results: Results }
    | { type: "pause" } // Esc during a take: the chart clock stops at atMs
    | { type: "resume" } // the clock runs on from atMs: the pause's own time, or after a rewind (wait mode's ← →) the bar start it moved to
    | { type: "quit" } // the take ends without results: no songEnd follows
  );

export interface InputEvent {
  // Internal transport cancellation (e.g. unplug), not evidence of a physical
  // release. V2 leaves offTimeMs unknown and cannot manufacture full credit.
  cancelled?: true;
  type: "on" | "off";
  pitch: number;
  velocity: number;
  timeMs: number; // performance.now() domain; the play screen converts to the chart clock
}

export interface InputDevice {
  kind: InputKind;
  start(onEvent: (e: InputEvent) => void): void | Promise<void>;
  stop(): void;
}

export interface Frame {
  nowMs: number; // chart clock
  lowPitch: number; // visible key range, inclusive
  highPitch: number;
  judgmentLineY: number; // px from the canvas top
  keyX(pitch: number): { x: number; width: number }; // at the judgment line
  width: number;
  height: number;
}

// A layer under the highway that its plugin renders itself (WebGL, e.g. three.js). /play gives it an empty element
// the size of the window, behind the highway canvas, calls frame() once per animation frame after the plugins' draw,
// and dispose() when the take ends or the page unmounts. At most one plugin provides one.
export interface BackgroundLayer {
  frame(frame: Frame): void;
  dispose(): void;
}

// What /play hands a plugin's panels. A panel only reads: it never changes the take or its results. Return an element
// (`<MyPanel ... />`), not markup built inline, so the panel can use hooks; return null for no panel this time.
export interface PanelContext {
  chart: Chart; // after every plugin's transformChart
  params: URLSearchParams;
}

export interface ResultsPanelContext extends PanelContext {
  take: Take;
  results: Results;
  retry(): void; // the same as the Retry button
}

export interface GamePlugin {
  id: string;
  background?(el: HTMLElement): BackgroundLayer | null; // null: no stage this time (no WebGL, switched off)
  draw?(ctx: CanvasRenderingContext2D, frame: Frame): void;
  onEvent?(event: GameEvent): void;
  transformChart?(chart: Chart, params: URLSearchParams): Chart;
  wrapInput?(input: InputDevice): InputDevice;
  startPanel?(ctx: PanelContext): ReactNode; // on /play's start screen, under Start, in plugin order
  resultsPanel?(ctx: ResultsPanelContext): ReactNode; // on the results screen, under the score, in plugin order
}

// Validators: return a list of problems, empty when valid.

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export function validateChart(c: unknown): string[] {
  const p: string[] = [];
  const o = c as Partial<Chart>;
  if (!o || typeof o !== "object") return ["chart is not an object"];
  for (const k of ["id", "title", "composer", "source"] as const) if (!isStr(o[k])) p.push(`${k} missing`);
  if (!isNum(o.bpm) || o.bpm <= 0) p.push("bpm must be > 0");
  if (!isNum(o.beatsPerBar) || o.beatsPerBar <= 0) p.push("beatsPerBar must be > 0");
  if (o.voice !== undefined && !(Number.isInteger(o.voice) && o.voice >= 1 && o.voice <= 128)) p.push("voice must be 1–128");
  if (!Array.isArray(o.notes) || o.notes.length === 0) return [...p, "notes missing"];
  const ids = new Set<string>();
  o.notes.forEach((n, i) => {
    if (!isStr(n.id) || ids.has(n.id)) p.push(`note ${i}: id missing or duplicate`);
    ids.add(n.id);
    if (!Number.isInteger(n.pitch) || n.pitch < 21 || n.pitch > 108) p.push(`note ${i}: pitch out of 21–108`);
    if (!isNum(n.beat) || n.beat < 0) p.push(`note ${i}: beat must be >= 0`);
    if (!isNum(n.duration) || n.duration <= 0) p.push(`note ${i}: duration must be > 0`);
    if (n.hand !== "R" && n.hand !== "L") p.push(`note ${i}: hand must be R or L`);
    if (n.velocity !== undefined && !(Number.isInteger(n.velocity) && n.velocity >= 1 && n.velocity <= 127))
      p.push(`note ${i}: velocity must be 1–127`);
  });
  return p;
}

export function validateTake(t: unknown): string[] {
  const p: string[] = [];
  const o = t as Partial<Take>;
  if (!o || typeof o !== "object") return ["take is not an object"];
  if (!isStr(o.chartId)) p.push("chartId missing");
  if (!isStr(o.startedAt) || Number.isNaN(Date.parse(o.startedAt))) p.push("startedAt must be ISO");
  if (!isNum(o.latencyOffsetMs)) p.push("latencyOffsetMs missing");
  if (o.scoringVersion !== undefined && o.scoringVersion !== 1 && o.scoringVersion !== 2) p.push("scoringVersion must be 1 or 2");
  if (!["midi", "keys", "test"].includes(o.inputDevice as string)) p.push("inputDevice invalid");
  if (!Array.isArray(o.events)) return [...p, "events missing"];
  o.events.forEach((e, i) => {
    if (!Number.isInteger(e.pitch) || e.pitch < 0 || e.pitch > 127) p.push(`event ${i}: pitch invalid`);
    if (!Number.isInteger(e.velocity) || e.velocity < 1 || e.velocity > 127) p.push(`event ${i}: velocity invalid`);
    if (!isNum(e.timeMs)) p.push(`event ${i}: timeMs missing`);
    if (e.offTimeMs !== null && !isNum(e.offTimeMs)) p.push(`event ${i}: offTimeMs must be a number or null`);
    if (o.scoringVersion === 2 && e.offTimeMs !== null && e.offTimeMs < e.timeMs) p.push(`event ${i}: release precedes press`);
  });
  return p;
}

export function validateResults(r: unknown): string[] {
  const p: string[] = [];
  const o = r as Partial<Results>;
  if (!o || typeof o !== "object") return ["results is not an object"];
  if (!isStr(o.chartId)) p.push("chartId missing");
  if (!Array.isArray(o.judgments)) p.push("judgments missing");
  else
    o.judgments.forEach((j, i) => {
      if (!["PERFECT", "GREAT", "GOOD", "MISS"].includes(j.judgment)) p.push(`judgment ${i}: invalid`);
      if ((j.judgment === "MISS") !== (j.offsetMs === null)) p.push(`judgment ${i}: offsetMs must be null iff MISS`);
    });
  if (!Array.isArray(o.extras)) p.push("extras missing");
  if (!isNum(o.accuracy) || o.accuracy < 0 || o.accuracy > 1) p.push("accuracy must be 0–1");
  if (!isNum(o.maxCombo)) p.push("maxCombo missing");
  if (!["S", "A", "B", "C", "D"].includes(o.rank as string)) p.push("rank invalid");
  if (o.sustain !== undefined) {
    const s = o.sustain;
    if (!s || s.version !== 2 || !Array.isArray(s.notes)) p.push("sustain must be a version 2 summary");
    else {
      for (const n of s.notes) {
        if (!isStr(n.noteId) || !isNum(n.targetMs) || n.targetMs <= 0 || !isNum(n.heldMs) || n.heldMs < 0 || n.heldMs > n.targetMs || !Number.isInteger(n.earnedPoints) || !Number.isInteger(n.possiblePoints) || n.earnedPoints < 0 || n.earnedPoints > n.possiblePoints || n.possiblePoints < 0 || typeof n.releasedEarly !== "boolean") p.push("invalid sustain note");
      }
      if (s.earnedPoints !== s.notes.reduce((sum, n) => sum + n.earnedPoints, 0) || s.possiblePoints !== s.notes.reduce((sum, n) => sum + n.possiblePoints, 0)) p.push("sustain totals do not match notes");
    }
  }
  return p;
}
