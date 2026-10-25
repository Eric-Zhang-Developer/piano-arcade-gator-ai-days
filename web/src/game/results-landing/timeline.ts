// Results landing's timeline (spec: results-landing): the moment from the last note to the rank as one cut, a pure
// function of t (ms from T0), so the page, the seek hook and the tests read the same frame.
import { tally } from "../results-tally";

export const landingSettings = {
  outMs: 400, // T0 to the results' mount: the highway's clock eases to a stop, the keyboard dims
  slideMs: 300, // from the mount: the score and the combo fly from the HUD to their places
  tallyMaxMs: 1200, // the four counts, first start to last end (pitch)
  tallyEachMs: 450, // one count's own run, as results-tally's
  comboTickMs: 250, // MAX COMBO ticks from the landed combo up to the max, after the slide
  stampMs: 180, // the rank's 1.08 → 0.97 → 1.0 (pitch)
  stampFrom: 1.08,
  stampLow: 0.97,
  shakePx: 2,
  afterGapMs: 250, // from the stamp to NEW RECORD and the tutor (pitch)
  afterFadeMs: 200,
  keyboardDim: 0.6, // the keyboard's dim at the end of the out (0 none, 1 black)
  frameMs: 1000 / 60,
};

export type LandingInput = {
  bpm: number;
  mountChartMs: number; // the chart clock at the mount, as if the song ran on: the tally lands on its beat grid
  counts: [number, number, number, number]; // PERFECT, GREAT, GOOD, MISS
  combo: number; // the HUD's combo at T0
  maxCombo: number;
  reduced?: boolean; // prefers-reduced-motion: the first frame is the end state
};

export type LandingPlan = LandingInput & {
  gridMs: number; // the tally's beat grid: a beat, halved until four starts fit
  tallyAtMs: number; // from T0: the first count's start, on the grid
  tallyEndMs: number;
  stampAtMs: number; // the stamp's start, which is its impact: it lands at 1.08 and springs
  afterAtMs: number;
  endMs: number; // T0 to the end state (≤ 2.8 s)
};

export type LandingState = {
  mounted: boolean; // the results are on screen
  clockRate: number; // the highway's drawn clock, 1 → 0 over the out
  clockMs: number; // the drawn clock's advance past T0
  keyboardDim: number;
  slide: number; // 0 at the HUD, 1 in the cells (eased)
  hudCounts: number; // the HUD's live counters' opacity: they hand over to the count cells
  counts: number[]; // the four count cells' shown values
  countProgress: number[];
  combo: number | null; // MAX COMBO's shown value, null while the number is in flight
  acc: number; // ACC's opacity: it arrives with the last count
  rank: { opacity: number; scale: number; x: number; tint: boolean };
  brackets: number; // the rank's bracket corners: 0 out (8 px wide of their place), 1 home, in two frames from impact
  after: number; // NEW RECORD and the tutor's opacity
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);

// The stamp's spring: (1-u)^p · cos(1.5πu) is 1 at the start, dips once and rests at exactly 0; p puts its low at
// -0.375, so the scale 1 + 0.08·f runs 1.08 → 0.97 → 1.0 (solved numerically, pinned by a test).
const SPRING_P = 1.0349;
const springF = (u: number) => (1 - u) ** SPRING_P * Math.cos(1.5 * Math.PI * u);
export function stampLandingScale(u: number): number {
  const v = clamp01(u);
  return v >= 1 ? 1 : 1 + (landingSettings.stampFrom - 1) * springF(v);
}

// The settle shake: three swings inside the stamp, ±2 px at most, decaying to 0.
export function stampShake(u: number): number {
  const v = clamp01(u);
  return v >= 1 ? 0 : landingSettings.shakePx * (1 - v) * Math.sin(6 * Math.PI * v);
}

// The four starts on the chart's beat grid: a beat, halved until 3 gaps and one run fit in tallyMaxMs.
export function tallyGrid(bpm: number): number {
  const { tallyMaxMs, tallyEachMs } = landingSettings;
  let g = 60000 / bpm;
  while (3 * g + tallyEachMs > tallyMaxMs) g /= 2;
  return g;
}

export function planLanding(input: LandingInput): LandingPlan {
  const s = landingSettings;
  const gridMs = tallyGrid(input.bpm);
  // The first count starts on the next grid line at or after the mount, in the song's own time.
  const wait = (((-input.mountChartMs % gridMs) + gridMs) % gridMs) % gridMs;
  const tallyAtMs = s.outMs + wait;
  const tallyEndMs = tallyAtMs + 3 * gridMs + s.tallyEachMs;
  const stampAtMs = Math.max(tallyEndMs, s.outMs + s.slideMs + s.comboTickMs);
  const afterAtMs = stampAtMs + s.afterGapMs;
  return { ...input, gridMs, tallyAtMs, tallyEndMs, stampAtMs, afterAtMs, endMs: afterAtMs + s.afterFadeMs };
}

export function landingAt(t: number, plan: LandingPlan): LandingState {
  const s = landingSettings;
  const at = plan.reduced ? Infinity : t;
  const out = clamp01(at / s.outMs);
  const slide = easeInOut(clamp01((at - s.outMs) / s.slideMs));
  const countProgress = [0, 1, 2, 3].map((i) => clamp01((at - plan.tallyAtMs - i * plan.gridMs) / s.tallyEachMs));
  const landed = at >= s.outMs + s.slideMs;
  const tick = clamp01((at - s.outMs - s.slideMs) / s.comboTickMs);
  const stampU = (at - plan.stampAtMs) / s.stampMs;
  return {
    mounted: at >= s.outMs,
    clockRate: (1 - out) ** 2,
    clockMs: (s.outMs * (1 - (1 - out) ** 3)) / 3, // the integral of the rate: no jump, and it stops
    keyboardDim: s.keyboardDim * easeInOut(out),
    slide,
    hudCounts: 1 - out,
    counts: countProgress.map((p, i) => tally(p, plan.counts[i])),
    countProgress,
    combo: landed ? Math.round(plan.combo + (plan.maxCombo - plan.combo) * tick) : null,
    acc: countProgress[3],
    rank: {
      opacity: stampU >= 0 ? 1 : 0,
      scale: stampU >= 0 ? stampLandingScale(stampU) : s.stampFrom,
      x: stampU >= 0 ? stampShake(stampU) : 0,
      tint: stampU >= 0 && at - plan.stampAtMs < s.frameMs, // one 60 fps frame at impact
    },
    brackets: clamp01((at - plan.stampAtMs + s.frameMs) / (2 * s.frameMs)),
    after: clamp01((at - plan.afterAtMs) / s.afterFadeMs),
  };
}

export const endState = (plan: LandingPlan) => landingAt(Infinity, plan);

// Mount-relative times (ms after the results show), for rank-stamp's override: sound and record-moment follow them.
export const mountTimes = (plan: LandingPlan) => ({
  stampStartMs: plan.stampAtMs - landingSettings.outMs,
  stampImpactMs: plan.stampAtMs - landingSettings.outMs,
  afterMs: plan.afterAtMs - landingSettings.outMs,
});

// Cue times for milestone-sfx to schedule from later (no new sound here), ms from T0.
export const cueTimes = (plan: LandingPlan) => ({
  outStart: 0,
  ticks: [0, 1, 2, 3].map((i) => plan.tallyAtMs + i * plan.gridMs),
  stampImpact: plan.stampAtMs,
  after: plan.afterAtMs,
});
