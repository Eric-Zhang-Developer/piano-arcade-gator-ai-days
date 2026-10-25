// ui-sound-family Validation (a) and (b): every sound rendered and measured, old against new, under the preview.
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../../contracts";
import { keyOf, type UiSound } from "../../ui-sounds";
import { admit, C_MAJOR, degreeHz, LENGTH_S, pileSettings, render, strikes, type Voice } from "../../ui-sounds/timbre";
import { UI_LEVEL } from "../../ui-sounds";
import { measure, renderNew, renderOld, renderPreview, SR, under } from "./measure";

const chart = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));
const SOUNDS: UiSound[] = ["move", "confirm", "back", "sting", "tick", "tickAccent"];
// The preview the sounds sit under: Twinkle's opening, the song the select opens on.
const ref = measure(renderPreview(chart("twinkle")));

export const table = (render: (n: UiSound) => Float32Array) =>
  SOUNDS.map((name) => {
    const m = measure(render(name));
    return { name, ...m, peakUnderDb: under(m.peak, ref.peak), rmsUnderDb: under(m.rms, ref.rms) };
  });

describe("the new family, measured", () => {
  const rows = table((n) => renderNew(n, C_MAJOR));
  for (const r of rows)
    it(`${r.name}: short, 12 dB or more under the preview, low-mid, soft attack, no DC, ends on 0`, () => {
      expect(r.durationMs).toBeLessThanOrEqual(r.name === "sting" ? 600 : 150);
      expect(r.peakUnderDb).toBeGreaterThanOrEqual(12);
      expect(r.rmsUnderDb).toBeGreaterThanOrEqual(12);
      expect(r.centroidHz).toBeGreaterThanOrEqual(500);
      expect(r.centroidHz).toBeLessThanOrEqual(3000);
      expect(r.attackMs).toBeGreaterThanOrEqual(2);
      expect(Math.abs(r.mean)).toBeLessThan(r.peak * 0.01);
      expect(Math.abs(r.last)).toBe(0);
    });

  it("the old sounds, measured the same way, fail on level and attack: the before column", () => {
    const old = table(renderOld);
    expect(old.every((r) => r.peakUnderDb < 12)).toBe(true);
    expect(old.every((r) => r.attackMs < 2)).toBe(true);
  });
});

describe("the song's key", () => {
  const scale = (tonic: number, steps: number[]) => [0, 1].flatMap((o) => steps.map((s) => 60 + tonic + s + 12 * o));
  it("finds C major in a C scale and A minor in an A harmonic-minor scale", () => {
    expect(keyOf(scale(0, [0, 2, 4, 5, 7, 9, 11]))).toEqual({ tonic: 0, mode: "major" });
    expect(keyOf(scale(9, [0, 2, 3, 5, 7, 8, 11]))).toEqual({ tonic: 9, mode: "minor" });
    expect(keyOf([])).toEqual(C_MAJOR);
  });

  it("drives move: each step is the next degree of that key's scale, an octave and round", () => {
    const a = keyOf(scale(9, [0, 2, 3, 5, 7, 8, 11]));
    const hz = [0, 1, 2, 8].map((s) => strikes("move", a, s)[0].hz);
    expect(hz[0]).toBeCloseTo(440, 6); // A4, the tonic in its band
    expect(hz[1]).toBeCloseTo(degreeHz(a, 1), 6); // B
    expect(hz[2]).toBeCloseTo(440 * 2 ** (3 / 12), 6); // C, minor's third
    expect(hz[3]).toBeCloseTo(440, 6); // step 8 is the tonic again
  });
});

describe("pile-up (b)", () => {
  it("40 moves in 2 s never pass the voice cap, never clip, and velocity eases and recovers", () => {
    const one = render(strikes("move", C_MAJOR, 0), LENGTH_S.move, SR, UI_LEVEL);
    const mix = new Float32Array(Math.round(2.5 * SR));
    let live: (Voice & { velocity: number })[] = [];
    let last = { atS: -Infinity, velocity: 1 };
    let most = 0;
    const played: (Voice & { velocity: number })[] = [];
    for (let i = 0; i < 40; i++) {
      const atS = i * 0.05;
      const next = admit(live, last, atS);
      for (const v of next.steal) v.endS = atS + pileSettings.fadeS; // faded out, not cut
      const v = { startS: atS, endS: atS + LENGTH_S.move, velocity: next.velocity };
      played.push(v);
      live = [...next.live, v];
      most = Math.max(most, live.length);
      last = { atS, velocity: next.velocity };
    }
    for (const v of played) {
      const t0 = Math.round(v.startS * SR);
      const cut = Math.round((v.endS - v.startS) * SR);
      const fade = Math.round(pileSettings.fadeS * SR);
      for (let i = 0; i < Math.min(one.length, cut); i++) {
        const f = v.endS - v.startS < LENGTH_S.move ? Math.min(1, (cut - i) / fade) : 1;
        mix[t0 + i] += v.velocity * f * one[i];
      }
    }
    expect(most).toBeLessThanOrEqual(pileSettings.cap);
    expect(mix.reduce((m, x) => Math.max(m, Math.abs(x)), 0)).toBeLessThanOrEqual(ref.peak * 10 ** (-12 / 20));
    expect(played[39].velocity).toBe(pileSettings.floor);
    expect(admit([], { atS: 0, velocity: pileSettings.floor }, pileSettings.recoverS).velocity).toBe(1);
  });
});

// UI_TABLE=1 writes the tables the PR quotes.
it.runIf(process.env.UI_TABLE)("writes the before and after tables", () => {
  const fmt = (rows: ReturnType<typeof table>) =>
    rows.map((r) => `| ${r.name} | ${r.durationMs.toFixed(0)} | ${r.peakUnderDb.toFixed(1)} | ${r.rmsUnderDb.toFixed(1)} | ${r.centroidHz.toFixed(0)} | ${r.attackMs.toFixed(2)} | ${r.mean.toExponential(1)} | ${r.last.toExponential(1)} |`).join("\n");
  const head = "| sound | ms | peak under, dB | RMS under, dB | centroid, Hz | attack, ms | mean | last sample |\n|---|---|---|---|---|---|---|---|";
  const out = new URL("../../../../../specs/features/ui-sound-family/measurements.md", import.meta.url);
  writeFileSync(
    out,
    `# UI sound family: measurements\n\nWritten by \`UI_TABLE=1 pnpm -C web exec vitest run src/game/x/ui-sounds-ab\`. The reference is Twinkle's preview opening as laptop tones: peak ${ref.peak.toFixed(4)}, RMS ${ref.rms.toFixed(4)}. "Under" is how far below it, in dB.\n\n## Before\n\n${head}\n${fmt(table(renderOld))}\n\n## After\n\n${head}\n${fmt(table((n) => renderNew(n, C_MAJOR)))}\n`,
  );
});
