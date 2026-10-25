// Pinned's Validation (a): pin angles, the comb, the STL and the voice.
import { describe, expect, it } from "vitest";
import type { TakeEvent } from "../../../contracts";
import { fit, hz, pinTake, toothLengths } from "./cylinder";
import { model, modelSettings, readStl, signedVolume, triangleCount, writeStl, type Shell } from "./stl";
import { cantileverBetas, RATIOS, renderTooth } from "./voice";

// A scripted take: four presses, a repeat, a chord, released at 2000 ms. It starts at 500, so 0° is the first press.
const take: TakeEvent[] = [
  { pitch: 60, velocity: 90, timeMs: 500, offTimeMs: 800 },
  { pitch: 64, velocity: 40, timeMs: 875, offTimeMs: 1100 },
  { pitch: 67, velocity: 127, timeMs: 1250, offTimeMs: 1500 },
  { pitch: 60, velocity: 80, timeMs: 1625, offTimeMs: 2000 },
  { pitch: 72, velocity: 80, timeMs: 1625, offTimeMs: null },
];

describe("the cylinder", () => {
  const p = pinTake(take);
  it("one revolution is the whole take, first press to last release, and the first press is at 0°", () => {
    expect(p.lengthMs).toBe(1500);
    for (const pin of p.pins) expect(Math.abs(pin.angleDeg - (pin.timeMs / 1500) * 360)).toBeLessThan(0.1);
    expect(p.pins[0].angleDeg).toBe(0);
    expect(p.pins.map((x) => Math.round(x.angleDeg))).toEqual([0, 90, 180, 270, 270]);
  });

  it("one tooth per distinct pitch, low to high, and each pin on its pitch's tooth", () => {
    expect(p.teeth).toEqual([60, 64, 67, 72]);
    for (const pin of p.pins) expect(p.teeth[pin.tooth]).toBe(pin.pitch);
  });

  it("tooth lengths go as 1/√f: L₁/L₂ = √(f₂/f₁) within 0.1%, the longest at full length", () => {
    const L = toothLengths(p.teeth, 22);
    expect(Math.max(...L)).toBeCloseTo(22, 9);
    for (let i = 0; i < L.length; i++)
      for (let j = 0; j < L.length; j++) expect(Math.abs(L[i] / L[j] / Math.sqrt(hz(p.teeth[j]) / hz(p.teeth[i])) - 1)).toBeLessThan(0.001);
  });

  it("fit mode refuses to run without a cited tooth list", () => {
    expect(() => fit(p, null)).toThrow(/cited/);
    expect(() => fit(p, { name: "a movement", source: "", teeth: [60, 62, 64] })).toThrow(/cited/);
  });
});

describe("the STL", () => {
  const shells = model(pinTake(take));
  const key = (v: number[]) => v.map((x) => x.toFixed(4)).join(",");

  it("is watertight: in each shell, every edge is shared by exactly 2 triangles, and each faces out", () => {
    for (const shell of shells) {
      const edges = new Map<string, number>();
      for (const t of shell)
        for (let i = 0; i < 3; i++) {
          const [a, b] = [key(t[i]), key(t[(i + 1) % 3])];
          const e = a < b ? `${a}|${b}` : `${b}|${a}`;
          edges.set(e, (edges.get(e) ?? 0) + 1);
        }
      expect([...edges.values()].every((n) => n === 2)).toBe(true);
      expect(signedVolume(shell)).toBeGreaterThan(0);
    }
  });

  it("has the drum, a shell per pin, the base, and a tooth per pitch (with a root under each shorter one)", () => {
    expect(shells.length).toBe(1 + 5 + 1 + 4 + 3);
  });

  it("writes binary that parses back: 80-byte header, the count, 50 bytes a triangle, under the cap", () => {
    const buf = writeStl(shells);
    const back = readStl(buf);
    expect(back.count).toBe(triangleCount(shells));
    expect(buf.byteLength).toBe(84 + 50 * back.count);
    expect(back.count).toBeLessThan(modelSettings.triangleCap);
    expect(back.tris[0][1][0]).toBeCloseTo(shells[0][0][1][0], 4);
    const big: Shell[] = [Array.from({ length: modelSettings.triangleCap + 1 }, () => shells[0][0])];
    expect(() => writeStl(big)).toThrow(/cap/);
  });
});

describe("the voice", () => {
  it("solves cos β · cosh β = −1, and its partials sit at β² ratios within 0.5% of 1 : 6.27 : 17.55", () => {
    const b = cantileverBetas(3);
    for (const x of b) expect(Math.abs(Math.cos(x) * Math.cosh(x) + 1)).toBeLessThan(1e-6);
    const ratios = b.map((x) => (x / b[0]) ** 2);
    expect(RATIOS).toEqual(ratios);
    [1, 6.27, 17.55].forEach((r, i) => expect(Math.abs(ratios[i] / r - 1)).toBeLessThan(0.005));
  });

  it("renders a tooth that starts and ends on 0 and peaks where it's set", () => {
    const x = renderTooth(hz(72), 48000);
    expect(Math.abs(x[0])).toBe(0);
    expect(Math.abs(x[x.length - 1])).toBe(0);
    expect(Math.max(...x.subarray(0, 4800).map(Math.abs))).toBeGreaterThan(0.1);
  });
});
