// Real Keys (spec: real-keys): the plane-to-plane map from the key bed to the camera picture, by DLT on normalized
// points (Hartley), solved as an 8×8 system with h33 = 1. Plain JS: no OpenCV, no dependency.
export type Pt = [number, number];
export type H = number[]; // row-major 3×3

// Translate to the centroid and scale so the mean distance is √2: keeps the solve well conditioned in pixels.
function normalizer(pts: Pt[]): H {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const d = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / pts.length || 1;
  const k = Math.SQRT2 / d;
  return [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1];
}

const mul = (a: H, b: H): H => {
  const r = new Array<number>(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
};

export function invert(m: H): H {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!det) throw new Error("homography: singular");
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
}

export function apply(m: H, [x, y]: Pt): Pt {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

// Gaussian elimination with partial pivoting; n×n, in place.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error("homography: degenerate points");
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

// The H with apply(H, src[i]) ≈ dst[i]. Four points solve exactly; more are least squares (normal equations, still 8×8).
export function homography(src: Pt[], dst: Pt[]): H {
  if (src.length < 4 || src.length !== dst.length) throw new Error("homography: needs 4+ point pairs");
  const Ts = normalizer(src), Td = normalizer(dst);
  const s = src.map((p) => apply(Ts, p)), d = dst.map((p) => apply(Td, p));
  const rows: number[][] = [], rhs: number[] = [];
  s.forEach(([x, y], i) => {
    const [u, v] = d[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]);
    rhs.push(u, v);
  });
  const AtA = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => rows.reduce((t, r) => t + r[i] * r[j], 0)));
  const Atb = Array.from({ length: 8 }, (_, i) => rows.reduce((t, r, k) => t + r[i] * rhs[k], 0));
  const h = [...solve(AtA, Atb), 1];
  const m = mul(invert(Td), mul(h, Ts));
  return m.map((v) => v / m[8]);
}
