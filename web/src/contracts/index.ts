// Shared formats for both lanes. Frozen once merged: change only through a `contract:` PR.
// Times are ms on the chart clock: 0 is beat 0 of bar 1. Pitches are MIDI note numbers.

export type Hand = "R" | "L";

export interface ChartNote {
  id: string;
  pitch: number; // 21–108
  beat: number; // start, from beat 0 of bar 1
  duration: number; // beats
  hand: Hand;
}

export interface Chart {
  id: string;
  title: string;
  composer: string;
  catalog?: string;
  source: string; // public-domain score (URL or citation), or "Eric"
  bpm: number;
  beatsPerBar: number;
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
  chartId: string;
  startedAt: string; // ISO
  latencyOffsetMs: number;
  inputDevice: InputKind;
  events: TakeEvent[];
}

export type Judgment = "PERFECT" | "GREAT" | "MISS";
export type Rank = "S" | "A" | "B" | "C" | "D";

export interface NoteJudgment {
  noteId: string;
  judgment: Judgment;
  offsetMs: number | null; // signed: negative is early
  eventIndex: number | null; // index into Take.events
}

export interface Results {
  chartId: string;
  judgments: NoteJudgment[];
  extras: { eventIndex: number }[];
  counts: { PERFECT: number; GREAT: number; MISS: number; extra: number };
  accuracy: number; // 0–1: (PERFECT + 0.5 × GREAT) / notes
  maxCombo: number;
  rank: Rank;
}

type At = { atMs: number };
export type GameEvent = At &
  (
    | { type: "songStart" }
    | { type: "countInBeat"; beat: number }
    | { type: "noteHit"; noteId: string; pitch: number; judgment: "PERFECT" | "GREAT"; offsetMs: number }
    | { type: "noteMiss"; noteId: string; pitch: number }
    | { type: "extra"; pitch: number }
    | { type: "combo"; count: number }
    | { type: "comboMilestone"; count: number }
    | { type: "feverStart" }
    | { type: "feverEnd" }
    | { type: "fullCombo" }
    | { type: "songEnd"; results: Results }
  );

export interface InputEvent {
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

export interface GamePlugin {
  id: string;
  draw?(ctx: CanvasRenderingContext2D, frame: Frame): void;
  onEvent?(event: GameEvent): void;
  transformChart?(chart: Chart, params: URLSearchParams): Chart;
  wrapInput?(input: InputDevice): InputDevice;
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
  if (!Array.isArray(o.notes) || o.notes.length === 0) return [...p, "notes missing"];
  const ids = new Set<string>();
  o.notes.forEach((n, i) => {
    if (!isStr(n.id) || ids.has(n.id)) p.push(`note ${i}: id missing or duplicate`);
    ids.add(n.id);
    if (!Number.isInteger(n.pitch) || n.pitch < 21 || n.pitch > 108) p.push(`note ${i}: pitch out of 21–108`);
    if (!isNum(n.beat) || n.beat < 0) p.push(`note ${i}: beat must be >= 0`);
    if (!isNum(n.duration) || n.duration <= 0) p.push(`note ${i}: duration must be > 0`);
    if (n.hand !== "R" && n.hand !== "L") p.push(`note ${i}: hand must be R or L`);
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
  if (!["midi", "keys", "test"].includes(o.inputDevice as string)) p.push("inputDevice invalid");
  if (!Array.isArray(o.events)) return [...p, "events missing"];
  o.events.forEach((e, i) => {
    if (!Number.isInteger(e.pitch) || e.pitch < 0 || e.pitch > 127) p.push(`event ${i}: pitch invalid`);
    if (!Number.isInteger(e.velocity) || e.velocity < 1 || e.velocity > 127) p.push(`event ${i}: velocity invalid`);
    if (!isNum(e.timeMs)) p.push(`event ${i}: timeMs missing`);
    if (e.offTimeMs !== null && !isNum(e.offTimeMs)) p.push(`event ${i}: offTimeMs must be a number or null`);
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
      if (!["PERFECT", "GREAT", "MISS"].includes(j.judgment)) p.push(`judgment ${i}: invalid`);
      if ((j.judgment === "MISS") !== (j.offsetMs === null)) p.push(`judgment ${i}: offsetMs must be null iff MISS`);
    });
  if (!Array.isArray(o.extras)) p.push("extras missing");
  if (!isNum(o.accuracy) || o.accuracy < 0 || o.accuracy > 1) p.push("accuracy must be 0–1");
  if (!isNum(o.maxCombo)) p.push("maxCombo missing");
  if (!["S", "A", "B", "C", "D"].includes(o.rank as string)) p.push("rank invalid");
  return p;
}
