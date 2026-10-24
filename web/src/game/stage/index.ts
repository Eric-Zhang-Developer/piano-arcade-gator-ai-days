// Fever stage: a three.js synthwave stage behind the highway that reacts to play (spec: fever-stage).
// This file is the pure part (state, grid phase, frame budget, off switches) and the plugin; three.js is in scene.ts.
import type { Chart, GameEvent, GamePlugin } from "../../contracts";
import { hudSettings, tierFor } from "../hud";
import { blackKeyLaneSettings } from "../black-key-lanes";
import { msPerBeat, settings as core } from "../core/settings";
import { makeScene } from "./scene";

export const stageSettings = {
  maxLaneLuma: 0.35, // 0–1: the stage's brightest pixel behind the lanes, after the highway's backdrop
  pixelRatioCap: 1.5,
  linesPerBeat: [1, 2, 3, 4], // per HUD tier; whole numbers, so the grid is on a line at every beat
  glow: [0.45, 0.6, 0.8, 1], // grid brightness per HUD tier
  dipMs: 300, // miss / WRONG desaturation
  dipDepth: 0.85, // 0–1 of the saturation taken out at the dip's start
  flashMs: 150, // count-in grid flash
  burstMs: 900, // full-combo ring from the sun
  feverEaseMs: 400, // into and out of the hot palette
  budgetMs: 20, // freeze if the mean frame time over budgetWindowMs goes above this
  budgetWindowMs: 1000,
  warmupMs: 1000, // frames this soon after mount don't count (shader compile)
  sky: "#0b0220",
  skyHot: "#2a0614",
  grid: "#ff2fd0",
  gridHot: "#ffb02e",
  sunTop: "#ffe66b",
  sunBottom: "#ff3fa4",
  sunTopHot: "#fff4d0",
  sunBottomHot: "#ff4a1c",
  star: "#cfd8ff",
  sunSwell: 1.3, // sun scale in fever
  starStreak: 6, // star length in fever, world units
};

export const STAGE_KEY = "pianoArcade.stage";

// ---------- state (pure) ----------

export interface StageState {
  tier: number; // index into hudSettings.tiers
  fever: boolean;
  feverAtMs: number; // when fever last turned on or off
  dipAtMs: number | null;
  flashAtMs: number | null;
  burstAtMs: number | null;
}

export const emptyStage = (): StageState => ({ tier: 0, fever: false, feverAtMs: -Infinity, dipAtMs: null, flashAtMs: null, burstAtMs: null });

const tierIndex = (combo: number) => hudSettings.tiers.indexOf(tierFor(combo));

export function reduceStage(s: StageState, e: GameEvent): StageState {
  switch (e.type) {
    case "songStart":
      return emptyStage();
    case "combo":
      return { ...s, tier: tierIndex(e.count) };
    case "noteMiss":
    case "wrongNote": // both break the combo: speed back to tier 1
      return { ...s, tier: 0, dipAtMs: e.atMs };
    case "feverStart": // the count-in's grid flash too, so fever's start is a moment (fever-moment)
      return { ...s, fever: true, feverAtMs: e.atMs, flashAtMs: e.atMs };
    case "feverEnd":
      return { ...s, fever: false, feverAtMs: e.atMs };
    case "countInBeat":
      return { ...s, flashAtMs: e.atMs };
    case "fullCombo":
      return { ...s, burstAtMs: e.atMs };
    default:
      return s;
  }
}

// What the scene shows at nowMs. Every value is 0–1 except speed.
export interface Look {
  speed: number; // grid lines per beat
  glow: number;
  heat: number; // 0 normal palette … 1 fever
  dip: number; // desaturation
  flash: number;
  burst: number | null; // the burst's progress, null when none is playing
}

const fade = (atMs: number | null, nowMs: number, lengthMs: number) =>
  atMs === null || nowMs < atMs || nowMs >= atMs + lengthMs ? 0 : 1 - (nowMs - atMs) / lengthMs;

export function look(s: StageState, nowMs: number): Look {
  const t = Math.min(1, Math.max(0, (nowMs - s.feverAtMs) / stageSettings.feverEaseMs));
  const burst = s.burstAtMs === null ? 0 : (nowMs - s.burstAtMs) / stageSettings.burstMs;
  return {
    speed: stageSettings.linesPerBeat[s.tier],
    glow: stageSettings.glow[s.tier],
    heat: s.fever ? t : 1 - t,
    dip: fade(s.dipAtMs, nowMs, stageSettings.dipMs) * stageSettings.dipDepth,
    flash: fade(s.flashAtMs, nowMs, stageSettings.flashMs),
    burst: s.burstAtMs !== null && burst >= 0 && burst < 1 ? burst : null,
  };
}

// Where the grid is between two lines, 0–1, at nowMs on the chart clock. With whole lines per beat it's 0 at every
// beat, count-in included, so the grid can't drift from the beat track.
export function gridPhase(nowMs: number, bpm: number, linesPerBeat: number): number {
  const lines = (nowMs / msPerBeat(bpm)) * linesPerBeat;
  if (Math.abs(lines - Math.round(lines)) < 1e-9) return 0; // float error either side of a whole line counts as on it
  return lines - Math.floor(lines);
}

// ---------- frame budget (pure) ----------

// Feed it each frame's time since mount; it says true once the mean frame time over the last window is too high.
export function frameBudget(budgetMs = stageSettings.budgetMs, windowMs = stageSettings.budgetWindowMs, warmupMs = stageSettings.warmupMs) {
  let last: number | null = null;
  const dts: number[] = [];
  let sum = 0;
  return (sinceMountMs: number): boolean => {
    const dt = last === null ? null : sinceMountMs - last;
    last = sinceMountMs;
    if (dt === null || sinceMountMs <= warmupMs) return false;
    if (dt >= windowMs) {
      dts.length = sum = 0; // a pause (hidden tab, debugger), not a slow machine: start the window again
      return false;
    }
    dts.push(dt);
    sum += dt;
    while (sum - dts[0] >= windowMs) sum -= dts.shift()!;
    return sum >= windowMs && sum / dts.length > budgetMs;
  };
}

// ---------- lane cap (pure) ----------

// The stage canvas's opacity. The highway's backdrop lets (1 - stageBackdropAlpha) of the stage through, and a black
// key's lane lays white at tint over that (black-key-lanes), so its brightest pixel is
// tint + (1 - tint) × opacity × (1 - stageBackdropAlpha). Cap it at maxLaneLuma, so the lanes stay readable.
export function stageOpacity(tint = blackKeyLaneSettings.tint): number {
  return Math.min(1, (stageSettings.maxLaneLuma - tint) / ((1 - tint) * (1 - core.stageBackdropAlpha)));
}

// ---------- off switches ----------

export function stageOff(params: URLSearchParams): boolean {
  if (params.get("stage") === "off") return true;
  try {
    return localStorage.getItem(STAGE_KEY) === "off";
  } catch {
    return false; // no storage (node, private mode): the URL decides
  }
}

// ---------- plugin ----------

export function feverStage(): GamePlugin {
  let chart: Chart | null = null;
  let off = false;
  let state = emptyStage();
  return {
    id: "fever-stage",
    transformChart(c, params) {
      chart = c;
      off = stageOff(params);
      return c;
    },
    onEvent(e) {
      state = reduceStage(state, e);
    },
    background(el) {
      if (off || !chart || typeof window === "undefined") return null;
      const bpm = chart.bpm;
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const scene = makeScene(el, stageOpacity());
      if (!scene) return null; // no WebGL
      const overBudget = frameBudget();
      const mountedAt = performance.now();
      let frozen = false;
      let drawn = false;
      return {
        frame(f) {
          if (frozen || (still && drawn)) return;
          if (!document.hidden && overBudget(performance.now() - mountedAt)) {
            frozen = true;
            console.info(`fever-stage: frames averaged over ${stageSettings.budgetMs} ms for 1 s; the stage is frozen for this take`);
            return;
          }
          const l = look(state, f.nowMs);
          scene.render(f, still ? { ...l, burst: null } : l, still ? 0 : gridPhase(f.nowMs, bpm, l.speed));
          drawn = true;
        },
        dispose: scene.dispose,
      };
    },
  };
}
