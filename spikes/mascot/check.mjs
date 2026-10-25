// The mascot spike's code checks (spec: mascot-spike). For every frame under out/sets/<sheet>/<set>/: transparent
// corners; at most 5 colors, each within ΔE 10 of the palette, once anti-aliasing (under 2% of the opaque area) is
// dropped; and across the set, the opaque box's height within ±8% of the set's median and its bottom within ±4% of the
// canvas height. One line per frame, a pass count per set.
// Usage: node spikes/mascot/check.mjs spikes/mascot/out. It first runs a self-test on two synthetic PNGs it writes.
// Exit 0 once the self-test passes and every set is checked (frames may still fail: the lines say which).
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { blank, readPng, writePng } from "./png.mjs";

export const PALETTE = { green: "#6f8f5e", cream: "#efe6cf", ink: "#16130f", blue: "#2b9bff" };
// solid: codex's fills come out at alpha 253-254, not 255, so "opaque" means alpha >= 250 (edges sit below it).
export const limits = { colors: 5, deltaE: 10, minShare: 0.02, height: 0.08, bottom: 0.04, solid: 250 };

const say = (line) => process.stdout.write(`${line}\n`); // a CLI report, not debug output
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// sRGB to CIE Lab (D65); ΔE is CIE76, the plain distance in Lab.
function lab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [x, y, z] = [(R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, R * 0.2126 + G * 0.7152 + B * 0.0722, (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883];
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const PAL = Object.entries(PALETTE).map(([name, h]) => ({ name, lab: lab(hex(h)) }));

export function frameStats({ width, height, px }) {
  const alpha = (x, y) => px[(y * width + x) * 4 + 3];
  const corners = [alpha(0, 0), alpha(width - 1, 0), alpha(0, height - 1), alpha(width - 1, height - 1)].every((a) => a === 0);
  let top = height, bottom = -1, opaque = 0;
  const bins = new Map(); // nearest palette color, or an off-palette Lab bin
  const cache = new Map();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (px[o + 3] > 16) [top, bottom] = [Math.min(top, y), Math.max(bottom, y)];
      if (px[o + 3] < limits.solid) continue; // edges blend with the background: not a fill color
      opaque++;
      const key = (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
      let bin = cache.get(key);
      if (bin === undefined) {
        const L = lab([px[o], px[o + 1], px[o + 2]]);
        const near = PAL.map((p) => [p.name, dE(L, p.lab)]).sort((a, b) => a[1] - b[1])[0];
        bin = near[1] <= limits.deltaE ? near[0] : `off(${L.map((v) => Math.round(v / 12) * 12).join(",")})`;
        cache.set(key, bin);
      }
      bins.set(bin, (bins.get(bin) ?? 0) + 1);
    }
  const colors = [...bins].filter(([, n]) => n >= limits.minShare * opaque).sort((a, b) => b[1] - a[1]);
  return { corners, colors: colors.map(([bin, n]) => [bin, n / opaque]), top, bottom, height };
}

// One frame's own checks; framing is judged against its set.
export function frameVerdict(s) {
  const off = s.colors.filter(([bin]) => bin.startsWith("off"));
  return { corners: s.corners, colorsOk: s.colors.length <= limits.colors && off.length === 0, off };
}

export function checkSet(frames) {
  const heights = frames.map((f) => f.stats.bottom - f.stats.top + 1).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)];
  return frames.map((f) => {
    const s = f.stats;
    const v = frameVerdict(s);
    const h = s.bottom - s.top + 1;
    const heightOk = Math.abs(h - median) <= limits.height * median;
    const bottomOk = Math.abs(s.bottom + 1 - s.height) <= limits.bottom * s.height;
    const pass = v.corners && v.colorsOk && heightOk && bottomOk;
    const why = [
      !v.corners && "corner not transparent",
      !v.colorsOk && `colors ${s.colors.map(([b, n]) => `${b} ${(n * 100).toFixed(0)}%`).join(" ")}`,
      !heightOk && `height ${h}px vs median ${median}px`,
      !bottomOk && `bottom ${s.bottom + 1}px of ${s.height}`,
    ].filter(Boolean);
    return { file: f.file, pass, line: `${pass ? "pass" : "FAIL"} ${f.file}  ${pass ? s.colors.map(([b]) => b).join(" ") : why.join("; ")}` };
  });
}

function selfTest() {
  const dir = join(tmpdir(), `mascot-check-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const paint = (img, x0, y0, x1, y1, [r, g, b]) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) img.px.set([r, g, b, 255], (y * img.width + x) * 4);
  };
  const good = blank(64, 64);
  paint(good, 16, 8, 48, 64, hex(PALETTE.green));
  paint(good, 24, 30, 40, 60, hex(PALETTE.cream));
  paint(good, 26, 14, 30, 18, hex(PALETTE.ink));
  paint(good, 28, 24, 36, 28, hex(PALETTE.blue));
  const bad = blank(64, 64);
  bad.px.set(good.px);
  paint(bad, 0, 0, 4, 4, hex(PALETTE.ink)); // an opaque corner
  paint(bad, 16, 40, 48, 50, [255, 120, 0]); // a sixth color, orange
  writePng(join(dir, "good.png"), good);
  writePng(join(dir, "bad.png"), bad);
  const [g, b] = ["good.png", "bad.png"].map((f) => frameVerdict(frameStats(readPng(join(dir, f)))));
  const ok = g.corners && g.colorsOk && !b.corners && !b.colorsOk && b.off.length === 1;
  say(`self-test: ${ok ? "pass" : "FAIL"} (synthetic frames in ${dir}: good passes, bad fails on its corner and its orange)`);
  return ok;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!selfTest()) process.exit(1);
  const root = join(process.argv[2] ?? "spikes/mascot/out", "sets");
  const sets = [];
  for (const sheet of readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory()))
    for (const set of readdirSync(join(root, sheet)).filter((d) => statSync(join(root, sheet, d)).isDirectory())) sets.push(join(sheet, set));
  if (!sets.length) {
    say(`no pose sets under ${root}`);
    process.exit(1);
  }
  for (const set of sets.sort()) {
    const files = readdirSync(join(root, set)).filter((f) => /-f\d+\.png$/.test(f)).sort();
    const frames = files.map((file) => ({ file: join(set, file), stats: frameStats(readPng(join(root, set, file))) }));
    const rows = checkSet(frames);
    for (const r of rows) say(r.line);
    say(`set ${set}: ${rows.filter((r) => r.pass).length}/${rows.length} frames pass\n`);
  }
}
