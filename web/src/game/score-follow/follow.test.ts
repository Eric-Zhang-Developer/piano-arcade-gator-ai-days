// The spike's measurement (spec: score-follow-spike): scripted players on the committed Twinkle and Für Elise, the
// band on the predicting clock (follow) and on flow mode's own clock (hold, driven through FlowJudge as flow-mode's
// tests do). It prints one table for FINDINGS.md and asserts only the plumbing, so a "no" still runs green.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, GameEvent, InputDevice, InputEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { onsetsOf } from "../flow-mode/clock";
import { FlowJudge } from "../flow-mode/judge";
import { bandEvents, follower, followSettings, kalmanFollower, kalmanTune, scheduler, silence, specTune, type KalmanTune, type Tune } from "./follow";
import { scoreFollow } from ".";
import { PLAYERS, SEED, stopAt, type Press } from "./players";

const song = (id: string): Chart => JSON.parse(readFileSync(`public/songs/${id}/chart.json`, "utf8"));
const SONGS = { twinkle: song("twinkle"), "fur-elise": song("fur-elise") };
interface Sent {
  data: number[];
  at: number;
  beat: number;
}

const FRAME = 16;
const firstPresses = (presses: Press[]) => {
  const first = new Map<number, number>();
  for (const p of presses) first.set(p.onset, Math.min(first.get(p.onset) ?? Infinity, p.wallMs));
  return first;
};
const endOf = (chart: Chart, presses: Press[]) => Math.max(...presses.map((p) => p.wallMs)) + (8 * msPerBeat(chart.bpm)) / 0.5;

// The predicting clock, as the plugin runs it: each frame, the onsets pressed by now are played at their press times,
// then the lookahead is filled.
type Clock = Pick<ReturnType<typeof follower>, "played" | "wallAt">;
function runFollow(chart: Chart, presses: Press[], tune: Tune = specTune): Sent[] {
  return runClock(chart, presses, (beats) => follower(chart, beats, 1, tune));
}
// The two-state follower, through the same loop.
function runKalman(chart: Chart, presses: Press[], tune: KalmanTune = kalmanTune): Sent[] {
  return runClock(chart, presses, (beats) => kalmanFollower(chart, beats, 1, tune));
}
function runClock(chart: Chart, presses: Press[], make: (beats: number[]) => Clock): Sent[] {
  const beats = onsetsOf(chart).map((o) => o.ms / msPerBeat(chart.bpm));
  const f = make(beats);
  const sched = scheduler(bandEvents(chart), beats[0]);
  const first = [...firstPresses(presses).entries()].sort((a, b) => a[1] - b[1]);
  const sent: Sent[] = [];
  let k = 0;
  for (let t = first[0][1] - 2 * msPerBeat(chart.bpm); t <= endOf(chart, presses) && !sched.done; t += FRAME) {
    for (; k < first.length && first[k][1] <= t; k++) f.played(first[k][0], first[k][1]);
    sched.fill(t, f.wallAt, (data, at, beat) => sent.push({ data, at, beat }));
  }
  return sent;
}

// The baseline: the same events, each sent when flow mode's clock passes its beat, through FlowJudge's own clock and
// judge (flow-mode.test.ts's loop). The crossing is interpolated inside the frame, so the baseline isn't charged a
// frame's quantization the browser would add.
function runHold(chart: Chart, presses: Press[]): Sent[] {
  const mpb = msPerBeat(chart.bpm);
  const judge = new FlowJudge(chart, () => {}, {});
  const beats = onsetsOf(chart).map((o) => o.ms / mpb);
  // the same events and the same entry as the follower's scheduler: none before the first onset, no orphan bass off
  const entered = bandEvents(chart).filter((e) => e.beat >= beats[0] - 1e-9);
  const events = entered.filter((e, j) => (e.data[0] & 0xf0) !== 0x80 || entered.slice(0, j).some((x) => (x.data[0] & 0xf0) === 0x90 && x.data[1] === e.data[1] && x.data[0] === (0x90 | (e.data[0] & 0x0f))));
  const sorted = [...presses].sort((a, b) => a.wallMs - b.wallMs);
  const sent: Sent[] = [];
  let k = 0;
  let i = 0;
  let prevT = beats[0] * mpb - 2 * mpb;
  let prevNow = prevT;
  for (let t = prevT; t <= endOf(chart, presses) && i < events.length; t += FRAME) {
    for (; k < sorted.length && sorted[k].wallMs <= t; k++) judge.press(sorted[k].pitch, judge.clock.now(sorted[k].wallMs), k, sorted[k].wallMs);
    judge.clock.update(t);
    judge.advance(judge.clock.now(t));
    const now = judge.clock.now(t);
    for (; i < events.length && events[i].beat * mpb <= now + 1e-6; i++) {
      const frac = now > prevNow ? Math.min(1, Math.max(0, (events[i].beat * mpb - prevNow) / (now - prevNow))) : 1;
      const at = prevT + frac * (t - prevT);
      sent.push({ data: events[i].data, at, beat: events[i].beat });
      const off = events[i].offAfterMs;
      if (off !== undefined) sent.push({ data: [0x80 | (events[i].data[0] & 0x0f), events[i].data[1], 0], at: at + off, beat: events[i].beat });
    }
    prevT = t;
    prevNow = now;
  }
  return sent;
}

const isOn = (m: number[]) => (m[0] & 0xf0) === 0x90 && m[2] > 0;
const isOff = (m: number[]) => (m[0] & 0xf0) === 0x80 || ((m[0] & 0xf0) === 0x90 && m[2] === 0);
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : NaN;
};

// The numbers: |send − press| at every band note-on on a beat where the player has an onset; the hi-hat's inter-beat
// spread; for the stop, the band note-ons past the unplayed onset before it's played.
function measure(chart: Chart, presses: Press[], sent: Sent[], stopOnset: number | null) {
  const mpb = msPerBeat(chart.bpm);
  const beats = onsetsOf(chart).map((o) => o.ms / mpb);
  const first = firstPresses(presses);
  const onsetAt = new Map(beats.map((b, k) => [Math.round(b * 1000), k]));
  const asyncs: number[] = [];
  for (const s of sent.filter((s) => isOn(s.data))) {
    const k = onsetAt.get(Math.round(s.beat * 1000));
    if (k !== undefined && first.has(k)) asyncs.push(s.at - first.get(k)!);
  }
  const abs = asyncs.map(Math.abs);
  const hats = sent.filter((s) => isOn(s.data) && (s.data[0] & 0x0f) === followSettings.drumChannel && s.data[1] === 42).map((s) => s.at).sort((a, b) => a - b);
  const gaps = hats.slice(1).map((t, i) => t - hats[i]);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
  const past =
    stopOnset === null ? null : sent.filter((s) => isOn(s.data) && s.beat > beats[stopOnset] + 1e-9 && s.at < first.get(stopOnset)!).length;
  return { n: abs.length, median: q(abs, 0.5), p95: q(abs, 0.95), max: Math.max(...abs), signed: q(asyncs, 0.5), spread: sd / mean, past };
}

const fmt = (x: number | null, d = 0) => (x === null ? "–" : Number.isFinite(x) ? x.toFixed(d) : "–");

describe("score follow: the measurement", () => {
  it("prints the table: both songs, four players, both clocks", () => {
    const rows: string[] = [
      "| song | player | clock | n | median |ms| | p95 |ms| | max |ms| | signed median ms | hat spread (sd/mean) | past the stop |",
      "|---|---|---|---|---|---|---|---|---|---|",
    ];
    for (const [id, chart] of Object.entries(SONGS)) {
      for (const [name, play] of Object.entries(PLAYERS)) {
        const presses = play(chart);
        const stop = name === "stop" ? stopAt(onsetsOf(chart).length) : null;
        for (const [clock, run] of [["kalman", runKalman], ["follow", runFollow], ["hold", runHold]] as const) {
          const m = measure(chart, presses, run(chart, presses), stop);
          rows.push(`| ${id} | ${name} | ${clock} | ${m.n} | ${fmt(m.median)} | ${fmt(m.p95)} | ${fmt(m.max)} | ${fmt(m.signed)} | ${fmt(m.spread, 3)} | ${fmt(m.past)} |`);
        }
      }
    }
    process.stdout.write(`\nscore-follow measurement (seed ${SEED}, frame ${FRAME} ms, lookahead ${followSettings.lookaheadMs} ms)\n${rows.join("\n")}\n\n`);
    expect(rows.length).toBe(2 + 2 * 4 * 3);
  });
});

describe.skipIf(!process.env.SF_SWEEP)("score follow: the variant sweep", () => {
  it("prints follow's numbers per variant", () => {
    const rows: string[] = [];
    for (const gain of [1, 0.75, 0.5, 0.35, 0.25])
      for (const trend of [false, true])
        for (const [id, chart] of Object.entries(SONGS))
          for (const name of ["drift", "drift+jitter"]) {
            const presses = PLAYERS[name](chart);
            const m = measure(chart, presses, runFollow(chart, presses, { phaseGain: gain, trend }), null);
            rows.push(`gain ${gain} trend ${trend} | ${id} ${name} | median ${fmt(m.median)} p95 ${fmt(m.p95)} max ${fmt(m.max)} signed ${fmt(m.signed)}`);
          }
    process.stdout.write(`${rows.join("\n")}\n`);
  });
});

describe.skipIf(!process.env.SF_SWEEP)("score follow: the Kalman sweep", () => {
  it("prints the two-state follower's numbers per tune", () => {
    const rows: string[] = [];
    for (const pressSdMs of [10, 17])
      for (const [order, drifts] of [[2, [15, 30]], [3, [0.25, 0.5, 1, 2, 4]]] as const)
      for (const drift of drifts) {
        const cells = Object.entries(SONGS).flatMap(([, chart]) =>
          ["steady", "drift", "drift+jitter"].map((name) => {
            const presses = PLAYERS[name](chart);
            const m = measure(chart, presses, runKalman(chart, presses, { ...kalmanTune, order, pressSdMs, drift }), null);
            return `${fmt(m.median)}/${fmt(m.p95)}`;
          }),
        );
        rows.push(`order ${order} R ${pressSdMs} q ${drift} | ${cells.join(" | ")}`);
      }
    process.stdout.write(`kalman: twinkle steady | drift | drift+jitter | fur-elise steady | drift | drift+jitter (median/p95)\n${rows.join("\n")}\n`);
  });
});

describe("score follow: the plumbing", () => {
  for (const [id, chart] of Object.entries(SONGS))
    for (const [clock, run] of [["kalman", runKalman], ["follow", runFollow], ["hold", runHold]] as const)
      it(`${id}, ${clock}: nothing on channel 1, and every note-on has its note-off`, () => {
        const sent = run(chart, PLAYERS["drift+jitter"](chart));
        expect(sent.length).toBeGreaterThan(0);
        expect(sent.filter((s) => (s.data[0] & 0x0f) === 0)).toEqual([]);
        const open = new Map<string, number>();
        for (const s of [...sent].sort((a, b) => a.at - b.at)) {
          const key = `${s.data[0] & 0x0f}:${s.data[1]}`;
          if (isOn(s.data)) open.set(key, (open.get(key) ?? 0) + 1);
          else if (isOff(s.data)) open.set(key, (open.get(key) ?? 0) - 1);
        }
        expect([...open.entries()].filter(([, n]) => n !== 0)).toEqual([]);
      });

  it.each([["mean", follower], ["kalman", kalmanFollower]] as const)("%s: the band waits at your next note: nothing more than waitBeats past it until you play it", (_, make) => {
    const chart = SONGS.twinkle;
    const beats = onsetsOf(chart).map((o) => o.ms / msPerBeat(chart.bpm));
    const f = make(chart, beats);
    f.played(0, 0);
    f.played(1, 600);
    expect(f.beatAt(1e6)).toBeCloseTo(beats[2] + followSettings.waitBeats);
    expect(f.wallAt(beats[2] + followSettings.waitBeats + 0.25)).toBe(Infinity);
    f.played(2, 1e6);
    expect(f.beatAt(1e6)).toBeCloseTo(beats[2]); // resumes from the onset itself
  });

  it("silence is All Notes Off and the pedal up on channels 2 and 10", () => {
    expect(silence()).toEqual([
      [0xb1, 123, 0],
      [0xb1, 64, 0],
      [0xb9, 123, 0],
      [0xb9, 64, 0],
    ]);
  });
});

describe("score follow: the plugin", () => {
  afterEach(() => vi.unstubAllGlobals());

  // A fake "Portable Grand" output, a fake input and a page loop: songStart, presses, a few frames, then `end`.
  async function page(query: string, end: GameEvent["type"]) {
    const sent: number[][] = [];
    const output = { name: "Portable Grand", send: (d: number[]) => sent.push(d), clear() {} };
    vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ outputs: new Map([["p", output]]) }) });
    vi.stubGlobal("window", { addEventListener() {} });
    let now = 0;
    vi.stubGlobal("performance", { now: () => now });
    const plugin = scoreFollow();
    const chart = plugin.transformChart!(SONGS.twinkle, new URLSearchParams(query));
    await new Promise((r) => setTimeout(r, 0)); // the MIDI access resolves
    let emit: (e: InputEvent) => void = () => {};
    const input = plugin.wrapInput!({ kind: "test", start: (on) => void (emit = on), stop() {} } as InputDevice);
    await input.start(() => {});
    plugin.onEvent!({ type: "songStart", atMs: 0 });
    const frame = { nowMs: 0 } as never;
    chart.notes.slice(0, 6).forEach((n, i) => {
      now = i * 750;
      emit({ type: "on", pitch: n.pitch, velocity: 80, timeMs: now });
      plugin.onEvent!({ type: "noteHit", noteId: n.id, pitch: n.pitch, judgment: "PERFECT", offsetMs: 0, atMs: now });
      plugin.draw!(null as never, { ...(frame as object), nowMs: n.beat * msPerBeat(chart.bpm) } as never);
    });
    plugin.onEvent!({ type: end, atMs: now } as GameEvent);
    return sent;
  }

  it("without band=follow (or band=hold) in Flow it sends nothing", async () => {
    for (const q of ["song=twinkle", "song=twinkle&mode=flow", "song=twinkle&band=follow", "song=twinkle&mode=wait&band=follow"])
      expect(await page(q, "quit"), q).toEqual([]);
  });

  it("with band=follow it plays bass and drums, never channel 1, and quit, pause and songEnd silence both channels", async () => {
    for (const end of ["quit", "pause", "songEnd"] as const) {
      const sent = await page("song=twinkle&mode=flow&band=follow", end);
      expect(sent.some((m) => isOn(m) && (m[0] & 0x0f) === followSettings.bassChannel)).toBe(true);
      expect(sent.some((m) => isOn(m) && (m[0] & 0x0f) === followSettings.drumChannel)).toBe(true);
      expect(sent.filter((m) => (m[0] & 0x0f) === 0)).toEqual([]);
      expect(sent.slice(-4)).toEqual(silence());
    }
  });

  it("band=hold plays the same band on flow's clock", async () => {
    const sent = await page("song=twinkle&mode=flow&band=hold", "quit");
    expect(sent.some((m) => isOn(m) && (m[0] & 0x0f) === followSettings.drumChannel)).toBe(true);
  });
});
