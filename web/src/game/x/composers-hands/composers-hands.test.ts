import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { validateChart } from "../../../contracts";
import { noteTimeMs } from "../../core/judge";
import { echoGuard, playbackBetween, splitHands } from "../../hand-mode/hands";
import { dtw, sections, sequence, timeMap, type Seq } from "./align";
import { StatusLine } from "./ComposersHands";
import { AHEAD_MS, sendsBetween, silence, testRoll, type Out } from "./rolls";
import { handOf, parseMidi, rollSettings, secondsChart, splitPoints, spoolRate, unspool, type Roll, type RollNote } from "./roll";

// Synthetic rolls only: the real ones stay local (specs/decisions/composers-hands-rolls-local.md).
const vlq = (n: number) => {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
};
const u32 = (n: number) => [n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const track = (events: [number, number[]][]) => {
  const body = events.flatMap(([dt, e]) => [...vlq(dt), ...e]).concat([0, 0xff, 0x2f, 0]);
  return [..."MTrk"].map((c) => c.charCodeAt(0)).concat(u32(body.length), body);
};
const midi = (tracks: number[][], ppq = 480) =>
  new Uint8Array([..."MThd"].map((c) => c.charCodeAt(0)).concat(u32(6), [0, 1, 0, tracks.length, ppq >> 8, ppq & 0xff], ...tracks));

const note = (pitch: number, onMs: number, offMs = onMs + 200): RollNote => ({ pitch, onMs, offMs, velocity: 70 });
const roll = (notes: RollNote[]): Roll => ({ notes, pedal: [], dynamics: true });

describe("parseMidi", () => {
  it("merges tracks, applies a tempo change, reads the pedal, and flattens a roll with one velocity", () => {
    const tempo = track([
      [0, [0xff, 0x51, 3, 0x07, 0xa1, 0x20]], // 500000 µs per quarter
      [960, [0xff, 0x51, 3, 0x0f, 0x42, 0x40]], // 1000000 from tick 960 (1000 ms)
    ]);
    const notes = track([
      [0, [0x90, 60, 64]],
      [0, [0xb0, 64, 127]],
      [480, [0x80, 60, 0]], // 500 ms
      [0, [0x90, 64, 64]],
      [480, [64, 0]], // running status, velocity 0: an off at 1000 ms
      [480, [0x90, 67, 64]], // 2000 ms, at the slower tempo
      [480, [0x80, 67, 0]],
      [0, [0xb0, 64, 0]],
    ]);
    const r = parseMidi(midi([tempo, notes]));
    expect(r.notes.map((n) => [n.pitch, n.onMs, n.offMs])).toEqual([
      [60, 0, 500],
      [64, 500, 1000],
      [67, 2000, 3000],
    ]);
    expect(r.pedal).toEqual([
      { atMs: 0, down: true },
      { atMs: 3000, down: false },
    ]);
    expect(r.dynamics).toBe(false);
    expect(r.notes.every((n) => n.velocity === rollSettings.fixedVelocity)).toBe(true);
  });

  it("refuses what isn't a MIDI file", () => {
    expect(() => parseMidi(new Uint8Array([1, 2, 3]))).toThrow();
  });
});

describe("the spool correction", () => {
  it("removes a planted linear speed-up from a steady passage", () => {
    const a = 2e-6; // 12% faster after a minute
    const played = Array.from({ length: 240 }, (_, n) => n * 250); // even eighths at 120 bpm, as the player played them
    const onRoll = played.map((tau) => (Math.sqrt(1 + 2 * a * tau) - 1) / a); // where a speeding roll puts them
    expect(onRoll[239] - onRoll[238]).toBeLessThan(230);
    const est = spoolRate(onRoll);
    expect(Math.abs(est - a) / a).toBeLessThan(0.05);
    const fixed = unspool(roll(onRoll.map((t) => note(60, t, t + 100))), est).notes.map((n) => n.onMs);
    const gaps = fixed.slice(1).map((t, i) => t - fixed[i]);
    expect(Math.max(...gaps.map((g) => Math.abs(g - 250)))).toBeLessThan(2);
  });

  it("leaves a steady roll alone", () => {
    const steady = Array.from({ length: 50 }, (_, n) => n * 300);
    expect(Math.abs(spoolRate(steady))).toBeLessThan(rollSettings.spoolMin);
  });
});

describe("the hand split", () => {
  // Passage 0: left chords around C3, right chords around C5. Passage 1: the same, an octave apart.
  const notes = [0, 1000, 2000].flatMap((t) => [note(43, t), note(48, t), note(72, t), note(76, t)]).concat(
    [4000, 5000].flatMap((t) => [note(50, t), note(55, t), note(64, t), note(67, t)]),
  );
  it("splits two clustered bands at their gap, per passage", () => {
    const splits = splitPoints(notes);
    expect(splits).toEqual([60, 59.5]);
    expect(notes.map((n) => handOf(n, splits)).join("")).toBe("LLRR".repeat(5));
  });
  it("a nudge moves one passage's split", () => {
    const splits = splitPoints(notes, { 1: -6 });
    expect(splits).toEqual([60, 53.5]);
    expect(handOf(note(55, 4000), splits)).toBe("R");
  });
});

describe("the seconds chart", () => {
  const r = roll([note(48, 0, 900), note(72, 0, 400), note(74, 1234.5, 1500)]);
  const chart = secondsChart(r, splitPoints(r.notes), { id: "roll-test", title: "Test", composer: "Test", source: "synthetic" });
  it("passes validateChart, and a note at roll time t ms has noteTimeMs t", () => {
    expect(validateChart(chart)).toEqual([]);
    expect(chart.notes.map((n) => noteTimeMs(chart, n))).toEqual([0, 0, 1234.5]);
    expect(chart.beatsPerBar).toBeGreaterThanOrEqual(2); // one bar longer than the roll: no bar line draws
  });
  it("the duet: his left hand is hand-mode's playback at roll times, and an echo within 30 ms isn't judged", () => {
    const { judged, playback } = splitHands(chart, "R");
    expect(judged.notes.map((n) => n.pitch)).toEqual([72, 74]);
    expect(playbackBetween(chart, playback, 0, 10_000).map((p) => [p.pitch, p.atMs, p.endMs])).toEqual([[48, 0, 900]]);
    const guard = echoGuard();
    guard.sent(48, 1000);
    expect(guard.isEcho(48, 1025)).toBe(true);
    expect(guard.isEcho(48, 1040)).toBe(false);
    expect(guard.isEcho(72, 1010)).toBe(false);
  });
});

describe("the alignment", () => {
  // A chart of 12 bars of 8 notes, each bar its own short motif so no two bars look alike.
  const chart: Seq[] = Array.from({ length: 96 }, (_, k) => ({ pitch: 48 + ((Math.floor(k / 8) * 5 + (k % 8) * 3) % 36), ms: k * 250, bar: Math.floor(k / 8) + 1 }));
  // His roll: bars 1–2 played twice (the repeat), two extra notes, two dropped.
  const played = [...chart.slice(0, 16), ...chart.slice(0, 16), ...chart.slice(16)].map((c, k) => ({ pitch: c.pitch, ms: k * 260 }));
  played.splice(40, 0, { pitch: 100, ms: 0 });
  played.splice(70, 0, { pitch: 101, ms: 0 });
  played.splice(90, 1);
  played.splice(60, 1);

  it("labels the repeat, and the matched sections reach 90%", () => {
    const s = sections(played, chart);
    expect(s.map((x) => x.kind)).toEqual(["matched", "repeat", "matched"]);
    expect(s[1].roll[1] - s[1].roll[0]).toBe(16);
    for (const m of s.filter((x) => x.kind === "matched")) expect(m.match).toBeGreaterThanOrEqual(0.9);
    expect(s[0].bars).toEqual([1, 2]);
    expect(s[2].bars).toEqual([3, 12]);
  });

  it("labels a long stretch the roll leaves out as skipped, and a long unrelated one as extra", () => {
    expect(sections(chart.slice(0, 40).concat(chart.slice(56)), chart).map((x) => x.kind)).toEqual(["matched", "skipped", "matched"]);
    const tail = Array.from({ length: 12 }, (_, k) => ({ pitch: 100 + (k % 3), ms: 0 }));
    expect(sections(chart.concat(tail), chart).map((x) => x.kind)).toEqual(["matched", "extra"]);
  });

  it("orders a chord by pitch in both, and maps chart time to roll time at equal pitches", () => {
    expect(sequence([{ pitch: 64, ms: 10 }, { pitch: 60, ms: 0 }, { pitch: 55, ms: 500 }]).map((x) => x.pitch)).toEqual([60, 64, 55]);
    const map = timeMap(played, chart, dtw(played, chart));
    expect(map.length).toBeGreaterThan(80);
    expect(map.every((q, i) => i === 0 || q.p >= map[i - 1].p)).toBe(true);
  });
});

describe("the sends", () => {
  it("his notes go out on channel 1 at roll times, a release before a repeat at the same time, with the pedal", () => {
    const notes = [note(48, 0, 500), note(48, 500, 900), note(72, 250, 400)];
    const sends = sendsBetween(notes, [{ atMs: 0, down: true }, { atMs: 900, down: false }], 0, 1000);
    expect(sends.map((x) => [x.bytes.join(" "), x.atMs])).toEqual([
      ["176 64 127", 0],
      ["144 48 70", 0],
      ["144 72 70", 250],
      ["128 72 0", 400],
      ["128 48 0", 500],
      ["144 48 70", 500],
      ["176 64 0", 900],
      ["128 48 0", 900],
    ]);
    expect(sends.every((x) => (x.bytes[0] & 0x0f) === 0)).toBe(true);
    expect(sendsBetween(notes, [], 250, 500).map((x) => x.atMs)).toEqual([250, 400]); // [from, to)
  });

  it("the test roll is our chart at its own tempo", () => {
    const chart = { id: "t", title: "T", composer: "T", source: "s", bpm: 120, beatsPerBar: 4, notes: [{ id: "a", pitch: 60, beat: 1, duration: 0.5, hand: "R" as const }] };
    expect(testRoll(chart).notes).toEqual([{ pitch: 60, onMs: 500, offMs: 750, velocity: 80 }]);
    expect(testRoll(chart).dynamics).toBe(false);
  });
});

// roll-pages-polish (#1206, #1207): a stop leaves nothing sounding, and the status line is read out.
describe("a stop", () => {
  const fake = (withClear: boolean) => {
    const log: (string | [number[], number | undefined])[] = [];
    const out: Out = { send: (d, t) => void log.push([d, t]) };
    if (withClear) out.clear = () => void log.push("clear");
    return { out, log };
  };

  it("clears the queue first, then All Notes Off and the pedal up, now and AHEAD_MS later", () => {
    const { out, log } = fake(true);
    silence(out, 1000);
    expect(log[0]).toBe("clear");
    const sends = log.slice(1) as [number[], number][];
    for (const at of [1000, 1000 + AHEAD_MS]) {
      for (let ch = 0; ch < 16; ch++) expect(sends).toContainEqual([[0xb0 + ch, 123, 0], at]);
      expect(sends).toContainEqual([[0xb0, 64, 0], at]);
    }
    expect(sends).toHaveLength(2 * 17);
  });

  it("works on a port with no clear(), and on no port at all", () => {
    const { out, log } = fake(false);
    silence(out, 0);
    expect(log).toHaveLength(2 * 17);
    expect(() => silence(null, 0)).not.toThrow();
  });
});

describe("the status line", () => {
  it("sits in a polite status region", () => {
    const html = renderToStaticMarkup(createElement(StatusLine, { text: "No piano output: the highway plays silent" }));
    expect(html).toMatch(/<p[^>]*role="status"[^>]*aria-live="polite"[^>]*>No piano output: the highway plays silent<\/p>/);
  });
});
