#!/usr/bin/env node
// Hum a level (spec: hum-level-spike): a 16-bit PCM WAV hummed to a click becomes a one-hand chart.
//
//   node spikes/hum-level/hum.mjs <wav> --bpm <n> --beats-per-bar <n> --id <id> [--save]
//   node spikes/hum-level/hum.mjs --self-test
//
// The WAV starts on the count-in's first click; beat 0 is one bar later. The chart goes to local/<wav name>.chart.json
// (gitignored); --save also writes web/public/songs/local/hum-<id>/chart.json for /play?song=local/hum-<id>.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const LOCAL = join(HERE, "local");
export const SONGS_LOCAL = join(HERE, "..", "..", "web", "public", "songs", "local");

const RATE = 16000; // the tracker's rate: plenty for a voice's fundamental, and YIN's cost falls with it
const HOP = 0.01; // s between frames
const WINDOW = 0.03; // s of YIN's integration window
const F_MIN = 70;
const F_MAX = 1000;
const YIN_THRESHOLD = 0.2; // below this the frame is periodic: voiced
const GATE_DB = -40; // frames this far under the loudest are silence
const MEDIAN = 5; // frames in the median filter
const MIN_NOTE = 0.08; // s: a shorter run of one pitch is a glide or a wobble, not a note
const DIP = 0.5; // a frame under half the level on both sides is a re-articulation: "da da" on one pitch is two notes
const DIP_REACH = 8; // frames looked at on each side of a dip

export class Refused extends Error {}

// ---------- WAV ----------

export function readWav(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Refused("not a WAV file");
  let fmt = null;
  for (let at = 12; at + 8 <= buf.length; ) {
    const tag = buf.toString("ascii", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    const body = at + 8;
    if (tag === "fmt ") {
      fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (tag === "data") {
      if (!fmt || (fmt.format !== 1 && fmt.format !== 0xfffe) || fmt.bits !== 16) throw new Refused("only 16-bit PCM WAV");
      const frames = Math.floor(Math.min(size, buf.length - body) / (2 * fmt.channels));
      const samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < fmt.channels; c++) sum += buf.readInt16LE(body + 2 * (i * fmt.channels + c));
        samples[i] = sum / fmt.channels / 32768;
      }
      return { rate: fmt.rate, samples };
    }
    at = body + size + (size % 2);
  }
  throw new Refused("WAV has no data chunk");
}

export function writeWav(samples, rate) {
  const buf = Buffer.alloc(44 + 2 * samples.length);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + 2 * samples.length, 4);
  buf.write("WAVEfmt ", 8, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(2 * samples.length, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + 2 * i);
  return buf;
}

// ---------- pitch ----------

// Box-filter decimation to about RATE. Crude, but a hum's fundamental sits far below the new Nyquist.
function downsample(samples, rate) {
  const k = Math.max(1, Math.floor(rate / RATE));
  const out = new Float32Array(Math.floor(samples.length / k));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let j = 0; j < k; j++) s += samples[i * k + j];
    out[i] = s / k;
  }
  return { x: out, sr: rate / k };
}

// One f0 per hop, as a fractional MIDI number, or null where the frame is silent or aperiodic. YIN (de Cheveigné &
// Kawahara 2002): difference function, cumulative-mean normalization, absolute threshold, parabolic interpolation.
export function track(samples, rate) {
  const { x, sr } = downsample(samples, rate);
  const hop = Math.round(sr * HOP);
  const W = Math.round(sr * WINDOW);
  const tauMin = Math.floor(sr / F_MAX);
  const tauMax = Math.ceil(sr / F_MIN);
  const frames = Math.max(0, Math.floor((x.length - W - tauMax) / hop));
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let j = 0; j < W; j++) e += x[f * hop + j] ** 2;
    rms[f] = Math.sqrt(e / W);
  }
  const gate = Math.max(...rms, 0) * 10 ** (GATE_DB / 20);
  const d = new Float64Array(tauMax + 2);
  const out = [];
  for (let f = 0; f < frames; f++) {
    if (!(rms[f] > gate) || rms[f] === 0) {
      out.push(null);
      continue;
    }
    const s = f * hop;
    let cum = 0;
    let pick = -1;
    for (let tau = 1; tau <= tauMax + 1; tau++) {
      let sum = 0;
      for (let j = 0; j < W; j++) {
        const v = x[s + j] - x[s + j + tau];
        sum += v * v;
      }
      cum += sum;
      d[tau] = cum ? (sum * tau) / cum : 1;
    }
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (d[tau] < YIN_THRESHOLD) {
        while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++;
        pick = tau;
        break;
      }
    }
    if (pick < 0) {
      out.push(null);
      continue;
    }
    const a = d[pick - 1];
    const b = d[pick];
    const c = d[pick + 1];
    const den = a - 2 * b + c;
    const tau = den ? pick + (a - c) / (2 * den) : pick;
    out.push(69 + 12 * Math.log2(sr / tau / 440));
  }
  return { f0: out, rms, hop: hop / sr, offset: W / 2 / sr };
}

// A median over each voiced run, so one wild frame can't start a note.
function medianFilter(f0) {
  const out = f0.slice();
  const h = Math.floor(MEDIAN / 2);
  for (let i = 0; i < f0.length; i++) {
    if (f0[i] === null) continue;
    const win = [];
    for (let j = i - h; j <= i + h; j++) if (j >= 0 && j < f0.length && f0[j] !== null) win.push(f0[j]);
    win.sort((p, q) => p - q);
    out[i] = win[Math.floor(win.length / 2)];
  }
  return out;
}

// The hummer's tuning, in semitones (-0.5 to 0.5): the circular mean of every voiced frame's distance from its nearest
// semitone. Removing it puts a uniformly flat or sharp hummer back on the grid.
export function tuning(f0) {
  let sx = 0;
  let sy = 0;
  for (const m of f0) {
    if (m === null) continue;
    sx += Math.cos(2 * Math.PI * m);
    sy += Math.sin(2 * Math.PI * m);
  }
  return sx || sy ? Math.atan2(sy, sx) / (2 * Math.PI) : 0;
}

// Runs of one semitone, in seconds. A run shorter than MIN_NOTE is dropped; two runs of one pitch with only dropped
// frames (no silence) between them are one note that wobbled.
export function notesOf(samples, rate) {
  const { f0: raw, rms, hop, offset } = track(samples, rate);
  const f0 = medianFilter(raw);
  const shift = tuning(f0);
  const peak = (from, to) => Math.max(...rms.slice(Math.max(0, from), Math.max(0, to)), 0);
  // A gap shorter than YIN's window can leave every frame voiced; the energy dip still shows it, so it counts as silence.
  const dip = (i) => rms[i] < DIP * peak(i - DIP_REACH, i) && rms[i] < DIP * peak(i + 1, i + 1 + DIP_REACH) && rms[i] <= peak(i - 2, i + 3);
  const semis = f0.map((m, i) => (m === null || dip(i) ? null : Math.round(m - shift)));
  const runs = [];
  for (let i = 0; i < semis.length; ) {
    let j = i;
    while (j < semis.length && semis[j] === semis[i]) j++;
    runs.push({ pitch: semis[i], from: i, to: j });
    i = j;
  }
  const notes = [];
  let silentSince = true; // a silent frame since the last kept note
  for (const r of runs) {
    if (r.pitch === null) {
      silentSince = true;
      continue;
    }
    if ((r.to - r.from) * hop < MIN_NOTE) continue;
    const last = notes.at(-1);
    if (last && !silentSince && last.pitch === r.pitch) last.to = r.to;
    else notes.push({ ...r });
    silentSince = false;
  }
  return {
    tuningCents: Math.round(shift * 100),
    notes: notes.map((n) => ({ pitch: n.pitch, start: n.from * hop + offset, end: n.to * hop + offset })),
  };
}

// ---------- chart ----------

export function chartOf(notes, { bpm, beatsPerBar, id }) {
  const countIn = (beatsPerBar * 60) / bpm;
  const eighth = (t) => Math.round((((t - countIn) * bpm) / 60) * 2) / 2;
  const byBeat = new Map();
  for (const n of notes) {
    const beat = eighth(n.start);
    if (beat < 0) continue;
    const q = { pitch: n.pitch, beat, end: Math.max(beat + 0.5, eighth(n.end)), held: n.end - n.start };
    const other = byBeat.get(beat);
    if (!other || q.held > other.held) byBeat.set(beat, q); // two runs on one 8th: the longer is the note
  }
  const picked = [...byBeat.values()].sort((a, b) => a.beat - b.beat);
  if (picked.length) {
    // The hummer's octave is a voice's, not the tune's: put the (low) median in MIDI 60-71.
    const sorted = picked.map((n) => n.pitch).sort((a, b) => a - b);
    const octave = 12 * Math.round((65.5 - sorted[Math.floor((sorted.length - 1) / 2)]) / 12);
    for (const n of picked) n.pitch = Math.min(108, Math.max(21, n.pitch + octave));
  }
  return {
    id: `hum-${id}`,
    title: "Hummed",
    composer: "Hummed",
    source: "Hummed to a click (hum-level-spike)",
    bpm,
    beatsPerBar,
    notes: picked.map((n, i) => ({
      id: `n${i + 1}`,
      pitch: n.pitch,
      beat: n.beat,
      duration: Math.min(n.end, picked[i + 1]?.beat ?? Infinity) - n.beat, // a melody: each note ends by the next
      hand: "R",
    })),
  };
}

export function hum(wavBuffer, opts) {
  const { rate, samples } = readWav(wavBuffer);
  const { notes, tuningCents } = notesOf(samples, rate);
  return { chart: chartOf(notes, opts), tuningCents };
}

// As forge save: never over an existing level.
export function save(chart, root = SONGS_LOCAL) {
  const dest = join(root, chart.id);
  if (existsSync(dest)) throw new Refused(`songs/local/${chart.id} already exists`);
  mkdirSync(dest, { recursive: true });
  writeFileSync(join(dest, "chart.json"), JSON.stringify(chart, null, 2) + "\n");
  return `/play?song=local/${chart.id}`;
}

// ---------- self-test ----------

// validateChart's shape rules (web/src/contracts/index.ts), copied: a spike imports nothing from web/.
export function shapeProblems(c) {
  const p = [];
  for (const k of ["id", "title", "composer", "source"]) if (typeof c[k] !== "string" || !c[k]) p.push(`${k} missing`);
  if (!(c.bpm > 0)) p.push("bpm must be > 0");
  if (!(c.beatsPerBar > 0)) p.push("beatsPerBar must be > 0");
  if (!Array.isArray(c.notes) || !c.notes.length) return [...p, "notes missing"];
  const ids = new Set();
  c.notes.forEach((n, i) => {
    if (typeof n.id !== "string" || ids.has(n.id)) p.push(`note ${i}: id missing or duplicate`);
    ids.add(n.id);
    if (!Number.isInteger(n.pitch) || n.pitch < 21 || n.pitch > 108) p.push(`note ${i}: pitch out of 21–108`);
    if (!(n.beat >= 0)) p.push(`note ${i}: beat must be >= 0`);
    if (!(n.duration > 0)) p.push(`note ${i}: duration must be > 0`);
    if (n.hand !== "R" && n.hand !== "L") p.push(`note ${i}: hand must be R or L`);
  });
  return p;
}

function tone(steps, { rate = 44100, bpm = 100, beatsPerBar = 4, cents = 0 } = {}) {
  const beat = 60 / bpm;
  const lead = beatsPerBar * beat;
  const out = new Float32Array(Math.ceil((lead + steps.length * beat + 0.2) * rate));
  let phase = 0;
  for (let i = Math.round(lead * rate); i < out.length; i++) {
    const k = Math.floor((i / rate - lead) / beat);
    if (k >= steps.length) break;
    phase += (2 * Math.PI * 440 * 2 ** ((steps[k] + cents / 100 - 69) / 12)) / rate;
    out[i] = 0.5 * Math.sin(phase);
  }
  return writeWav(out, rate);
}

async function selfTest() {
  const opts = { bpm: 100, beatsPerBar: 4, id: "test" };
  const got = (wav) => hum(wav, opts).chart.notes.map((n) => [n.pitch, n.beat, n.duration]);
  const want = [
    [60, 0, 1],
    [62, 1, 1],
    [64, 2, 1],
  ];
  const steps = JSON.stringify(got(tone([60, 62, 64])));
  if (steps !== JSON.stringify(want)) throw new Error(`C4-D4-E4: ${steps}`);
  const flat = hum(tone([60, 62, 64], { cents: -40 }), opts);
  if (JSON.stringify(flat.chart.notes.map((n) => [n.pitch, n.beat, n.duration])) !== JSON.stringify(want))
    throw new Error(`40 cents flat: ${JSON.stringify(flat.chart.notes)}`);
  if (Math.abs(flat.tuningCents + 40) > 5) throw new Error(`tuning read ${flat.tuningCents} cents, not -40`);
  // Ode to Joy's two D5s at beats 51 and 52, as synth.mjs's clean hum sings them: there the 30 ms gap falls between
  // frames and leaves every one voiced. Two notes, not one long one (an octave down: the median rule puts D5 at D4).
  const { synth, PROFILES } = await import("./synth.mjs");
  const d5 = { bpm: 80, beatsPerBar: 4, notes: [51, 52].map((beat) => ({ pitch: 74, beat, duration: 1 })) };
  const again = JSON.stringify(hum(synth(d5, PROFILES.clean), { ...d5, id: "test" }).chart.notes.map((n) => [n.pitch, n.beat, n.duration]));
  if (again !== JSON.stringify([[62, 51, 1], [62, 52, 1]])) throw new Error(`repeated D5: ${again}`);
  const silent = got(writeWav(new Float32Array(44100 * 3), 44100));
  if (silent.length) throw new Error(`silence gave ${JSON.stringify(silent)}`);
  const chart = hum(tone([60, 62, 64]), opts).chart;
  const problems = shapeProblems(chart);
  if (problems.length) throw new Error(`shape: ${problems.join("; ")}`);
  const root = mkdtempSync(join(tmpdir(), "hum-level-"));
  try {
    save(chart, root);
    let refused = false;
    try {
      save(chart, root);
    } catch (e) {
      refused = e instanceof Refused;
    }
    if (!refused) throw new Error("--save wrote over an existing folder");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  process.stdout.write("self-test: ok (C4-D4-E4, 40 cents flat, a repeated note, silence, --save refusal, validateChart's shape copied)\n");
}

// ---------- CLI ----------

function main(argv) {
  if (argv.includes("--self-test")) return selfTest().catch((e) => {
    process.stderr.write(`${e.stack}\n`);
    process.exit(1);
  });
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const wav = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const bpm = Number(flag("--bpm"));
  const beatsPerBar = Number(flag("--beats-per-bar"));
  const id = flag("--id");
  if (!wav || !(bpm > 0) || !(beatsPerBar > 0) || !id || !/^[a-z0-9-]+$/.test(id)) {
    throw new Refused("usage: hum.mjs <wav> --bpm <n> --beats-per-bar <n> --id <a-z0-9-> [--save]");
  }
  const { chart, tuningCents } = hum(readFileSync(wav), { bpm, beatsPerBar, id });
  if (!chart.notes.length) throw new Refused("no notes heard");
  mkdirSync(LOCAL, { recursive: true });
  const out = join(LOCAL, `${basename(wav).replace(/\.wav$/i, "")}.chart.json`);
  writeFileSync(out, JSON.stringify(chart, null, 2) + "\n");
  process.stdout.write(`${chart.notes.length} notes, tuning ${tuningCents} cents: ${out}\n`);
  if (argv.includes("--save")) process.stdout.write(`saved: ${save(chart)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    process.stderr.write(`refused: ${e.message}\n`);
    process.exit(2);
  }
}
