// Flow mode's steadiness word for the results headline (spec: flow-mode), from each hit's signed deviation in beats
// (FlowJudge.deviations: negative is early). Pure.
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
