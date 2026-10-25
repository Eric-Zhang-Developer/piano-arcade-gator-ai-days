// record-follows' Validation (a)–(c): following, offline, against the synthetic recording; smoothness; CPU. It prints
// the tables the PR and the done note quote, beside score-follow's own numbers.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../../contracts";
import { msPerBeat } from "../../core/settings";
import { onsetsOf } from "../../flow-mode/clock";
import { PLAYERS, type Press } from "../../score-follow/players";
import { beatMap, detectOnsets, piecewise } from "./beatmap";
import { driverSettings, recordDriver } from "./driver";
import { steerer, steerSettings } from "./steer";
import { renderSynthetic } from "./synth";
import { Stretcher } from "./vocoder";
import { processorSource } from "./worklet";

const song = (id: string): Chart => JSON.parse(readFileSync(`public/songs/${id}/chart.json`, "utf8"));
const onsetBeats = (c: Chart) => onsetsOf(c).map((o) => o.ms / msPerBeat(c.bpm));
const firstPress = (ps: Press[]) => {
  const m = new Map<number, number>();
  for (const p of ps) m.set(p.onset, Math.min(m.get(p.onset) ?? Infinity, p.wallMs));
  return m;
};
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))];

// A take, block by block as the worklet runs: presses go to the driver at their wall times; at each onset's intended
// time (the player's beat with no jitter) the record's true beat is compared with it, in ms at the chart's bpm. The
// per-beat ratio change is read once the first beat's settling is over.
function follow(id: string, player: string) {
  const chart = song(id);
  const rec = renderSynthetic(chart);
  const beats = onsetBeats(chart);
  const mpb = msPerBeat(chart.bpm);
  const map = beatMap(detectOnsets(rec.samples, rec.sampleRate), beats, chart.bpm, rec.offsetMs / 1000);
  const trueBeat = (sec: number) => {
    let [lo, hi] = [-4, beats[beats.length - 1] + 8];
    for (let i = 0; i < 60; i++) [lo, hi] = rec.secAt((lo + hi) / 2) < sec ? [(lo + hi) / 2, hi] : [lo, (lo + hi) / 2];
    return lo;
  };
  const press = firstPress(PLAYERS[player](chart));
  const intended = firstPress(PLAYERS[player === "drift+jitter" ? "drift" : player](chart));
  const ks = [...press.keys()].sort((a, b) => a - b);
  const d = recordDriver(chart, map, beats);
  const dt = 128 / 48000;
  const errs: number[] = [];
  let maxStep = 0;
  let last = -1;
  let acc = 0;
  let next = 0;
  let k = 1; // the first onset starts the record: it's measured from the second
  const settled = beats[ks[0]] + driverSettings.settleBeats;
  const end = intended.get(ks[ks.length - 1])! / 1000 + 0.05;
  for (let t = Math.min(press.get(ks[0])!, intended.get(ks[0])!) / 1000; t < end; t += dt) {
    while (next < ks.length && press.get(ks[next])! / 1000 <= t) d.played(ks[next], press.get(ks[next++])!);
    const before = d.pos;
    const { rate } = d.block(t * 1000, dt);
    while (k < ks.length && intended.get(ks[k])! / 1000 <= t) errs.push(Math.abs(trueBeat(d.pos) - beats[ks[k++]]) * mpb);
    if (next && beats[ks[next - 1]] > settled) {
      acc += (d.pos - before) * map.bpsAt(d.pos);
      if (last < 0) last = rate;
      if (acc >= 1) [maxStep, last, acc] = [Math.max(maxStep, Math.abs(rate - last) / last), rate, acc - 1];
    }
  }
  return { median: pct(errs, 0.5), p95: pct(errs, 0.95), max: Math.max(...errs), n: errs.length, maxStep };
}

describe("following, offline (a)", () => {
  it("drift+jitter (seed 519) on moonlight-1 against the synthetic recording: median ≤ 40 ms, p95 ≤ 80 ms", () => {
    const rows = ["song | player | onsets | median | p95 | max (ms) | max ratio change per beat"];
    for (const id of ["moonlight-1", "twinkle", "fur-elise"])
      for (const player of ["steady", "drift", "drift+jitter"]) {
        const r = follow(id, player);
        rows.push(`${id} | ${player} | ${r.n} | ${r.median.toFixed(0)} | ${r.p95.toFixed(0)} | ${r.max.toFixed(0)} | ${(r.maxStep * 100).toFixed(1)}%`);
      }
    process.stdout.write(`\nrecord-follows (score-follow's own drift+jitter, Kalman: Twinkle 15/63, Für Elise 15/33 median/p95)\n${rows.join("\n")}\n\n`);
    const m = follow("moonlight-1", "drift+jitter");
    expect(m.median).toBeLessThanOrEqual(40);
    expect(m.p95).toBeLessThanOrEqual(80);
  }, 60_000);
});

describe("smoothness (b)", () => {
  // A map that swings ±10% over 8 beats, against a player whose tempo jumps by 25%: the steering has to work.
  const bpm = 90;
  const pts: [number, number][] = [];
  for (let b = 0, s = 0; b <= 64; b += 0.25, s += (0.25 * 60) / bpm / (1 + 0.1 * Math.sin((2 * Math.PI * b) / 8))) pts.push([b, s]);
  const map = piecewise(pts, bpm);

  it("the ratio moves at most about 3% per beat of record, and stays in 0.5–1.5×", () => {
    const st = steerer(map);
    const dt = 128 / 48000;
    let pos = 0;
    let wall = 0;
    let [last, acc, worst, lo, hi] = [1, 0, 0, Infinity, -Infinity];
    while (map.beatAt(pos) < 60) {
      const bps = (wall < 10 ? 1 : 1.25) * (bpm / 60);
      const playerBeat = wall < 10 ? wall * (bpm / 60) : 10 * (bpm / 60) + (wall - 10) * bps;
      const r = st.step(playerBeat, bps, pos, dt);
      const p0 = pos;
      pos += r * dt;
      wall += dt;
      [lo, hi] = [Math.min(lo, r), Math.max(hi, r)];
      acc += (pos - p0) * map.bpsAt(pos);
      if (acc >= 1) [worst, last, acc] = [Math.max(worst, Math.abs(r - last) / last), r, acc - 1];
    }
    expect(worst).toBeLessThanOrEqual(steerSettings.maxStepPerBeat * 1.05);
    expect(lo).toBeGreaterThanOrEqual(0.5);
    expect(hi).toBeLessThanOrEqual(1.5);
  });

  it("no output sample leaves ±1.0: the synthetic recording at 0.5×, 1.5×, a sweep, a freeze and a seek", () => {
    const rec = renderSynthetic(song("moonlight-1"));
    for (const plan of ["0.5", "1.5", "sweep"]) {
      const s = new Stretcher(rec.samples);
      const block = new Float32Array(128);
      let peak = 0;
      for (let i = 0; i < (rec.samples.length / 128) * 0.6; i++) {
        s.rate = plan === "sweep" ? 1 + 0.5 * Math.sin(i / 300) : Number(plan);
        if (plan === "sweep" && i === 2000) s.frozen = true;
        if (plan === "sweep" && i === 2600) [s.frozen] = [false, s.seek(rec.sampleRate * 3)];
        s.process(block);
        for (const v of block) peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, plan).toBeLessThanOrEqual(1);
    }
  });

  it("after a hold, the next correct note restarts the record at that note's mapped position", () => {
    const chart = song("twinkle");
    const beats = onsetBeats(chart);
    const d = recordDriver(chart, piecewise(beats.map((b, i) => [b, 0.5 + i * 0.61]), chart.bpm), beats);
    for (let k = 0; k < 6; k++) d.played(k, 1000 + k * 600);
    d.block(4600, 0.1);
    d.hold();
    expect(d.block(5200, 0.1).frozen).toBe(true);
    d.played(6, 9000);
    const { cmd, frozen } = d.block(9001, 0.003);
    expect(frozen).toBe(false);
    expect(cmd).toEqual({ seek: 0.5 + 6 * 0.61 });
    // The audio lands where it was sent: the stretcher reads from that sample next.
    const s = new Stretcher(new Float32Array(48000 * 8));
    s.seek(Math.round(cmd!.seek * 48000));
    expect(s.pos).toBe(Math.round(cmd!.seek * 48000));
  });

  // The fundamental of a 4-partial tone at 220 Hz, by the biggest low peak of a long FFT with parabolic interpolation.
  const fundamental = (y: Float32Array, sr: number) => {
    const N = 32768;
    const s = new Stretcher(y.subarray(0, N), N, N / 4);
    const re = new Float64Array(N);
    const im = new Float64Array(N);
    s.frame(0, re, im);
    const mag = (k: number) => Math.log(Math.hypot(re[k], im[k]) + 1e-12);
    let best = 1;
    for (let k = 2; k < Math.round((300 * N) / sr); k++) if (mag(k) > mag(best)) best = k;
    const [a, b, c] = [mag(best - 1), mag(best), mag(best + 1)];
    return ((best + (0.5 * (a - c)) / (a - 2 * b + c)) * sr) / N;
  };
  it.each([0.7, 1.3])("with the pitch preserved: at %s× the fundamental stays within 5 cents", (rate) => {
    const sr = 48000;
    const x = new Float32Array(sr * 3).map((_, i) => [1, 0.45, 0.22, 0.1].reduce((v, a, k) => v + 0.15 * a * Math.sin((2 * Math.PI * 220 * (k + 1) * i) / sr), 0));
    const s = new Stretcher(x);
    s.rate = rate;
    const y = new Float32Array(32768 + 8192);
    s.process(y);
    const cents = 1200 * Math.log2(fundamental(y.subarray(8192), sr) / 220);
    expect(Math.abs(cents)).toBeLessThan(5);
  });
});

describe("CPU (c)", () => {
  it("process() per 128-sample block stays under 30% of the block's budget, offline under node", () => {
    const sr = 48000;
    const rec = renderSynthetic(song("moonlight-1"), sr);
    const budget = (128 / sr) * 1000;
    const runs: { mean: number; worst: number }[] = [];
    for (let run = 0; run < 4; run++) {
      const s = new Stretcher(rec.samples);
      s.rate = 0.82;
      const block = new Float32Array(128);
      const n = 3000;
      let worst = 0;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const b0 = performance.now();
        s.process(block);
        worst = Math.max(worst, performance.now() - b0);
      }
      if (run) runs.push({ mean: (performance.now() - t0) / n, worst }); // run 0 warms the JIT
    }
    const means = runs.map((r) => r.mean);
    process.stdout.write(
      `\nrecord-follows CPU: budget ${budget.toFixed(3)} ms per 128-sample block at ${sr} Hz; mean ${means.map((m) => m.toFixed(4)).join(" / ")} ms ` +
        `(${means.map((m) => ((m / budget) * 100).toFixed(1)).join(" / ")}%), spread ${((Math.max(...means) - Math.min(...means)) * 1000).toFixed(1)} µs; ` +
        `worst single block ${Math.max(...runs.map((r) => r.worst)).toFixed(3)} ms (a hop's two FFTs land in one block of four)\n\n`,
    );
    for (const m of means) expect(m / budget).toBeLessThan(0.3);
  }, 60_000);
});

describe("the worklet", () => {
  it("its Blob source runs: the processor registers, takes the buffer and plays the Stretcher's output on both channels", () => {
    type Proc = { port: { onmessage: (e: { data: unknown }) => void }; process(i: unknown[], o: Float32Array[][]): boolean };
    let P: (new () => Proc) | null = null;
    class AudioWorkletProcessor {
      port = { onmessage: (() => {}) as (e: { data: unknown }) => void, postMessage() {} };
    }
    new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", processorSource())(AudioWorkletProcessor, (name: string, c: new () => Proc) => {
      expect(name).toBe("record-follows");
      P = c;
    }, 48000);
    const p = new P!();
    const out = [new Float32Array(128), new Float32Array(128)];
    p.process([], [out]);
    expect(out[0].every((v) => v === 0)).toBe(true); // no buffer yet: silent
    p.port.onmessage({ data: { buffer: new Float32Array(48000).map((_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / 48000)) } });
    p.port.onmessage({ data: { mode: "playing" } });
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      p.process([], [out]);
      peak = Math.max(peak, ...out[0].map(Math.abs));
      expect(out[1]).toEqual(out[0]);
    }
    expect(peak).toBeGreaterThan(0.1);
  });
});
