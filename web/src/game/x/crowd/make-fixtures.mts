// Writes Crowd Mode's test mixes as WAVs for listening (decision crowd-onsets: fixtures): twinkle on the laptop voice
// with claps on every beat at 0, −6 and −12 dB, the first few seconds of each, and the true clap times beside them.
// The WAVs stay out of git (fixtures/.gitignore); vitest builds the same mixes in memory.
//   node web/src/game/x/crowd/make-fixtures.mts
import { readFileSync, writeFileSync } from "node:fs";
import { crowdMix } from "./mix.ts";

const seconds = 4; // disk is tight: a few seconds is enough to hear the claps against the bed
const twinkle = JSON.parse(readFileSync(new URL("../../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const beats = Array.from({ length: 48 }, (_, i) => i);

function wav(x: Float32Array, rate: number): Buffer {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + x.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(x.length * 2, 40);
  x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return b;
}

for (const db of [0, -6, -12]) {
  const m = crowdMix(twinkle, beats, db, 1);
  const n = seconds * m.sampleRate;
  const name = new URL(`fixtures/twinkle-claps${db}dB`, import.meta.url);
  writeFileSync(`${name.pathname}.wav`, wav(m.samples.subarray(0, n), m.sampleRate));
  writeFileSync(`${name.pathname}.txt`, m.claps.filter((t) => t < seconds).map((t) => t.toFixed(5)).join("\n") + "\n");
}
