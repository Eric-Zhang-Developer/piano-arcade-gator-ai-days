// Every tuning number lives here (decision 000, D1). Judging windows are mission.md rules, not tuning.

export const PERFECT_MS = 40;
export const GREAT_MS = 80;
export const GOOD_MS = 120; // judging-tiers: GOOD keeps the combo; MISS only past this
export const NEAR_MISS_MS = 150; // a same-pitch press this close to a note is that note's timing, never WRONG
// accuracy = (PERFECT + GREAT_WEIGHT × GREAT + GOOD_WEIGHT × GOOD) / (notes + WRONG) (decision judging-windows-wider)
export const GREAT_WEIGHT = 0.8;
export const GOOD_WEIGHT = 0.5;
export const KEYS_VELOCITY = 80;

export const settings = {
  lookaheadMs: 2000,
  perspective: 0, // 0 flat … 0.3: top of the highway is (1 - p) × the bottom's width
  countInBeats: 8, // two bars: time to get hands on the keys after Start (playtest, findings.md)
  noteColor: "#2b9bff",
  noteHeadColor: "#ffffff", // the leading edge: the moment to press
  noteHeadPx: 6,
  noteGapPx: 8, // space at the end of each note, so repeated notes read as separate
  missColor: "#6b5560",
  keyLitColor: "#ffffff", // a pressed key that hit no note (key-skin: plain white, never red)
  // The 2D canvases' devicePixelRatio at most, as fever-stage caps its WebGL canvas: a Retina screen's 2 made every
  // full-window layer 4× the pixels to clear and composite each frame, and /play lagged on Eric's MacBook (2026-10-25).
  pixelRatioCap: 1.5,
  stageBackdropAlpha: 0.55, // the highway's backdrop while a background layer (fever-stage) shows through
};

export const LATENCY_KEY = "pianoArcade.latencyOffsetMs";
export const LATENCY_MIN = -150;
export const LATENCY_MAX = 150;

export function loadLatencyOffset(): number {
  try {
    const v = Number(localStorage.getItem(LATENCY_KEY));
    return Number.isFinite(v) ? Math.max(LATENCY_MIN, Math.min(LATENCY_MAX, Math.round(v))) : 0;
  } catch {
    return 0;
  }
}

export function saveLatencyOffset(ms: number): void {
  try {
    localStorage.setItem(LATENCY_KEY, String(ms));
  } catch {
    // storage blocked: the slider still works for this session
  }
}

export const msPerBeat = (bpm: number) => 60000 / bpm;
