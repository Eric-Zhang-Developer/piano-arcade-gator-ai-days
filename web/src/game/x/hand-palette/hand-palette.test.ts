import { describe, expect, it } from "vitest";
import type { Chart, Frame } from "../../../contracts";
import { meterSettings } from "../../fever-gauge";
import { handColorSettings } from "../../hand-colors";
import { hudSettings } from "../../hud";
import { juiceSettings } from "../../juice";
import { candidates, field, passes, table, today } from "./candidates";
import { contrast, deltaE, deltaE00, lightness, MACHADO, oklchToRgb, rgbToHex, rgbToOklch, hexToRgb } from "./color";
import { apply, matrixValues, notches, restore, visionOf } from ".";
import { sharma2005 } from "./sharma2005";

describe("the color math", () => {
  it("CIEDE2000 matches all 34 of Sharma, Wu & Dalal's published pairs to 4 decimals", () => {
    expect(sharma2005).toHaveLength(34);
    for (const r of sharma2005) expect(deltaE00([r[0], r[1], r[2]], [r[3], r[4], r[5]])).toBeCloseTo(r[6], 4);
  });

  it("the Machado matrices are the paper's severity 1.0 rows, and each keeps white white", () => {
    // Copied from the authors' table (inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html).
    expect(MACHADO.protan[0]).toEqual([0.152286, 1.052583, -0.204868]);
    expect(MACHADO.deutan[1]).toEqual([0.280085, 0.672501, 0.047413]);
    expect(MACHADO.tritan[2]).toEqual([0.004733, 0.691367, 0.3039]);
    for (const m of Object.values(MACHADO)) for (const row of m) expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 4);
  });

  it("OKLCH round-trips a color, and says when one is outside sRGB", () => {
    for (const hex of ["#2b9bff", "#e6870a", "#f34fc2", "#ffe27a"]) expect(rgbToHex(oklchToRgb(...rgbToOklch(hexToRgb(hex)))!)).toBe(hex);
    expect(oklchToRgb(0.7, 0.4, 150)).toBeNull();
  });

  it("the simulation turns the deutan pair the pitch measured into a near match", () => {
    expect(deltaE("#2b9bff", "#a07cff")).toBeCloseTo(23.3, 1);
    expect(deltaE("#2b9bff", "#a07cff", "deutan")).toBeCloseTo(0.6, 1);
  });
});

describe("the table", () => {
  it("today's palette fails where #1127 says: the hands under protan and deutan, the highway's GREAT against GOOD", () => {
    const rows = table(candidates.A.palette);
    const hands = rows.find((r) => r.kind === "hand")!;
    expect(hands.d[1]).toBeLessThan(10);
    expect(hands.d[2]).toBeLessThan(1);
    const highway = table({ ...candidates.A.palette, GREAT: today.highwayGreat });
    const greatGood = highway.find((r) => r.a === "GREAT" && r.b === "GOOD")!;
    expect(passes(greatGood)).toBe(false);
    expect(greatGood.d[3]).toBeLessThan(8); // tritan
    // A fixes nothing by color: that's the point of A.
    expect(rows.filter((r) => !passes(r)).map((r) => `${r.a}/${r.b}`)).toEqual(["R/L"]);
  });

  for (const id of ["B", "C"] as const) {
    it(`${id} hits every target: the hands 10 under all four, the rest 10 normal and 8 under a deficiency`, () => {
      const rows = table(candidates[id].palette);
      expect(rows.filter((r) => !passes(r)).map((r) => `${r.a}/${r.b} ${r.d.map((x) => x.toFixed(1))}`)).toEqual([]);
    });
  }

  for (const id of ["A", "B", "C"] as const) {
    it(`${id}: the hands within 3 of each other in L*, and every fill 3:1 or more against the field`, () => {
      const p = candidates[id].palette;
      expect(Math.abs(lightness(p.R) - lightness(p.L))).toBeLessThanOrEqual(3);
      for (const [slot, hex] of Object.entries(p)) expect(contrast(hex, field), slot).toBeGreaterThanOrEqual(3);
    });
  }

  it("juice's second amber passes beside A's too", () => {
    expect(table({ ...candidates.A.palette, AMBER: today.juiceAmber }).filter((r) => r.kind === "amber" && !passes(r))).toEqual([]);
  });
});

describe("the experiment", () => {
  it("applies a candidate to the readers' settings and puts today's back", () => {
    const before = JSON.stringify([handColorSettings.colors, hudSettings.judgmentColors, meterSettings.fill, juiceSettings.feverColor]);
    const saved = { hands: { ...handColorSettings.colors }, judgments: { ...hudSettings.judgmentColors }, meter: meterSettings.fill, juice: juiceSettings.feverColor };
    apply(candidates.B.palette);
    expect(handColorSettings.colors.L).toBe("#e6870a");
    expect(hudSettings.judgmentColors.GREAT).toBe("#5ef2c4");
    expect(meterSettings.fill).toBe("#ff2fd0");
    expect(juiceSettings.feverColor).toBe("255, 47, 208");
    restore(saved);
    expect(JSON.stringify([handColorSettings.colors, hudSettings.judgmentColors, meterSettings.fill, juiceSettings.feverColor])).toBe(before);
  });

  it("reads ?sim= and builds a 20-value feColorMatrix", () => {
    expect([visionOf("deutan"), visionOf(null), visionOf("x")]).toEqual(["deutan", "normal", "normal"]);
    const v = matrixValues("deutan").split(" ").map(Number);
    expect(v).toHaveLength(20);
    expect(v.slice(15)).toEqual([0, 0, 0, 1, 0]);
  });

  it("notches only the left hand's notes on the highway, not hit ones", () => {
    const chart = {
      bpm: 60,
      notes: [
        { id: "l", pitch: 60, beat: 1, duration: 1, hand: "L" },
        { id: "r", pitch: 62, beat: 1, duration: 1, hand: "R" },
        { id: "gone", pitch: 64, beat: 1, duration: 1, hand: "L" },
        { id: "far", pitch: 65, beat: 9, duration: 1, hand: "L" }, // past the lookahead
      ],
    } as unknown as Chart;
    const f = { nowMs: 0, judgmentLineY: 600, keyX: (p: number) => ({ x: (p - 60) * 20, width: 20 }), width: 1000, height: 720 } as unknown as Frame;
    const n = notches(chart, f, new Set(["gone"]));
    expect(n).toHaveLength(1);
    expect(n[0].cx).toBeCloseTo(10);
    expect(n[0].y).toBeCloseTo(600 - 1000 * (600 / 2000) - 1);
  });
});
