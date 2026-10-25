// Pinned's STL export (spec: pinned), pure: the cylinder, its pins and the comb as closed shells, written as binary
// STL with no dependency. Sizes are in millimetres (decision pinned-model).
import { toothLengths, type Pinned } from "./cylinder";

export type V3 = [number, number, number];
export type Tri = [V3, V3, V3];
export type Shell = Tri[];

export const modelSettings = {
  drumRadius: 12,
  drumSides: 64,
  pinRadius: 0.4,
  pinHeight: 1,
  pinSides: 8,
  toothPitch: 1.6, // centre to centre along the drum's axis
  margin: 3, // drum length past the outer teeth, each end
  combGap: 0.4, // between a tooth tip and the pins' reach
  toothWidth: 1.2,
  toothThick: 0.6,
  longestTooth: 22,
  baseDepth: 6,
  triangleCap: 200_000,
};

// A prism over a convex polygon (counter-clockwise in its own u, v), from w0 to w1 along its axis. One closed shell:
// the walls, and both caps fanned from their centres. `place` maps (u, v, w) into the model.
function prism(poly: [number, number][], w0: number, w1: number, place: (u: number, v: number, w: number) => V3): Shell {
  const n = poly.length;
  const lo = poly.map(([u, v]) => place(u, v, w0));
  const hi = poly.map(([u, v]) => place(u, v, w1));
  const c = poly.reduce(([a, b], [u, v]) => [a + u / n, b + v / n], [0, 0]);
  const [cLo, cHi] = [place(c[0], c[1], w0), place(c[0], c[1], w1)];
  const tris: Shell = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push([lo[i], lo[j], hi[j]], [lo[i], hi[j], hi[i]]); // walls, facing out
    tris.push([cLo, lo[j], lo[i]]); // bottom cap, facing −w
    tris.push([cHi, hi[i], hi[j]]); // top cap, facing +w
  }
  // A left-handed placement turns the shell inside out: flip it so every normal faces out.
  return signedVolume(tris) < 0 ? tris.map(([a, b, c]) => [a, c, b]) : tris;
}

// Positive for a closed shell whose triangles wind counter-clockwise seen from outside.
export const signedVolume = (shell: Shell) =>
  shell.reduce((sum, [a, b, c]) => sum + (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6, 0);

const ring = (r: number, sides: number): [number, number][] => Array.from({ length: sides }, (_, i) => [r * Math.cos((2 * Math.PI * i) / sides), r * Math.sin((2 * Math.PI * i) / sides)]);
const rect = (w: number, h: number): [number, number][] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];

// The drum's axis is x; the comb sits along −y, its teeth reaching up toward the pins at angle 0 (the pluck point).
export function model(p: Pinned): Shell[] {
  const s = modelSettings;
  const span = Math.max(1, p.teeth.length) * s.toothPitch;
  const x0 = -span / 2;
  const toothX = (i: number) => x0 + (i + 0.5) * s.toothPitch;
  const shells: Shell[] = [prism(ring(s.drumRadius, s.drumSides), x0 - s.margin, x0 + span + s.margin, (u, v, w) => [w, u, v])];
  // Each pin stands radially out of the drum at its angle, its foot on the drum's surface: a separate closed shell.
  for (const pin of p.pins) {
    const a = (pin.angleDeg * Math.PI) / 180;
    const [ry, rz] = [-Math.cos(a), Math.sin(a)]; // angle 0 points down at the comb
    const [ty, tz] = [-rz, ry]; // the tangent, round the drum
    const x = toothX(pin.tooth);
    shells.push(
      prism(ring(s.pinRadius, s.pinSides), s.drumRadius, s.drumRadius + s.pinHeight, (u, v, w) => [x + u, w * ry + v * ty, w * rz + v * tz]),
    );
  }
  // The comb: a base bar under the drum; per pitch a free tooth of its own length, its tip just inside the pins'
  // reach, and under a shorter tooth a root block that carries it up, as a real comb's stepped base does. Each part
  // is its own closed shell.
  const tip = -(s.drumRadius + s.pinHeight - s.combGap);
  const baseTop = tip - s.longestTooth;
  shells.push(prism(rect(span + 2, s.toothThick * 2), baseTop - s.baseDepth, baseTop, (u, v, w) => [u, w, v]));
  toothLengths(p.teeth, s.longestTooth).forEach((len, i) => {
    const at = (u: number, v: number, w: number): V3 => [toothX(i) + u, w, v];
    shells.push(prism(rect(s.toothWidth, s.toothThick), tip - len, tip, at));
    if (tip - len - baseTop > 1e-6) shells.push(prism(rect(s.toothPitch * 0.95, s.toothThick * 2), baseTop, tip - len, at));
  });
  return shells;
}

export const triangleCount = (shells: Shell[]) => shells.reduce((n, s) => n + s.length, 0);

// Binary STL: an 80-byte header, a uint32 count, then 50 bytes a triangle (normal, three vertices, attribute 0).
export function writeStl(shells: Shell[], name = "pinned"): ArrayBuffer {
  const count = triangleCount(shells);
  if (count > modelSettings.triangleCap) throw new Error(`${count} triangles is over the cap of ${modelSettings.triangleCap}`);
  const buf = new ArrayBuffer(84 + 50 * count);
  const dv = new DataView(buf);
  const header = `binary STL: ${name}, a model, not fitted to a commercial movement`.slice(0, 80);
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i) & 0x7f);
  dv.setUint32(80, count, true);
  let o = 84;
  for (const [a, b, c] of shells.flat()) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...nrm) || 1;
    for (const x of [...nrm.map((k) => k / len), ...a, ...b, ...c]) {
      dv.setFloat32(o, x, true);
      o += 4;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}

export function readStl(buf: ArrayBuffer): { count: number; tris: Tri[] } {
  const dv = new DataView(buf);
  const count = dv.getUint32(80, true);
  if (buf.byteLength !== 84 + 50 * count) throw new Error(`a binary STL of ${count} triangles is ${84 + 50 * count} bytes, not ${buf.byteLength}`);
  const tris: Tri[] = [];
  for (let t = 0, o = 84; t < count; t++, o += 50) {
    const at = (k: number): V3 => [dv.getFloat32(o + 12 + k * 12, true), dv.getFloat32(o + 16 + k * 12, true), dv.getFloat32(o + 20 + k * 12, true)];
    tris.push([at(0), at(1), at(2)]);
  }
  return { count, tris };
}
