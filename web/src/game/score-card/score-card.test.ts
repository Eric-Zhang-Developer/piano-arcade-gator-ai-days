import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Results } from "../../contracts";
import { loopChart } from "../bar-loop";
import { CARD_LABELS, cardModel, drawCard, practiceLine, type CardModel } from "./card";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const results: Results = {
  chartId: "twinkle",
  judgments: [],
  extras: [],
  wrong: [{ eventIndex: 3 }],
  counts: { PERFECT: 38, GREAT: 2, GOOD: 1, MISS: 1, extra: 2, wrong: 1 },
  accuracy: 0.9734,
  maxCombo: 31,
  rank: "S",
};
const day = new Date(2026, 9, 24, 23, 30); // local time: the date stays the 24th whatever the zone

describe("cardModel", () => {
  it("gives the results screen's strings", () => {
    const m = cardModel(twinkle, results, 12345, day);
    expect(m).toMatchObject({ title: twinkle.title, composer: twinkle.composer, practice: null, rank: "S" });
    expect([m.score, m.accuracy, m.maxCombo, m.date]).toEqual(["12,345", "97.3%", "31", "2026-10-24"]);
    expect(m.counts.map((c) => `${c.label} ${c.value}`)).toEqual(["PERFECT 38", "GREAT 2", "GOOD 1", "MISS 1", "WRONG 1", "EXTRA 2"]);
    expect(m.counts.every((c) => /^(#[0-9a-f]{6}|rgba\()/i.test(c.color))).toBe(true); // colors a canvas can use
  });

  it("gives a bar loop's take the song's own title and a practice line", () => {
    const params = new URLSearchParams("song=twinkle&from=5&to=8&tempo=70");
    const looped = loopChart(twinkle, params)!.chart;
    expect(looped.title).not.toBe(twinkle.title);
    const m = cardModel(looped, results, 0, day, params);
    expect(m.title).toBe(twinkle.title);
    expect(m.practice).toBe("Bars 5–8 at 70%");
  });

  it("names the other practice takes", () => {
    expect(practiceLine(new URLSearchParams("hands=R"))).toBe("Right hand");
    expect(practiceLine(new URLSearchParams("tempo=80&hands=L"))).toBe("Whole song at 80% · Left hand");
    expect(practiceLine(new URLSearchParams("versus=1"))).toBe("Versus");
    expect(practiceLine(new URLSearchParams("hands=both&bot=perfect"))).toBeNull();
  });

  it("names the file after the song, the day and the rank", () => {
    const m = cardModel({ ...twinkle, id: "local/my-song" }, results, 0, day);
    expect(m.file).toBe("piano-arcade-local-my-song-2026-10-24-S.png");
  });
});

describe("drawCard", () => {
  // Records every fillText and every font; the rest are no-ops.
  function recorder() {
    const texts: string[] = [];
    const fonts: string[] = [];
    let font = "";
    const ctx = {
      fillStyle: "" as unknown,
      textAlign: "left",
      textBaseline: "alphabetic",
      get font() {
        return font;
      },
      set font(f: string) {
        font = f;
        fonts.push(f);
      },
      fillRect() {},
      fillText(s: string) {
        texts.push(s);
      },
      measureText: (s: string) => ({ width: s.length * 30 }),
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
      createLinearGradient: () => ({ addColorStop() {} }),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, fonts };
  }
  const strings = (m: CardModel) =>
    [m.title, m.composer, m.practice, m.rank, m.score, m.accuracy, m.maxCombo, m.date, m.jacket.word]
      .concat(m.counts.flatMap((c) => [c.label, c.value]))
      .filter((s): s is string => s !== null);

  it("writes each of the model's strings once, and its labels", () => {
    const params = new URLSearchParams("from=5&to=8&tempo=70");
    const m = cardModel(loopChart(twinkle, params)!.chart, results, 12345, day, params);
    const { ctx, texts } = recorder();
    drawCard(ctx, m);
    expect(texts.toSorted()).toEqual([...strings(m), ...CARD_LABELS].toSorted());
  });

  it("draws no text under 24 px", () => {
    const { ctx, fonts } = recorder();
    drawCard(ctx, cardModel({ ...twinkle, title: "A very long title that has to shrink to fit the right column" }, results, 0, day));
    const sizes = fonts.map((f) => Number(/(\d+)px/.exec(f)?.[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(24);
  });
});
