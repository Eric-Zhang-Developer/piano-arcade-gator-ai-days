// The roll against our chart (spike: composers-hands): a DTW on the two pitch sequences, with gap steps so a note in
// one and not the other costs one, then the result read as sections: matched (with the chart's bars), or a stretch
// only the roll plays (a repeat it took, an added ending) or only the chart has (a repeat it skipped). Pure.

export interface Seq {
  pitch: number;
  ms: number; // roll time, or chart time
  bar?: number; // the chart's bar, 1-based
  i?: number; // the note's index before sequence() sorted it
}

export interface Section {
  kind: "matched" | "repeat" | "extra" | "skipped";
  roll: [number, number]; // index range in the roll, end exclusive (empty for skipped)
  chart: [number, number]; // index range in the chart (empty for repeat and extra)
  bars?: [number, number]; // the chart's first and last bar
  match: number; // share of the stretch's pairs with equal pitches, 0–1 (matched only)
}

export const alignSettings = {
  minRun: 8, // a one-sided stretch this long is a section of its own; shorter ones are slips inside a matched one
  repeatMatch: 0.8, // an extra stretch whose pitches match some chart stretch this well is a repeat
};

// Notes starting together are ordered by pitch in both, so a chord's order never counts as a mismatch.
export const sequence = <T extends Seq>(xs: T[], chordMs = 30): T[] =>
  [...xs].sort((a, b) => (Math.abs(a.ms - b.ms) <= chordMs ? a.pitch - b.pitch : a.ms - b.ms));

// The path: pairs [i, j] where both play, [i, -1] where only the roll does, [-1, j] where only the chart does.
export function dtw(roll: Seq[], chart: Seq[]): [number, number][] {
  const n = roll.length;
  const m = chart.length;
  const w = m + 1;
  const cost = new Int32Array((n + 1) * w);
  const step = new Uint8Array((n + 1) * w); // 1 diagonal, 2 roll only, 3 chart only
  for (let i = 1; i <= n; i++) {
    cost[i * w] = i;
    step[i * w] = 2;
  }
  for (let j = 1; j <= m; j++) {
    cost[j] = j;
    step[j] = 3;
  }
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const d = cost[(i - 1) * w + j - 1] + (roll[i - 1].pitch === chart[j - 1].pitch ? 0 : 1);
      const r = cost[(i - 1) * w + j] + 1;
      const c = cost[i * w + j - 1] + 1;
      const best = Math.min(d, r, c);
      cost[i * w + j] = best;
      // On a tie a roll-only step wins: read back from the end, a repeated stretch's later pass is the repeat.
      step[i * w + j] = best === r ? 2 : best === d ? 1 : 3;
    }
  const path: [number, number][] = [];
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const s = step[i * w + j];
    if (s === 1) path.push([--i, --j]);
    else if (s === 2) path.push([--i, -1]);
    else path.push([-1, --j]);
  }
  return path.reverse();
}

// Similarity of two pitch runs: the share of the longer one the alignment pairs with an equal pitch.
const likeness = (a: number[], b: number[]) => {
  const p = dtw(a.map((pitch) => ({ pitch, ms: 0 })), b.map((pitch) => ({ pitch, ms: 0 })));
  return p.filter(([i, j]) => i >= 0 && j >= 0 && a[i] === b[j]).length / Math.max(a.length, b.length, 1);
};

export function sections(roll: Seq[], chart: Seq[], path = dtw(roll, chart)): Section[] {
  const { minRun } = alignSettings;
  // Cut the path at one-sided runs of minRun or more; everything between is one matched section.
  const runs: { side: "both" | "roll" | "chart"; from: number; to: number }[] = [];
  for (let k = 0; k < path.length; ) {
    const side = path[k][1] < 0 ? "roll" : path[k][0] < 0 ? "chart" : "both";
    let e = k;
    while (e < path.length && (path[e][1] < 0 ? "roll" : path[e][0] < 0 ? "chart" : "both") === side) e++;
    const long = side !== "both" && e - k >= minRun;
    const last = runs[runs.length - 1];
    if (!long && last?.side === "both") last.to = e;
    else runs.push({ side: long ? side : "both", from: k, to: e });
    k = e;
  }
  const chartPitches = chart.map((c) => c.pitch);
  return runs.map(({ side, from, to }) => {
    const pairs = path.slice(from, to);
    const ri = pairs.map(([i]) => i).filter((i) => i >= 0);
    const ci = pairs.map(([, j]) => j).filter((j) => j >= 0);
    const range = (xs: number[]): [number, number] => (xs.length ? [xs[0], xs[xs.length - 1] + 1] : [0, 0]);
    if (side === "chart") return { kind: "skipped", roll: [0, 0], chart: range(ci), bars: barsOf(chart, ci), match: 0 } as Section;
    if (side === "roll") {
      const played = ri.map((i) => roll[i].pitch);
      // A repeat: some stretch of the chart as long as this one sounds the same.
      let best = 0;
      for (let s = 0; s + played.length <= chartPitches.length && best < alignSettings.repeatMatch; s += Math.max(1, played.length >> 2))
        best = Math.max(best, likeness(played, chartPitches.slice(s, s + played.length)));
      return { kind: best >= alignSettings.repeatMatch ? "repeat" : "extra", roll: range(ri), chart: [0, 0], match: 0 } as Section;
    }
    const both = pairs.filter(([i, j]) => i >= 0 && j >= 0);
    const equal = both.filter(([i, j]) => roll[i].pitch === chart[j].pitch).length;
    return { kind: "matched", roll: range(ri), chart: range(ci), bars: barsOf(chart, ci), match: equal / Math.max(ri.length, ci.length, 1) } as Section;
  });
}

const barsOf = (chart: Seq[], ci: number[]): [number, number] | undefined =>
  ci.length && chart[ci[0]].bar !== undefined ? [chart[ci[0]].bar!, chart[ci[ci.length - 1]].bar!] : undefined;

// Chart time against roll time at every equal-pitch pair in a matched section: tempo-curve's fitCurve points for
// Compare, and the map from a chart beat to his time.
export function timeMap(roll: Seq[], chart: Seq[], path = dtw(roll, chart)): { t: number; p: number }[] {
  return path.filter(([i, j]) => i >= 0 && j >= 0 && roll[i].pitch === chart[j].pitch).map(([i, j]) => ({ t: chart[j].ms, p: roll[i].ms }));
}
