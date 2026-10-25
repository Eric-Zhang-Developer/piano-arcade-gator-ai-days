// Fever moment (spec: fever-moment): fever's start, loud at the edges for at most 2 s, then out of the way. An amber
// flash up both edges (above the 500 ms mark only) and a FEVER banner sweeping through the HUD band. The grid flash
// on the stage is fever-stage's.
import type { Frame, GamePlugin } from "../../contracts";
import { isolated } from "../core/isolated";
import { settings } from "../core/settings";
import { hudLayout } from "../hud";
import { meterSettings } from "../fever-gauge";
import { bg, whenDisplayFontReady } from "../ui-tokens";
import { arcNow, ignitionFor, markLit } from "../fever-arc";

export const momentSettings = {
  totalMs: 2000, // spec: all done within 2 s
  peakMs: 50, // the edge flash peaks here, then fades into juice's steady glow: a drop's attack, on the beat (fever-arc)
  edgePx: 300, // over three times juice's steady fever edge (90 px)
  edgeAlpha: 1, // juice's steady edge is 0.38
  clearMs: 500, // nothing below the line where notes are due within this (0.75 of the line today)
  bannerInMs: 260, // the sweep in, then a hold, then the sweep out over the last outMs
  bannerOutMs: 320,
  stillMs: 1000, // reduced motion: the banner, still, for this long
  drainPx: 90, // fever-arc's release: juice's steady edge width and alpha, draining from the edges inward
  drainAlpha: 0.38,
};

// How much of the moment is left: 1 at its start, falling to 0 at 2 s; 0 before it, from 2 s on, and once fever
// ended (endAtMs) or nothing started it.
export function moment(nowMs: number, startAtMs: number | null, endAtMs: number | null): number {
  if (startAtMs === null || nowMs < startAtMs || (endAtMs !== null && nowMs >= endAtMs)) return 0; // a break before the ignition beat too
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

// FEVER's amber up both edges, px wide at alpha a, faded inward and toward its lowest line (cut), so it melts into
// juice's steady glow instead of ending at a hard edge. Flat color under the fades: no sun gradient (#885).
function drawEdges(ctx: CanvasRenderingContext2D, width: number, cut: number, px: number, a: number): void {
  // Isolated: the fades erase, which on /play's shared overlay would reach other plugins' pixels.
  isolated(ctx, (ctx) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = meterSettings.fill;
    ctx.fillRect(0, 0, px, cut);
    ctx.fillRect(width - px, 0, px, cut);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-out";
    for (const [x0, x1] of [
      [0, px],
      [width, width - px],
    ]) {
      const inward = ctx.createLinearGradient(x0, 0, x1, 0);
      inward.addColorStop(0, "rgba(0,0,0,0)");
      inward.addColorStop(0.35, "rgba(0,0,0,0.45)"); // eased: the light stays bright near the edge
      inward.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = inward;
      ctx.fillRect(Math.min(x0, x1), 0, px, cut);
    }
    const down = ctx.createLinearGradient(0, cut * 0.45, 0, cut);
    down.addColorStop(0, "rgba(0,0,0,0)");
    down.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = down;
    ctx.fillRect(0, cut * 0.45, px, cut * 0.55);
    ctx.fillRect(width - px, cut * 0.45, px, cut * 0.55);
  });
}

const clearLine = (f: Frame) => f.judgmentLineY * (1 - momentSettings.clearMs / settings.lookaheadMs);

function drawMoment(ctx: CanvasRenderingContext2D, f: Frame, elapsed: number, still: boolean, display: string): boolean {
  const s = momentSettings;
  const band = hudLayout(f.width, f.judgmentLineY).panel.h;
  let drew = false;

  const a = still ? 0 : flashAt(elapsed) * s.edgeAlpha;
  if (a > 0) {
    drawEdges(ctx, f.width, clearLine(f), s.edgePx, a);
    markLit("flash");
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
    ctx.font = `900 ${size}px ${display}`; // upright, the kit's display type
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = meterSettings.fill; // flat amber, no glow: the edges carry the light
    ctx.fillText("FEVER", b.x, band / 2);
    ctx.restore();
    markLit("banner");
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
  let ended = false; // songEnd: nothing more to draw, including /play's last frame behind the results
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
    ended = false;
    startAtMs = endAtMs = lastDrawnAtMs = null;
    publish();
  };
  return {
    id: "fever-moment",
    onEvent(e) {
      if (e.type === "songStart" || e.type === "quit") clear();
      if (e.type === "feverStart") {
        startAtMs = ignitionFor(e.atMs); // the next beat: fever-arc's ignition, with the stars and the sound
        endAtMs = null;
        publish();
      }
      if (e.type === "feverEnd") endAtMs = e.atMs; // within the 2 s: it ends at once
      if (e.type === "songEnd") ended = true;
    },
    draw(ctx, f) {
      const still = reducedMotion();
      // fever-arc's release and handoff: juice's steady edge drains from the edges inward, never louder than a hit.
      // Reduced motion: a cut, no drain.
      const arc = arcNow(f.nowMs);
      if (!still && (arc.phase === "release" || arc.phase === "handoff") && arc.heat > 0) {
        drawEdges(ctx, f.width, clearLine(f), momentSettings.drainPx * arc.heat, momentSettings.drainAlpha * arc.heat);
        markLit("drain");
      }
      if (ended) return;
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
