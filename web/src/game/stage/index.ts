// Fever stage: a three.js star field behind the highway that streaks in fever (spec: fever-stage).
// This file is the pure part (state, frame budget, off switches) and the plugin; three.js is in scene.ts.
import type { Chart, GameEvent, GamePlugin } from "../../contracts";
import { blackKeyLaneSettings } from "../black-key-lanes";
import { settings as core } from "../core/settings";
import { makeScene } from "./scene";

export const stageSettings = {
  maxLaneLuma: 0.35, // 0–1: the stage's brightest pixel behind the lanes, after the highway's backdrop
  pixelRatioCap: 1.5,
  dipMs: 100, // a big combo break's desaturation (miss-moment calls dip(); a plain miss or WRONG no longer dips)
  dipDepth: 0.15, // 0–1 of the saturation taken out at the dip's start
  feverEaseMs: 400, // into and out of the hot palette
  budgetMs: 20, // freeze if the mean frame time over budgetWindowMs goes above this
  budgetWindowMs: 1000,
  warmupMs: 1000, // frames this soon after mount don't count (shader compile)
  star: "#cfd8ff",
  starStreak: 6, // star length in fever, world units
};

export const STAGE_KEY = "pianoArcade.stage";

// ---------- state (pure) ----------

export interface StageState {
  fever: boolean;
  feverAtMs: number; // when fever last turned on or off
  dipAtMs: number | null;
}

export const emptyStage = (): StageState => ({ fever: false, feverAtMs: -Infinity, dipAtMs: null });

export function reduceStage(s: StageState, e: GameEvent): StageState {
  switch (e.type) {
    case "songStart":
      return emptyStage();
    case "feverStart":
      return { ...s, fever: true, feverAtMs: e.atMs };
    case "feverEnd":
      return { ...s, fever: false, feverAtMs: e.atMs };
    default:
      return s;
  }
}

// miss-moment's hook: a combo break at 50 or more dips the stage once (spec: miss-moment). The plugin picks it up on
// its next frame; a miss or WRONG by itself is quiet (decision miss-moment-stage-dip).
let pendingDip: number | null = null;
export function dip(atMs: number): void {
  pendingDip = atMs;
}
export const applyDip = (s: StageState, atMs: number): StageState => ({ ...s, dipAtMs: atMs });

// What the scene shows at nowMs, each 0–1.
export interface Look {
  heat: number; // 0 out of fever … 1 fever: the stars' streak, and the stage's opacity
  dip: number; // desaturation
}

const fade = (atMs: number | null, nowMs: number, lengthMs: number) =>
  atMs === null || nowMs < atMs || nowMs >= atMs + lengthMs ? 0 : 1 - (nowMs - atMs) / lengthMs;

export function look(s: StageState, nowMs: number): Look {
  const t = Math.min(1, Math.max(0, (nowMs - s.feverAtMs) / stageSettings.feverEaseMs));
  return {
    heat: s.fever ? t : 1 - t,
    dip: fade(s.dipAtMs, nowMs, stageSettings.dipMs) * stageSettings.dipDepth,
  };
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
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const scene = makeScene(el, stageOpacity());
      if (!scene) return null; // no WebGL
      const overBudget = frameBudget();
      const mountedAt = performance.now();
      let frozen = false;
      let drawn = false;
      return {
        frame(f) {
          if (pendingDip !== null) {
            state = applyDip(state, pendingDip);
            pendingDip = null;
          }
          // Plain black in normal play (Eric, 2026-10-25): the stage fades in and out with fever's heat and isn't
          // drawn at all outside it. Reduced motion shows fever's stage at once, with no fade.
          const l = look(state, f.nowMs);
          const heat = still ? Math.ceil(l.heat) : l.heat;
          el.style.opacity = String(heat);
          if (heat === 0 || frozen || (still && drawn)) return;
          if (!document.hidden && overBudget(performance.now() - mountedAt)) {
            frozen = true;
            console.info(`fever-stage: frames averaged over ${stageSettings.budgetMs} ms for 1 s; the stage is frozen for this take`);
            return;
          }
          scene.render(f, still ? { ...l, heat: 1 } : l);
          drawn = true;
        },
        dispose: scene.dispose,
      };
    },
  };
}
