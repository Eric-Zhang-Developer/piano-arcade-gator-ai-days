// Results landing (spec: results-landing), behind ?x=results-landing: one clock from T0 drives the out on /play's
// canvas, then the results' DOM (the flying score and combo, the counts, the rank's stamp, its corners, the after).
// The page owns T0 and the out; this module owns the clock, the seek hook, the skip and every DOM write.
import { useLayoutEffect } from "react";
import { setStampTiming } from "../rank-stamp";
import { setTallyDriver } from "../results-tally";
import { endState, landingAt, landingSettings, mountTimes, planLanding, type LandingInput, type LandingPlan, type LandingState } from "./timeline";

export * from "./timeline";

export const landingOn = (params: URLSearchParams) => (params.get("x") ?? "").split(",").includes("results-landing");
// Scored takes only: wait mode's results say "not scored", and a bar-loop practice take keeps today's results.
export const landingRuns = (params: URLSearchParams) => landingOn(params) && params.get("mode") !== "wait" && !["from", "to", "practice"].some((k) => params.has(k));

// Where the HUD drew a number, in page px: the flight's start.
export type FlyFrom = { x: number; y: number; size: number };

const COUNT_IDS = ["count-PERFECT", "count-GREAT", "count-GOOD", "count-MISS"];

type Run = {
  plan: LandingPlan;
  t0: number; // performance.now() at T0
  pausedAt: number | null;
  raf: number;
  version: number;
  listeners: Set<() => void>;
  from: { score: FlyFrom; combo: FlyFrom };
  score: number;
  fly: { score: HTMLElement; combo: HTMLElement } | null;
  swallowClick: boolean; // the click that follows a skipping pointerdown
  swallowKeyUp: string | null; // and the keyup that follows a skipping key (Space presses a button on keyup)
  unlisten: () => void;
};
let run: Run | null = null;

declare global {
  interface Window {
    __pianoArcadeLanding?: { plan: LandingPlan; readonly t: number; seek(ms: number): void; pause(): void; play(): void; endState: LandingState };
  }
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function landingT(): number {
  if (!run) return Infinity;
  return run.pausedAt ?? performance.now() - run.t0;
}
export const landingPlan = () => run?.plan ?? null;
export const landingState = (): LandingState | null => (run ? landingAt(landingT(), run.plan) : null);

// At T0: plan the cut, hand its stamp times to rank-stamp (sound and record-moment follow) and its counts to
// results-tally, and start the clock. The counts and the score are corrected at the mount, from the judge's results.
export function startLanding(input: Omit<LandingInput, "reduced">, from: { score: FlyFrom; combo: FlyFrom }, score: number, t0 = performance.now()): LandingPlan {
  stopLanding();
  const plan = planLanding({ ...input, reduced: reducedMotion() });
  setStampTiming(mountTimes(plan));
  const r: Run = { plan, t0, pausedAt: null, raf: 0, version: 0, listeners: new Set(), from, score, fly: null, swallowClick: false, swallowKeyUp: null, unlisten: () => {} };
  run = r;
  setTallyDriver({
    subscribe: (cb) => (r.listeners.add(cb), () => r.listeners.delete(cb)),
    version: () => r.version,
    value: (testid, target) => {
      const i = COUNT_IDS.indexOf(testid);
      const st = landingAt(landingT(), r.plan);
      if (i >= 0) return st.counts[i];
      // WRONG and EXTRA tally with the last count, on its run
      return Math.round(target * st.countProgress[3]);
    },
  });
  window.__pianoArcadeLanding = {
    get plan() {
      return r.plan;
    },
    get t() {
      return landingT();
    },
    seek: (ms) => {
      if (r.pausedAt !== null) r.pausedAt = ms;
      else r.t0 = performance.now() - ms;
      apply();
    },
    pause: () => {
      r.pausedAt ??= landingT();
    },
    play: () => {
      if (r.pausedAt === null) return;
      r.t0 = performance.now() - r.pausedAt;
      r.pausedAt = null;
    },
    get endState() {
      return endState(r.plan);
    },
  } as Window["__pianoArcadeLanding"];
  const frame = () => {
    apply();
    if (run === r && (r.pausedAt !== null || landingT() <= r.plan.endMs + landingSettings.frameMs)) r.raf = requestAnimationFrame(frame);
  };
  r.raf = requestAnimationFrame(frame);
  return plan;
}

// At the mount: the judge's own numbers replace the HUD's, and the skip listens from here (during the out, keys are
// still play input).
export function landingMounted(counts: [number, number, number, number], maxCombo: number, score: number): void {
  const r = run;
  if (!r) return;
  r.plan = { ...r.plan, counts, maxCombo };
  r.score = score;
  const skip = () => {
    if (landingT() >= r.plan.endMs) return false;
    r.pausedAt = null;
    r.t0 = performance.now() - r.plan.endMs;
    apply();
    return true;
  };
  // Any key or click jumps to the end state and does nothing else: no Retry, no button. A letter still reaches
  // record-moment's initials, as today.
  const onKey = (e: KeyboardEvent) => {
    if (!skip()) return;
    if (/^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) return;
    r.swallowKeyUp = e.key;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (r.swallowKeyUp !== e.key) return;
    r.swallowKeyUp = null;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onPointer = (e: PointerEvent) => {
    if (!skip()) return;
    r.swallowClick = true;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onClick = (e: MouseEvent) => {
    if (!r.swallowClick) return;
    r.swallowClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("pointerdown", onPointer, true);
  window.addEventListener("click", onClick, true);
  r.unlisten = () => {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("pointerdown", onPointer, true);
    window.removeEventListener("click", onClick, true);
  };
  apply();
}

// A new take or leaving /play: today's stamp and tally again, and nothing of ours left in the page.
export function stopLanding(): void {
  const r = run;
  if (!r) return;
  cancelAnimationFrame(r.raf);
  r.unlisten();
  r.fly?.score.remove();
  r.fly?.combo.remove();
  run = null;
  setStampTiming(null);
  setTallyDriver(null);
  document.getElementById("results-landing-style")?.remove();
  delete window.__pianoArcadeLanding;
}

// The results' first frame is the landing's: its DOM writes land after React's and before the first paint, so the
// rank, the tutor and the shade never show their final state for a frame before the cut takes them.
export function useLandingLayout(): void {
  useLayoutEffect(() => apply(), []);
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

// juice draws today's stamp as a CSS animation on the rank, which beats inline styles, and its gold ring on ::after.
// The landing's stamp replaces both while it runs (juice/index.ts is another PR's file, so the override lives here).
const STYLE = `[data-landing] [data-testid="rank"] { animation: none !important; }
[data-landing] [data-testid="rank"]::after { content: none !important; animation: none !important; }`;
function ensureStyle(): void {
  if (document.getElementById("results-landing-style")) return;
  const el = document.createElement("style");
  el.id = "results-landing-style";
  el.textContent = STYLE;
  document.head.append(el);
}

function flyer(): HTMLElement {
  const el = document.createElement("div");
  el.dataset.landingFly = "";
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, { position: "fixed", left: "0", top: "0", zIndex: "30", pointerEvents: "none", whiteSpace: "nowrap", lineHeight: "1", willChange: "transform" });
  document.body.append(el);
  return el;
}

// Moves a flying number from the HUD's spot to its target's, the target's own face and color, centered on both.
function fly(el: HTMLElement, from: FlyFrom, target: HTMLElement, u: number, text: string): void {
  const b = target.getBoundingClientRect();
  const cs = getComputedStyle(target);
  const size = lerp(from.size, parseFloat(cs.fontSize), u);
  el.textContent = text;
  el.style.font = cs.font;
  el.style.fontSize = `${size}px`;
  el.style.color = cs.color;
  el.style.letterSpacing = cs.letterSpacing;
  // In flight it rides on a tile of the page's own color, so it passes over the cells instead of through their
  // labels; the tile dissolves as it lands.
  el.style.padding = "0.08em 0.3em";
  el.style.background = `color-mix(in srgb, var(--pa-bg) ${Math.round(100 * Math.min(1, (1 - u) / 0.2))}%, transparent)`;
  const x = lerp(from.x, b.left + b.width / 2, u);
  const y = lerp(from.y, b.top + b.height / 2, u);
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}

function apply(): void {
  const r = run;
  if (!r) return;
  const t = landingT();
  const st = landingAt(t, r.plan);
  const done = r.plan.reduced || t >= r.plan.endMs; // reduced motion: the end state from the first frame
  r.version++;
  for (const cb of r.listeners) cb();
  const results = document.querySelector<HTMLElement>('[data-testid="results"]');
  if (!results) return;
  ensureStyle();
  results.dataset.landing = done ? "end" : "on";
  // The page's dim fades in under the cut, so the stopped highway reads through for the slide.
  const shade = results.parentElement;
  if (shade) shade.style.background = `rgba(0,0,0,${(0.75 * st.slide).toFixed(3)})`;

  const rank = results.querySelector<HTMLElement>('[data-testid="rank"]');
  if (rank) {
    rank.style.opacity = String(st.rank.opacity);
    rank.style.transform = st.rank.scale === 1 && st.rank.x === 0 ? "" : `translateX(${st.rank.x.toFixed(2)}px) scale(${st.rank.scale.toFixed(4)})`;
    rank.style.color = st.rank.tint ? "var(--pa-hype)" : "";
    const corners = rank.parentElement?.querySelectorAll<HTMLElement>('[data-kit="corner"]') ?? [];
    for (const c of corners) {
      const off = 8 * (1 - st.brackets);
      c.style.opacity = st.brackets > 0 ? "1" : "0";
      c.style.transform = off ? `translate(${c.style.left ? -off : off}px, ${c.style.top ? -off : off}px)` : "";
    }
  }
  const acc = results.querySelector<HTMLElement>('[data-testid="accuracy"]');
  if (acc) acc.style.opacity = String(st.acc);
  // The after: the tutor, and NEW RECORD (its own stamp runs on stampAfterMs(); this holds it for a seeked frame too).
  for (const el of results.querySelectorAll<HTMLElement>('[data-landing-after], [data-testid="record-moment"]')) el.style.opacity = String(st.after);
  // The tutor rises into its panel as it fades in, so it reads as an arrival, not a hole that fills.
  for (const el of results.querySelectorAll<HTMLElement>("[data-landing-after]")) el.style.transform = st.after < 1 ? `translateY(${(12 * (1 - st.after) ** 2).toFixed(2)}px)` : "";

  // The score and the combo fly in, keep their values, and hand over to the real cells once they've landed.
  const scoreEl = results.querySelector<HTMLElement>('[data-testid="score"]');
  const comboEl = results.querySelector<HTMLElement>('[data-testid="max-combo"]');
  const comboDone = st.combo === r.plan.maxCombo && st.slide === 1;
  if (scoreEl) scoreEl.style.visibility = st.slide === 1 ? "" : "hidden";
  if (comboEl) comboEl.style.visibility = comboDone ? "" : "hidden";
  if (!done && st.mounted && scoreEl && comboEl) {
    r.fly ??= { score: flyer(), combo: flyer() };
    r.fly.score.style.display = st.slide === 1 ? "none" : "";
    r.fly.combo.style.display = comboDone ? "none" : "";
    fly(r.fly.score, r.from.score, scoreEl, st.slide, r.score.toLocaleString("en-US"));
    fly(r.fly.combo, r.from.combo, comboEl, st.slide, String(st.combo ?? r.plan.combo));
  } else if (r.fly) {
    r.fly.score.remove();
    r.fly.combo.remove();
    r.fly = null;
  }
}

export const landingCounts = (s: { PERFECT: number; GREAT: number; GOOD?: number; MISS: number }): [number, number, number, number] => [s.PERFECT, s.GREAT, s.GOOD ?? 0, s.MISS];
