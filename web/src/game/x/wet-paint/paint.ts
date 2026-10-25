// Wet Paint (spec: wet-paint): the pure parts. Where a pitch lands, how the pedal sets the paint, and the painter that
// turns notes and CC64 into calls on a surface (the WebGL fluid, or a CPU model in the tests). Decisions:
// specs/decisions/wet-paint-pedal.md (the curve and when paint dries) and wet-paint-splats.md (sizes, forces, ranges).
import type { Rgb } from "./vendor/fluid";

const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);

export const ranges = {
  piano: { lo: 21, hi: 108 }, // a MIDI piano: A0..C8
  laptop: { lo: 48, hi: 84 }, // laptop keys alone: C3..C6, so Z / X have an octave each way from C4
};

// The drawn keyboard: white keys share the width evenly; a black key's center sits on the line between its whites.
export interface Key {
  pitch: number;
  black: boolean;
  x: number; // its center, 0-1 across the keyboard (and the canvas above it)
  w: number; // its width, 0-1
}

export function keyboard(lo: number, hi: number): Key[] {
  const whites: number[] = [];
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites.push(p);
  const w = 1 / whites.length;
  const keys: Key[] = whites.map((p, i) => ({ pitch: p, black: false, x: (i + 0.5) * w, w }));
  whites.forEach((p, i) => {
    if (isBlack(p + 1) && p + 1 <= hi) keys.push({ pitch: p + 1, black: true, x: (i + 1) * w, w: w * 0.6 });
  });
  return keys.sort((a, b) => a.pitch - b.pitch);
}

// x for a pitch, from the same keyboard; a pitch outside the range clamps to its nearer end.
export function xOfPitch(pitch: number, lo: number, hi: number): number {
  const keys = keyboard(lo, hi);
  const p = Math.max(lo, Math.min(hi, pitch));
  return (keys.find((k) => k.pitch === p) ?? keys[0]).x;
}

// --- the pedal ------------------------------------------------------------------------------------------------------

export interface PaintParams {
  densityDissipation: number; // how fast the live paint fades, per second
  velocityDissipation: number; // how fast its flow stops
  curl: number; // the swirl
}

export const pedalSettings = {
  wet: { densityDissipation: 0.08, velocityDissipation: 1.2, curl: 28 }, // CC64 127: blooms, swirls, bleeds and mixes, then settles
  dry: { densityDissipation: 0.9, velocityDissipation: 4, curl: 4 }, // CC64 0: a short bloom that stops and fades
  downAt: 64, // CC64 at or over this is "down": the MIDI spec's on/off line
};

// One curve from dry (0) to wet (127), linear in CC64, so a half pedal is half wet.
export function pedalCurve(cc: number, s = pedalSettings): PaintParams {
  const t = Math.max(0, Math.min(127, cc)) / 127;
  const mix = (a: number, b: number) => a * (1 - t) + b * t; // exact at both ends
  return {
    densityDissipation: mix(s.dry.densityDissipation, s.wet.densityDissipation),
    velocityDissipation: mix(s.dry.velocityDissipation, s.wet.velocityDissipation),
    curl: mix(s.dry.curl, s.wet.curl),
  };
}

// --- splats ---------------------------------------------------------------------------------------------------------

export const splatSettings = {
  y: 0.06, // a note's paint starts just above its key
  // The solver turns a narrow push into a dome that stays or a jet that leaves the canvas (FINDINGS.md). So a held note
  // paints like a brush: its ink source climbs from the key while it's held, and the fluid only stirs and bleeds it.
  climb: [0.12, 0.42], // canvas heights per second the brush climbs, pp to ff
  top: 0.94, // where it stops
  radius: [0.014, 0.05], // the solver's SPLAT_RADIUS units (its pointer default 0.25 is a whole hand), pp to ff
  force: [60, 220], // an upward stir per frame at the strike, the solver's units: it adds up in the velocity field
  ink: [0.05, 0.12], // the color's strength per frame at the strike, pp to ff
  burstSec: 0.2,
  trickle: { ink: 0.45, force: 0 }, // what's left after the strike's burst, as shares of it: no push, or a long hold launches its paint
};

const lerp = ([a, b]: number[], t: number) => a + (b - a) * t;

export interface Splat {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: Rgb;
  radius: number;
}

// A held note's brush, age seconds after its strike: where it is, how much ink and how hard it stirs.
export function jet(x: number, velocity: number, color: Rgb, age: number, still: boolean, s = splatSettings): Splat {
  const t = Math.max(1, Math.min(127, velocity)) / 127;
  const e = Math.exp(-age / s.burstSec);
  const y = Math.min(s.top, s.y + age * lerp(s.climb, t));
  const k = y >= s.top ? 0 : lerp(s.ink, t) * (s.trickle.ink + (1 - s.trickle.ink) * e); // at the top it lifts off: ink left there pools into a blot
  const push = lerp(s.force, t) * (s.trickle.force + (1 - s.trickle.force) * e);
  return { x, y, dx: 0, dy: still ? 0 : push, color: { r: color.r * k, g: color.g * k, b: color.b * k }, radius: lerp(s.radius, t) };
}

// The fix's "over", as the vendored fixShader computes it per pixel: the live paint on top of the dried.
export function over(live: [number, number, number], dried: [number, number, number]): [number, number, number] {
  const a = Math.max(0, Math.min(1, Math.max(...live)));
  return [live[0] + dried[0] * (1 - a), live[1] + dried[1] * (1 - a), live[2] + dried[2] * (1 - a)];
}

// --- the painter ----------------------------------------------------------------------------------------------------

export interface Surface {
  splat(s: Splat): void;
  step(dt: number): void;
  params(p: PaintParams): void;
  fix(): void; // the live layer laid over the dried one, then emptied
  clear(): void;
}

export interface Painter {
  noteOn(pitch: number, velocity: number): void;
  noteOff(pitch: number): void;
  pedal(cc: number): void;
  frame(dt: number): void;
  again(): void;
  readonly notes: number; // struck this session
  readonly cc: number;
  readonly fixes: number; // times the paint dried
  readonly held: ReadonlySet<number>;
}

// Paint dries when the pedal lifts, and, with the pedal up, when a key lifts: the dampers are down, so the note's
// paint stops where it is. With the pedal down nothing dries; the live layer keeps flowing.
export function createPainter(surface: Surface, opts: { xOf(pitch: number): number; colorOf(pitch: number): Rgb; still: boolean }): Painter {
  const held = new Map<number, { x: number; velocity: number; color: Rgb; age: number }>();
  let notes = 0;
  let cc = 0;
  let fixes = 0;
  const down = () => cc >= pedalSettings.downAt;
  const dry = () => {
    surface.fix();
    fixes++;
  };
  surface.params(pedalCurve(cc));
  return {
    noteOn(pitch, velocity) {
      const n = { x: opts.xOf(pitch), velocity, color: opts.colorOf(pitch), age: 0 };
      held.set(pitch, n);
      notes++;
      surface.splat(jet(n.x, n.velocity, n.color, 0, opts.still));
    },
    noteOff(pitch) {
      if (!held.delete(pitch)) return;
      if (!down()) dry();
    },
    pedal(value) {
      const was = down();
      cc = value;
      surface.params(pedalCurve(cc));
      if (was && !down()) dry();
    },
    frame(dt) {
      for (const n of held.values()) {
        n.age += dt;
        surface.splat(jet(n.x, n.velocity, n.color, n.age, opts.still));
      }
      surface.step(dt);
    },
    again() {
      held.clear();
      notes = 0;
      fixes = 0;
      surface.clear();
    },
    get notes() {
      return notes;
    },
    get cc() {
      return cc;
    },
    get fixes() {
      return fixes;
    },
    get held() {
      return new Set(held.keys());
    },
  };
}
