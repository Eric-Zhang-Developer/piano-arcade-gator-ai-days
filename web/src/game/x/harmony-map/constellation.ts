// A song's constellation (spec: harmony-map): its triads as triangles on the Tonnetz, each sized by the beats it
// sounds, the moves between them as edges weighted by how often they're taken, the home triangle marked. Pure: the
// wall renders it on the server, /harmony in the browser, and the download is the same string.
// Values: specs/decisions/harmony-map-constellation.md.
import type { Chart } from "../../../contracts";
import type { Pedal } from "../../pedal";
import { chartReadings, chordSettings } from "./chords";
import { centroid, corners, fromId, nearest, nearestNode, pc, plr, toPlane, triadId, triadName, type Point } from "./tonnetz";

export const constellationSettings = {
  unit: 44, // px per lattice edge, the same on every song, so the wall compares them at one scale
  margin: 0.9, // lattice units of empty patch around the path
  maxReach: 3.2, // a triad further than this from home goes to the copy nearest home instead: a wrap, drawn dashed
  minEdge: 1, // an edge's width for one traversal...
  edgeGain: 1.6, // ...plus this × log2(traversals)
};

export interface Stats {
  beats: Map<number, number>; // triad id -> beats it sounds
  edges: Map<string, number>; // "a-b" (ids, a < b) -> traversals, either way
  order: number[]; // the triads in the order they change
  home: number | null;
  pcs: Set<number>; // every pitch class that sounds
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Each strike's triad holds until the next strike; a strike with no triangle adds no time and doesn't rename. Home is
// the triad with the most beats; a tie goes to the final chord.
export function stats(chart: Chart, pedal: Pedal | null, s = chordSettings): Stats {
  const rs = chartReadings(chart, pedal, s);
  const end = Math.max(...chart.notes.map((n) => n.beat + n.duration));
  const st: Stats = { beats: new Map(), edges: new Map(), order: [], home: null, pcs: new Set() };
  rs.forEach(({ beat, reading }, i) => {
    reading.pcs.forEach((p) => st.pcs.add(p));
    if (!reading.triad) return;
    const id = triadId(reading.triad);
    st.beats.set(id, (st.beats.get(id) ?? 0) + ((rs[i + 1]?.beat ?? end) - beat));
    const last = st.order[st.order.length - 1];
    if (last === id) return;
    if (last !== undefined) st.edges.set(edgeKey(last, id), (st.edges.get(edgeKey(last, id)) ?? 0) + 1);
    st.order.push(id);
  });
  let most = -1;
  const final = st.order[st.order.length - 1];
  for (const [id, b] of st.beats) if (b > most || (b === most && id === final)) [st.home, most] = [id, b];
  return st;
}

export interface Placed {
  id: number;
  root: Point;
  c: Point; // centroid, in lattice units on the plane
}

// Home at the copy nearest the origin; every other triad at the copy nearest the previous step, unless that's further
// than maxReach from home: then the copy nearest home, and the edge into it is a wrap.
export function place(st: Stats, s = constellationSettings): { at: Map<number, Placed>; steps: { from: Placed; to: Placed; wrap: boolean }[] } {
  const at = new Map<number, Placed>();
  const steps: { from: Placed; to: Placed; wrap: boolean }[] = [];
  if (st.home === null) return { at, steps };
  const put = (id: number, near: Point): Placed => {
    const t = fromId(id);
    const root = nearest(t, near);
    return { id, root, c: centroid(root, t.minor) };
  };
  const home = put(st.home, [0, 0]);
  at.set(home.id, home);
  let prev: Placed | null = null;
  for (const id of st.order) {
    let cur = at.get(id);
    let wrap = false;
    if (!cur) {
      cur = put(id, prev?.c ?? home.c);
      if (Math.hypot(cur.c[0] - home.c[0], cur.c[1] - home.c[1]) > s.maxReach) [cur, wrap] = [put(id, home.c), true];
      at.set(id, cur);
    }
    if (prev && prev.id !== id) steps.push({ from: prev, to: cur, wrap });
    prev = cur;
  }
  return { at, steps };
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const f = (n: number) => +n.toFixed(1);
// a ground-coloured outline under a label, so it reads over the edges and fills
const halo = (look: Look, k: number) => `stroke="${look.ground}" stroke-width="${f(3 * k)}" stroke-linejoin="round" paint-order="stroke"`;

export interface Look {
  ground: string;
  ink: string;
  dim: string;
  line: string;
  major: string;
  minor: string;
  home: string;
  font?: string; // set for a standalone file; inline, the text takes the page's font
}

// The SVG: the lattice patch (triangle edges and pitch-class nodes, lit where they sound), the visited triangles
// (alpha by their share of the time), the edges between them (width by traversals, dashed for a wrap, P/L/R where the
// move is one), chord names, and home in a bracket. Sized in em (16 px each at 16 px type), so inline it scales with
// the page's type at every width and every song keeps the same scale; a standalone file reads em as 16 px. `title` goes in <title> for the download and screen readers.
export function constellationSvg(st: Stats, look: Look, title: string, s = constellationSettings): string {
  const { at, steps } = place(st, s);
  // the patch holds the path; with no triad at all, each sounding pitch class's node nearest the middle, so a melody
  // still shows what it touches
  const pts = [...at.values()].flatMap((p) => corners(p.root, fromId(p.id).minor).map(toPlane));
  if (!pts.length) for (const p of st.pcs) pts.push(toPlane(nearestNode(p, [0.5, -0.3])));
  if (!pts.length) pts.push([0, 0], [1, 0]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs) - s.margin, Math.max(...xs) + s.margin, Math.min(...ys) - s.margin, Math.max(...ys) + s.margin];
  const u = s.unit;
  const k = u / 44; // type, dots and strokes grow with the unit, so a bigger drawing is the same drawing
  const X = (x: number) => f((x - x0) * u);
  const Y = (y: number) => f((y - y0) * u);
  const out: string[] = [];
  // the patch: every lattice point whose plane position falls inside, and the three edge directions from each
  const h = Math.sqrt(3) / 2;
  const nodes: [Point, Point][] = [];
  for (let ly = Math.floor(-y1 / h) - 1; ly <= Math.ceil(-y0 / h) + 1; ly++)
    for (let lx = Math.floor(x0 - ly / 2) - 1; lx <= Math.ceil(x1 - ly / 2) + 1; lx++) {
      const p = toPlane([lx, ly]);
      if (p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) nodes.push([[lx, ly], p]);
    }
  for (const [[lx, ly], p] of nodes)
    for (const q of [toPlane([lx + 1, ly]), toPlane([lx, ly + 1]), toPlane([lx + 1, ly - 1])])
      if (q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1) out.push(`<line x1="${X(p[0])}" y1="${Y(p[1])}" x2="${X(q[0])}" y2="${Y(q[1])}" stroke="${look.line}" stroke-width="${f(k)}"/>`);
  const total = [...st.beats.values()].reduce((a, b) => a + b, 0) || 1;
  const top = Math.max(...st.beats.values(), 0) || 1;
  for (const p of at.values()) {
    const t = fromId(p.id);
    const c = corners(p.root, t.minor).map(toPlane);
    const share = (st.beats.get(p.id) ?? 0) / top;
    out.push(`<polygon points="${c.map((q) => `${X(q[0])},${Y(q[1])}`).join(" ")}" fill="${t.minor ? look.minor : look.major}" fill-opacity="${(0.18 + 0.72 * Math.sqrt(share)).toFixed(2)}"><title>${esc(triadName(t))}: ${f((100 * (st.beats.get(p.id) ?? 0)) / total)}% of the time</title></polygon>`);
  }
  for (const { from, to, wrap } of steps.filter((v, i, a) => a.findIndex((w) => edgeKey(w.from.id, w.to.id) === edgeKey(v.from.id, v.to.id)) === i)) {
    const n = st.edges.get(edgeKey(from.id, to.id)) ?? 1;
    const w = (s.minEdge + s.edgeGain * Math.log2(n)) * k;
    out.push(`<line x1="${X(from.c[0])}" y1="${Y(from.c[1])}" x2="${X(to.c[0])}" y2="${Y(to.c[1])}" stroke="${look.ink}" stroke-width="${f(w)}" stroke-linecap="round"${wrap ? ' stroke-dasharray="3 5"' : ""}><title>${n}×</title></line>`);
    const move = plr(fromId(from.id), fromId(to.id));
    // P, L or R beside the edge's middle, off to one side, so it never sits on a chord name
    const [dx, dy] = [to.c[0] - from.c[0], to.c[1] - from.c[1]];
    const len = Math.hypot(dx, dy) || 1;
    const [mx, my] = [(from.c[0] + to.c[0]) / 2 - (dy / len) * 0.22, (from.c[1] + to.c[1]) / 2 + (dx / len) * 0.22];
    if (move && !wrap) out.push(`<text x="${X(mx)}" y="${f(Y(my) + 3.5 * k)}" fill="${look.dim}" font-size="${f(10 * k)}" text-anchor="middle" ${halo(look, k)}>${move}</text>`);
  }
  for (const [[lx, ly], p] of nodes) {
    const lit = st.pcs.has(pc(lx, ly));
    out.push(`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="${f((lit ? 2.6 : 1.6) * k)}" fill="${lit ? look.ink : look.dim}"/>`);
  }
  for (const p of at.values()) {
    const t = fromId(p.id);
    // every visited triangle is named; the ones heard a quarter as long as the most-heard, smaller and dimmer
    const strong = (st.beats.get(p.id) ?? 0) / top > 0.25 || p.id === st.home;
    out.push(`<text x="${X(p.c[0])}" y="${f(Y(p.c[1]) + (strong ? 4 : 3) * k)}" fill="${strong ? look.ink : look.dim}" font-size="${f((strong ? 11 : 8.5) * k)}" font-weight="700" text-anchor="middle" ${halo(look, k)}>${esc(triadName(t))}</text>`);
  }
  if (st.home !== null) {
    const p = at.get(st.home)!;
    const c = corners(p.root, fromId(p.id).minor).map(toPlane);
    out.push(`<polygon points="${c.map((q) => `${X(q[0])},${Y(q[1])}`).join(" ")}" fill="none" stroke="${look.home}" stroke-width="${f(2.5 * k)}"><title>home: ${esc(triadName(fromId(p.id)))}</title></polygon>`);
  }
  const W = f((x1 - x0) * u);
  const H = f((y1 - y0) * u);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${f(W / 16)}em" height="${f(H / 16)}em" ${look.font ? ` font-family="${esc(look.font)}"` : ""} role="img"><title>${esc(title)}</title><rect width="${W}" height="${H}" fill="${look.ground}"/>${out.join("")}</svg>`;
}
