// ui-sound-family Validation (a) and (b): every sound rendered and measured, old against new, under the preview.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../../contracts";
import { keyOf, type UiSound } from "../../ui-sounds";
import { admit, C_MAJOR, degreeHz, LENGTH_S, pileSettings, render, strikes, type Voice } from "../../ui-sounds/timbre";
import { UI_LEVEL } from "../../ui-sounds";
import { measure, renderNew, renderOld, renderPreview, spectrum, SR, under } from "./measure";
import { UI_PEAK } from "../../ui-sounds";

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

// UI_SHOTS=1 draws Validation (c)'s images: per sound, old (grey) beside new (blue), each a waveform over a spectrogram
// (0–8 kHz, −90–0 dB), on one time axis and one level scale per sound, so the drop and the softer edges show.
function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    t.copy(out, 4);
    out.writeUInt32BE(crc32(t), 8 + data.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgb.subarray(y * w * 3, (y + 1) * w * 3)).copy(raw, y * (w * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

it.runIf(process.env.UI_SHOTS)("draws the waveform and spectrogram shots", () => {
  const [W, WAVE, SPEC, GAP] = [320, 80, 160, 16];
  const bg = [3, 6, 7];
  const dir = new URL("../../../../../specs/features/ui-sound-family/shots/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const name of SOUNDS) {
    const sides = [{ x: renderOld(name), color: [125, 132, 150] }, { x: renderNew(name, C_MAJOR), color: [43, 155, 255] }];
    const span = Math.max(...sides.map((s) => s.x.length));
    const width = 2 * W + GAP;
    const height = WAVE + 4 + SPEC;
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0; i < width * height; i++) rgb.set(bg, i * 3);
    const put = (x: number, y: number, c: number[], a: number) => {
      const i = (y * width + x) * 3;
      for (let k = 0; k < 3; k++) rgb[i + k] = Math.round(rgb[i + k] * (1 - a) + c[k] * a);
    };
    sides.forEach(({ x, color }, side) => {
      const x0 = side * (W + GAP);
      for (let col = 0; col < W; col++) {
        // Waveform: min and max per column against the old sounds' peak.
        const [a, b] = [Math.floor((col * span) / W), Math.floor(((col + 1) * span) / W)];
        let [lo, hi] = [0, 0];
        for (let i = a; i < Math.min(b, x.length); i++) [lo, hi] = [Math.min(lo, x[i]), Math.max(hi, x[i])];
        const y = (v: number) => Math.round(WAVE / 2 - (v / UI_PEAK) * (WAVE / 2 - 2));
        for (let py = y(hi); py <= y(lo); py++) put(x0 + col, py, color, 1);
        put(x0 + col, WAVE / 2, color, 0.25);
        // Spectrogram: a 1024-sample frame centred on the column, 0–8 kHz up the image.
        const from = Math.round(((col + 0.5) * span) / W) - 512;
        const frame = Float32Array.from({ length: 1024 }, (_, i) => (x[from + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 1023))); // Hann
        const mag = spectrum(frame);
        for (let row = 0; row < SPEC; row++) {
          const bin = Math.round(((SPEC - 1 - row) / SPEC) * ((8000 / SR) * 1024));
          const db = 20 * Math.log10(mag[bin] / (UI_PEAK * 256) + 1e-12);
          put(x0 + col, WAVE + 4 + row, color, Math.min(1, Math.max(0, (db + 90) / 90)));
        }
      }
    });
    writeFileSync(new URL(`${name}.png`, dir), png(width, height, rgb));
  }
});
