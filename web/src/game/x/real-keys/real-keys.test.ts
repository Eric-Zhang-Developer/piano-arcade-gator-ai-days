import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isBlack } from "../../core/highway";
import { apply, homography, invert, type H, type Pt } from "./homography";
import { bedQuads, BED_CORNERS, keySettings, mapQuad, meanLuma, samplePoints } from "./keys";
import { pressDelays, summarize, type Sample } from "./latency";
import { containFit, laneDepth, noteSpan, overlaySettings, parseLog } from "./overlay";
import { metadata } from "../../../app/real-keys/layout";
import { APP_NAME } from "../../app-name";
import { RealKeys } from "./RealKeys";

// A seeded generator, so the "random" points are the same every run.
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

// A camera above and in front of the keys: a real perspective map from the 1×1 bed to a 1920×1080 picture.
const TRUE: H = [1500, 120, 210, 40, 260, 640, 0.02, 0.35, 1];

describe("homography", () => {
  it("recovers a known transform from 4 points: they map back within 1e-6, 20 random points within 1e-3 px", () => {
    const dst = BED_CORNERS.map((p) => apply(TRUE, p));
    const m = homography(BED_CORNERS, dst);
    BED_CORNERS.forEach((p, i) => {
      const [x, y] = apply(m, p);
      expect(Math.hypot(x - dst[i][0], y - dst[i][1])).toBeLessThan(1e-6);
    });
    const r = rng(7);
    for (let k = 0; k < 20; k++) {
      const p: Pt = [r(), r()];
      const [x, y] = apply(m, p), [u, v] = apply(TRUE, p);
      expect(Math.hypot(x - u, y - v)).toBeLessThan(1e-3);
    }
  });

  it("from clicked picture corners back to the bed (the page's direction) too, and inverts", () => {
    const picture: Pt[] = [[412, 300], [1530, 288], [1700, 760], [230, 790]];
    const toPicture = homography(BED_CORNERS, picture);
    const toBed = invert(toPicture);
    picture.forEach((p, i) => {
      const [u, v] = apply(toBed, p);
      expect(Math.hypot(u - BED_CORNERS[i][0], v - BED_CORNERS[i][1])).toBeLessThan(1e-9);
    });
  });

  it("refuses three collinear points", () => {
    expect(() => homography([[0, 0], [1, 1], [2, 2], [3, 3]], [[0, 0], [1, 0], [1, 1], [0, 1]])).toThrow();
  });
});

describe("key quads", () => {
  const whitesTile = (lo: number, hi: number) => {
    const q = bedQuads(lo, hi);
    const whites = [...q].filter(([p]) => !isBlack(p)).sort(([a], [b]) => a - b).map(([, k]) => k);
    expect(whites[0][0][0]).toBe(0);
    expect(whites.at(-1)![1][0]).toBeCloseTo(1, 12);
    for (let i = 1; i < whites.length; i++) expect(whites[i][0][0]).toBeCloseTo(whites[i - 1][1][0], 12); // no gap, no overlap
    for (const k of whites) expect([k[0][1], k[2][1]]).toEqual([0, 1]); // the bed's whole depth
    return q;
  };

  it("88 keys, 21–108: 52 whites tile the bed, 36 blacks", () => {
    const q = whitesTile(21, 108);
    expect(q.size).toBe(88);
    expect([...q.keys()].filter(isBlack)).toHaveLength(36);
  });

  it("61 keys, 36–96: 36 whites tile the bed", () => {
    expect(whitesTile(36, 96).size).toBe(61);
  });

  it("black keys sit where core's highway puts them: centered on the boundary, 0.6 of a white key wide", () => {
    const q = bedQuads(60, 72); // C4–C5: 8 whites
    const w = 1 / 8;
    const cs = q.get(61)!; // C♯ straddles C|D, the boundary at 1 white
    expect((cs[0][0] + cs[1][0]) / 2).toBeCloseTo(w, 12);
    expect(cs[1][0] - cs[0][0]).toBeCloseTo(0.6 * w, 12);
    expect(cs[2][1]).toBe(keySettings.blackKeyLength);
    const fs = q.get(66)!; // F♯ straddles F|G, the boundary at 4 whites
    expect((fs[0][0] + fs[1][0]) / 2).toBeCloseTo(4 * w, 12);
  });

  it("keySettings.blackKeyWidth is core's BLACK_KEY_WIDTH", () => {
    const src = readFileSync(new URL("../../core/highway.ts", import.meta.url), "utf8");
    expect(Number(src.match(/const BLACK_KEY_WIDTH = ([\d.]+)/)![1])).toBe(keySettings.blackKeyWidth);
  });

  it("a key's picture quad is its bed quad through the map, and its samples land inside the picture", () => {
    const q = bedQuads(21, 108).get(60)!;
    const pq = mapQuad(TRUE, q);
    expect(pq[0]).toEqual(apply(TRUE, q[0]));
    const at = samplePoints(TRUE, q, 1920, 1080);
    expect(at.length).toBe(25);
    expect(Math.min(...at)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...at)).toBeLessThan(1920 * 1080);
  });

  it("meanLuma reads the sampled pixels' brightness", () => {
    const rgba = new Uint8ClampedArray(4 * 4).fill(0);
    rgba.set([255, 255, 255, 255], 4); // pixel 1 white
    expect(meanLuma(rgba, Int32Array.from([1]))).toBeCloseTo(255, 6);
    expect(meanLuma(rgba, Int32Array.from([0, 1]))).toBeCloseTo(127.5, 6);
  });
});

describe("latency", () => {
  // 60 fps frames of one key: level 180, dropping to 120 (the key goes down into shadow) `lag` ms after each press.
  const series = (presses: number[], lags: number[], fps = 60, durMs = 12000): Sample[] => {
    const out: Sample[] = [];
    for (let t = 0; t < durMs; t += 1000 / fps) {
      const down = presses.some((p, i) => t >= p + lags[i] && t < p + lags[i] + 200);
      out.push({ t, b: down ? 120 : 180 });
    }
    return out;
  };
  const presses = [1000, 2300, 3700, 5000, 6400, 7800, 9100, 10500];

  it("finds planted brightness steps: the median and the spread", () => {
    const lags = [100, 110, 95, 105, 120, 100, 98, 102];
    const d = pressDelays(series(presses, lags), presses);
    expect(d.every((x) => x !== null)).toBe(true);
    // Each delay is the lag rounded up to the next 60 fps frame time.
    d.forEach((x, i) => {
      expect(x!).toBeGreaterThanOrEqual(lags[i]);
      expect(x! - lags[i]).toBeLessThan(1000 / 60);
    });
    const s = summarize(d, 1000 / 60)!;
    expect(s.found).toBe(8);
    expect(s.medianMs).toBeGreaterThanOrEqual(100);
    expect(s.medianMs).toBeLessThan(100 + 1000 / 60 + 3);
    expect(s.spreadFrames).toBeLessThanOrEqual(2 + 1e-9); // 25 ms of planted spread, quantized to whole frames
  });

  it("a press with no change in time gives null, and noise under the threshold isn't a step", () => {
    const frames = series(presses.slice(0, 1), [100]).map((f, i) => ({ t: f.t, b: f.t > 1500 ? 180 + (i % 2) * 5 : f.b }));
    expect(pressDelays(frames, [1000, 5000])).toEqual([expect.any(Number), null]);
    expect(summarize([null, null], 16)).toBeNull();
  });
});

describe("overlay geometry", () => {
  it("lanes stop short of the horizon, where the map's denominator would reach 0", () => {
    const d = laneDepth(TRUE);
    for (const u of [0, 0.5, 1]) expect(TRUE[6] * u + TRUE[7] * -d + TRUE[8]).toBeGreaterThan(0);
    expect(laneDepth([1, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(overlaySettings.maxDepth); // no perspective: the full length
  });

  it("a note enters leadMs early at the far end, lands on the back edge at its time, and leaves after its tail", () => {
    const { leadMs } = overlaySettings;
    expect(noteSpan(0, leadMs + 1, 100, 2)).toBeNull();
    const entering = noteSpan(0, leadMs - 100, 500, 2)!;
    expect(entering[0]).toBe(-2); // the tail is still past the far end: clipped there
    expect(noteSpan(1000, 1000, 400, 2)![1]).toBe(0);
    const held = noteSpan(1200, 1000, 400, 2)!; // 200 ms into a 400 ms note: its tail is still coming in
    expect(held[1]).toBe(0);
    expect(held[0]).toBeCloseTo((-200 / leadMs) * 2, 9);
    expect(noteSpan(1500, 1000, 400, 2)).toBeNull();
  });

  it("containFit centers the picture at its scale", () => {
    const g = containFit(1920, 1080, 1280, 720);
    expect([g.scale, g.dx, g.dy].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0.666666667, 0, 0]);
    const f = containFit(1920, 1080, 1000, 1000);
    expect(f.dx).toBeCloseTo(0, 9);
    expect(f.dy).toBeCloseTo((1000 - 1080 * f.scale) / 2, 9);
  });

  it("parseLog reads the recorder's notes, in time order, and skips anything malformed", () => {
    expect(parseLog({ notes: [{ t: 20, type: "off", pitch: 60 }, { t: 10, type: "on", pitch: 60, velocity: 90 }, { t: "x" }] })).toEqual([
      { t: 10, type: "on", pitch: 60, velocity: 90 },
      { t: 20, type: "off", pitch: 60, velocity: 64 },
    ]);
    expect(parseLog(null)).toEqual([]);
  });
});

describe("the page's basics (lab-pages-a11y, #1128)", () => {
  const page = () => renderToStaticMarkup(createElement(RealKeys));

  it("the tab reads Real Keys · the app's name", () => {
    expect(metadata.title).toBe(`Real Keys · ${APP_NAME}`);
  });

  it("one h1, and a Lab link on the rail that capture mode leaves out", () => {
    const html = page();
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="/lab"');
    const doc = globalThis.document;
    globalThis.document = { documentElement: { hasAttribute: (a: string) => a === "data-capture" } } as unknown as Document;
    try {
      expect(page()).not.toContain('href="/lab"');
    } finally {
      globalThis.document = doc;
    }
  });

  it("no canvas font reads a CSS variable, and nothing is set under the kit's 12 px floor", () => {
    const tsx = readFileSync(new URL("./RealKeys.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./real-keys.module.css", import.meta.url), "utf8");
    expect(tsx.match(/ctx\.font\s*=\s*[`"'][^`"']*var\(/g)).toBeNull();
    const sizes = [...`${tsx}\n${css}`.matchAll(/(\d+(?:\.\d+)?)px/g)].filter((m) => /font/.test(lineOf(`${tsx}\n${css}`, m.index!)));
    for (const m of sizes) expect(Number(m[1]), lineOf(`${tsx}\n${css}`, m.index!)).toBeGreaterThanOrEqual(12);
    // An em size in the rail (13 px at its smallest) has a 12 px floor: max(12px, …).
    for (const m of css.matchAll(/font(?:-size)?:[^;]*?\b0\.[0-8]\d*em/g)) expect(m[0]).toContain("max(12px");
  });
});

const lineOf = (s: string, i: number) => s.slice(s.lastIndexOf("\n", i) + 1, s.indexOf("\n", i));
