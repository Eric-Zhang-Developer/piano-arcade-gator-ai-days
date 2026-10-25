// The live panel (spec: harmony-map): what a player sounds now, on a fixed patch of the Tonnetz. Nodes glow in the hand
// colors (below middle C the left hand's, from it the right's: a live note carries no hand), the one triad fills, and
// each chord change leaves an edge that fades, labelled P, L or R when it's one. Only a struck key renames (decision
// jam-mode-spike-rename): a release or the pedal coming up keeps the last triangle. One canvas drawer serves /harmony
// and the /play corner. Values: specs/decisions/harmony-map-panel.md.
import { handColor } from "../../hand-colors";
import { canvasFonts } from "../../duo-tokens";
import { bg, ink, inkDim, line, secondary, primary } from "../../ui-tokens";
import { chordSettings, read, type Reading } from "./chords";
import { centroid, corners, nearest, NAMES, pc, plr, same, toPlane, triadName, type Point, type Triad } from "./tonnetz";

export const panelSettings = {
  patch: { x: [-3, 3], y: [-2, 2] }, // 7 × 5 points: every pitch class two or three times
  trailMs: 2400, // an edge fades over this
  trailMax: 6,
  splitPitch: 60, // a live note's hand: below this the left
};

interface Step {
  from: Point; // centroids
  to: Point;
  move: "P" | "L" | "R" | null;
  at: number;
}

export function liveHarmony(s = chordSettings, p = panelSettings) {
  const down = new Map<number, number>(); // pitch -> when struck
  const sustained = new Map<number, number>();
  const recent = new Map<number, number>(); // pitch -> when struck, for the window
  let pedal = false;
  let triad: Triad | null = null;
  let at: Point | null = null; // the lit triangle's root on the patch
  let reading: Reading = { pcs: [], triad: null, name: null };
  const trail: Step[] = [];
  const sounding = (t: number) => {
    for (const [k, v] of recent) if (t - v > s.liveWindowMs) recent.delete(k);
    return [...new Set([...down.keys(), ...sustained.keys(), ...recent.keys()])];
  };
  return {
    press(pitch: number, t: number) {
      down.set(pitch, t);
      sustained.delete(pitch);
      recent.set(pitch, t);
      reading = read(sounding(t), s);
      if (!reading.triad || same(reading.triad, triad)) return;
      const next = nearest(reading.triad, at ? centroid(at, triad!.minor) : [0.5, -0.3]);
      const inside = corners(next, reading.triad.minor).every(([x, y]) => x >= p.patch.x[0] && x <= p.patch.x[1] && y >= p.patch.y[0] && y <= p.patch.y[1]);
      const root = inside ? next : nearest(reading.triad, [0.5, -0.3]); // off the patch: the copy nearest its middle
      if (triad && at) trail.push({ from: centroid(at, triad.minor), to: centroid(root, reading.triad.minor), move: plr(triad, reading.triad), at: t });
      if (trail.length > p.trailMax) trail.shift();
      [triad, at] = [reading.triad, root];
    },
    release(pitch: number, t: number) {
      if (!down.delete(pitch)) return;
      if (pedal) sustained.set(pitch, t);
      reading = { ...read(sounding(t), s), triad: reading.triad }; // the nodes follow; the triangle doesn't
    },
    pedal(isDown: boolean, t: number) {
      pedal = isDown;
      if (!isDown) sustained.clear();
      reading = { ...read(sounding(t), s), triad: reading.triad };
    },
    // The nodes sounding now (the window ages out between events), the triad, the trail.
    view(t: number) {
      const pcs = new Map<number, "L" | "R">();
      for (const pitch of sounding(t)) pcs.set(((pitch % 12) + 12) % 12, pitch < p.splitPitch ? "L" : "R");
      return { pcs, triad, at, name: reading.name, trail };
    },
  };
}
export type LiveHarmony = ReturnType<typeof liveHarmony>;

// The panel in (x, y, w, h). `still`: reduced motion, so no fade: the triangle and the last edge only.
export function drawPanel(ctx: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, live: LiveHarmony, t: number, still: boolean, p = panelSettings) {
  const v = live.view(t);
  const [[xa, xb], [ya, yb]] = [p.patch.x, p.patch.y];
  const corner = [toPlane([xa, ya]), toPlane([xb, ya]), toPlane([xa, yb]), toPlane([xb, yb])];
  const minX = Math.min(...corner.map((c) => c[0])) - 0.3;
  const maxX = Math.max(...corner.map((c) => c[0])) + 0.3;
  const minY = Math.min(...corner.map((c) => c[1])) - 0.3;
  const maxY = Math.max(...corner.map((c) => c[1])) + 0.3;
  const label = Math.round(Math.max(12, box.h * 0.09));
  const top = box.y + label * 1.8;
  const u = Math.min(box.w / (maxX - minX), (box.y + box.h - top) / (maxY - minY));
  const ox = box.x + (box.w - u * (maxX - minX)) / 2 - minX * u;
  const oy = top - minY * u;
  const X = ([x, y]: Point): Point => [ox + x * u, oy + y * u];
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  // the lattice
  ctx.beginPath();
  for (let x = xa; x <= xb; x++)
    for (let y = ya; y <= yb; y++)
      for (const [dx, dy] of [[1, 0], [0, 1], [1, -1]] as Point[]) {
        const [qx, qy] = [x + dx, y + dy];
        if (qx > xb || qy > yb || qy < ya) continue;
        const [a, b] = [X(toPlane([x, y])), X(toPlane([qx, qy]))];
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
  ctx.stroke();
  // the triad
  if (v.triad && v.at) {
    const c = corners(v.at, v.triad.minor).map((q) => X(toPlane(q)));
    ctx.fillStyle = v.triad.minor ? secondary : primary;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // the trail: fading edges, P/L/R at their middles
  ctx.font = canvasFonts.data(Math.round(label * 0.85));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const shown = still ? v.trail.slice(-1) : v.trail;
  for (const st of shown) {
    const a = still ? 0.9 : Math.max(0, 1 - (t - st.at) / p.trailMs);
    if (a <= 0) continue;
    const [f, g] = [X(st.from), X(st.to)];
    ctx.globalAlpha = a;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f[0], f[1]);
    ctx.lineTo(g[0], g[1]);
    ctx.stroke();
    if (st.move) {
      ctx.fillStyle = ink;
      ctx.fillText(st.move, (f[0] + g[0]) / 2, (f[1] + g[1]) / 2 - label * 0.6);
    }
  }
  ctx.globalAlpha = 1;
  // the nodes: every point, lit in its hand's color where its pitch class sounds
  const r = Math.max(2, u * 0.07);
  for (let x = xa; x <= xb; x++)
    for (let y = ya; y <= yb; y++) {
      const [cx, cy] = X(toPlane([x, y]));
      const hand = v.pcs.get(pc(x, y));
      ctx.fillStyle = hand ? handColor(hand) : inkDim;
      ctx.beginPath();
      ctx.arc(cx, cy, hand ? r * 1.8 : r, 0, Math.PI * 2);
      ctx.fill();
      if (hand && u > 40) {
        ctx.fillStyle = ink;
        ctx.fillText(NAMES[pc(x, y)], cx, cy - r * 3.4);
      }
    }
  // the name, top left: the triad, else what the namer heard, else nothing
  ctx.textAlign = "left";
  ctx.font = canvasFonts.data(label);
  ctx.fillStyle = v.triad ? ink : inkDim;
  ctx.fillText(v.triad ? triadName(v.triad) : (v.name ?? "—"), box.x + label * 0.8, box.y + label);
  ctx.restore();
}
