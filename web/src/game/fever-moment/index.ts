// Fever moment (spec: fever-moment): fever's start, loud at the edges for at most 2 s, then out of the way. A sun
// flash up both edges (above the 500 ms mark only) and a FEVER banner sweeping through the HUD band. The grid flash
// on the stage is fever-stage's.
import type { Frame, GamePlugin } from "../../contracts";
import { settings } from "../core/settings";
import { hudLayout } from "../hud";
import { bg, sunFrom, sunTo, whenDisplayFontReady } from "../ui-tokens";

export const momentSettings = {
  totalMs: 2000, // spec: all done within 2 s
  peakMs: 200, // the edge flash peaks here, then fades into juice's steady glow
  edgePx: 300, // over three times juice's steady fever edge (90 px)
  edgeAlpha: 1, // juice's steady edge is 0.38
  clearMs: 500, // nothing below the line where notes are due within this (0.75 of the line today)
  bannerInMs: 260, // the sweep in, then a hold, then the sweep out over the last outMs
  bannerOutMs: 320,
  stillMs: 1000, // reduced motion: the banner, still, for this long
};

// How much of the moment is left: 1 at its start, falling to 0 at 2 s; 0 before it, from 2 s on, and once fever
// ended (endAtMs) or nothing started it.
export function moment(nowMs: number, startAtMs: number | null, endAtMs: number | null): number {
  if (startAtMs === null || nowMs < startAtMs || (endAtMs !== null && endAtMs >= startAtMs && nowMs >= endAtMs)) return 0;
  return Math.max(0, 1 - (nowMs - startAtMs) / momentSettings.totalMs);
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

// The edge flash's strength at elapsed ms: up to 1 at peakMs, then down to 0 at totalMs.
export function flashAt(elapsed: number): number {
  const { peakMs, totalMs } = momentSettings;
  if (elapsed < 0 || elapsed >= totalMs) return 0;
  return elapsed < peakMs ? easeOut(elapsed / peakMs) : 1 - easeOut((elapsed - peakMs) / (totalMs - peakMs));
}

// The banner's centre x and its cover's opacity at elapsed ms: sweeps in from the left, holds at the centre, and
// sweeps out to the right by totalMs. Reduced motion: at the centre, still, for stillMs.
export function bannerAt(elapsed: number, width: number, still: boolean): { x: number; cover: number } | null {
  const { totalMs, bannerInMs, bannerOutMs, stillMs } = momentSettings;
  if (elapsed < 0) return null;
  if (still) return elapsed < stillMs ? { x: width / 2, cover: 1 } : null;
  if (elapsed >= totalMs) return null;
  const cx = width / 2;
  if (elapsed < bannerInMs) {
    const k = easeOut(elapsed / bannerInMs);
    return { x: -width * 0.3 + (cx + width * 0.3) * k, cover: k };
  }
  const outFrom = totalMs - bannerOutMs;
  if (elapsed < outFrom) return { x: cx, cover: 1 };
  const k = (elapsed - outFrom) / bannerOutMs;
  return { x: cx + (width * 0.8) * k * k, cover: 1 - k };
}

function drawMoment(ctx: CanvasRenderingContext2D, f: Frame, elapsed: number, still: boolean, display: string): boolean {
  const s = momentSettings;
  const line = f.judgmentLineY;
  const cut = line * (1 - s.clearMs / settings.lookaheadMs);
  const band = hudLayout(f.width, line).panel.h;
  let drew = false;

  // Edge flash: the sun gradient up both edges, faded inward and toward its lowest line, so it melts into juice's
  // steady glow instead of ending at a hard edge.
  const a = still ? 0 : flashAt(elapsed) * s.edgeAlpha;
  if (a > 0) {
    ctx.save();
    const sun = ctx.createLinearGradient(0, band, 0, cut);
    sun.addColorStop(0, sunFrom);
    sun.addColorStop(1, sunTo);
    ctx.globalAlpha = a;
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, s.edgePx, cut);
    ctx.fillRect(f.width - s.edgePx, 0, s.edgePx, cut);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-out";
    for (const [x0, x1] of [
      [0, s.edgePx],
      [f.width, f.width - s.edgePx],
    ]) {
      const inward = ctx.createLinearGradient(x0, 0, x1, 0);
      inward.addColorStop(0, "rgba(0,0,0,0)");
      inward.addColorStop(0.35, "rgba(0,0,0,0.45)"); // eased: the light stays bright near the edge
      inward.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = inward;
      ctx.fillRect(Math.min(x0, x1), 0, s.edgePx, cut);
    }
    const down = ctx.createLinearGradient(0, cut * 0.45, 0, cut);
    down.addColorStop(0, "rgba(0,0,0,0)");
    down.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = down;
    ctx.fillRect(0, cut * 0.45, s.edgePx, cut * 0.55);
    ctx.fillRect(f.width - s.edgePx, cut * 0.45, s.edgePx, cut * 0.55);
    ctx.restore();
    drew = true;
  }

  // Banner: inside the HUD band, over an opaque cover that hides the counts, combo and score meanwhile.
  const b = bannerAt(elapsed, f.width, still);
  if (b) {
    ctx.save();
    ctx.globalAlpha = b.cover;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, f.width, band);
    ctx.globalAlpha = 1;
    const size = Math.round(band * 0.72);
    ctx.font = `italic 900 ${size}px ${display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const w = ctx.measureText("FEVER").width || size * 3;
    const text = ctx.createLinearGradient(b.x - w / 2, 0, b.x + w / 2, 0);
    text.addColorStop(0, sunFrom);
    text.addColorStop(1, sunTo);
    ctx.shadowColor = sunTo;
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = text;
    ctx.fillText("FEVER", b.x, band / 2);
    ctx.restore();
    drew = true;
  }
  return drew;
}

// Read once and kept live, as the highway does.
let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

declare global {
  interface Window {
    __pianoArcadeFeverMoment?: { startAtMs: number | null; lastDrawnAtMs: number | null }; // verify-moment.mjs
  }
}

export function feverMoment(): GamePlugin {
  let startAtMs: number | null = null;
  let endAtMs: number | null = null;
  let lastDrawnAtMs: number | null = null;
  let lastCtx: CanvasRenderingContext2D | null = null; // /play stops drawing at the results: clear what's left
  let display = "system-ui, sans-serif";
  if (typeof document !== "undefined")
    void whenDisplayFontReady().then(() => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (family) display = `${family}, system-ui, sans-serif`;
    });
  const publish = () => {
    if (typeof window !== "undefined") window.__pianoArcadeFeverMoment = { startAtMs, lastDrawnAtMs };
  };
  const clear = () => {
    startAtMs = endAtMs = lastDrawnAtMs = null;
    publish();
  };
  return {
    id: "fever-moment",
    onEvent(e) {
      if (e.type === "songStart" || e.type === "quit") clear();
      if (e.type === "feverStart") {
        startAtMs = e.atMs;
        endAtMs = null;
        publish();
      }
      if (e.type === "feverEnd") endAtMs = e.atMs; // within the 2 s: it ends at once
      if (e.type === "songEnd") lastCtx?.clearRect(0, 0, lastCtx.canvas.width, lastCtx.canvas.height);
    },
    draw(ctx, f) {
      lastCtx = ctx;
      const still = reducedMotion();
      const live = still
        ? startAtMs !== null && moment(f.nowMs, startAtMs, endAtMs) > 0 && f.nowMs - startAtMs < momentSettings.stillMs
        : moment(f.nowMs, startAtMs, endAtMs) > 0;
      if (!live || startAtMs === null) return;
      if (drawMoment(ctx, f, f.nowMs - startAtMs, still, display)) {
        lastDrawnAtMs = f.nowMs;
        publish();
      }
    },
  };
}
