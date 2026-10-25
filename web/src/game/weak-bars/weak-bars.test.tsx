import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Chart, Judgment, Results, Take } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { phrases, practiceUrl, scorePhrases, weakBars, weakest } from ".";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const barMs = twinkle.beatsPerBar * msPerBeat(twinkle.bpm);
const params = new URLSearchParams("song=twinkle");
const wait = new URLSearchParams("song=twinkle&mode=wait");

// Every note PERFECT except `judge(note) ` says otherwise; `wrongAt` are WRONG presses at those chart times.
function take(judge: (beat: number) => Judgment = () => "PERFECT", wrongAt: number[] = []): { take: Take; results: Results } {
  const events: Take["events"] = [];
  const judgments = twinkle.notes.map((n) => {
    const j = judge(n.beat);
    if (j === "MISS") return { noteId: n.id, judgment: j, offsetMs: null, eventIndex: null };
    events.push({ pitch: n.pitch, velocity: 80, timeMs: n.beat * msPerBeat(twinkle.bpm), offTimeMs: null });
    return { noteId: n.id, judgment: j, offsetMs: 0, eventIndex: events.length - 1 };
  });
  const wrong = wrongAt.map((t) => ({ eventIndex: events.push({ pitch: 61, velocity: 80, timeMs: t, offTimeMs: null }) - 1 }));
  const results = { chartId: "twinkle", judgments, extras: wrong, wrong, counts: { PERFECT: 0, GREAT: 0, MISS: 0, extra: 0 }, accuracy: 1, maxCombo: 0, rank: "S" } as Results;
  return { take: { chartId: "twinkle", startedAt: "", latencyOffsetMs: 0, inputDevice: "test", events }, results };
}
const scores = (t: ReturnType<typeof take>) => scorePhrases(twinkle, t.take, t.results);
const panel = (t: ReturnType<typeof take>, p = params) =>
  renderToStaticMarkup(<>{weakBars().resultsPanel!({ chart: twinkle, params: p, take: t.take, results: t.results, retry() {} })}</>);

describe("weak bars on Twinkle", () => {
  it("12 bars of 4/4 give 6 two-bar phrases", () => {
    expect(phrases(twinkle).map((p) => [p.from, p.to])).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]]);
  });

  it("misses only in bars 5–6 make 5–6 the weakest, with the exact practice URL", () => {
    const w = weakest(scores(take((beat) => (beat >= 16 && beat < 24 && beat % 2 ? "MISS" : "PERFECT"))));
    expect([w?.from, w?.to]).toEqual([5, 6]);
    expect(practiceUrl(twinkle, params, w!)).toBe("/play?song=twinkle&from=5&to=6&tempo=80");
  });

  it("a WRONG press during bar 3 lowers phrase 3–4 only", () => {
    const s = scores(take(undefined, [2.5 * barMs]));
    expect(s.map((p) => p.accuracy < 1)).toEqual([false, true, false, false, false, false]);
  });

  it("a perfect wait take gives No weak bars and no button", () => {
    expect(weakest(scores(take()))).toBeNull();
    const html = panel(take(), wait);
    expect(html).toContain("No weak bars");
    expect(html).not.toContain("weak-bars-practice");
  });

  it("a tie picks the earlier phrase", () => {
    const missFirstOf = (bars: number[]) => (beat: number) => (bars.some((b) => beat === (b - 1) * 4) ? "MISS" : "PERFECT");
    const w = weakest(scores(take(missFirstOf([9, 3]))));
    expect(w?.from).toBe(3);
  });

  it("keeps hands, drops everything else, and a bar-loop take renders nothing", () => {
    const p = new URLSearchParams("song=twinkle&hands=R&bot=rank-c&midi=sim");
    expect(practiceUrl(twinkle, p, { from: 5, to: 6, noteIds: [] })).toBe("/play?song=twinkle&hands=R&from=5&to=6&tempo=80");
    expect(panel(take((b) => (b === 0 ? "MISS" : "PERFECT")), wait)).toContain("Practice bars 1–2 at 80%");
    expect(panel(take((b) => (b === 0 ? "MISS" : "PERFECT")), new URLSearchParams("song=twinkle&from=1&to=2"))).toBe("");
  });

  it("a scored take shows each phrase's number but no button and no weakest mark: the tutor's is the one prescription (#1026)", () => {
    const html = panel(take((beat) => (beat >= 16 && beat < 24 && beat % 2 ? "MISS" : "PERFECT")));
    expect(html).toContain("weak-bars-cell");
    expect(html).not.toContain("weak-bars-practice");
    expect(html).not.toContain("data-weakest");
    expect(html).not.toContain("No weak bars");
  });
});
