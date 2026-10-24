import { readFileSync } from "node:fs";
import { describe, expect, it, test } from "vitest";
import type { Chart, Frame } from "../../contracts";
import { hudLayout } from "../hud";
import { meterLayout } from "../fever-gauge";
import { countInDigitTop, firstCountInBar, warningCard, warningLayout } from ".";

const load = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));

// Counts what the card writes, without a real canvas.
function fakeCtx() {
  const texts: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k === "fillText" ? (s: string) => texts.push(s) : k in t ? t[k as string] : () => {}),
    set: (t, k, v) => ((t[k as string] = v), true),
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}
const frame = (nowMs: number): Frame => ({ nowMs, lowPitch: 60, highPitch: 72, judgmentLineY: 600, keyX: () => ({ x: 0, width: 10 }), width: 1280, height: 720 });

function textsAt(chart: Chart, query: string, nowMs: number): string[] {
  const card = warningCard();
  card.transformChart!(chart, new URLSearchParams(query));
  const { ctx, texts } = fakeCtx();
  card.draw!(ctx, frame(nowMs));
  return texts;
}

describe("WARNING card", () => {
  it("covers the count-in's first bar: Twinkle at100BPM, clipped to its three-pulse countdown", () => {
    expect(firstCountInBar(load("twinkle"))).toEqual({ fromMs: -1800, toMs: 0 });
  });

  it("shows on a level 13+ chart during the first bar only, with its level", () => {
    const moonlight = load("moonlight-3");
    const { fromMs, toMs } = firstCountInBar(moonlight);
    expect(textsAt(moonlight, "", fromMs)).toEqual(["WARNING", "Lv 14"]);
    expect(textsAt(moonlight, "", toMs)).toEqual([]);
    expect(textsAt(moonlight, "", 0)).toEqual([]);
  });

  it("stays off below 13, unless ?warn=1", () => {
    const twinkle = load("twinkle");
    expect(textsAt(twinkle, "", -1000)).toEqual([]);
    expect(textsAt(twinkle, "warn=1", -1000)).toEqual(["WARNING", "Lv 1"]);
  });

  it("sits under the HUD panel and the fever meter, above the count-in digit", () => {
    for (const [w, line] of [[1280, 560], [1920, 900], [800, 400]]) {
      const b = warningLayout(w, line);
      expect(b.y).toBeGreaterThan(meterLayout(w, line).bottom);
      expect(b.y).toBeGreaterThan(hudLayout(w, line).panel.h);
      expect(b.y + b.h).toBeLessThan(countInDigitTop(line));
      expect(b.h).toBeGreaterThan(40);
    }
  });
});


test("Nocturne warning follows the three-pulse12/8 countdown", () => {
  expect(firstCountInBar(load("nocturne-op9-2"))).toEqual({ fromMs: -4500, toMs: 0 });
});
