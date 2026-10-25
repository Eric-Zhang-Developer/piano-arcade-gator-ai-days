import type { Chart, GamePlugin, InputDevice } from "../../contracts";
import { noteColorFor } from "../hand-colors";
import { feverHeat } from "../fever-arc";
import { matcher, normalizer, seedOf, touchOf, type Touch } from "./energy";

// Touch visible (spec: touch-visible): each hit's velocity, matched by pitch from the note-ons it taps, becomes the
// hit's energy. It draws the top tenth's shockwave ring itself; the other visuals ask touchFor(noteId).
export const ringSettings = {
  ms: 420, // the ring's life
  from: 0.6, // its radius at the hit, in key widths
  to: 2.2, // its radius at the end, at full energy, in key widths
  squash: 0.38, // the ellipse's height over its width: a ring lying on the keys' plane
  lineWidth: 2,
  alpha: 0.85,
  amber: [255, 176, 46], // #ffb02e, the wisps' fever core (hit-particles): fever's heat warms the ring the same way
};

const touches = new Map<string, Touch>();
// The energy of a hit by its noteId, once noteHit has passed this plugin (it's mounted before the visuals).
// ponytail: juice's gpu.hit call (juice/index.ts, held by #761) passes touchFor(id)?.energy and .wispOnly once #761 frees it.
export const touchFor = (noteId: string): Touch | undefined => touches.get(noteId);

let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function touchVisible(): GamePlugin {
  const s = ringSettings;
  const ons = matcher();
  let place = normalizer(seedOf([]));
  let chart: Chart | null = null;
  let color: (hand: Chart["notes"][number]["hand"]) => string = () => "#ffffff";
  let rings: { pitch: number; at: number; energy: number; rgb: number[] }[] = [];

  return {
    id: "touch-visible",
    transformChart(c) {
      chart = c;
      color = noteColorFor(c);
      place = normalizer(seedOf(c.notes.map((n) => n.velocity ?? 0)));
      return c;
    },
    wrapInput(device): InputDevice {
      return {
        ...device,
        start(onEvent) {
          return device.start((e) => {
            if (e.type === "on") ons.on(e.pitch, e.velocity, e.timeMs);
            onEvent(e);
          });
        },
      };
    },
    onEvent(e) {
      if (e.type === "songStart") {
        touches.clear();
        ons.clear();
        place.reset();
        rings = [];
      }
      if (e.type !== "noteHit") return;
      const v = ons.hit(e.pitch, performance.now()); // the note-on's clock: noteHit's atMs is the chart's
      const t = touchOf(v === null ? 0.5 : place.place(v));
      touches.set(e.noteId, t);
      if (t.ring && !reducedMotion()) {
        const hand = chart?.notes.find((n) => n.id === e.noteId)?.hand ?? "R";
        rings.push({ pitch: e.pitch, at: performance.now(), energy: t.energy, rgb: rgbOf(color(hand)) });
      }
    },
    draw(ctx, f) {
      if (!rings.length) return;
      const now = performance.now();
      rings = rings.filter((r) => now - r.at < s.ms);
      const heat = feverHeat();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = s.lineWidth;
      for (const r of rings) {
        const t = (now - r.at) / s.ms;
        const ease = 1 - (1 - t) ** 3;
        const { x, width } = f.keyX(r.pitch);
        const rx = width * (s.from + (s.to * r.energy - s.from) * ease);
        const [cr, cg, cb] = r.rgb.map((c, i) => Math.round(c + (s.amber[i] - c) * heat));
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${s.alpha * (1 - t) ** 2})`;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, f.judgmentLineY, rx, rx * s.squash, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}
