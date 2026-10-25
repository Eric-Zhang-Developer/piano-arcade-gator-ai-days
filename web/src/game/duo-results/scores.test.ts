import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Judgment, Results, Take } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { scorePhrases } from "../weak-bars";
import { barScores, handDrift, histogram, nextForKey, practiceBarsUrl, saveNextFor, timingCaption, tutorLine, weakestRun } from "./scores";

const load = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));
const furElise = load("fur-elise");
const twinkle = load("twinkle");

// A take of `chart`: each note judged by `judge`, hit `offset(note)` ms off; `wrongAt` are WRONG presses at those times.
function take(chart: Chart, judge: (bar: number) => Judgment = () => "PERFECT", offset: (hand: string) => number = () => 0, wrongAt: number[] = []) {
  const events: Take["events"] = [];
  const judgments = chart.notes.map((n) => {
    const j = judge(Math.floor(n.beat / chart.beatsPerBar) + 1);
    if (j === "MISS") return { noteId: n.id, judgment: j, offsetMs: null, eventIndex: null };
    const off = offset(n.hand);
    events.push({ pitch: n.pitch, velocity: 80, timeMs: noteTimeMs(chart, n) + off, offTimeMs: null });
    return { noteId: n.id, judgment: j, offsetMs: off, eventIndex: events.length - 1 };
  });
  const wrong = wrongAt.map((t) => ({ eventIndex: events.push({ pitch: 61, velocity: 80, timeMs: t, offTimeMs: null }) - 1 }));
  const results = { chartId: chart.id, judgments, extras: wrong, wrong, counts: { PERFECT: 0, GREAT: 0, MISS: 0, extra: 0 }, accuracy: 1, maxCombo: 0, rank: "S" } as Results;
  return { take: { chartId: chart.id, startedAt: "", latencyOffsetMs: 0, inputDevice: "test", events } as Take, results };
}

describe("barScores", () => {
  it("paired cells equal weak-bars' 2-bar phrases, WRONG presses included", () => {
    const t = take(twinkle, (bar) => (bar % 3 ? "PERFECT" : bar % 2 ? "GOOD" : "MISS"), () => 0, [2500, 9000]);
    const phrases = scorePhrases(twinkle, t.take, t.results).map((p) => [p.from, p.to, p.accuracy]);
    const paired = barScores(twinkle, t.take, t.results, 2).map((c) => [c.from, c.to, c.accuracy]);
    expect(paired).toEqual(phrases);
  });

  it("one cell per bar, and a bar with no notes has no score", () => {
    const chart = { ...twinkle, notes: twinkle.notes.filter((n) => n.beat < 8 || n.beat >= 12) }; // bar 3 emptied
    const t = take(chart);
    const cells = barScores(chart, t.take, t.results);
    expect(cells).toHaveLength(12);
    expect(cells[2]).toEqual({ from: 3, to: 3, notes: 0, accuracy: null });
    expect(cells.filter((c) => c.accuracy === 1)).toHaveLength(11);
  });
});

describe("weakestRun", () => {
  it("finds bars 9–12 removed from a perfect Für Elise take", () => {
    const t = take(furElise, (bar) => (bar >= 9 && bar <= 12 ? "MISS" : "PERFECT"));
    expect(weakestRun(barScores(furElise, t.take, t.results))).toEqual({ from: 9, to: 12 });
  });

  it("stops at 4 bars, at a clean bar and at an empty bar; null when every bar is clean", () => {
    const cell = (from: number, accuracy: number | null) => ({ from, to: from, notes: accuracy === null ? 0 : 4, accuracy });
    expect(weakestRun([1, 0.5, 0.4, 0.3, 0.2, 0.6, 0.7].map((a, i) => cell(i + 1, a)))).toEqual({ from: 2, to: 5 });
    expect(weakestRun([0.9, 1, 0.2, 0.5, 0.96].map((a, i) => cell(i + 1, a)))).toEqual({ from: 3, to: 4 });
    expect(weakestRun([0.5, null, 0.2, 1].map((a, i) => cell(i + 1, a)))).toEqual({ from: 3, to: 3 });
    expect(weakestRun([1, 0.95, null].map((a, i) => cell(i + 1, a)))).toBeNull();
  });
});

describe("histogram", () => {
  it("the bins sum to the judged notes, and offsets past ±100 ms land in the end bins", () => {
    const offs = [-250, -100, -5, 0, 9, 10, 99, 100, 400];
    let i = 0;
    const t = take(twinkle, (bar) => (bar > 5 ? "MISS" : "PERFECT"), () => offs[i++ % offs.length]);
    const hits = t.results.judgments.filter((j) => j.judgment !== "MISS").length;
    const { bins } = histogram(t.results);
    expect(bins).toHaveLength(20);
    expect(bins.reduce((s, b) => s + b, 0)).toBe(hits);
    const one = histogram({ ...t.results, judgments: offs.map((o, k) => ({ noteId: `n${k}`, judgment: "GOOD", offsetMs: o, eventIndex: k })) });
    expect(one.bins).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 3]);
  });

  it("captions the mean", () => {
    expect([timingCaption(23.4), timingCaption(-8.6), timingCaption(0.2), timingCaption(null)]).toEqual(["AVG +23 MS LATE", "AVG −9 MS EARLY", "AVG 0 MS", "NO TIMED NOTES"]);
  });
});

describe("tutorLine", () => {
  const run = { from: 9, to: 12 };
  it("names a hand past ±20 ms, the larger if both, with the input's numbers", () => {
    expect(tutorLine({ run, accuracy: 0.6, drift: { L: 34.6, R: 5 } })[0]).toBe("Your left hand drags in bars 9–12, about 35 ms late.");
    expect(tutorLine({ run, accuracy: 0.6, drift: { L: 25, R: -41 } })[0]).toBe("Your right hand rushes in bars 9–12, about 41 ms early.");
  });

  it("else the run's accuracy, then the loop line", () => {
    expect(tutorLine({ run, accuracy: 0.425, drift: { L: 20, R: null } })).toEqual([
      "Bars 9–12 were your weakest: 43% of notes right.",
      "Let's loop just those bars at 70%, then play it through.",
    ]);
    expect(tutorLine({ run: { from: 4, to: 4 }, accuracy: 0.5, drift: { L: null, R: null } })[0]).toBe("Bar 4 was your weakest: 50% of notes right.");
  });

  it("a clean take", () => {
    expect(tutorLine({ run: null, accuracy: null, drift: { L: null, R: null } })).toEqual(["Clean take. Try it faster, or pick the next song."]);
  });

  it("reads each hand's drift from the take", () => {
    const t = take(furElise, () => "PERFECT", (hand) => (hand === "L" ? 30 : -4));
    const d = handDrift(furElise, t.results, 9, 12);
    expect([d.L, d.R]).toEqual([30, -4]);
  });
});

describe("the practice URL and next for you", () => {
  it("bar-loop at 70%, keeping hands", () => {
    expect(practiceBarsUrl("fur-elise", new URLSearchParams("song=fur-elise&hands=R&bot=rank-c"), { from: 9, to: 12 })).toBe("/play?song=fur-elise&hands=R&from=9&to=12&tempo=70");
  });

  it("saves after a scored take only: never a bot, demo, practice, loop or wait take", () => {
    const saved = new Map<string, string>();
    const storage = { setItem: (k: string, v: string) => void saved.set(k, v) };
    const entry = { song: "fur-elise", from: 9, to: 12, hand: "L" as const };
    for (const q of ["bot=rank-c", "bot=perfect&audible=1&demo=1", "demo=1", "practice=adapt", "from=1&to=4", "mode=wait", "tempo=70", "hands=R"])
      expect(saveNextFor(storage, new URLSearchParams(`song=fur-elise&${q}`), entry), q).toBe(false);
    expect(saved.size).toBe(0);
    expect(saveNextFor(storage, new URLSearchParams("song=fur-elise"), entry)).toBe(true);
    expect(JSON.parse(saved.get(nextForKey("fur-elise"))!)).toEqual(entry);
    expect(saveNextFor({ setItem: () => { throw new Error("blocked"); } }, new URLSearchParams("song=fur-elise"), entry)).toBe(false);
  });
});
