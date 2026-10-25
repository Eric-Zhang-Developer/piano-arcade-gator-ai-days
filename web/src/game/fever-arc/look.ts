// Fever's look (#1374): what makes the arc read as "on fire" on video and in the room. Drawn by fever-arc's own layer,
// so it sits under the wisps, the HUD and the banner, and over nothing but the notes' field. Amber only, and never a
// fill over the notes: flame walls stand on the hit line at both edges, the hit line runs hot and breathes on the beat,
// embers rise from it, and the ignition beat sends one shock front up the field. A break collapses the flames into the
// line; reduced motion keeps a still glow and cuts. References: specs/decisions/fever-arc-look.md.
import type { Frame } from "../../contracts";
import type { Arc } from ".";

export const lookSettings = {
  flameW: 0.11, // each wall's widest reach into the field, a share of the screen width (about a white key and a half)
  flameH: 0.8, // the walls' height, a share of the hit line's height
  tongues: 5, // per wall
  flameAlpha: 0.34, // per tongue: they add up where they overlap
  coreAlpha: 0.42, // the white-hot inner tongues
  lick: 0.08, // between beats each tip dips at most this share of its height, slowly
  sway: 0.18, // and sways at most this share of its half-width
  shimmer: 0.08, // and its alpha dips at most this much
  coreDrift: 0.06, // the white-hot core creeps up and back by this share
  beatSwell: 0.14, // the walls grow this much on each beat, falling back over it
  lineGlowPx: 46, // the hot line's glow above the line
  lineAlpha: 0.6, // the glow's peak, on the beat; 0.55 of it between beats
  hazeAlpha: 0.09, // a low heat haze over the field's last stretch, the only light over the lanes
  embersPerS: 60, // sustain; the build-up's last stretch spawns a fifth of this, rising
  igniteEmbers: 90, // one burst off the line on the ignition beat
  maxEmbers: 240,
  waveMs: 520, // the ignition's shock front climbs the field in this
};

type RGB = readonly [number, number, number];
const AMBER: RGB = [255, 176, 46]; // fever-gauge's #ffb02e, fever's one color
const HOT: RGB = [255, 232, 178]; // the same amber near white: the flames' core and the line's centre
const EMBER: RGB = [255, 122, 34]; // embers cool toward this as they rise
// Blue Fever: --pa-primary's #2b9bff, a hotter, whiter core, and a deeper blue the embers cool to.
const BLUE: RGB = [43, 155, 255];
const BLUE_HOT: RGB = [214, 240, 255];
const BLUE_EMBER: RGB = [70, 104, 255];
const mix = (a: RGB, b: RGB, k: number): string => a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(", ");

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (u: number) => 1 - (1 - u) ** 3;

/** Three sines: a cheap, smooth, deterministic flicker in about -1…1. */
export const flicker = (a: number, seed: number): number =>
  Math.sin(a * 2.1 + seed) * 0.5 + Math.sin(a * 4.7 + seed * 1.7) * 0.3 + Math.sin(a * 9.3 + seed * 3.1) * 0.2;

/** Two slow sines: the walls' calm breathing between beats, in -1…1, with no fast harmonic to jitter. */
export const calm = (a: number, seed: number): number => Math.sin(a + seed) * 0.65 + Math.sin(a * 1.7 + seed * 1.3) * 0.35;

/** How tall the walls stand, 0–1 of lookSettings.flameH: heat, plus a swell that peaks on each beat in the sustain. */
export function flameScale(arc: Arc, still: boolean): number {
  if (arc.heat <= 0) return 0;
  const swell = !still && (arc.phase === "sustain" || arc.phase === "ignite") ? lookSettings.beatSwell * (1 - arc.beat) ** 2 : 0;
  // The ignition beat: the walls shoot up over the first 18% of the moment instead of appearing whole.
  const rise = arc.phase === "ignite" && !still ? easeOut(clamp01(arc.progress / 0.18)) : 1;
  return arc.heat * rise * (1 + swell);
}

/** How many embers to spawn over dtMs (fractional; the caller keeps the remainder). */
export function emberRate(arc: Arc, still: boolean): number {
  if (still) return 0;
  if (arc.phase === "ignite" || arc.phase === "sustain") return lookSettings.embersPerS;
  if (arc.phase === "build") return lookSettings.embersPerS * 0.2 * arc.progress;
  return 0;
}

// One flame tongue standing on the line at cx: a teardrop whose tip sways, fading from the base up.
// It cools toward tip on the way up: hotter at the base, deeper orange at the tip.
function drawTongue(ctx: CanvasRenderingContext2D, cx: number, line: number, sway: number, bw: number, tall: number, rgb: string, tip: string, alpha: number): void {
  const grad = ctx.createLinearGradient(0, line, 0, line - tall);
  grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  grad.addColorStop(0.5, `rgba(${rgb}, ${alpha * 0.55})`);
  grad.addColorStop(1, `rgba(${tip}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx - bw, line);
  ctx.quadraticCurveTo(cx - bw * 0.85 + sway * 0.25, line - tall * 0.55, cx + sway, line - tall);
  ctx.quadraticCurveTo(cx + bw * 0.85 + sway * 0.25, line - tall * 0.55, cx + bw, line);
  ctx.closePath();
  ctx.fill();
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  seed: number;
}

export function fireLook() {
  let embers: Ember[] = [];
  let owed = 0;
  let lastNow: number | null = null;
  let burstFor: number | null = null; // the ignition the burst was spent on

  const spawn = (f: Frame, fast: boolean) => {
    if (embers.length >= lookSettings.maxEmbers) return;
    const r = Math.random();
    // Two thirds rise near the walls, the rest anywhere along the line: the fire is at the edges, the sparks everywhere.
    const edge = lookSettings.flameW * 1.6 * f.width;
    const x = r < 0.66 ? (Math.random() < 0.5 ? Math.random() * edge : f.width - Math.random() * edge) : Math.random() * f.width;
    const up = f.judgmentLineY * (fast ? 0.9 + Math.random() * 0.9 : 0.28 + Math.random() * 0.34);
    embers.push({
      x,
      y: f.judgmentLineY - Math.random() * 6,
      vx: (Math.random() - 0.5) * 40,
      vy: -up,
      age: 0,
      life: 900 + Math.random() * 1100,
      size: 2 + Math.random() * 2.6,
      seed: Math.random() * 100,
    });
  };

  return {
    reset() {
      embers = [];
      owed = 0;
      lastNow = null;
      burstFor = null;
    },
    draw(ctx: CanvasRenderingContext2D, f: Frame, arc: Arc, still: boolean) {
      const dt = lastNow === null ? 0 : Math.max(0, Math.min(100, f.nowMs - lastNow));
      lastNow = f.nowMs;
      const line = f.judgmentLineY;
      const t = still ? 0 : f.nowMs / 1000;
      const lit = arc.phase === "ignite" || arc.phase === "sustain";
      if (still && (arc.phase === "release" || arc.phase === "handoff")) return; // reduced motion: a cut, no drain

      // Embers: a burst on the ignition beat, then a steady rise; the build-up's last stretch lets the first few go.
      if (lit && arc.igniteAtMs !== null && burstFor !== arc.igniteAtMs && !still) {
        burstFor = arc.igniteAtMs;
        for (let i = 0; i < lookSettings.igniteEmbers; i++) spawn(f, true);
      }
      owed += (emberRate(arc, still) * dt) / 1000;
      for (; owed >= 1; owed--) spawn(f, false);
      if (embers.length > 0) {
        const s = dt / 1000;
        embers = embers.filter((e) => (e.age += dt) < e.life);
        for (const e of embers) {
          e.vy *= 1 - 0.55 * s; // the updraft tires
          e.x += (e.vx + Math.sin(t * 3 + e.seed) * 26) * s;
          e.y += e.vy * s;
        }
      }

      // Blue Fever over one beat, from the base up (reduced motion: at once). b0 is the base's share, b1 the tips'.
      const blue = still ? Math.ceil(arc.blue) : arc.blue;
      const b0 = clamp01(blue * 1.6);
      const b1 = clamp01(blue * 1.6 - 0.6);
      const amber = mix(AMBER, BLUE, b0);
      const hot = mix(HOT, BLUE_HOT, b0);
      const ember = mix(EMBER, BLUE_EMBER, b1);
      const tipAmber = mix(AMBER, BLUE, b1);
      const flames = flameScale(arc, still);
      const warm = arc.phase === "build" ? arc.progress * 0.3 : arc.heat; // the build-up warms the line before the drop
      if (flames <= 0 && warm <= 0 && embers.length === 0) return;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // The heat haze: the field's last stretch above the line, faint, so the lanes stay readable.
      if (warm > 0) {
        const pulse = still ? 0.75 : 0.55 + 0.45 * (1 - (lit ? arc.beat : 1)) ** 2;
        const haze = ctx.createLinearGradient(0, line, 0, line * 0.55);
        haze.addColorStop(0, `rgba(${amber}, ${lookSettings.hazeAlpha * warm * pulse})`);
        haze.addColorStop(1, `rgba(${amber}, 0)`);
        ctx.fillStyle = haze;
        ctx.fillRect(0, line * 0.55, f.width, line * 0.45);
        // The hot line: a glow standing on it, and a thin white-hot core.
        const g = lookSettings.lineGlowPx;
        const glow = ctx.createLinearGradient(0, line, 0, line - g);
        glow.addColorStop(0, `rgba(${amber}, ${lookSettings.lineAlpha * warm * pulse})`);
        glow.addColorStop(1, `rgba(${amber}, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, line - g, f.width, g);
        ctx.fillStyle = `rgba(${hot}, ${0.7 * warm * pulse})`;
        ctx.fillRect(0, line - 1.5, f.width, 3);
      }

      // The flame walls: overlapping tongues at both edges, each licking on its own clock, the tips swaying. Drawn
      // additively, so where tongues overlap near the edge and the line the fire runs hot by itself.
      if (flames > 0) {
        const h = line * lookSettings.flameH * flames;
        const w = f.width * lookSettings.flameW * Math.min(1, flames);
        const a = Math.min(1, arc.heat * 1.2);
        for (const side of [0, 1]) {
          // The light the fire throws: a soft pool at its foot, so the walls glow instead of sitting on the black.
          const x0 = side ? f.width : 0;
          const pool = ctx.createRadialGradient(x0, line, 0, x0, line, w * 2.4);
          pool.addColorStop(0, `rgba(${amber}, ${0.32 * a})`);
          pool.addColorStop(1, `rgba(${amber}, 0)`);
          ctx.fillStyle = pool;
          ctx.fillRect(side ? f.width - w * 2.4 : 0, line - w * 2.4, w * 2.4, w * 2.4);
          for (let j = 0; j < lookSettings.tongues; j++) {
            const seed = side * 11 + j * 2.3;
            const cx = w * (0.08 + 0.2 * j); // outer tongues tallest, inner ones short
            const bw = w * (0.34 - 0.03 * j);
            // Between beats the fire only breathes (Eric: "tiny, minimalistic"): a slow lick of each tip, a small sway,
            // a little shimmer, and the core creeping up and back. The beat's swell stays the big move.
            const lick = calm(t * 1.6 + j * 1.3, seed);
            const tall = h * (1 - 0.15 * j) * (1 - lookSettings.lick * (0.5 - 0.5 * lick));
            const sway = calm(t * 1.1 + j, seed + 5) * bw * lookSettings.sway;
            const shimmer = 1 - lookSettings.shimmer * (0.5 - 0.5 * calm(t * 2.3 + j * 2, seed + 9));
            const rise = 1 + lookSettings.coreDrift * calm(t * 0.9 + j, seed + 3);
            drawTongue(ctx, side ? f.width - cx : cx, line, side ? -sway : sway, bw, tall, amber, ember, lookSettings.flameAlpha * a * shimmer);
            if (j < 3) drawTongue(ctx, side ? f.width - cx : cx, line, side ? -sway * 0.6 : sway * 0.6, bw * 0.45, tall * 0.5 * rise, hot, tipAmber, lookSettings.coreAlpha * a * shimmer);
          }
        }
      }

      // The shock front: one bright band climbing from the line to the top on the drop, and again, blue, on the
      // upgrade beat. Reduced motion: none.
      const waveAt = arc.blueAtMs !== null && f.nowMs >= arc.blueAtMs ? arc.blueAtMs : arc.phase === "ignite" ? arc.igniteAtMs : null;
      if (!still && waveAt !== null && (arc.phase === "ignite" || arc.phase === "sustain")) {
        const u = (f.nowMs - waveAt) / lookSettings.waveMs;
        if (u >= 0 && u < 1) {
          const y = line * (1 - easeOut(u));
          const a = (1 - u) ** 1.5;
          const trail = Math.min(140, line - y);
          const band = ctx.createLinearGradient(0, y, 0, y + trail);
          const [front, body] = waveAt === arc.blueAtMs ? [BLUE_HOT.join(", "), BLUE.join(", ")] : [hot, amber];
          band.addColorStop(0, `rgba(${front}, ${0.55 * a})`);
          band.addColorStop(0.15, `rgba(${body}, ${0.3 * a})`);
          band.addColorStop(1, `rgba(${body}, 0)`);
          ctx.fillStyle = band;
          ctx.fillRect(0, y, f.width, trail);
        }
      }

      // Embers: hot when born, cooling to a deep orange, flickering as they go.
      for (const e of embers) {
        const k = e.age / e.life;
        const a = (1 - k) * (0.6 + 0.4 * flicker(t * 9, e.seed));
        if (a <= 0.02) continue;
        ctx.fillStyle = `rgba(${k < 0.3 ? hot : k < 0.6 ? amber : ember}, ${a})`;
        const sz = e.size * (1 - k * 0.5);
        ctx.fillRect(e.x - sz / 2, e.y - sz, sz, sz * 2); // a short streak, taller than wide: it rises
      }
      ctx.restore();
    },
  };
}
