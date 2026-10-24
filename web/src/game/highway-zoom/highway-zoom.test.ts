import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { makeLayout } from "../core/highway";
import { noteTimeMs } from "../core/judge";
import { GOOD_MS, settings } from "../core/settings";
import { createZoom, fullRange, isBlack, whiteIndex, zoomOn, zoomSettings, type Range } from ".";

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));

// Eight beats of C2, then eight of C6, at 120 BPM.
const jump: Chart = {
  id: "jump",
  title: "jump",
  composer: "test",
  source: "test",
  bpm: 120,
  beatsPerBar: 4,
  notes: Array.from({ length: 16 }, (_, i) => ({ id: `n${i}`, pitch: i < 8 ? 36 : 84, beat: i, duration: 1, hand: "R" as const })),
};

// Every frame at 60 fps from the count-in to past the end.
function frames(chart: Chart) {
  const zoom = createZoom(chart);
  const out: { now: number; r: Range }[] = [];
  for (let now = -4000; now < 10000; now += 1000 / 60) out.push({ now, r: zoom(now) });
  return out;
}
const keySpan = (p: number) => (isBlack(p) ? [whiteIndex(p), whiteIndex(p) + 2] : [whiteIndex(p), whiteIndex(p) + 1]);

describe("highway zoom across a jump from C2 to C6", () => {
  const fs = frames(jump);

  it("every frame holds every note between now - GOOD_MS and now + lookahead", () => {
    for (const { now, r } of fs) {
      for (const n of jump.notes) {
        const t = noteTimeMs(jump, n);
        if (t < now - GOOD_MS || t > now + settings.lookaheadMs) continue;
        const [lo, hi] = keySpan(n.pitch);
        expect(r.lo).toBeLessThanOrEqual(lo);
        expect(r.hi).toBeGreaterThanOrEqual(hi);
      }
    }
  });

  it("is never narrower than 15 white keys", () => {
    expect(Math.min(...fs.map(({ r }) => r.hi - r.lo))).toBeGreaterThanOrEqual(zoomSettings.minWidth - 1e-9);
  });

  it("moves across the jump over many frames, never in one", () => {
    const moves = fs.slice(1).map(({ r }, i) => Math.max(Math.abs(r.lo - fs[i].r.lo), Math.abs(r.hi - fs[i].r.hi)));
    const total = Math.abs(fs.at(-1)!.r.lo - fs[0].r.lo);
    expect(total).toBeGreaterThan(10); // it really pans: C2 to C6 is 28 white keys
    expect(Math.max(...moves)).toBeLessThan(total / 10);
    expect(moves.filter((m) => m > 0.01).length).toBeGreaterThan(20);
  });

  it("zooms in: while one pitch plays, the range is far narrower than the whole chart", () => {
    const full = fullRange(jump);
    const early = fs.find(({ now }) => now > 500)!.r;
    expect(early.hi - early.lo).toBeLessThan((full.hi - full.lo) / 1.5);
  });
});

describe("when it's on", () => {
  it("a narrow chart: off, and its full range is exactly makeLayout's", () => {
    const twinkle = song("twinkle");
    expect(zoomOn(twinkle, new URLSearchParams())).toBe(false);
    const L = makeLayout(twinkle, 1280, 720, 0);
    expect(fullRange(twinkle)).toEqual({ lo: whiteIndex(L.lowPitch), hi: whiteIndex(L.highPitch) + 1 });
  });

  it("is off by default even on a wide chart (#384); only ?zoom=on turns it on", () => {
    const furElise = song("fur-elise");
    expect(zoomOn(furElise, new URLSearchParams())).toBe(false);
    expect(zoomOn(furElise, new URLSearchParams("zoom=off"))).toBe(false);
    expect(zoomOn(furElise, new URLSearchParams("zoom=on"))).toBe(true);
    expect(zoomOn(song("twinkle"), new URLSearchParams("zoom=on"))).toBe(true);
  });

  it("matches makeLayout's static range for charts that start or end on a black key", () => {
    for (const pitches of [[61, 70], [60, 72], [59, 66]]) {
      const c: Chart = { ...jump, notes: pitches.map((pitch, i) => ({ ...jump.notes[0], id: `p${i}`, pitch })) };
      const L = makeLayout(c, 1280, 720, 0);
      expect(fullRange(c)).toEqual({ lo: whiteIndex(L.lowPitch), hi: whiteIndex(L.highPitch) + 1 });
    }
  });
});
