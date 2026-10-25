// Real Keys spike (spec: real-keys, "build on synthetic frames"): a stand-in for Eric's camera. It draws a key bed in
// perspective, presses keys from a known log with a planted camera lag, and pipes the frames to ffmpeg, so
// /real-keys?clip=1 and score.mjs run end to end before a real camera run exists. Frames are exact (60 fps, constant):
// a browser recorder in a hidden pane drops them.
//   node spikes/real-keys/synth.mjs play [lagMs]               Twinkle's first 14 beats after the 8-beat count-in
//   node spikes/real-keys/synth.mjs latency [lagMs] [shiftMs]  one key (C4), 8 times, presses off the frame grid
// Writes spikes/real-keys/local/synth-<kind>-lag<ms>.webm, its .notes.json and its .calibration.json (the true
// corners and range). Needs ffmpeg on the PATH. The pixel → key lookup uses the page's own homography.ts, so these
// clips test the timing end to end, not the geometry; (a)'s reprojection needs Eric's still.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { apply, homography, invert } from "../../web/src/game/x/real-keys/homography.ts";

const kind = process.argv[2] === "latency" ? "latency" : "play";
const lag = Number(process.argv[3] ?? 83);
const shift = Number(process.argv[4] ?? 0); // ms added to every press: another run, at another frame phase
const W = 1920, H = 1080, FPS = 60;
const here = new URL(".", import.meta.url).pathname;

// The bed: C2–C7 (36–96), its corners as an angled camera would see them.
const LO = 36, HI = 96;
const CORNERS = [[420, 330], [1540, 310], [1760, 760], [170, 790]]; // back-left, back-right, front-right, front-left
const isBlack = (p) => [1, 3, 6, 8, 10].includes(p % 12);
const whites = [];
for (let p = LO; p <= HI; p++) if (!isBlack(p)) whites.push(p);
const kw = 1 / whites.length;

// Each pixel's key (or -1), once: the picture → bed map, then white or black by (u, v).
const toBed = invert(homography([[0, 0], [1, 0], [1, 1], [0, 1]], CORNERS));
const keyAt = new Int16Array(W * H).fill(-1);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const [u, v] = apply(toBed, [x + 0.5, y + 0.5]);
    if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
    const i = Math.floor(u / kw), f = u / kw - i;
    if (f < 0.04 || f > 0.96) continue; // the gap between white keys
    let p = whites[i];
    if (v < 0.62) {
      if (f > 0.7 && isBlack(whites[i] + 1) && whites[i] + 1 <= HI) p = whites[i] + 1;
      else if (f < 0.3 && isBlack(whites[i] - 1) && whites[i] - 1 >= LO) p = whites[i] - 1;
    }
    keyAt[y * W + x] = p;
  }

// The log: note-ons and offs in ms from the clip's start.
const notes = [];
if (kind === "latency")
  for (let k = 0; k < 8; k++) {
    const t = 800 + k * 1000 + ((k * 7) % 17) + shift;
    notes.push({ t, type: "on", pitch: 60, velocity: 80 }, { t: t + 300, type: "off", pitch: 60, velocity: 0 });
  }
else {
  const chart = JSON.parse(readFileSync(`${here}../../web/public/songs/twinkle/chart.json`, "utf8"));
  const mpb = 60000 / chart.bpm, zero = 8 * mpb + 300; // the count-in, plus Start pressed about 0.3 s in
  for (const n of chart.notes.filter((n) => n.beat < 14)) {
    const t = Math.round(zero + n.beat * mpb + ((n.beat * 7) % 5) * 4 - 8); // a few ms off the grid, as hands are
    notes.push({ t, type: "on", pitch: n.pitch, velocity: 80 }, { t: Math.round(t + n.duration * mpb * 0.85), type: "off", pitch: n.pitch, velocity: 0 });
  }
}
notes.sort((a, b) => a.t - b.t);
const length = notes.at(-1).t + 1200;

// Colors (RGB): cabinet, white key up/down, black key up/down. A press darkens the key, as a key's top drops into shadow.
const COL = { bed: [26, 20, 16], wUp: [228, 226, 220], wDown: [154, 154, 150], bUp: [16, 16, 16], bDown: [58, 58, 58] };
const out = `${here}local/synth-${kind}-lag${lag}${shift ? `-shift${shift}` : ""}`;
const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-", "-c:v", "libvpx", "-b:v", "4M", "-deadline", "realtime", "-cpu-used", "8", `${out}.webm`], { stdio: ["pipe", "inherit", "inherit"] });
const buf = Buffer.alloc(W * H * 3);
for (let f = 0; f * (1000 / FPS) < length; f++) {
  const t = f * (1000 / FPS);
  const down = new Set();
  for (const n of notes) if (n.t + lag <= t) n.type === "on" ? down.add(n.pitch) : down.delete(n.pitch);
  for (let i = 0; i < W * H; i++) {
    const p = keyAt[i];
    const c = p < 0 ? COL.bed : isBlack(p) ? (down.has(p) ? COL.bDown : COL.bUp) : down.has(p) ? COL.wDown : COL.wUp;
    buf[i * 3] = c[0]; buf[i * 3 + 1] = c[1]; buf[i * 3 + 2] = c[2];
  }
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
writeFileSync(`${out}.notes.json`, JSON.stringify({ note: `synthetic: lag ${lag} ms planted`, lagMs: lag, notes }, null, 1));
writeFileSync(`${out}.calibration.json`, JSON.stringify({ corners: CORNERS, lo: LO, hi: HI, delayMs: lag }));
process.stdout.write(`synth: ${out}.webm, ${(length / 1000).toFixed(1)} s, ${notes.length / 2} presses, lag ${lag} ms\n`);
