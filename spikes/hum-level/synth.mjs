#!/usr/bin/env node
// Synthetic hums for hum-level-spike: each truth chart sung by a harmonic tone with falling partials, at its BPM, after
// a one-bar count-in of silence. Two seeded profiles, so a run repeats: clean (in tune, on time) and sloppy (the
// planner's guess at a casual hummer). Writes local/<id>.<profile>.wav; run truth.mjs first.
//
//   node spikes/hum-level/synth.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL, writeWav } from "./hum.mjs";
import { PIECES, truthPath } from "./truth.mjs";

const RATE = 44100;
const PARTIALS = [1, 0.5, 0.33, 0.2, 0.12, 0.07, 0.04, 0.02]; // falling, as a hummed "mm" or "da" roughly does
const LEVEL = 0.25;
const ATTACK = 0.015; // s
const RELEASE = 0.025; // s
const GAP = 0.03; // s of silence before the next note: the re-articulation that splits two notes of one pitch

export const PROFILES = {
  clean: { cents: 0, vibrato: 0, glide: 0, jitter: 0, noiseDb: null },
  sloppy: { cents: -40, vibrato: 30, vibratoHz: 5.5, glide: 0.05, jitter: 0.03, noiseDb: -30 },
};

// mulberry32: tiny, seeded, the same on every machine.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function synth(truth, p, seed = 1) {
  const random = rng(seed);
  const beat = 60 / truth.bpm;
  const lead = truth.beatsPerBar * beat;
  const notes = truth.notes.map((n) => ({ ...n, on: lead + n.beat * beat + (random() * 2 - 1) * p.jitter }));
  const last = notes.at(-1);
  const out = new Float32Array(Math.ceil((last.on + last.duration * beat + 0.5) * RATE));
  const phase0 = random() * 2 * Math.PI;
  notes.forEach((n, i) => {
    const end = Math.min(n.on + n.duration * beat, notes[i + 1]?.on ?? Infinity) - GAP;
    const from = notes[i - 1]?.pitch ?? n.pitch;
    let phase = 0;
    for (let s = Math.max(0, Math.round(n.on * RATE)); s < Math.round(end * RATE); s++) {
      const t = s / RATE;
      const into = t - n.on;
      const glide = p.glide && into < p.glide ? (from - n.pitch) * (1 - into / p.glide) : 0;
      const wobble = p.vibrato ? (p.vibrato / 100) * Math.sin(2 * Math.PI * p.vibratoHz * t + phase0) : 0;
      const midi = n.pitch + p.cents / 100 + glide + wobble;
      phase += (2 * Math.PI * 440 * 2 ** ((midi - 69) / 12)) / RATE;
      const amp = Math.min(1, into / ATTACK, (end - t) / RELEASE);
      let v = 0;
      for (let k = 0; k < PARTIALS.length; k++) v += PARTIALS[k] * Math.sin((k + 1) * phase);
      out[s] += LEVEL * amp * v;
    }
  });
  if (p.noiseDb !== null) {
    const toneRms = LEVEL * Math.sqrt(PARTIALS.reduce((s, a) => s + (a * a) / 2, 0));
    const noiseRms = toneRms * 10 ** (p.noiseDb / 20);
    for (let s = 0; s < out.length; s++) out[s] += (random() * 2 - 1) * noiseRms * Math.sqrt(3); // uniform: rms = a/sqrt(3)
  }
  return writeWav(out, RATE);
}

export function wavPath(id, profile) {
  return join(LOCAL, `${id}.${profile}.wav`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  PIECES.forEach((id, i) => {
    const truth = JSON.parse(readFileSync(truthPath(id), "utf8"));
    for (const [name, p] of Object.entries(PROFILES)) {
      writeFileSync(wavPath(id, name), synth(truth, p, 1000 + i));
      process.stdout.write(`${wavPath(id, name)}\n`);
    }
  });
}
