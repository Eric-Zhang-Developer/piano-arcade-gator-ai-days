// Flow mode's steadiness word for the results headline (spec: flow-mode), from each hit's signed deviation in beats
// (FlowJudge.deviations: negative is early). Pure.
import type { Results } from "../../contracts";

export type Steadiness = "steady" | "a bit rushed" | "a bit uneven";

export function steadiness(deviations: readonly number[]): Steadiness {
  if (!deviations.length) return "steady";
  const abs = deviations.map(Math.abs).sort((a, b) => a - b);
  const mid = abs.length >> 1;
  const median = abs.length % 2 ? abs[mid] : (abs[mid - 1] + abs[mid]) / 2;
  if (median <= 0.1) return "steady";
  const mean = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  return mean < -0.05 ? "a bit rushed" : "a bit uneven";
}

// The results headline: "Steady at 72% of tempo · 98% right notes · 2 slips". It leads with the tempo held (play-modes),
// so playing at half speed reads as that. Right notes are the judged notes hit at any tier (a chord's inner GOOD
// included) over all of them.
export function headline(results: Results, slips: number, deviations: readonly number[], held: number | null = null): string {
  const n = results.judgments.length;
  const right = n ? Math.round((100 * results.judgments.filter((j) => j.judgment !== "MISS").length) / n) : 100;
  const word = steadiness(deviations);
  const lead = `${word[0].toUpperCase()}${word.slice(1)}${held === null ? "" : ` at ${held}% of tempo`}`;
  return `${lead} · ${right}% right notes · ${slips} ${slips === 1 ? "slip" : "slips"}`;
}
