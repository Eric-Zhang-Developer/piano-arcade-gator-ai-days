// The tests' shared pieces (spec: crowd): twinkle, its note-ons, and the scoring of found onsets against the truth.
import { readFileSync } from "node:fs";
import type { Chart } from "../../../contracts";
import { bedSettings } from "./mix";

export const twinkle = JSON.parse(readFileSync(new URL("../../../../public/songs/twinkle/chart.json", import.meta.url), "utf8")) as Chart;

// The player's note-ons as samples: the chart's notes struck on time, as the MIDI the plugin forwards.
export const noteOnSamples = (c: Chart, rate: number) => c.notes.map((n) => Math.round((bedSettings.leadS + n.beat * (60 / c.bpm)) * rate));

// Found onsets (samples) against true clap starts (s): each truth matched once to the nearest unused onset within
// ±tolMs (decision crowd-onsets: the 30 ms match window).
export function evaluate(found: number[], truth: number[], rate: number, tolMs = 30) {
  const used = new Set<number>();
  const errs: number[] = [];
  for (const t of truth) {
    let best = -1;
    for (let i = 0; i < found.length; i++) {
      const e = Math.abs(found[i] / rate - t) * 1000;
      if (!used.has(i) && e <= tolMs && (best < 0 || e < Math.abs(found[best] / rate - t) * 1000)) best = i;
    }
    if (best >= 0) {
      used.add(best);
      errs.push((found[best] / rate - t) * 1000);
    }
  }
  const mid = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  return { P: found.length ? used.size / found.length : 0, R: truth.length ? used.size / truth.length : 0, medAbs: mid(errs.map(Math.abs)), medSigned: mid(errs), found: found.length };
}
