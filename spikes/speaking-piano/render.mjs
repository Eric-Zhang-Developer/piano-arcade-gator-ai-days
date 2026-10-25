// The speaking-piano spike's offline renders (#1153): for each preset phrase, macOS `say` → WAV (local only, never
// committed), the analysis swept over frame rate × keys a frame, each run resynthesized on a simple additive piano and
// scored with STOI against the TTS audio. Writes the sweep table, then at the pick: the page's preset tables
// (web/src/game/x/speaking-piano/presets/) and MIDI files (spikes/speaking-piano/presets/).
// Usage, from the repo root: node --no-warnings spikes/speaking-piano/render.mjs [--pick <fps>x<n>]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analysisDefaults, analyze, keyHz } from "../../web/src/game/x/speaking-piano/analysis.ts";
import { stoi } from "./stoi.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const local = join(here, "local");
const midiOut = join(here, "presets");
const tableOut = join(here, "../../web/src/game/x/speaking-piano/presets");
const SR = 22050;

export const PHRASES = [
  { id: "hello-judges", text: "Hello, judges" },
  { id: "welcome", text: "Welcome to Étude" },
  { id: "thank-you", text: "Thank you" },
];
const SWEEP = { fps: [8, 12, 16], n: [6, 10, 14] };

function readWav(path) {
  const b = readFileSync(path);
  let at = 12;
  let fmt;
  while (at < b.length) {
    const id = b.toString("ascii", at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === "fmt ") fmt = { channels: b.readUInt16LE(at + 10), rate: b.readUInt32LE(at + 12), bits: b.readUInt16LE(at + 22) };
    if (id === "data") {
      if (!fmt || fmt.bits !== 16 || fmt.channels !== 1) throw new Error(`${path}: want 16-bit mono`);
      const out = new Float32Array(size / 2);
      for (let i = 0; i < out.length; i++) out[i] = b.readInt16LE(at + 8 + 2 * i) / 32768;
      return { samples: out, rate: fmt.rate };
    }
    at += 8 + size + (size % 2);
  }
  throw new Error(`${path}: no data chunk`);
}

function writeWav(path, samples, rate) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + 2 * i));
  writeFileSync(path, b);
}

// The TTS audio, rendered once into local/ (self-ignored): macOS `say`'s default voice, then 16-bit mono at 22.05 kHz.
function speech(p) {
  mkdirSync(local, { recursive: true });
  const aiff = join(local, `${p.id}.aiff`);
  const wav = join(local, `${p.id}.wav`);
  if (!existsSync(wav)) {
    execFileSync("/usr/bin/say", ["-o", aiff, p.text]);
    execFileSync("/usr/bin/afconvert", ["-f", "WAVE", "-d", `LEI16@${SR}`, "-c", "1", aiff, wav]);
  }
  return readWav(wav);
}

// A simple additive piano (sampled-piano, #806, isn't on main): six partials falling 1/h^1.5, slightly stretched,
// struck at (vel/127)² and decaying faster up the keyboard; the damper ends each strike at the frame's end with a
// 20 ms release, and the next frame strikes again.
export function resynth(analysis, length, rate) {
  const out = new Float64Array(length);
  const frameS = analysis.frameMs / 1000;
  for (const f of analysis.frames) {
    const start = Math.round((f.tMs / 1000) * rate);
    const end = Math.min(length, Math.round((f.tMs / 1000 + frameS + 0.02) * rate));
    for (const s of f.strikes) {
      const hz = keyHz(s.key);
      const amp = (s.vel / 127) ** 2;
      const tau = Math.min(1.5, 0.6 * (440 / hz) ** 0.4);
      for (let i = start; i < end; i++) {
        const t = (i - start) / rate;
        const env = Math.min(1, t / 0.004) * Math.exp(-t / tau) * (t > frameS ? Math.max(0, 1 - (t - frameS) / 0.02) : 1);
        let v = 0;
        for (let h = 1; h <= 6 && hz * h < rate / 2; h++) v += Math.sin(2 * Math.PI * hz * h * (1 + 0.0004 * h * h) * t) / h ** 1.5;
        out[i] += amp * env * v;
      }
    }
  }
  const peak = Math.max(...out.map(Math.abs)) || 1;
  return out.map((v) => (0.8 * v) / peak);
}

// SMF type 0, 480 ticks a quarter at 120 BPM (a tick is 500/480 ms), on channel 1: each strike from its frame's start
// to just before the next, then All Notes Off and pedal up.
export function midiFile(analysis) {
  const tick = (ms) => Math.round((ms * 480) / 500);
  const ev = [];
  for (const f of analysis.frames)
    for (const s of f.strikes) {
      ev.push({ t: tick(f.tMs), on: 1, bytes: [0x90, s.key, s.vel] });
      ev.push({ t: tick(f.tMs + analysis.frameMs) - 1, on: 0, bytes: [0x80, s.key, 0] });
    }
  ev.sort((a, b) => a.t - b.t || a.on - b.on);
  const endT = (ev.at(-1)?.t ?? 0) + 1;
  ev.push({ t: endT, bytes: [0xb0, 123, 0] }, { t: endT, bytes: [0xb0, 64, 0] });
  const vlq = (n) => {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
  };
  const body = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]; // tempo 500000 µs a quarter
  let last = 0;
  for (const e of ev) {
    body.push(...vlq(e.t - last), ...e.bytes);
    last = e.t;
  }
  body.push(0x00, 0xff, 0x2f, 0x00);
  const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0];
  const len = body.length;
  return Buffer.from([...head, 0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...body]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pickArg = process.argv.indexOf("--pick");
  const voices = PHRASES.map((p) => ({ ...p, ...speech(p) }));
  const rows = [];
  for (const fps of SWEEP.fps)
    for (const n of SWEEP.n) {
      const scores = voices.map((v) => {
        const a = analyze(v.samples, v.rate, { ...analysisDefaults, fps, n });
        return stoi(v.samples, resynth(a, v.samples.length, v.rate), v.rate);
      });
      rows.push({ fps, n, scores, mean: scores.reduce((s, x) => s + x, 0) / scores.length });
    }
  const best = rows.reduce((a, b) => (b.mean > a.mean ? b : a));
  const [pf, pn] = pickArg > 0 ? process.argv[pickArg + 1].split("x").map(Number) : [best.fps, best.n];
  writeFileSync(join(local, "sweep.json"), JSON.stringify({ rows, best: { fps: best.fps, n: best.n } }, null, 1));
  mkdirSync(midiOut, { recursive: true });
  mkdirSync(tableOut, { recursive: true });
  for (const v of voices) {
    const a = analyze(v.samples, v.rate, { ...analysisDefaults, fps: pf, n: pn });
    writeFileSync(join(midiOut, `${v.id}.mid`), midiFile(a));
    writeWav(join(local, `${v.id}-piano-${pf}x${pn}.wav`), resynth(a, v.samples.length, v.rate), v.rate);
    // The page's table: the strikes and the spectrogram, rounded. Derived numbers only; the audio stays in local/.
    const table = {
      id: v.id,
      text: v.text,
      fps: pf,
      n: pn,
      frameMs: a.frameMs,
      frames: a.frames.map((f) => ({ tMs: Math.round(f.tMs), fricative: f.fricative, strikes: f.strikes.map((s) => [s.key, s.vel]) })),
      bandsDb: a.bandsDb.map((row) => row.map((d) => Math.round(d))),
    };
    writeFileSync(join(tableOut, `${v.id}.json`), JSON.stringify(table) + "\n");
  }
  const fmt = (x) => x.toFixed(3);
  process.stdout.write(`fps × n | ${voices.map((v) => v.id).join(" | ")} | mean\n`);
  for (const r of rows) process.stdout.write(`${r.fps} × ${r.n} | ${r.scores.map(fmt).join(" | ")} | ${fmt(r.mean)}\n`);
  process.stdout.write(`best ${best.fps} × ${best.n}; tables and MIDI written at ${pf} × ${pn}\n`);
}
