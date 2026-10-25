#!/usr/bin/env node
// The truth for hum-level-spike: each piece's melody, its skyline (the highest right-hand note at each onset), as a
// chart in local/<id>.truth.json. Derived from committed charts, so it stays local with the rest.
//
//   node spikes/hum-level/truth.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL } from "./hum.mjs";

export const PIECES = ["twinkle", "ode-to-joy", "minuet-g"];
const SONGS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "public", "songs");

export function skyline(chart) {
  const top = new Map();
  for (const n of chart.notes) if (n.hand === "R" && !(top.get(n.beat)?.pitch >= n.pitch)) top.set(n.beat, n);
  const notes = [...top.values()].sort((a, b) => a.beat - b.beat);
  return {
    id: chart.id,
    title: chart.title,
    composer: chart.composer,
    source: `The right hand's skyline of songs/${chart.id} (hum-level-spike truth)`,
    bpm: chart.bpm,
    beatsPerBar: chart.beatsPerBar,
    notes: notes.map((n, i) => ({ id: `n${i + 1}`, pitch: n.pitch, beat: n.beat, duration: n.duration, hand: "R" })),
  };
}

export function truthPath(id) {
  return join(LOCAL, `${id}.truth.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(LOCAL, { recursive: true });
  for (const id of PIECES) {
    const truth = skyline(JSON.parse(readFileSync(join(SONGS, id, "chart.json"), "utf8")));
    writeFileSync(truthPath(id), JSON.stringify(truth, null, 2) + "\n");
    process.stdout.write(`${id}: ${truth.notes.length} notes at ${truth.bpm} BPM, ${truth.beatsPerBar}/bar\n`);
  }
}
