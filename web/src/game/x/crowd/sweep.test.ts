// The threshold sweep behind crowdSettings (decision crowd-onsets). Off by default, it takes about a minute:
//   CROWD_SWEEP=1 pnpm -C web exec vitest run src/game/x/crowd/sweep.test.ts
// It prints a Markdown table to stderr: each setting's worst precision and recall, and median |error|, at −6 dB.
import { it } from "vitest";
import { crowdSettings, detect } from "./dsp";
import { crowdMix } from "./mix";
import { evaluate, noteOnSamples, twinkle } from "./fixtures";

it.skipIf(!process.env.CROWD_SWEEP)("sweeps crowdSettings at −6 dB", () => {
  const beats = Array.from({ length: 48 }, (_, i) => i);
  const mixes = [0, 1].flatMap((hammer) => [1, 2, 3].map((seed) => ({ hammer, m: crowdMix(twinkle, beats, -6, seed, 48000, undefined, { hammer }) })));
  const notes = noteOnSamples(twinkle, 48000);
  const rows: string[] = ["| λ | δ | flatMin | minGapMs | noteRaise | P (laptop) | R (laptop) | P (hammer) | R (hammer) | median \\|err\\| ms |", "|---|---|---|---|---|---|---|---|---|---|"];
  for (const lambda of [1.2, 1.6, 2.2])
    for (const delta of [2, 4, 8])
      for (const flatMin of [0.15, 0.25, 0.35])
        for (const minGapMs of [40, 60, 90])
        for (const noteRaise of [1, 2, 3]) {
          const s = { ...crowdSettings, lambda, delta, flatMin, minGapMs, noteRaise };
          const by = [0, 1].map((h) => mixes.filter((x) => x.hammer === h).map(({ m }) => evaluate(detect(m.samples, m.sampleRate, s, notes), m.claps, m.sampleRate)));
          const worst = (rs: ReturnType<typeof evaluate>[], k: "P" | "R") => Math.min(...rs.map((r) => r[k]));
          const med = Math.max(...by.flat().map((r) => r.medAbs));
          rows.push(`| ${lambda} | ${delta} | ${flatMin} | ${minGapMs} | ${noteRaise} | ${worst(by[0], "P").toFixed(3)} | ${worst(by[0], "R").toFixed(3)} | ${worst(by[1], "P").toFixed(3)} | ${worst(by[1], "R").toFixed(3)} | ${med.toFixed(1)} |`);
        }
  process.stderr.write(rows.join("\n") + "\n");
}, 600_000);
