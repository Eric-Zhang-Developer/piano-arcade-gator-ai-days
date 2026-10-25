// Conductor spike scoring (spec: conductor, Validation b and c). Nothing here is committed data: the clip, the labels
// and the logs stay in spikes/conductor/local/.
//   node spikes/conductor/score.mjs <labels.json> <detected.json>   precision, recall, median timing error (±100 ms)
//   node spikes/conductor/score.mjs --latency <log.json>            beat to note-on: median and p90
//   node spikes/conductor/score.mjs --check                         the self-check
// labels.json: [ms, …] or { beats: [ms, …] } in the clip's own time. detected.json: the page's copied log (its
// beats' mediaMs) or a plain [ms, …].
import { readFileSync } from "node:fs";

export const TOLERANCE_MS = 100;

const times = (raw) => {
  const list = Array.isArray(raw) ? raw : raw.beats;
  return list.map((b) => (typeof b === "number" ? b : b.mediaMs)).filter(Number.isFinite).sort((a, b) => a - b);
};

// Greedy one-to-one matching in time order: each label takes the nearest unused detection within the tolerance.
export function match(labels, detected, tol = TOLERANCE_MS) {
  const used = new Set();
  const errors = [];
  for (const l of labels) {
    let best = -1;
    for (let i = 0; i < detected.length; i++) {
      if (used.has(i) || Math.abs(detected[i] - l) > tol) continue;
      if (best < 0 || Math.abs(detected[i] - l) < Math.abs(detected[best] - l)) best = i;
    }
    if (best >= 0) {
      used.add(best);
      errors.push(detected[best] - l);
    }
  }
  return { tp: errors.length, precision: detected.length ? errors.length / detected.length : 0, recall: labels.length ? errors.length / labels.length : 0, errors };
}

const quantile = (xs, q) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

// For each note-on on a whole chart beat, the conducted beat nearest it in time: |send timestamp − beat frame time|.
export function latency(log) {
  const beats = log.beats.map((b) => b.frameMs);
  const out = [];
  for (const n of log.notes) {
    if (Math.abs(n.beat - Math.round(n.beat)) > 1e-6 || !beats.length) continue;
    const near = beats.reduce((a, b) => (Math.abs(b - n.sendMs) < Math.abs(a - n.sendMs) ? b : a));
    if (Math.abs(near - n.sendMs) < 500) out.push(Math.abs(n.sendMs - near));
  }
  return { n: out.length, median: quantile(out, 0.5), p90: quantile(out, 0.9) };
}

function check() {
  const m = match([1000, 2000, 3000, 4000], [1030, 1990, 2500, 3150, 4000]);
  if (m.tp !== 3 || m.precision !== 3 / 5 || m.recall !== 3 / 4) throw new Error(`match: ${JSON.stringify(m)}`);
  const l = latency({ beats: [{ frameMs: 1000 }, { frameMs: 2000 }], notes: [{ sendMs: 1060, beat: 0 }, { sendMs: 1300, beat: 0.5 }, { sendMs: 2040, beat: 1 }] });
  if (l.n !== 2 || l.median !== 60) throw new Error(`latency: ${JSON.stringify(l)}`);
  process.stdout.write("score: check ok\n");
}

const [a, b] = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  const read = (p) => JSON.parse(readFileSync(p, "utf8"));
  if (a === "--check") check();
  else if (a === "--latency" && b) {
    const r = latency(read(b));
    process.stdout.write(`latency: ${r.n} beat note-ons, median ${r.median.toFixed(1)} ms, p90 ${r.p90.toFixed(1)} ms (bar: median ≤ 80)\n`);
  } else if (a && b) {
    const r = match(times(read(a)), times(read(b)));
    const abs = r.errors.map(Math.abs);
    process.stdout.write(
      `detection: precision ${(r.precision * 100).toFixed(1)}%, recall ${(r.recall * 100).toFixed(1)}% (${r.tp} matched within ±${TOLERANCE_MS} ms), median |error| ${quantile(abs, 0.5).toFixed(1)} ms, median signed ${quantile(r.errors, 0.5).toFixed(1)} ms (bar: both ≥ 90%)\n`,
    );
  } else {
    process.stderr.write("usage: score.mjs <labels.json> <detected.json> | --latency <log.json> | --check\n");
    process.exit(2);
  }
}
