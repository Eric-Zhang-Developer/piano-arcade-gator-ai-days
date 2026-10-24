import type { Chart, Frame, GamePlugin, Hand, InputDevice } from "../../contracts";
import { noteColorFor } from "../hand-colors";
import { noteTimeMs } from "../core/judge";
import { msPerBeat, settings } from "../core/settings";
import { seededRandom } from "../sim/fake";
import { alphaOf, spawn, step, type Particle } from "./particles";
import { impactT, stampKeyframes, stampSettings, stampStartMs } from "../rank-stamp";

export const juiceSettings = {
  clearMs: 500, // spec: effects never cover a note less than 500 ms from the line
  flareMs: 320,
  pillarPx: 140, // a light pillar above the hit key (Nostalgia)
  missFlashMs: 220,
  wisps: { PERFECT: 32, GREAT: 18, GOOD: 8 },
  bright: { PERFECT: 1, GREAT: 0.7, GOOD: 0.45 },
  sparkEveryMs: 35, // a held hit note's spark stream
  laneLightAlpha: 0.13,
  laneLightHeight: 0.35, // of the line's height
  feverEdgePx: 90,
  fullComboMs: 2000, // spec: about 2 s
  feverColor: "255, 140, 60",
  missColor: "150, 150, 160",
};

type Judgment = keyof typeof juiceSettings.wisps;

// One plugin for every visual effect. Effects rise above the line into empty space and are clipped out of the
// rectangle of any note due within 500 ms, so they never hide the next thing to play.
export function juiceVisual(): GamePlugin {
  const s = juiceSettings;
  const random = seededRandom(1);
  let chart: Chart | null = null;
  let particles: Particle[] = [];
  let lastNow: number | null = null;
  let pending: { pitch: number; judgment: Judgment; color: string }[] = [];
  const flares: { pitch: number; atMs: number; bright: number; color: string }[] = [];
  const misses: { pitch: number; atMs: number }[] = [];
  const pressed = new Set<number>();
  const heldHits = new Map<number, string>(); // pressed keys whose press hit a note, with its hand color: they stream sparks
  let handOf = new Map<string, Hand>();
  let color: (hand: Hand) => string = () => settings.noteColor; // hand-colors: by hand on two-hand charts
  const hitIds = new Set<string>(); // played notes no longer need to be read, so effects may cover them
  let fever = false;
  let fullCombo = false;
  let sparkClock = 0;
  let lastCtx: CanvasRenderingContext2D | null = null; // /play stops drawing at the results: clear what's left

  // Rectangles of the unplayed notes due within clearMs: nothing juice draws may cover them.
  function clearZone(ctx: CanvasRenderingContext2D, f: Frame) {
    if (!chart) return;
    const pxPerMs = f.judgmentLineY / settings.lookaheadMs;
    const beatMs = msPerBeat(chart.bpm);
    ctx.beginPath();
    ctx.rect(0, 0, f.width, f.height);
    for (const n of chart.notes) {
      const t = noteTimeMs(chart, n) - f.nowMs;
      if (hitIds.has(n.id) || t < -n.duration * beatMs || t > s.clearMs) continue;
      const { x, width } = f.keyX(n.pitch);
      const yBottom = f.judgmentLineY - t * pxPerMs;
      const yTop = f.judgmentLineY - (t + n.duration * beatMs) * pxPerMs;
      ctx.rect(x, Math.max(0, yTop), width, Math.min(f.judgmentLineY, yBottom) - Math.max(0, yTop));
    }
    ctx.clip("evenodd");
  }

  return {
    id: "juice-visual",
    transformChart(c) {
      chart = c;
      handOf = new Map(c.notes.map((n) => [n.id, n.hand]));
      color = noteColorFor(c);
      return c;
    },
    wrapInput(device): InputDevice {
      return {
        ...device,
        start(onEvent) {
          return device.start((e) => {
            if (e.type === "on") pressed.add(e.pitch);
            else {
              pressed.delete(e.pitch);
              heldHits.delete(e.pitch);
            }
            onEvent(e);
          });
        },
      };
    },
    onEvent(e) {
      if (e.type === "songStart") {
        particles = [];
        pending = [];
        flares.length = misses.length = 0;
        heldHits.clear();
        hitIds.clear();
        fever = fullCombo = false;
        lastNow = null;
        rankReveal(false);
      }
      if (e.type === "noteHit") {
        hitIds.add(e.noteId);
        const c = color(handOf.get(e.noteId) ?? "R");
        pending.push({ pitch: e.pitch, judgment: e.judgment, color: c });
        flares.push({ pitch: e.pitch, atMs: e.atMs, bright: s.bright[e.judgment], color: c });
        if (pressed.has(e.pitch)) heldHits.set(e.pitch, c);
      }
      if (e.type === "noteMiss") misses.push({ pitch: e.pitch, atMs: e.atMs });
      if (e.type === "feverStart") fever = true;
      if (e.type === "feverEnd") fever = false;
      if (e.type === "fullCombo") {
        fullCombo = true;
        showFullCombo();
      }
      if (e.type === "songEnd") {
        rankReveal(fullCombo);
        lastCtx?.clearRect(0, 0, lastCtx.canvas.width, lastCtx.canvas.height);
      }
    },
    draw(ctx, f) {
      lastCtx = ctx;
      const dt = lastNow === null ? 0 : Math.max(0, Math.min(100, f.nowMs - lastNow));
      lastNow = f.nowMs;
      const line = f.judgmentLineY;

      // Fever: the one whole-screen state. Edges only, so notes keep their color.
      if (fever) {
        for (const [x0, x1] of [
          [0, s.feverEdgePx],
          [f.width, f.width - s.feverEdgePx],
        ]) {
          const g = ctx.createLinearGradient(x0, 0, x1, 0);
          g.addColorStop(0, `rgba(${s.feverColor}, 0.38)`);
          g.addColorStop(1, `rgba(${s.feverColor}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(Math.min(x0, x1), 0, s.feverEdgePx, f.height);
        }
        const top = ctx.createLinearGradient(0, 0, 0, line * 0.25);
        top.addColorStop(0, `rgba(${s.feverColor}, 0.22)`);
        top.addColorStop(1, `rgba(${s.feverColor}, 0)`);
        ctx.fillStyle = top;
        ctx.fillRect(0, 0, f.width, line * 0.25);
      }

      // New hits become wisps; held hit notes stream sparks.
      for (const h of pending) {
        const { x, width } = f.keyX(h.pitch);
        particles = spawn(particles, "wisp", s.wisps[h.judgment], x, width, line, s.bright[h.judgment], random, h.color);
      }
      pending = [];
      sparkClock += dt;
      for (; sparkClock >= s.sparkEveryMs; sparkClock -= s.sparkEveryMs) {
        for (const [p, c] of heldHits) {
          const { x, width } = f.keyX(p);
          particles = spawn(particles, "spark", 1, x + width * 0.3, width * 0.4, line, 0.8, random, c);
        }
      }
      particles = step(particles, dt);

      ctx.save();
      clearZone(ctx, f);

      // Lane light: a pressed key's lane glows faintly up from the line.
      for (const p of pressed) {
        const { x, width } = f.keyX(p);
        const h = line * s.laneLightHeight;
        const g = ctx.createLinearGradient(0, line, 0, line - h);
        const lit = heldHits.get(p) ?? settings.keyLitColor; // the hit note's hand, like the key itself
        g.addColorStop(0, hexAlpha(lit, s.laneLightAlpha));
        g.addColorStop(1, hexAlpha(lit, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, line - h, width, h);
      }

      // Miss: no burst, a brief desaturated flash on the line.
      for (let i = misses.length - 1; i >= 0; i--) {
        const age = f.nowMs - misses[i].atMs;
        if (age > s.missFlashMs) {
          misses.splice(i, 1);
          continue;
        }
        const { x, width } = f.keyX(misses[i].pitch);
        ctx.fillStyle = `rgba(${s.missColor}, ${0.55 * (1 - age / s.missFlashMs)})`;
        ctx.fillRect(x, line - 4, width, 8);
      }

      // Hit flare where the note met the line, as wide as the key; PERFECT brighter than GREAT.
      ctx.globalCompositeOperation = "lighter";
      for (let i = flares.length - 1; i >= 0; i--) {
        const fl = flares[i];
        const age = f.nowMs - fl.atMs;
        if (age > s.flareMs) {
          flares.splice(i, 1);
          continue;
        }
        const { x, width } = f.keyX(fl.pitch);
        const a = fl.bright * (1 - age / s.flareMs);
        const cx = x + width / 2;
        const g = ctx.createRadialGradient(cx, line, 0, cx, line, width * 1.4);
        g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
        g.addColorStop(0.35, hexAlpha(fl.color, a * 0.7));
        g.addColorStop(1, hexAlpha(fl.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - width * 1.4, line - width * 1.4, width * 2.8, width * 2.8);
        const pillar = ctx.createLinearGradient(0, line, 0, line - s.pillarPx);
        pillar.addColorStop(0, hexAlpha(fl.color, a * 0.45));
        pillar.addColorStop(1, hexAlpha(fl.color, 0));
        ctx.fillStyle = pillar;
        ctx.fillRect(x + width * 0.15, line - s.pillarPx, width * 0.7, s.pillarPx);
      }

      for (const p of particles) {
        const a = alphaOf(p);
        if (a <= 0.01) continue;
        ctx.fillStyle = hexAlpha(p.bright > 0.9 ? "#ffffff" : (p.color ?? settings.noteColor), a);
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.restore();
    },
  };
}

function hexAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}

// Full combo: a large banner over a dimmed screen for about 2 s, before the results show through.
function showFullCombo() {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = "FULL COMBO";
  el.setAttribute("data-testid", "full-combo");
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.6)",
    color: settings.noteColor,
    font: "900 clamp(48px, 11vw, 160px) system-ui, sans-serif",
    letterSpacing: "0.04em",
    textShadow: `0 0 32px ${settings.noteColor}`,
    zIndex: "1000",
    pointerEvents: "none",
    animation: `juice-banner ${juiceSettings.fullComboMs}ms ease-out both`,
  });
  ensureStyles();
  document.body.appendChild(el);
  setTimeout(() => el.remove(), juiceSettings.fullComboMs);
}

// Rank reveal: the results screen's rank letter stamps down (rank-stamp) once the tally ends, or after the full-combo
// banner. The results screen is results-layout's, so this styles its rank element by test id instead of editing it.
function rankReveal(fullCombo: boolean) {
  if (typeof document === "undefined") return;
  ensureStyles();
  document.documentElement.style.setProperty("--juice-rank-delay", `${stampStartMs(fullCombo)}ms`);
}

function ensureStyles() {
  if (document.getElementById("juice-visual-css")) return;
  const css = document.createElement("style");
  css.id = "juice-visual-css";
  css.textContent = `
@keyframes juice-banner { 0% { opacity: 0; transform: scale(1.15) } 12% { opacity: 1; transform: scale(1) } 80% { opacity: 1 } 100% { opacity: 0 } }
${stampKeyframes("juice-rank")}
@keyframes juice-rank-ring { from { opacity: 0.95; transform: scale(0.55) } to { opacity: 0; transform: scale(1.9) } }
[data-testid="rank"] { position: relative; animation: juice-rank ${stampSettings.durationMs}ms linear var(--juice-rank-delay, 0ms) both; }
[data-testid="rank"]::after { content: ""; position: absolute; inset: 4% -8%; border-radius: 50%; pointer-events: none;
  border: 3px solid var(--pa-gold); box-shadow: 0 0 28px var(--pa-gold), inset 0 0 28px var(--pa-gold); opacity: 0;
  animation: juice-rank-ring ${stampSettings.flashMs}ms ease-out calc(var(--juice-rank-delay, 0ms) + ${Math.round(impactT * stampSettings.durationMs)}ms) forwards; }
@media (prefers-reduced-motion: reduce) { [data-testid="rank"], [data-testid="rank"]::after, [data-testid="full-combo"] { animation: none; } }`;
  document.head.appendChild(css);
}
