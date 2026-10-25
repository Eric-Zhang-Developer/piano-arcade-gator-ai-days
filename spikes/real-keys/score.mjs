// Real Keys spike scoring (spec: real-keys, Validation a and b). It reads the page's own math (Node strips the types),
// so the scores measure the code that runs. Nothing it reads is committed: stills, clips and logs stay in local/.
//   node spikes/real-keys/score.mjs edges <edges.json> <calibration.json>   key-edge reprojection error (bar ≤ 3 px)
//   node spikes/real-keys/score.mjs latency <a.analysis.json> <b…> <c…>     each run's median; agreement (bar ±1 frame)
//   node spikes/real-keys/score.mjs sparks <play.analysis.json> [delayMs]  spark frame vs key-down frame (bar ±1 frame)
//   node spikes/real-keys/score.mjs --check                                 the self-check, on synthetic data
// calibration.json: what "Save still" downloads beside the PNG ({ corners, lo, hi, delayMs }).
// edges.json: points marked by hand on the still, each on the boundary between two white keys:
//   { "points": [{ "x": 812, "y": 604, "left": 60, "right": 62 }, …] }   (left/right: the two white keys' MIDI pitches)
// *.analysis.json: what "Save analysis log" downloads in clip mode ({ delayMs, notes, frames: { pitch: [{ t, b }] } }).
import { readFileSync } from "node:fs";
import { apply, homography } from "../../web/src/game/x/real-keys/homography.ts";
import { pressDelays, summarize } from "../../web/src/game/x/real-keys/latency.ts";

const BED = [[0, 0], [1, 0], [1, 1], [0, 1]];
const isBlack = (p) => [1, 3, 6, 8, 10].includes(p % 12);
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Each marked point's distance (px) from the predicted boundary line between its two white keys.
export function edges(marks, cal) {
  const H = homography(BED, cal.corners);
  const lo = Math.min(cal.lo ?? 21, cal.hi ?? 108), hi = Math.max(cal.lo ?? 21, cal.hi ?? 108);
  const whites = [];
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites.push(p);
  return marks.points.map(({ x, y, right }) => {
    const u = whites.indexOf(right) / whites.length;
    if (u <= 0) return NaN;
    const [a, b] = [apply(H, [u, 0]), apply(H, [u, 1])];
    return Math.abs((b[0] - a[0]) * (a[1] - y) - (a[0] - x) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
}

// A clip's frame period: the median gap between its frame times.
const frameMsOf = (frames) => median(frames.slice(1).map((f, i) => f.t - frames[i].t).filter((d) => d > 0));

// One latency run: the most-pressed key's presses against its own brightness.
export function latencyRun(log) {
  const ons = log.notes.filter((n) => n.type === "on");
  const counts = new Map();
  for (const n of ons) counts.set(n.pitch, (counts.get(n.pitch) ?? 0) + 1);
  const pitch = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const frames = log.frames[pitch] ?? [];
  return summarize(pressDelays(frames, ons.filter((n) => n.pitch === pitch).map((n) => n.t)), frameMsOf(frames));
}

// Each press: the frame its spark first shows (the first frame at or after note-on + delay) minus the frame its key
// goes down (the first frame past the threshold), in frames.
export function sparks(log, delayMs = log.delayMs) {
  const out = [];
  for (const n of log.notes.filter((x) => x.type === "on")) {
    const frames = log.frames[n.pitch] ?? [];
    const [d] = pressDelays(frames, [n.t]);
    const shown = frames.find((f) => f.t >= n.t + delayMs);
    if (d === null || !shown) continue;
    out.push({ pitch: n.pitch, t: n.t, offset: Math.round(((shown.t - (n.t + d)) / frameMsOf(frames)) * 100) / 100 });
  }
  return out;
}

// Synthetic frames: a key at luma 120 that steps to 90 `lagMs` after each press, sampled every `frameMs`.
function synth(presses, lagMs, frameMs, pitch = 60, phase = 0) {
  const frames = [];
  for (let t = phase; t < presses.at(-1) + 800; t += frameMs) frames.push({ t, b: presses.some((p) => t >= p + lagMs && t < p + lagMs + 200) ? 90 : 120 });
  return { delayMs: Math.round(lagMs), notes: presses.map((t) => ({ t, type: "on", pitch })), frames: { [pitch]: frames } };
}

function check() {
  // edges: points on the true boundaries, shifted 2 px off them, score 2 px.
  const cal = { corners: [[300, 400], [1600, 380], [1700, 800], [200, 820]], lo: 60, hi: 72 };
  const H = homography(BED, cal.corners), whites = [60, 62, 64, 65, 67, 69, 71, 72];
  const points = [1, 3, 5].map((i) => {
    const [a, b] = [apply(H, [i / 8, 0]), apply(H, [i / 8, 1])], n = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [x, y] = apply(H, [i / 8, 0.5]);
    return { x: x + (2 * (b[1] - a[1])) / n, y: y - (2 * (b[0] - a[0])) / n, left: whites[i - 1], right: whites[i] };
  });
  const e = edges({ points }, cal);
  if (e.some((d) => Math.abs(d - 2) > 1e-6)) throw new Error(`edges: ${e}`);
  // latency: a planted 83 ms lag at 60 fps comes back within a frame, three runs at different frame phases.
  const presses = [500, 1500, 2500, 3500, 4500, 5500, 6500, 7500];
  const runs = [0, 5, 11].map((ph) => latencyRun(synth(presses, 83, 1000 / 60, 60, ph)));
  if (runs.some((r) => !r || r.found !== 8 || Math.abs(r.medianMs - 83) > 1000 / 60)) throw new Error(`latency: ${JSON.stringify(runs)}`);
  // sparks: with the delay set to the measured median, every spark is within a frame of its key.
  const log = synth(presses, 83, 1000 / 60);
  const s = sparks(log, runs[0].medianMs);
  if (s.length !== 8 || s.some((x) => Math.abs(x.offset) > 1)) throw new Error(`sparks: ${JSON.stringify(s)}`);
  process.stdout.write("score: check ok\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const read = (p) => JSON.parse(readFileSync(p, "utf8"));
  const [cmd, ...args] = process.argv.slice(2);
  const f1 = (x) => x.toFixed(1);
  if (cmd === "--check") check();
  else if (cmd === "edges" && args.length === 2) {
    const e = edges(read(args[0]), read(args[1])).filter(Number.isFinite);
    process.stdout.write(`edges: ${e.length} points, mean ${f1(e.reduce((a, b) => a + b, 0) / e.length)} px, max ${f1(Math.max(...e))} px (bar: mean ≤ 3 px at 1080p)\n`);
  } else if (cmd === "latency" && args.length) {
    const runs = args.map((p) => [p, latencyRun(read(p))]);
    for (const [p, r] of runs)
      process.stdout.write(r ? `${p}: median ${f1(r.medianMs)} ms, ${f1(r.minMs)}–${f1(r.maxMs)} ms (${f1(r.spreadFrames)} frames), found ${r.found} of ${r.of}\n` : `${p}: no press found\n`);
    const ok = runs.map(([, r]) => r).filter(Boolean);
    if (ok.length > 1) {
      const fr = median(ok.map((r) => r.frameMs)), span = (Math.max(...ok.map((r) => r.medianMs)) - Math.min(...ok.map((r) => r.medianMs))) / fr;
      process.stdout.write(`agreement: medians span ${f1(span)} frames at ${f1(fr)} ms a frame (bar: ≤ 2, that is ±1 frame)\n`);
    }
  } else if (cmd === "sparks" && args.length) {
    const s = sparks(read(args[0]), args[1] === undefined ? undefined : Number(args[1]));
    for (const x of s) process.stdout.write(`${x.pitch} at ${f1(x.t)} ms: ${x.offset >= 0 ? "+" : ""}${f1(x.offset)} frames\n`);
    process.stdout.write(`sparks: ${s.filter((x) => Math.abs(x.offset) <= 1).length} of ${s.length} within ±1 frame\n`);
  } else {
    process.stderr.write("usage: score.mjs edges <edges.json> <calibration.json> | latency <a.json> [b.json …] | sparks <play.json> [delayMs] | --check\n");
    process.exit(2);
  }
}
