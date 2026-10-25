// Real Keys spike scoring (spec: real-keys, Validation a and b). It reads the page's own math (Node strips the types),
// so the scores measure the code that runs. Nothing it reads is committed: stills, clips and logs stay in local/.
//   node spikes/real-keys/score.mjs analyse <clip.webm> <notes.json> <calibration.json>   writes <clip>.analysis.json
//   node spikes/real-keys/score.mjs edges <edges.json> <calibration.json>   key-edge reprojection error (bar ≤ 3 px)
//   node spikes/real-keys/score.mjs latency <a.analysis.json> <b…> <c…>     each run's median; agreement (bar ±1 frame)
//   node spikes/real-keys/score.mjs sparks <play.analysis.json> [delayMs]  spark frame vs key-down frame (bar ±1 frame)
//   node spikes/real-keys/score.mjs --check                                 the self-check, on synthetic data
// calibration.json: what "Save still" downloads beside the PNG ({ corners, lo, hi, delayMs }).
// edges.json: points marked by hand on the still, each on the boundary between two white keys:
//   { "points": [{ "x": 812, "y": 604, "left": 60, "right": 62 }, …] }   (left/right: the two white keys' MIDI pitches)
// *.analysis.json: what "Save analysis log" downloads in clip mode ({ delayMs, notes, frames: { pitch: [{ t, b }] } }),
// or what `analyse` writes from the clip itself through ffmpeg: every frame at its own timestamp, read the way the page
// reads them (a 480-wide picture, a 5×5 grid in each key's quad), for when the page can't play the clip in view.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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

// Each key's quad in bed space, as keys.ts's bedQuads makes them (its import of core/highway doesn't resolve in Node,
// so the two numbers are copied: black keys 0.6 of a white key wide, 0.62 of the bed long).
function bedQuad(p, lo, hi) {
  const whites = [];
  for (let k = lo; k <= hi; k++) if (!isBlack(k)) whites.push(k);
  const w = 1 / whites.length;
  if (!isBlack(p)) { const i = whites.indexOf(p); return [i * w, (i + 1) * w, 0, 1]; }
  const x = (whites.indexOf(p - 1) + 1) * w;
  return [x - 0.3 * w, x + 0.3 * w, 0, 0.62];
}

// The clip's frames, each key's mean luma at the frame's own time: ffmpeg decodes to 480-wide grey, every frame kept.
export function analyse(clip, log, cal) {
  const probe = (entries) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", entries, "-of", "csv=p=0", clip], { encoding: "utf8" });
  const [vw, vh] = probe("stream=width,height").trim().split(",").map(Number);
  const times = probe("frame=best_effort_timestamp_time").trim().split("\n").map((x) => Number(x) * 1000);
  const W = 480, Hh = Math.round((vh * W) / vw), k = W / vw;
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", clip, "-fps_mode", "passthrough", "-vf", `scale=${W}:${Hh}`, "-pix_fmt", "gray", "-f", "rawvideo", "-"], { maxBuffer: 2 ** 31 });
  const Hm = homography(BED, cal.corners.map(([x, y]) => [x * k, y * k]));
  const lo = Math.min(cal.lo ?? 21, cal.hi ?? 108), hi = Math.max(cal.lo ?? 21, cal.hi ?? 108);
  const pitches = [...new Set(log.notes.map((n) => n.pitch))].filter((p) => p >= lo && p <= hi);
  const at = new Map(pitches.map((p) => {
    const [u0, u1, v0, v1] = bedQuad(p, lo, hi), pts = [];
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
      const [x, y] = apply(Hm, [u0 + ((u1 - u0) * (a + 0.5)) / 5, v0 + ((v1 - v0) * (b + 0.5)) / 5]).map(Math.round);
      if (x >= 0 && y >= 0 && x < W && y < Hh) pts.push(y * W + x);
    }
    return [p, pts];
  }));
  const n = Math.min(times.length, Math.floor(raw.length / (W * Hh)));
  const frames = Object.fromEntries(pitches.map((p) => [p, []]));
  for (let f = 0; f < n; f++) {
    const off = f * W * Hh;
    for (const [p, pts] of at) frames[p].push({ t: times[f], b: pts.reduce((s, i) => s + raw[off + i], 0) / (pts.length || 1) });
  }
  return { clip, delayMs: cal.delayMs ?? 0, notes: log.notes, frames };
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

// Which way a press moves a key's brightness (−1 darker, +1 brighter), from the presses pressDelays reads cleanly: no
// release of the same key in the 400 ms before, so its baseline is the key at rest.
export function pressSign(log) {
  let sum = 0;
  for (const n of log.notes.filter((x) => x.type === "on")) {
    if (log.notes.some((m) => m.pitch === n.pitch && m.type === "off" && m.t < n.t && m.t > n.t - 400)) continue;
    const frames = log.frames[n.pitch] ?? [];
    const [d] = pressDelays(frames, [n.t]);
    if (d === null) continue;
    const before = frames.filter((f) => f.t < n.t && f.t >= n.t - 150), after = frames.find((f) => f.t >= n.t + d);
    if (before.length && after) sum += after.b - before.reduce((a, f) => a + f.b, 0) / before.length;
  }
  return sum < 0 ? -1 : 1;
}

// A press's key-down frame: the first frame from the note-on whose brightness has stepped the press's way past the
// threshold over two frames. pressDelays' level-before-the-press can't do this for a repeated note: the key's release
// from the note before is still arriving in the picture, and it reads as the change.
function keyDown(frames, t, sign) {
  const i0 = frames.findIndex((f) => f.t >= t);
  for (let i = Math.max(i0, 2); i0 >= 0 && i < frames.length && frames[i].t <= t + 600; i++)
    if (sign * (frames[i].b - frames[i - 2].b) > 12) return sign * (frames[i - 1].b - frames[i - 2].b) > 12 ? frames[i - 1].t : frames[i].t;
  return null;
}

// Each press: the frame its spark first shows (the first frame at or after note-on + delay) minus the frame its key
// goes down, in frames.
export function sparks(log, delayMs = log.delayMs) {
  const out = [], sign = pressSign(log);
  for (const n of log.notes.filter((x) => x.type === "on")) {
    const frames = log.frames[n.pitch] ?? [];
    const down = keyDown(frames, n.t, sign);
    const shown = frames.find((f) => f.t >= n.t + delayMs);
    if (down === null || !shown) continue;
    out.push({ pitch: n.pitch, t: n.t, offset: Math.round(((shown.t - down) / frameMsOf(frames)) * 100) / 100 });
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
  // sparks on a repeated note: the key comes back up only just before the next press (Twinkle's C C), still within a frame.
  const rep = { delayMs: 91, notes: [], frames: { 60: [] } };
  for (const t of [500, 1100, 1700, 2300]) rep.notes.push({ t, type: "on", pitch: 60 }, { t: t + 510, type: "off", pitch: 60 });
  const isDown = (t) => rep.notes.some((n) => n.type === "on" && t >= n.t + 83 && t < n.t + 510 + 83);
  for (let t = 0; t < 3200; t += 1000 / 60) rep.frames[60].push({ t, b: isDown(t) ? 90 : 120 });
  const r = sparks(rep);
  if (r.length !== 4 || r.some((x) => Math.abs(x.offset) > 1)) throw new Error(`sparks, repeated: ${JSON.stringify(r)}`);
  process.stdout.write("score: check ok\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const read = (p) => JSON.parse(readFileSync(p, "utf8"));
  const [cmd, ...args] = process.argv.slice(2);
  const f1 = (x) => x.toFixed(1);
  if (cmd === "--check") check();
  else if (cmd === "analyse" && args.length === 3) {
    const out = args[0].replace(/\.[^.]+$/, "") + ".analysis.json";
    const a = analyse(args[0], read(args[1]), read(args[2]));
    writeFileSync(out, JSON.stringify(a));
    process.stdout.write(`analyse: ${out}, ${Object.values(a.frames)[0]?.length ?? 0} frames, ${Object.keys(a.frames).length} keys\n`);
  }
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
    process.stderr.write("usage: score.mjs analyse <clip.webm> <notes.json> <calibration.json> | edges <edges.json> <calibration.json> | latency <a.json> [b.json …] | sparks <play.json> [delayMs] | --check\n");
    process.exit(2);
  }
}
