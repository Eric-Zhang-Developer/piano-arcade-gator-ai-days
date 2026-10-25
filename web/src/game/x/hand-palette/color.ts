// The color math hand-palette measures with (spec: hand-palette): sRGB, CIELAB, OKLCH, CIEDE2000, WCAG contrast and
// Machado 2009 color-vision-deficiency simulation. Pure, no DOM; every constant names where it was copied from.

export type Rgb = [number, number, number]; // 0–1
export type Lab = [number, number, number];
export type Vision = "normal" | "protan" | "deutan" | "tritan";
export const visions: Vision[] = ["normal", "protan", "deutan", "tritan"];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

export const rgbToHex = (c: Rgb): string =>
  "#" + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");

// IEC 61966-2-1 (sRGB) transfer function.
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
export const linear = (c: Rgb): Rgb => c.map(toLinear) as Rgb;
export const gamma = (c: Rgb): Rgb => c.map(toGamma) as Rgb;

const mul = (m: number[][], v: Rgb): Rgb => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as Rgb;

// Linear sRGB to XYZ, and the D65 white, as IEC 61966-2-1 gives them.
const SRGB_TO_XYZ = [
  [0.4124, 0.3576, 0.1805],
  [0.2126, 0.7152, 0.0722],
  [0.0193, 0.1192, 0.9505],
];
const D65 = [0.95047, 1, 1.08883];

export function rgbToLab(c: Rgb): Lab {
  const xyz = mul(SRGB_TO_XYZ, linear(c));
  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const [fx, fy, fz] = xyz.map((v, i) => f(v / D65[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// OKLab, from Björn Ottosson's "A perceptual color space for image processing" (bottosson.github.io/posts/oklab,
// matrices as updated 2021-01-25), on linear sRGB.
const LIN_TO_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const LMS_TO_OKLAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const OKLAB_TO_LMS = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];
const LMS_TO_LIN = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

export function rgbToOklch(c: Rgb): [number, number, number] {
  const [L, a, b] = mul(LMS_TO_OKLAB, mul(LIN_TO_LMS, linear(c)).map(Math.cbrt) as Rgb);
  return [L, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
}

// OKLCH to sRGB; null when it's outside the sRGB gamut.
export function oklchToRgb(L: number, C: number, h: number): Rgb | null {
  const r = (h * Math.PI) / 180;
  const lms = mul(OKLAB_TO_LMS, [L, C * Math.cos(r), C * Math.sin(r)]).map((v) => v ** 3) as Rgb;
  const lin = mul(LMS_TO_LIN, lms);
  if (lin.some((v) => v < -1e-6 || v > 1 + 1e-6)) return null;
  return gamma(lin.map((v) => Math.min(1, Math.max(0, v))) as Rgb);
}

/**
 * CIEDE2000 with kL = kC = kH = 1, as written out in Sharma, Wu & Dalal, "The CIEDE2000 color-difference formula:
 * implementation notes, supplementary test data, and mathematical observations", Color Res. Appl. 30(1), 2005.
 */
export function deltaE00([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) / rad) + 360) % 360);
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
    else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Cbp7 = Cbp ** 7;
  const RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

/**
 * Machado, Oliveira & Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency", IEEE TVCG
 * 15(6), 2009: the severity 1.0 rows of the authors' published table
 * (inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html), applied to linear RGB.
 */
export const MACHADO: Record<Exclude<Vision, "normal">, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export function simulate(c: Rgb, v: Vision): Rgb {
  if (v === "normal") return c;
  return gamma(mul(MACHADO[v], linear(c)).map((x) => Math.min(1, Math.max(0, x))) as Rgb);
}

// ΔE00 between two hex colors as a viewer with this vision sees them.
export const deltaE = (x: string, y: string, v: Vision = "normal"): number =>
  deltaE00(rgbToLab(simulate(hexToRgb(x), v)), rgbToLab(simulate(hexToRgb(y), v)));

// WCAG 2.x contrast ratio.
export function contrast(x: string, y: string): number {
  const lum = (h: string) => mul(SRGB_TO_XYZ, linear(hexToRgb(h)))[1];
  const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
}

// L* (CIELAB lightness) of a hex color.
export const lightness = (hex: string): number => rgbToLab(hexToRgb(hex))[0];
