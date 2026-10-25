// Screen shake (spec: screen-shake, #990): each comboMilestone gives the play screen a short, small shake that settles
// to exactly 0. It moves the highway and overlay canvases together with a CSS transform, so the notes and the
// judgment word never drift apart (decision screen-shake-target). Off by default: ?x=screen-shake.
import type { Experiment } from "..";

export const shakeSettings = {
  decayMs: 250, // the offset is exactly 0 from here on
  hz: 28, // how fast it swings: about 7 swings over the decay
  capPerHeight: 180, // the peak offset is at most round(height / 180) px on each axis: 6 px at 1080
};

// How hard a milestone shakes, as a share of the cap: 25 three quarters, 50 seven eighths, 100 and later the whole cap.
// Round 1 had 25 at a half: 2 px at 1080, too small to see, and 25 is the milestone most takes reach.
export const strength = (count: number) => (count >= 100 ? 1 : count >= 50 ? 0.875 : 0.75);

// A phase in [0, 2π) from the milestone's atMs, so each milestone swings its own way and the same atMs always the same.
const phase = (seed: number) => (((Math.imul(Math.round(seed) | 0, 2654435761) >>> 0) % 3600) / 3600) * 2 * Math.PI;

/**
 * The offset, in whole px, `t` ms after a milestone: a swing on each axis (x and y a quarter turn apart) under a
 * straight fall from the peak to 0 at decayMs (round 1's squared fall was under 1 px after ~130 ms). 0 before the event and from decayMs on. Pure: written into `out`, nothing allocated.
 */
export function shakeAt(t: number, seed: number, count: number, height: number, out: { x: number; y: number }) {
  const { decayMs, hz, capPerHeight } = shakeSettings;
  if (!(t >= 0 && t < decayMs)) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const amp = Math.round(height / capPerHeight) * strength(count) * (1 - t / decayMs);
  const a = 2 * Math.PI * hz * (t / 1000) + phase(seed);
  out.x = Math.round(amp * Math.sin(a)) || 0; // || 0: never -0, so a test can compare with 0
  out.y = Math.round(amp * Math.cos(a)) || 0;
  return out;
}

// Read once and kept live, as fever-moment does.
let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

export const screenShake: Experiment = {
  name: "screen-shake",
  title: "Screen shake",
  group: "Juice",
  line: "A small shake on each combo milestone (#990): 25, 50, then every 100.",
  issue: 990,
  href: "/play?song=minuet-g&bot=fever&x=screen-shake",
  plugin: () => {
    let atMs: number | null = null;
    let count = 0;
    let moved: HTMLElement[] = [];
    let shown = "";
    const off = { x: 0, y: 0 };
    const set = (transform: string) => {
      if (transform === shown) return;
      shown = transform;
      for (const el of moved) el.style.transform = transform;
    };
    const stop = () => {
      atMs = null;
      set("");
    };
    return {
      id: "x-screen-shake",
      onEvent(e) {
        if (e.type === "comboMilestone") {
          atMs = e.atMs;
          count = e.count;
        } else if (e.type === "pause" || e.type === "quit" || e.type === "songEnd" || e.type === "songStart") stop();
      },
      draw(ctx, f) {
        if (atMs === null) return;
        try {
          // The overlay canvas this draws on, and the highway canvas just before it in /play's <main>.
          // Re-resolved when the canvas changes: a second /play in the tab mounts new ones (#1326).
          if (moved.at(-1) !== ctx.canvas) {
            const prev = ctx.canvas.previousElementSibling;
            moved = prev?.tagName === "CANVAS" ? [prev as HTMLElement, ctx.canvas] : [ctx.canvas];
            shown = "";
          }
          shakeAt(reducedMotion() ? -1 : f.nowMs - atMs, atMs, count, f.height, off);
          if (off.x === 0 && off.y === 0 && f.nowMs - atMs >= shakeSettings.decayMs) return stop();
          set(off.x || off.y ? `translate(${off.x}px, ${off.y}px)` : "");
        } catch (err) {
          stop(); // the guard turns this experiment off for the take: leave the screen where it belongs
          throw err;
        }
      },
    };
  },
};
