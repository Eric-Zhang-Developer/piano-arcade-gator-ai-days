import { describe, expect, it } from "vitest";
import type { Chart } from "../../../contracts";
import { beatDetector, isFist, type Sample } from "./beats";
import { clockSettings, conductorClock } from "./clock";
import { scheduler, scheduleSettings, scoreEvents } from "./schedule";

// Feeds the clock beats and reads its position on a 5 ms grid; returns position samples.
function drive(clock: ReturnType<typeof conductorClock>, beats: number[], until: number) {
  const out: { t: number; pos: number }[] = [];
  let b = 0;
  for (let t = beats[0]; t <= until; t += 5) {
    while (b < beats.length && beats[b] <= t) clock.beat(beats[b++]);
    out.push({ t, pos: clock.at(t) });
  }
  return out;
}

describe("the clock (conductor)", () => {
  // Conducts 3 prep-and-song beats at 60, then 90; returns the tempo and the phase error (ms) `after` beats into 90.
  const settle = (chartBpm: number, after: number) => {
    const c = conductorClock(chartBpm);
    const beats = [0, 1000, 2000, 3000, 4000];
    let t = 4000;
    for (let k = 0; k < after + 4; k++) beats.push((t += 60000 / 90));
    const at = beats[4 + after];
    let b = 0;
    for (let now = 0; now <= at; now += 1) {
      while (b < beats.length && beats[b] <= now) c.beat(beats[b++]);
      c.at(now);
    }
    while (b < beats.length && beats[b] <= at) c.beat(beats[b++]); // the beat at `at` itself, off the 1 ms grid
    // on a conducted beat the clock should sit on a chart beat: the distance to the nearest one, in ms at its rate
    const pos = c.at(at);
    return { bpm: c.tempoRatio * chartBpm, phaseMs: Math.abs(pos - Math.round(pos)) / c.rate };
  };

  // 60 and 90 are 0.8× and 1.2× a 75 BPM chart: inside the clamp with room to correct (decisions/conductor-thresholds).
  it("60 → 90 BPM settles within 2 beats: rate within 5% of 90, phase error under 30 ms", () => {
    const { bpm, phaseMs } = settle(75, 2);
    expect(bpm).toBeGreaterThan(90 * 0.95);
    expect(bpm).toBeLessThan(90 * 1.05);
    expect(phaseMs).toBeLessThan(30);
  });

  // On a 60 BPM chart, 90 is 1.5×: the 1.6× clamp leaves 0.1× to catch up a third of a beat, so it takes longer.
  it("on a 60 BPM chart, the clamp spreads the same correction over more beats", () => {
    expect(settle(60, 2).phaseMs).toBeGreaterThan(30);
    expect(settle(60, 6).phaseMs).toBeLessThan(30);
  });

  it("never goes backward over a jittery beat list, with one beat far early and one far late", () => {
    const c = conductorClock(90);
    const beats = [0, 667, 1333, 2000, 2700, 3300, 3500, 4700, 5400, 6000, 6700];
    const s = drive(c, beats, 8000);
    for (let k = 1; k < s.length; k++) expect(s[k].pos).toBeGreaterThanOrEqual(s[k - 1].pos);
  });

  it("holds the position on a fermata and resumes on the next downbeat without a jump", () => {
    const c = conductorClock(60);
    [0, 1000, 2000, 3000].forEach((b) => c.beat(b));
    c.at(3000);
    c.hold(3200);
    const held = c.at(3200);
    expect(c.at(5000)).toBe(held);
    c.beat(5500);
    expect(c.at(5500)).toBeCloseTo(held, 9);
    expect(c.at(5600)).toBeGreaterThan(held);
    expect(c.at(5600) - held).toBeLessThan(0.11 * 1.6); // at most the clamp's rate: no jump
  });

  it("keeps the rate within 0.5–1.6× the chart at 20 and 300 BPM", () => {
    for (const bpm of [20, 300]) {
      const c = conductorClock(90);
      const step = 60000 / bpm;
      const beats = Array.from({ length: 8 }, (_, k) => k * step);
      const s = drive(c, beats, beats[7] + 500);
      for (let k = 1; k < s.length; k++) {
        const r = (s[k].pos - s[k - 1].pos) / (s[k].t - s[k - 1].t) / (90 / 60000);
        if (s[k].t > beats[1]) {
          expect(r).toBeGreaterThanOrEqual(clockSettings.minRate - 1e-9);
          expect(r).toBeLessThanOrEqual(clockSettings.maxRate + 1e-9);
        }
      }
    }
  });

  it("starts the song on the beat after the two preparatory beats", () => {
    const c = conductorClock(60, 0);
    c.beat(0);
    expect(c.state).toBe("prep");
    c.beat(800); // 75 BPM
    expect(c.state).toBe("running");
    expect(c.at(800)).toBeCloseTo(-1);
    expect(c.at(1600)).toBeCloseTo(0, 1);
  });

  it("a cutoff waits for two new preparatory beats and restarts from the next conducted beat", () => {
    const c = conductorClock(60);
    [0, 1000, 2000, 3000].forEach((b) => c.beat(b));
    c.cut(3500); // at beat 1.5
    expect(c.state).toBe("prep");
    const at = c.at(4000);
    c.beat(6000);
    c.beat(7000);
    expect(c.at(7000)).toBeCloseTo(at);
    expect(c.at(8000)).toBeCloseTo(2, 1);
  });
});

describe("the beat detector (conductor)", () => {
  // A wrist that strokes down and back up once per period, sampled at 30 fps; hand size 0.1.
  const track = (period: number, n: number, depth = 0.2, size = 0.1): Sample[] => {
    const out: Sample[] = [];
    for (let t = 0; t <= period * n; t += 1000 / 30) {
      const ph = (t % period) / period; // 0..1: falls over the first 30%, rises over the rest
      const y = 0.4 + depth * (ph < 0.3 ? Math.sin((ph / 0.3) * (Math.PI / 2)) : Math.cos(((ph - 0.3) / 0.7) * (Math.PI / 2)));
      out.push({ t, y, size });
    }
    return out;
  };
  const run = (samples: Sample[]) => {
    const d = beatDetector();
    return samples.map((p) => d.push(p)).filter((b) => b !== null);
  };

  it("finds a stroke's low point at its known time", () => {
    const beats = run(track(1000, 5));
    expect(beats).toHaveLength(5);
    beats.forEach((b, k) => expect(Math.abs(b!.t - (k * 1000 + 300))).toBeLessThanOrEqual(34)); // a frame
    expect(beats[1]!.stroke).toBeCloseTo(2, 0); // 0.2 deep / 0.1 hand
  });

  it("drops beats under 250 ms apart", () => {
    expect(run(track(200, 10)).length).toBeLessThanOrEqual(10 * (200 / 250));
    const beats = run(track(200, 10));
    for (let k = 1; k < beats.length; k++) expect(beats[k]!.t - beats[k - 1]!.t).toBeGreaterThanOrEqual(250);
  });

  it("makes no beat on a slow drift", () => {
    const d = beatDetector();
    const got = Array.from({ length: 300 }, (_, k) => d.push({ t: k * 33, y: 0.3 + k * 0.0004, size: 0.1 })); // 0.12 hands/s
    expect(got.filter(Boolean)).toEqual([]);
  });

  it("is the same at any distance from the camera (speed in hand sizes)", () => {
    const near = run(track(1000, 4, 0.2, 0.1)).map((b) => Math.round(b!.t));
    const far = run(track(1000, 4, 0.1, 0.05)).map((b) => Math.round(b!.t));
    expect(far).toEqual(near);
  });
});

describe("the fist (conductor)", () => {
  // 21 landmarks: wrist at the origin, knuckles 1 up, fingertips 2 up (open) or 0.5 up (folded).
  const hand = (folded: boolean) =>
    Array.from({ length: 21 }, (_, i) => {
      if (i === 0) return { x: 0, y: 0 };
      const knuckle = [5, 9, 13, 17].includes(i);
      const tip = [8, 12, 16, 20].includes(i);
      return { x: (i % 4) * 0.1, y: -(knuckle ? 1 : tip ? (folded ? 0.5 : 2) : 1.2) };
    });
  it("is a fist when every fingertip folds to the palm, and not when the hand is open", () => {
    expect(isFist(hand(true))).toBe(true);
    expect(isFist(hand(false))).toBe(false);
  });
});

describe("the scheduler (conductor)", () => {
  const chart: Chart = {
    id: "s",
    title: "S",
    composer: "T",
    source: "t",
    bpm: 60,
    beatsPerBar: 4,
    notes: Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, pitch: 60 + i, beat: i, duration: 0.5, hand: "R" as const, velocity: 64 })),
  };
  it("sends each event once, inside the window, never in the past", () => {
    const c = conductorClock(60);
    c.beat(-2000);
    c.beat(-1000); // the song starts at 0 ms
    const s = scheduler(scoreEvents(chart));
    const sent: { at: number; now: number; beat: number; data: number[] }[] = [];
    for (let now = -1000; now < 9000; now += 16) s.fill(now, c, (data, at, beat) => sent.push({ at, now, beat, data }));
    expect(sent.filter((e) => e.data[0] === 0x90)).toHaveLength(8);
    expect(sent).toHaveLength(16);
    for (const e of sent) {
      expect(e.at).toBeGreaterThanOrEqual(e.now);
      expect(e.at).toBeLessThanOrEqual(e.now + scheduleSettings.lookaheadMs + 1e-6);
    }
    const ons = sent.filter((e) => e.data[0] === 0x90).map((e) => e.at);
    ons.forEach((t, i) => expect(t).toBeCloseTo(i * 1000, 0));
  });
  it("sends nothing while held, and applies the velocity factor within 1–127", () => {
    const c = conductorClock(60);
    c.beat(-2000);
    c.beat(-1000);
    const s = scheduler(scoreEvents(chart));
    const sent: number[][] = [];
    for (let now = -1000; now < 1200; now += 16) s.fill(now, c, (d) => sent.push(d), 3);
    c.hold(1200);
    const n = sent.length;
    for (let now = 1200; now < 5000; now += 16) s.fill(now, c, (d) => sent.push(d), 3);
    expect(sent).toHaveLength(n);
    expect(sent.filter((d) => d[0] === 0x90).every((d) => d[2] === 127 || d[2] === 64 * 3)).toBe(true);
    expect(Math.max(...sent.filter((d) => d[0] === 0x90).map((d) => d[2]))).toBe(127);
  });
});
