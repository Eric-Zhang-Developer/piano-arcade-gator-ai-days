// The Tonnetz (spec: harmony-map): pitch class pc(x, y) = (7x + 4y) mod 12, so a step along x is a fifth, along y a
// major third, and along the (1, −1) diagonal a minor third (7 − 4 = 3). The triangles are the triads: a major one
// with its root at (x, y) is (x, y), (x+1, y), (x, y+1); a minor one is (x, y), (x+1, y), (x+1, y−1). The lattice
// repeats every (0, 3) and (4, −1), so each triad has a copy near any point; a path takes the copy nearest its last
// step. Lineage (cited in changes/harmony-map.md): Euler 1739, Riemann, Cohn's neo-Riemannian P, L and R.
export const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export const pc = (x: number, y: number) => (((7 * x + 4 * y) % 12) + 12) % 12;

export interface Triad {
  root: number; // pitch class
  minor: boolean;
}
export const triadId = (t: Triad) => t.root + (t.minor ? 12 : 0);
export const fromId = (id: number): Triad => ({ root: id % 12, minor: id >= 12 });
export const triadName = (t: Triad) => NAMES[t.root] + (t.minor ? "m" : "");
export const triadPcs = (t: Triad) => [t.root, (t.root + (t.minor ? 3 : 4)) % 12, (t.root + 7) % 12];
export const same = (a: Triad | null, b: Triad | null) => !!a && !!b && a.root === b.root && a.minor === b.minor;

export type Point = [number, number];
export const corners = ([x, y]: Point, minor: boolean): Point[] => (minor ? [[x, y], [x + 1, y], [x + 1, y - 1]] : [[x, y], [x + 1, y], [x, y + 1]]);

// The plane: x across, y up and leaning right, so every triangle is equilateral. Unit edge.
export const toPlane = ([x, y]: Point): Point => [x + y / 2, (-y * Math.sqrt(3)) / 2];
export const centroid = (root: Point, minor: boolean): Point => {
  const c = corners(root, minor).map(toPlane);
  return [(c[0][0] + c[1][0] + c[2][0]) / 3, (c[0][1] + c[1][1] + c[2][1]) / 3];
};

// The neo-Riemannian move between two triads, or null: P keeps root and fifth (C ↔ Cm), L keeps the third and fifth
// of a major chord (C ↔ Em), R keeps its root and third (C ↔ Am).
export function plr(a: Triad, b: Triad): "P" | "L" | "R" | null {
  if (a.minor === b.minor) return null;
  const [maj, min] = a.minor ? [b, a] : [a, b];
  const d = (min.root - maj.root + 12) % 12;
  return d === 0 ? "P" : d === 4 ? "L" : d === 9 ? "R" : null;
}

// The copy of a triad's root nearest a point in the plane (by its triangle's centroid).
export function nearest(t: Triad, near: Point): Point {
  const x0 = (7 * t.root) % 12; // 7 · 7 = 49 ≡ 1, so (7r, 0) has pitch class r
  let best: Point = [x0, 0];
  let bestD = Infinity;
  const [nx, ny] = near;
  // the copies (x0 + 4n, 3m − n); search a window around the point's own lattice coordinates
  const ly = Math.round((-2 * ny) / Math.sqrt(3));
  const lx = Math.round(nx - ly / 2);
  for (let n = Math.floor((lx - x0) / 4) - 3; n <= Math.floor((lx - x0) / 4) + 3; n++)
    for (let m = Math.floor((ly + n) / 3) - 3; m <= Math.floor((ly + n) / 3) + 3; m++) {
      const p: Point = [x0 + 4 * n, 3 * m - n];
      const [cx, cy] = centroid(p, t.minor);
      const d = (cx - nx) ** 2 + (cy - ny) ** 2;
      if (d < bestD - 1e-9) [best, bestD] = [p, d];
    }
  return best;
}

// The lattice point of a pitch class nearest a point in the plane.
export function nearestNode(p: number, near: Point): Point {
  const ly0 = Math.round((-2 * near[1]) / Math.sqrt(3));
  const lx0 = Math.round(near[0] - ly0 / 2);
  let best: Point = [lx0, ly0];
  let bestD = Infinity;
  for (let ly = ly0 - 4; ly <= ly0 + 4; ly++)
    for (let lx = lx0 - 5; lx <= lx0 + 5; lx++) {
      if (pc(lx, ly) !== p) continue;
      const [x, y] = toPlane([lx, ly]);
      const d = (x - near[0]) ** 2 + (y - near[1]) ** 2;
      if (d < bestD) [best, bestD] = [[lx, ly], d];
    }
  return best;
}
