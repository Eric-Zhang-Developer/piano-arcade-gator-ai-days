// The grand's double-escapement action, one key at a time (spec: inside). Pure: a key keeps its presses and releases,
// and pose(t) says where the key, hammer and damper are at time t. The times are a performance.now() clock.
// Hammer 0 is at rest and 1 is at the string; key 0 is up and 1 is the full dip; damper 0 sits on the string and 1 is
// fully lifted. Each value is a choice or a source's, logged in specs/decisions/inside-geometry.md and inside-timing.md.

export const actionSettings = {
  letOff: 0.96, // hammer height at let-off: 1 − let-off distance ÷ blow distance (geometry)
  check: 0.7, // hammer height where the backcheck catches it on the rebound (geometry)
  repetition: 0.8, // hammer height the repetition lever holds it at while the key rises (geometry)
  damperPoint: 0.5, // the key depth where the damper starts to lift: half the dip
  strikeMs: 4, // the hammer's contact with the string
  reboundMs: 60, // from the string down to the backcheck
  keyUpMs: 90, // a released key's rise to rest
  dropMs: 120, // the hammer's fall to rest once the key is up
  // Key travel from rest to the strike, by velocity: pp is slow, ff fast. Interpolated on log time between the two.
  approach: { ppMs: 160, ffMs: 25 }, // velocity 1 and velocity 127
  // Free flight after let-off: the same curve, scaled.
  flight: { ppMs: 12, ffMs: 3 },
  // CC64 → damper rail: dead below `from`, fully up at `to`, linear between (half pedal in the middle).
  pedal: { from: 16, to: 110, riseMs: 60 },
  waveMsPerKey: 2, // the rail's lift runs bass to treble, this far apart per key
  ring: { sustainMs: 2600, dampedMs: 90 }, // a string's decay constant with its damper up and down
};

export type Phase = "rest" | "approach" | "flight" | "strike" | "rebound" | "checked" | "repetition" | "return";
export interface Pose {
  key: number;
  hammer: number;
  damper: number;
  phase: Phase;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * clamp01(k);
const ease = (k: number) => {
  const x = clamp01(k);
  return x * x * (3 - 2 * x);
};

// Log-time interpolation by velocity (1–127): a higher velocity gives a shorter time.
const byVelocity = ({ ppMs, ffMs }: { ppMs: number; ffMs: number }, velocity: number) =>
  ppMs * Math.pow(ffMs / ppMs, (Math.min(127, Math.max(1, velocity)) - 1) / 126);
export const approachMs = (velocity: number) => byVelocity(actionSettings.approach, velocity);
export const flightMs = (velocity: number) => byVelocity(actionSettings.flight, velocity);

// The damper the key itself lifts: nothing above half dip, then up with the key.
export const keyDamper = (key: number) => clamp01((key - actionSettings.damperPoint) / (1 - actionSettings.damperPoint));

interface Press {
  at: number; // the strike: a live note-on's time, or a played note's send time
  velocity: number;
  ahead: boolean; // playback knows it in advance, so its approach is drawn before `at`
}

const REST: Pose = { key: 0, hammer: 0, damper: 0, phase: "rest" };

export class KeyAction {
  private presses: Press[] = [];
  private releases: number[] = [];

  press(at: number, velocity: number, ahead = false) {
    this.presses.push({ at, velocity, ahead });
    this.presses.sort((a, b) => a.at - b.at);
  }

  release(at: number) {
    this.releases.push(at);
    this.releases.sort((a, b) => a - b);
  }

  // Drop history no pose after `t` can need (keepMs back), keeping the last press, so a long session stays small.
  forget(t: number, keepMs = 5000) {
    while (this.presses.length > 1 && this.presses[0].at < t - keepMs) this.presses.shift();
    while (this.releases.length && this.releases[0] < this.presses[0]?.at) this.releases.shift();
  }

  private releaseAfter(at: number) {
    return this.releases.find((r) => r >= at) ?? Infinity;
  }

  private start(p: Press) {
    return p.ahead ? p.at - approachMs(p.velocity) : p.at;
  }

  // The key's pose at t, damper from the key alone (the pedal is added by the caller).
  pose(t: number): Pose {
    let i = this.presses.length - 1;
    while (i >= 0 && this.start(this.presses[i]) > t) i--;
    return this.from(i, t);
  }

  private from(i: number, t: number): Pose {
    if (i < 0) return REST;
    const S = actionSettings;
    const p = this.presses[i];
    const s = this.start(p);
    if (t < s) return this.from(i - 1, t);
    if (t < p.at) {
      // The approach: the key goes down from where it was; the jack lifts the hammer to let-off, then it flies free.
      const was = this.from(i - 1, s);
      const fly = Math.min(flightMs(p.velocity), p.at - s);
      const letOffAt = p.at - fly;
      const key = lerp(was.key, 1, (t - s) / (p.at - s));
      if (t < letOffAt) {
        const h = lerp(was.hammer, S.letOff, (t - s) / Math.max(1e-6, letOffAt - s));
        return { key, hammer: h, damper: keyDamper(key), phase: "approach" };
      }
      return { key, hammer: lerp(S.letOff, 1, (t - letOffAt) / Math.max(1e-6, fly)), damper: keyDamper(key), phase: "flight" };
    }
    const r = this.releaseAfter(p.at);
    const struck = (u: number): Pose => {
      // From the strike: contact, then the rebound to the backcheck, which holds it while the key is down.
      const since = u - p.at;
      if (since < S.strikeMs) return { key: 1, hammer: 1, damper: 1, phase: "strike" };
      if (since < S.strikeMs + S.reboundMs) return { key: 1, hammer: lerp(1, S.check, ease((since - S.strikeMs) / S.reboundMs)), damper: 1, phase: "rebound" };
      return { key: 1, hammer: S.check, damper: 1, phase: "checked" };
    };
    if (t < r) return struck(t);
    // Released: the key rises, and the repetition lever lifts the hammer off the backcheck and holds it, so a re-press
    // before the key is back re-strikes from there. Once the key is up the hammer drops to rest.
    const at = struck(r);
    const up = t - r;
    const key = lerp(1, 0, up / S.keyUpMs);
    if (up < S.keyUpMs) return { key, hammer: lerp(at.hammer, S.repetition, ease(up / (S.keyUpMs / 2))), damper: keyDamper(key), phase: "repetition" };
    const down = up - S.keyUpMs;
    if (down < S.dropMs) return { key: 0, hammer: lerp(S.repetition, 0, ease(down / S.dropMs)), damper: 0, phase: "return" };
    return REST;
  }
}

// The damper rail from CC64: dead at the bottom, linear to fully up, so a mid value is half pedal.
export const railFor = (cc: number) => clamp01((cc - actionSettings.pedal.from) / (actionSettings.pedal.to - actionSettings.pedal.from));

// The pedal over time: each CC64 value eases the rail toward its height over riseMs. Pure: events in, height out.
export class Rail {
  private events: { at: number; value: number }[] = [];

  set(at: number, value: number) {
    this.events.push({ at, value });
    this.events.sort((a, b) => a.at - b.at);
    if (this.events.length > 64) this.events.splice(0, this.events.length - 64);
  }

  at(t: number): number {
    // Each value eases from the rail's height at its own time, so the segments chain.
    let [from, to, start] = [0, 0, -Infinity];
    for (const e of this.events) {
      if (e.at > t) break;
      from = start === -Infinity ? 0 : lerp(from, to, (e.at - start) / actionSettings.pedal.riseMs);
      [to, start] = [railFor(e.value), e.at];
    }
    return start === -Infinity ? 0 : lerp(from, to, (t - start) / actionSettings.pedal.riseMs);
  }

  // Key k of 88 (0 = A0) sees the rail this much later: the lift runs across the keyboard as a wave.
  forKey(t: number, k: number): number {
    return this.at(t - k * actionSettings.waveMsPerKey);
  }
}

// A string's ring, stepped per frame: struck to its velocity, decaying slowly with the damper up and fast with it down.
export const ring = (amp: number, dtMs: number, damper: number) =>
  amp * Math.exp(-dtMs / (damper > 0.5 ? actionSettings.ring.sustainMs : actionSettings.ring.dampedMs));
