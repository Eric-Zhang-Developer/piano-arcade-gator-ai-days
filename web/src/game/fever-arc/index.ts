// Fever arc (spec: fever-arc): fever as one designed state, like a drop. Build-up in the gauge's last stretch,
// ignition on the next beat after the judge's feverStart, a sustain, then a release (a combo break) or a handoff to
// results-landing (the song ends in fever). One pure timeline; the meter, the moment, the stars, the sparks and the
// sound read it instead of their own clocks. Judging is untouched: only when the visuals and the sound fire moves.
import type { GameEvent, GamePlugin } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { type Gauge, emptyGauge, reduceGauge } from "../fever-gauge/gauge";
import { landingSettings } from "../results-landing/timeline";
import { momentSettings } from "../fever-moment"; // read at call time only: fever-moment imports this module too

export const arcSettings = {
  buildFrom: 0.8, // the gauge share where the build-up starts (spec: its last ~20%)
  releaseMs: 400, // a combo break powers fever down over this
  handoffMs: landingSettings.outMs, // a song ending in fever drains on results-landing's out
  pulse: 0.12, // the stars' streak swells this much on each beat in the sustain
  tint: 0.35, // how far the stars and sparks move toward fever's amber in the sustain (0 none, 1 all the way)
  amber: [255, 176, 46] as const, // #ffb02e, fever-gauge's fill
};

export type Phase = "idle" | "build" | "ignite" | "sustain" | "release" | "handoff";

export interface ArcState {
  beatMs: number;
  gauge: Gauge;
  igniteAtMs: number | null; // the visuals' fever start: the beat on or after the judge's feverStart
  endAtMs: number | null; // feverEnd or songEnd during fever
  endKind: "break" | "song" | null;
}

export interface Arc {
  phase: Phase;
  progress: number; // 0–1 through the phase (build: through the gauge's last stretch)
  beat: number; // 0–1 through the current beat, on the chart's grid from chart time 0
  igniteAtMs: number | null;
  heat: number; // 0–1: how much of fever's look is on (ignite and sustain 1, draining to 0 in release or handoff)
}

export const emptyArc = (notes = 0, bpm = 120): ArcState => ({
  beatMs: msPerBeat(bpm),
  gauge: emptyGauge(notes),
  igniteAtMs: null,
  endAtMs: null,
  endKind: null,
});

/** The first beat at or after atMs on a grid of beatMs from chart time 0: at most one beat later. */
export function nextBeat(atMs: number, beatMs: number): number {
  const k = Math.ceil(atMs / beatMs - 1e-9);
  return Math.max(k, 0) * beatMs;
}

export function reduceArc(s: ArcState, e: GameEvent): ArcState {
  const gauge = reduceGauge(s.gauge, e);
  switch (e.type) {
    case "songStart":
      return { ...s, gauge: { ...s.gauge, fill: 0, fever: false }, igniteAtMs: null, endAtMs: null, endKind: null };
    case "feverStart":
      return { ...s, gauge, igniteAtMs: nextBeat(e.atMs, s.beatMs), endAtMs: null, endKind: null };
    case "feverEnd":
      return { ...s, gauge, endAtMs: e.atMs, endKind: "break" };
    case "songEnd":
      return s.igniteAtMs !== null && s.endAtMs === null ? { ...s, gauge, endAtMs: e.atMs, endKind: "song" } : { ...s, gauge };
    default:
      return { ...s, gauge };
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);

export function arcAt(s: ArcState, nowMs: number): Arc {
  const beat = (((nowMs / s.beatMs) % 1) + 1) % 1;
  const at = (phase: Phase, progress: number, heat: number): Arc => ({ phase, progress: clamp01(progress), beat, igniteAtMs: s.igniteAtMs, heat });
  const lit = s.igniteAtMs !== null && nowMs >= s.igniteAtMs;
  if (s.endAtMs !== null && nowMs >= s.endAtMs) {
    // A break before the ignition beat never lit anything: back to idle at once.
    if (s.igniteAtMs === null || s.endAtMs < s.igniteAtMs) return at("idle", 0, 0);
    const span = s.endKind === "song" ? arcSettings.handoffMs : arcSettings.releaseMs;
    const u = (nowMs - s.endAtMs) / span;
    if (u < 1 || s.endKind === "song") return at(s.endKind === "song" ? "handoff" : "release", u, 1 - easeInOut(clamp01(u)));
  } else if (lit) {
    const t = nowMs - s.igniteAtMs!;
    return t < momentSettings.totalMs ? at("ignite", t / momentSettings.totalMs, 1) : at("sustain", 0, 1);
  }
  const share = s.gauge.size > 0 ? s.gauge.fill / s.gauge.size : 0;
  // Between feverStart and its beat the gauge is full: the build-up holds at its peak until the drop.
  if (s.gauge.fever && !lit) return at("build", 1, 0);
  if (share >= arcSettings.buildFrom) return at("build", (share - arcSettings.buildFrom) / (1 - arcSettings.buildFrom), 0);
  return at("idle", 0, 0);
}

// One take at a time: the plugin feeds this, the readers ask it.
let state = emptyArc();
export const arcNow = (nowMs: number): Arc => arcAt(state, nowMs);
/** Where a feverStart at atMs ignites: for the sound, which is scheduled at event time. */
export const ignitionFor = (atMs: number): number => nextBeat(atMs, state.beatMs);
// The sustain's tint toward amber at the last drawn frame, for readers that don't see the chart clock (the sparks).
let tintNow = 0;
export const feverTint = (): number => tintNow;

/** A hand color moved toward fever's amber by k (0–1) in hue only, so the hands still read. Channels 0–255 or 0–1. */
export function towardAmber(rgb: readonly number[], k: number): number[] {
  if (k <= 0) return [...rgb];
  const scale = Math.max(...rgb) > 1 ? 255 : 1;
  const [r, g, b] = rgb.map((v) => v / scale);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [...rgb]; // grey has no hue to shift
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  const target = 37; // #ffb02e's hue
  const dh = (((target - h) % 360) + 540) % 360 - 180; // the short way round
  h = (h + dh * k + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r1 + m, g1 + m, b1 + m].map((v) => v * scale);
}

declare global {
  interface Window {
    __pianoArcadeFever?: { frames: { nowMs: number; phase: Phase; lit: string[] }[]; lit?: Set<string> };
  }
}

/** The test hook: each reader says it drew; the arc logs one frame per draw with the phase and who was lit. */
export function markLit(piece: string): void {
  if (typeof window !== "undefined" && window.__pianoArcadeFever) (window.__pianoArcadeFever.lit ??= new Set()).add(piece);
}

export function feverArc(): GamePlugin {
  return {
    id: "fever-arc",
    transformChart(chart) {
      state = emptyArc(chart.notes.length, chart.bpm);
      tintNow = 0;
      return chart;
    },
    onEvent(e) {
      state = reduceArc(state, e);
    },
    draw(_ctx, f) {
      tintNow = arcNow(f.nowMs).heat * arcSettings.tint;
      const hook = typeof window !== "undefined" ? window.__pianoArcadeFever : undefined;
      if (!hook) return;
      // The readers drew on the previous frame (they're mounted after this plugin): log that frame's set, then clear.
      const last = hook.frames.at(-1);
      if (last) last.lit = [...(hook.lit ?? [])];
      hook.lit = new Set();
      hook.frames.push({ nowMs: f.nowMs, phase: arcNow(f.nowMs).phase, lit: [] });
    },
  };
}
