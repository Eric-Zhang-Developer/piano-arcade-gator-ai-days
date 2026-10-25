import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Chart, Take } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";
import { GOOD_MS } from "../core/settings";
import { pianoOutSettings } from "../piano-out";
import { highwayAt, latePresses, replayChartTime, replaySpan, replayView } from ".";
import { ReplayOverlay } from "./overlay";
import { makeLayout } from "../core/highway";
import { staticRange } from "../core/range";
import { plugins } from "../layers";
import { takeKeys } from "./keys";

// 4/4 at 120 bpm (500 ms a beat, 2 s a bar): C D E F on beats 0–3.
const chart: Chart = {
  id: "t", title: "t", composer: "t", source: "test", bpm: 120, beatsPerBar: 4,
  notes: [60, 62, 64, 65].map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 1, hand: "R" as const })),
};
// C on time, D 30 ms late and held 400 ms, E skipped (MISS), F on time.
const take: Take = {
  chartId: "t", startedAt: "2026-10-24T00:00:00Z", latencyOffsetMs: 0, inputDevice: "test",
  events: [
    { pitch: 60, velocity: 80, timeMs: 0, offTimeMs: 300 },
    { pitch: 62, velocity: 80, timeMs: 560, offTimeMs: 930 },
    { pitch: 65, velocity: 80, timeMs: 1500, offTimeMs: null },
  ],
};
const results = judgeTake(chart, take);

describe("the replay clock", () => {
  it("spans one bar before the first press to one bar after the last release", () => {
    expect(replaySpan(chart, take)).toEqual({ firstPressMs: 0, fromMs: -2000, toMs: 1500 + pianoOutSettings.heldMs + 2000, barMs: 2000 });
  });

  it("puts the first press on the line leadMs after piano-out starts, at 1×", () => {
    const lead = pianoOutSettings.leadMs;
    expect(replayChartTime(10_000 + lead, 10_000, 0)).toBe(0);
    expect(replayChartTime(10_000 + lead + 530, 10_000, 0)).toBe(530);
    expect(replayChartTime(10_000, 10_000, 250, 200)).toBe(50);
  });
});

describe("the highway at a chart time", () => {
  it("shows hits from their press and a miss once its window closes", () => {
    expect([...highwayAt(chart, take, results, -1).noteState]).toEqual([]);
    expect([...highwayAt(chart, take, results, 0).noteState]).toEqual([["n0", "PERFECT"]]);
    expect(highwayAt(chart, take, results, 559).noteState.has("n1")).toBe(false);
    expect(highwayAt(chart, take, results, 560).noteState.get("n1")).toBe("GREAT");
    const missAt = noteTimeMs(chart, chart.notes[2]) + GOOD_MS;
    expect(highwayAt(chart, take, results, missAt - 1).noteState.has("n2")).toBe(false);
    expect(highwayAt(chart, take, results, missAt).noteState.get("n2")).toBe("MISS");
  });

  it("lights the keys held by presses at that time", () => {
    expect([...highwayAt(chart, take, results, 100).pressed]).toEqual([60]);
    expect([...highwayAt(chart, take, results, 600).pressed]).toEqual([62]);
    expect([...highwayAt(chart, take, results, 1600).pressed]).toEqual([65]); // no release: held heldMs
    expect([...highwayAt(chart, take, results, 1500 + pianoOutSettings.heldMs).pressed]).toEqual([]);
  });

  it("shows the latest judgment, with its offset", () => {
    expect(highwayAt(chart, take, results, 600).latest).toMatchObject({ judgment: "GREAT", atMs: 560 });
  });
});

describe("the slip", () => {
  it("marks only the presses the game called LATE: past PERFECT and after the note", () => {
    expect([...latePresses(results)]).toEqual([1]); // D, 60 ms late (GREAT); C and F on time, E missed
    const early = judgeTake(chart, { ...take, events: [{ ...take.events[0], timeMs: -60 }] });
    expect(latePresses(early).size).toBe(0); // EARLY isn't a slip here
  });
});

describe("the panel", () => {
  it("offers Watch replay only for a take with a press", () => {
    const p = replayView();
    expect(p.resultsPanel!({ chart, take, results, params: new URLSearchParams(), retry() {} })).not.toBeNull();
    const empty = { ...take, events: [] };
    expect(p.resultsPanel!({ chart, take: empty, results: judgeTake(chart, empty), params: new URLSearchParams(), retry() {} })).toBeNull();
  });
});

describe("the overlay", () => {
  const html = renderToStaticMarkup(createElement(ReplayOverlay, { chart, take, results, onClose() {} }));

  it("is a dialog named by its caption (#1245)", () => {
    expect(html).toMatch(/^<dialog data-testid="replay-overlay" aria-labelledby="replay-caption"/);
    expect(html).toMatch(/<p id="replay-caption"[^>]*>.*Replay/);
  });

  it("captions on the kit with no key hint; Stop carries Esc (#1246)", () => {
    const caption = html.match(/<p id="replay-caption".*?<\/p>/)![0];
    expect(caption).toContain('data-kit="mono"');
    expect(caption).toContain("clamp(16px, 1.25vw, 24px)");
    expect(caption).not.toContain("Esc");
    expect(html).toMatch(/<button[^>]*title="Stop \(Esc\)"[^>]*aria-keyshortcuts="Escape"[^>]*>Stop<\/button>/);
  });
});

// replay-keys (#419): a hands= or bar-loop take keeps the loaded chart's keyboard, and so does its replay.
describe("the replay's keyboard is the take's", () => {
  const raw = JSON.parse(readFileSync("public/songs/fur-elise/chart.json", "utf8")) as Chart;
  const keysOf = (l: { lowPitch: number; highPitch: number }) => [l.lowPitch, l.highPitch];
  for (const q of ["hands=R", "hands=L", "from=9&to=12", "from=9&to=12&tempo=70"]) {
    it(`fur-elise ${q}: the take's range, through layers.ts in its own order`, () => {
      const params = new URLSearchParams(`song=fur-elise&${q}`);
      const chart = plugins.reduce((c, p) => p.transformChart?.(c, params) ?? c, raw); // as /play loads it
      const take = staticRange(raw); // /play's keysRef: C2–C7 here
      expect(keysOf(take)).toEqual([36, 96]);
      expect(keysOf(makeLayout(chart, 1280, 720, 0.5))).not.toEqual(keysOf(take)); // what the replay drew before
      expect(keysOf(makeLayout(chart, 1280, 720, 0.5, undefined, takeKeys()!))).toEqual(keysOf(take));
    });
  }
});
