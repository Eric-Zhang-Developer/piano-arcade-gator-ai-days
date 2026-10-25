import type { InkSignal } from './signal';
import type { Rect } from './zones';

/* The ink is the tutor's way of being in the room: one body of ink in water, never a face or a pet
   (.claude/context/ink-tutor/principles.md). A dense core, low-alpha veils and hairline filaments, all carried by one
   current. MC is the body's centre: it trails the pointer, rests at the page's perch when the pointer is idle, and
   wanders the open space when there is neither. It pools beside its line to speak and knots on a mistake. */

export type Point = { x: number; y: number };
type State = 'rest' | 'gather' | 'speak' | 'burst' | 'core';
type Strand = { knot: boolean; rank: number; x: number; y: number; vx: number; vy: number; tr: Float32Array; hi: number; len: number; k: number;
  dead: boolean; race: number; w: number; a: number; crisp: boolean; u: number; u2: number; ph: number; sp: number; off: number; dir: number };
type Bloom = { x: number; y: number; r: number; t0: number; grow: number; life: number; seed: number };
type Physics = { R: number; k: number; rel: number; amp: number; sw: number; rise: number; sc: number; fz: number; rot: number };

export type InkEngine = {
  /** The viewport changed size. */
  resize(): void;
  /** The quiet fields on screen: ink dims over them and its dense marks stay out. */
  setZones(zones: Rect[]): void;
  /** Where the ink rests while the pointer is idle, or null when the page has no perch. */
  setPerch(perch: Point | null): void;
  /** The pointer's position, or null once it leaves or is a finger. */
  setPointer(pointer: Point | null): void;
  /** A point the ink must follow closely (the guided entry), or null to let it go. */
  setGuide(guide: Point | null): void;
  setColour(colour: string): void;
  setReduced(reduced: boolean): void;
  /** Runs or pauses the loop (the tab is hidden). */
  setRunning(running: boolean): void;
  cue(signal: InkSignal): void;
  clearLine(): void;
  destroy(): void;
};

const N = 320, TL = 40, SAMP = 3, TAU = Math.PI * 2;
/** How long after its last move the pointer still leads the ink. */
const POINTER_IDLE = 3.5;
/** How far behind the pointer the core trails, so the student's cursor is never inside it. */
const TRAIL = 64;
/** Fastest the body travels, px a frame: drifting after the pointer, pulled to its line or knot, and led on a guided entry
 *  (which must keep up with a flight of about a second across the map). */
const MAX_DRIFT = 9, MAX_PULL = 13, MAX_GUIDED = 20;
const KNOT_SPAN = 18;
/** Fields: the gap a mark keeps from one, how far the dimming feathers out, and how much ink it takes away there. */
const GAP = 24, FEATHER = 48, DIM = .8;
const ACT: Record<State, (m: number) => number> = { rest: m => 170 + 110 * m, gather: () => 290, speak: () => 300, burst: () => N, core: () => 260 };
const VIS: Record<State, number> = { rest: 30, gather: 18, speak: 22, burst: 26, core: 10 };
const AM: Record<State, number> = { rest: .8, gather: .9, speak: 1, burst: 1, core: 1.2 };
const LAYERS = [[1, .045], [.78, .05], [.56, .06], [.36, .08], [.2, .12]] as const;
const VEIL = [[1, .03], [.66, .04], [.38, .055]] as const;
/** Light ink on the dark learning ground needs a stronger wash than the mockup's dark ink on gesso to read as a body. */
const WASH = 1.8;
const CH = [.3, .6, 1] as const;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** The ink holds long enough to read the line after it bleeds in: about 60ms a character on a 2s floor. */
const holdMs = (text: string) => 2000 + 60 * text.length;

export function createInkEngine(cv: HTMLCanvasElement, line: HTMLElement): InkEngine {
  const cx = cv.getContext('2d');
  const mask = document.createElement('canvas'), mx = mask.getContext('2d');
  const rand = Math.random;
  let W = 0, H = 0, DPR = 1, T = 0, ST: State = 'rest', stT0 = 0, m = .12, tight = 0, talkUntil = 0, streak = 0, visCur = 26;
  let MC: Point | null = null, ROUTE: Point[] = [], destT = 0, moveUntil = 0, nextDrop = 2.5, FZ = 0, Rcur = 100, veilR = 52, spin = 1;
  let SP: Point = { x: 0, y: 0 }, TR: DOMRect | null = null, Cc: Point = { x: 0, y: 0 }, KN: Point = { x: 0, y: 0 };
  const MV = { x: 0, y: 0 };
  let blooms: Bloom[] = [], reduced = false, running = false, raf = 0, last = 0, colour = '#e2e6f0';
  let pages: Rect[] = [], pagesKey = '', Z: Rect[] = [], zKey = '';
  let perch: Point | null = null, guide: Point | null = null, pointer: Point | null = null, pointerT = -1e9;
  const lead = { x: 1, y: 0 };
  let seq = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  const S: Strand[] = [];
  {
    const ranks = [...Array(N).keys()];
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ranks[i], ranks[j]] = [ranks[j], ranks[i]]; }
    for (let i = 0; i < N; i++) {
      const knot = i < 6, r = rand();
      const w = knot ? 1.4 + rand() * .8 : r < .7 ? .45 + rand() * .45 : r < .93 ? 1 + rand() * .7 : 2 + rand() * 1.4;
      // u is the strand's place in the body: squared, so most strands crowd the core and a few roam as filaments.
      S.push({ knot, rank: ranks[i], x: 0, y: 0, vx: 0, vy: 0, tr: new Float32Array(TL * 2), hi: 0, len: 0, k: 0, dead: true, race: 0,
        w, a: knot ? .9 : .2 + rand() * .45, crisp: !knot && rand() < .07, u: knot ? rand() : rand() ** 1.7, u2: rand(),
        ph: rand() * TAU, sp: .6 + rand() * .8, off: rand(), dir: rand() < .5 ? -1 : 1 });
    }
  }

  /* ---------- the current: gradient noise in x, y and time; the field is its curl, so the water swirls and folds but
     never piles ink up ---------- */
  const PERM = new Uint8Array(512);
  {
    const p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  }
  const q5 = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number, z: number) => { const g = h & 15, u = g < 8 ? x : y, v = g < 4 ? y : g === 12 || g === 14 ? x : z; return (g & 1 ? -u : u) + (g & 2 ? -v : v); };
  function noise3(x: number, y: number, z: number) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), X = xi & 255, Y = yi & 255, Zc = zi & 255;
    x -= xi; y -= yi; z -= zi;
    const u = q5(x), v = q5(y), w = q5(z);
    const a = PERM[X] + Y, aa = PERM[a] + Zc, ab = PERM[a + 1] + Zc, b = PERM[X + 1] + Y, ba = PERM[b] + Zc, bb = PERM[b + 1] + Zc;
    return lerp(
      lerp(lerp(grad(PERM[aa], x, y, z), grad(PERM[ba], x - 1, y, z), u), lerp(grad(PERM[ab], x, y - 1, z), grad(PERM[bb], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(PERM[aa + 1], x, y, z - 1), grad(PERM[ba + 1], x - 1, y, z - 1), u), lerp(grad(PERM[ab + 1], x, y - 1, z - 1), grad(PERM[bb + 1], x - 1, y - 1, z - 1), u), v), w);
  }
  const psi = (x: number, y: number, z: number) => noise3(x, y, z) + .45 * noise3(x * 2.3 + 31.7, y * 2.3 - 11.3, z * 1.7 + 5.1);
  function curl(x: number, y: number, sc: number, z: number): [number, number] {
    const e = .3, X = x * sc, Y = y * sc;
    return [(psi(X, Y + e, z) - psi(X, Y - e, z)) / (2 * e), (psi(X - e, Y, z) - psi(X + e, Y, z)) / (2 * e)];
  }
  /* how the body behaves in each state: R its size, k its pull home, rel how hard the water drags, amp the current,
     sw the swirl around the core, rise the plume, sc the current's scale, fz how fast the current changes */
  function phys(tS: number, talk: number): Physics {
    const mn = Math.min(W, H);
    switch (ST) {
      case 'gather': return { R: 30, k: .0065, rel: .07, amp: 1, sw: 1.8, rise: .2, sc: .003, fz: .2, rot: .4 };
      case 'speak': return { R: 44 * (1 + .12 * Math.sin(T * 2.4) + .35 * talk), k: .007, rel: .08, amp: .9, sw: 1.3, rise: .3, sc: .003, fz: .16, rot: .25 };
      case 'burst': return tS < .5 ? { R: mn * .22, k: 0, rel: .012, amp: 1.5, sw: 0, rise: 0, sc: .0028, fz: .4, rot: .1 }
        : { R: mn * .22, k: .0022, rel: .035, amp: 1.8, sw: 1, rise: .4, sc: .0028, fz: .3, rot: .1 };
      case 'core': return { R: 8 + 30 * (1 - tight), k: .03, rel: .2, amp: .6, sw: 4.5, rise: 0, sc: .004, fz: .3, rot: 1.2 };
      // Smaller than the mockup's rest body: here it shares the screen with a whole activity, not a mock screen.
      default: return { R: mn * .12, k: .003, rel: .05, amp: 1 + .5 * m, sw: 1.3, rise: .18, sc: .006, fz: .16, rot: .3 };
    }
  }

  /* ---------- quiet fields ---------- */
  const clearAt = (x: number, y: number, r: number) => Z.every(z => x + r + GAP <= z.l || x - r - GAP >= z.r || y + r + GAP <= z.t || y - r - GAP >= z.b);
  const rectClear = (l: number, t: number, r: number, b: number) => Z.every(z => r + GAP <= z.l || l - GAP >= z.r || b + GAP <= z.t || t - GAP >= z.b);
  /** The nearest on-screen spot beside the fields for a mark of radius r, or null when there is none. */
  function hub(x: number, y: number, r: number): Point | null {
    if (clearAt(x, y, r)) return { x, y };
    const d = r + GAP + 1; let best: Point | null = null, bd = Infinity;
    for (const z of Z) for (const [px, py] of [[z.l - d, y], [z.r + d, y], [x, z.t - d], [x, z.b + d]]) {
      const dist = Math.hypot(px - x, py - y);
      if (dist < bd && px >= 0 && px <= W && py >= 0 && py <= H && clearAt(px, py, r)) { best = { x: px, y: py }; bd = dist; }
    }
    return best;
  }
  function buildMask() {
    const key = cv.width + 'x' + cv.height + ':' + Z.map(z => [z.l, z.t, z.r, z.b].map(Math.round).join()).join(';');
    if (key === zKey || !mx) return;
    zKey = key; mask.width = cv.width; mask.height = cv.height;
    if (!mask.width || !mask.height) return;
    // Only the blurred shadow lands on the mask, the shape itself is drawn off to the left, so a field has no edge.
    const f = FEATHER / 2, off = mask.width + 6 * FEATHER * DPR;
    mx.clearRect(0, 0, mask.width, mask.height);
    mx.fillStyle = mx.shadowColor = '#000'; mx.shadowBlur = FEATHER * DPR; mx.shadowOffsetX = off;
    for (const z of Z) mx.fillRect((z.l - f) * DPR - off, (z.t - f) * DPR, (z.r - z.l + 2 * f) * DPR, (z.b - z.t + 2 * f) * DPR);
  }
  function measure() {
    TR = line.textContent ? line.getBoundingClientRect() : null;
    Z = TR ? [...pages, { l: TR.left - 16, t: TR.top - 16, r: TR.right + 16, b: TR.bottom + 16 }] : pages;
    buildMask();
    if (!W || !H) return;
    if (!MC) MC = (perch && hub(perch.x, perch.y, 20)) || hub(W * .1, H * .42, 40) || { x: W * .1, y: H * .42 };
    // The body pools beside its line to speak: on the left of it, or on the right when the line is at the left edge.
    if (TR) { const left = TR.left > 90, sp = { x: left ? TR.left - 60 : TR.right + 60, y: TR.top + TR.height / 2 }; SP = hub(sp.x, sp.y, 30) || sp; }
    KN = hub(MC.x, MC.y, 8) || { x: MC.x, y: MC.y };
  }

  /* ---------- the line: placed once, in open water near the ink, so it never covers what the student reads ---------- */
  function placeLine() {
    line.style.left = '0px'; line.style.top = '0px';
    const w = line.offsetWidth, h = line.offsetHeight, near = MC ?? { x: W / 2, y: H / 2 };
    Z = pages;
    let best: Point | null = null, bd = Infinity;
    for (let y = 72; y + h <= H - 24; y += 24) for (let x = 24; x + w <= W - 24; x += 32) {
      if (!rectClear(x - 80, y, x + w, y + h) && !rectClear(x, y, x + w + 80, y + h)) continue;
      const d = Math.hypot(x + w / 2 - near.x, y + h / 2 - near.y);
      if (d < bd) { best = { x, y }; bd = d; }
    }
    // Nowhere open: the foot of the screen, on a ground of its own so it still reads over the page.
    line.dataset.crowded = String(!best);
    const at = best ?? { x: 24, y: H - h - 24 };
    line.style.left = `${Math.round(at.x)}px`; line.style.top = `${Math.round(at.y)}px`;
    measure();
  }
  /** Places the line before it shows, so the ink can gather at the right spot a beat before the words appear. */
  function prepareLine(text: string) {
    line.textContent = text; line.dataset.pending = ''; delete line.dataset.writing;
    placeLine();
  }
  function showLine(text: string) {
    if (line.textContent !== text) prepareLine(text);
    // Restart the bleed-in for each new line.
    delete line.dataset.pending; void line.offsetWidth; line.dataset.writing = '';
    talkUntil = T + Math.min(holdMs(text) / 1000 - .6, .5 + .035 * text.length);
  }

  /* ---------- migration ---------- */
  function segClear(a: Point, b: Point, r: number) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 16);
    for (let i = 1; i <= n; i++) if (!clearAt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, r)) return false;
    return true;
  }
  function openSpot(r: number): Point | null {
    for (let i = 0; i < 30; i++) { const p = { x: W * (.04 + rand() * .92), y: H * (.08 + rand() * .84) }; if (clearAt(p.x, p.y, r)) return p; }
    return null;
  }
  /** With no pointer and no perch, the body wanders: a visibility graph over a handful of open spots, so it goes
   *  around a field, not just past one corner. */
  function planRoute(near?: [number, number]) {
    if (!MC) return;
    destT = T + 9 + rand() * 6; ROUTE = [];
    const [lo, hi] = near ?? [200, Math.max(W, H) * .8], nodes = [MC];
    for (let i = 0; i < 26; i++) { const p = openSpot(36); if (p) nodes.push(p); }
    const order = nodes.slice(1).map((p, i) => [i + 1, Math.hypot(p.x - MC!.x, p.y - MC!.y)]).filter(([, d]) => d > lo && d < hi).sort(() => rand() - .5);
    const seen = new Map<number, boolean>();
    const edge = (a: number, b: number) => { const k = a < b ? a * 64 + b : b * 64 + a; if (!seen.has(k)) seen.set(k, segClear(nodes[a], nodes[b], 12)); return seen.get(k); };
    for (const [goal] of order.slice(0, 4)) {
      const prev = new Int16Array(nodes.length).fill(-1); prev[0] = 0; const q = [0];
      while (q.length && prev[goal] < 0) { const a = q.shift()!; for (let b = 1; b < nodes.length; b++) if (prev[b] < 0 && edge(a, b)) { prev[b] = a; q.push(b); } }
      if (prev[goal] < 0) continue;
      for (let b = goal; b !== 0; b = prev[b]) ROUTE.unshift(nodes[b]);
      // It lingers a few seconds where it lands before it sets off again.
      let len = 0, a = MC; for (const w of ROUTE) { len += Math.hypot(w.x - a.x, w.y - a.y); a = w; }
      destT = T + len / 40 + 3 + rand() * 4;
      return;
    }
    // Boxed in: wander inside its own patch of space.
    const h = hub(MC.x + (rand() - .5) * 160, MC.y + (rand() - .5) * 160, 30);
    if (h) ROUTE = [h]; destT = T + 3;
  }
  /** A spring toward a point: it lags, leans a little past, and settles, so the ink drifts after its lead. Its speed is
   *  capped: a flick across the screen stretches the body into streamers instead of firing it off as one straight line. */
  function spring(to: Point, k: number, dt: number) {
    MV.x += ((to.x - MC!.x) * k - MV.x * 2 * Math.sqrt(k) * .88) * dt;
    MV.y += ((to.y - MC!.y) * k - MV.y * 2 * Math.sqrt(k) * .88) * dt;
    const v = Math.hypot(MV.x, MV.y);
    if (v > MAX_DRIFT) { MV.x *= MAX_DRIFT / v; MV.y *= MAX_DRIFT / v; }
  }
  function moveMass(dt: number, still: boolean) {
    if (!MC) return;
    const tg = guide ?? (ST === 'gather' || ST === 'speak' ? SP : ST === 'core' ? Cc : null);
    const rest = perch && (hub(perch.x, perch.y, 20) ?? perch);
    if (still) { const to = tg ?? rest; if (to) { MC.x = to.x; MC.y = to.y; } return; }
    if (tg) {
      const e = 1 - Math.pow(1 - (guide ? .3 : ST === 'core' ? .14 : ST === 'gather' ? .09 : .05), dt);
      const dx = (tg.x - MC.x) * e, dy = (tg.y - MC.y) * e, d = Math.hypot(dx, dy), cap = (guide ? MAX_GUIDED : MAX_PULL) * dt;
      MC.x += d > cap ? dx * cap / d : dx; MC.y += d > cap ? dy * cap / d : dy; MV.x = MV.y = 0; ROUTE = []; destT = 0; return;
    }
    if (ST === 'burst') return;
    const led = pointer && T - pointerT < POINTER_IDLE;
    if (T < moveUntil || (!led && !rest)) {
      if (T > destT) planRoute();
      const w = ROUTE[0];
      if (!w) { MV.x *= Math.pow(.96, dt); MV.y *= Math.pow(.96, dt); }
      else {
        const dx = w.x - MC.x, dy = w.y - MC.y, d = Math.hypot(dx, dy) || 1;
        if (d < 24) ROUTE.shift();
        const sp = (T < moveUntil ? 2.4 : .8) * Math.min(1, d / 90 + .3);
        MV.x += (dx / d * sp - MV.x) * .025 * dt; MV.y += (dy / d * sp - MV.y) * .025 * dt;
      }
    } else if (led) {
      const p = { x: pointer!.x - lead.x * TRAIL, y: pointer!.y - lead.y * TRAIL };
      spring(hub(p.x, p.y, 24) ?? p, .0018, dt);
    } else spring(rest!, .0008, dt);
    // The current carries the body too, so even its path meanders.
    const [fx, fy] = curl(MC.x, MC.y, .0016, FZ * .5 + 40);
    MC.x += (MV.x + fx * .3) * dt; MC.y += (MV.y + fy * .3) * dt;
    // A screen change can land a field on it: it slides out to the nearest clear spot. Not while it follows the pointer:
    // its target is already clear, and crossing a label on the way (dimmed there) beats getting stuck at the label's edge.
    if (!led && !clearAt(MC.x, MC.y, 20)) { const h = hub(MC.x, MC.y, 20); if (h) { const e = Math.min(1, .05 * dt); MC.x += (h.x - MC.x) * e; MC.y += (h.y - MC.y) * e; } }
    MC.x = clamp(MC.x, 24, W - 24); MC.y = clamp(MC.y, 24, H - 24);
  }
  /** Every few seconds a drop lands in open water and blooms; outer filaments leave the body for it, then race home. */
  function drop() {
    if (!MC || ST === 'core' || ST === 'burst' || guide) { nextDrop = T + 1; return; }
    nextDrop = T + 2.6 + rand() * 3.2;
    for (let i = 0; i < 16; i++) {
      const a = rand() * TAU, d = 130 + rand() * 300, x = MC.x + Math.cos(a) * d, y = MC.y + Math.sin(a) * d, r = 9 + rand() * 18;
      if (x < 20 || x > W - 20 || y < 20 || y > H - 20 || !clearAt(x, y, r * 1.3)) continue;
      addBloom(x, y, r);
      const act = ACT[ST](m); let n = 0;
      for (const s of S) {
        if (s.knot || s.rank >= act || s.u < .4 || rand() > .3) continue;
        s.x = x + (rand() - .5) * r; s.y = y + (rand() - .5) * r; s.len = 0; s.race = T + 1.8;
        const b = rand() * TAU, v = 1 + rand() * 3; s.vx = Math.cos(b) * v; s.vy = Math.sin(b) * v;
        if (++n >= 14) break;
      }
      return;
    }
  }
  function step(dt: number, still: boolean) {
    const tS = T - stT0, act = ACT[ST](m);
    if (ST === 'core') tight = Math.min(1, tight + dt / 40);
    const talk = !still && ST === 'speak' && T < talkUntil ? (Math.sin(T * 13) * .5 + .5) * (.6 + .4 * Math.sin(T * 4.1)) : 0;
    moveMass(dt, still);
    if (!MC) return;
    if (!still && T > nextDrop) drop();
    const p = guide ? { ...phys(tS, talk), R: 30, k: .0065, rel: .07 } : phys(tS, talk), e = Math.min(1, .06 * dt);
    FZ += p.fz * dt / 60;
    Rcur += (p.R - Rcur) * e;
    veilR += ((ST === 'core' ? 14 + 18 * (1 - tight) : ST === 'speak' ? p.R * 1.05 : ST === 'gather' || guide ? 30 : 46) - veilR) * e;
    // The swirl turns over every half minute or so, so the body never settles into one spin.
    spin = Math.sin(T * .21 + 1.3) * .7 + Math.sin(T * .07) * .3;
    KN = hub(MC.x, MC.y, 8) || { x: MC.x, y: MC.y };
    // Speaking: a few strands reach toward the words and stop short of them.
    const tip = TR && ST === 'speak' ? { x: SP.x < TR.left ? TR.left - GAP : TR.right + GAP, y: TR.top + TR.height / 2, h: Math.max(14, TR.height) } : null;
    const R = Rcur, R2 = R * R * 1.4 + 1;
    for (const s of S) {
      if (!s.knot && s.rank >= act) { if (s.len > 0) s.len--; else s.dead = true; continue; }
      // A strand coming back to life starts in the core, so new filaments always grow out of the body.
      if (s.dead) { s.dead = false; s.x = MC.x + (rand() - .5) * 8; s.y = MC.y + (rand() - .5) * 8; s.vx = s.vy = 0; s.len = 0; }
      let hx: number, hy: number, kk: number, rel = p.rel;
      if (s.knot) {
        const a = s.ph + T * 3 * s.dir; hx = KN.x + Math.cos(a) * 3 * s.u; hy = KN.y + Math.sin(a) * 3 * s.u; kk = .09; rel = .3;
      } else if (tip && s.u2 < .22) {
        const f = .25 + .75 * s.off * (.75 + .25 * Math.sin(T * 1.7 + s.ph));
        hx = lerp(MC.x, tip.x, f); hy = lerp(MC.y, tip.y + (s.u - .5) * tip.h, f) + Math.sin(T * 2 + s.ph) * 6; kk = .01;
      } else {
        const a = s.ph + T * p.rot * s.dir * s.sp, rr = s.u * R * (.8 + .35 * Math.sin(T * .37 * s.sp + s.ph * 3));
        hx = MC.x + Math.cos(a) * rr; hy = MC.y + Math.sin(a) * rr * .85;
        kk = p.k * (.35 + 1.3 * (1 - s.u));
      }
      if (s.race > T) { kk += .0028; rel = Math.min(rel, .05); }
      const [fx, fy] = curl(s.x, s.y, p.sc, FZ);
      const dx = s.x - MC.x, dy = s.y - MC.y, r2 = dx * dx + dy * dy, g = Math.exp(-r2 / R2), r = Math.sqrt(r2) + 1;
      const tvx = fx * p.amp - dy / r * p.sw * g * spin, tvy = fy * p.amp + dx / r * p.sw * g * spin - p.rise * g;
      s.vx += ((tvx - s.vx) * rel + (hx - s.x) * kk) * dt;
      s.vy += ((tvy - s.vy) * rel + (hy - s.y) * kk) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      // The head point follows the strand every frame; a new point is laid down every SAMP frames.
      if (s.k === 0 || s.len < 2) { s.hi = (s.hi + 1) % TL; if (s.len < TL) s.len++; }
      const h = (s.hi - 1 + TL) % TL; s.tr[h * 2] = s.x; s.tr[h * 2 + 1] = s.y; s.k = (s.k + 1) % SAMP;
    }
  }
  function tick(dt: number, still: boolean) {
    m = Math.max(.12, m - .015 * dt / 60);
    visCur += (VIS[ST] - visCur) * Math.min(1, .1 * dt);
    step(dt, still);
  }

  /* ---------- drawing ---------- */
  function strandPath(c: CanvasRenderingContext2D, s: Strand, j0: number, j1: number) {
    let i = (s.hi - 1 - j0 + TL * 2) % TL, px = s.tr[i * 2], py = s.tr[i * 2 + 1];
    c.beginPath(); c.moveTo(px, py);
    for (let j = j0 - 1; j >= j1; j--) {
      i = (s.hi - 1 - j + TL * 2) % TL; const x = s.tr[i * 2], y = s.tr[i * 2 + 1];
      c.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2); if (j === j1) c.lineTo(x, y);
      px = x; py = y;
    }
  }
  const trailAt = (s: Strand, j: number): [number, number] => { const i = (s.hi - 1 - j + TL * 2) % TL; return [s.tr[i * 2], s.tr[i * 2 + 1]]; };
  /** How far back a knot strand is drawn: its last KNOT_SPAN px of path, so a moving body keeps a knot, not a white bar. */
  function knotSpan(s: Strand, n: number) {
    let [px, py] = trailAt(s, 0), run = 0;
    for (let j = 1; j < n; j++) { const [x, y] = trailAt(s, j); run += Math.hypot(x - px, y - py); if (run > KNOT_SPAN) return j - 1; px = x; py = y; }
    return n - 1;
  }
  /** A bloom that would land on a quiet field is not drawn; blob() wobbles out to 1.3r. */
  function addBloom(x: number, y: number, r: number) { if (clearAt(x, y, r * 1.3)) blooms.push({ x, y, r, t0: T, grow: .6 + rand() * .4, life: 8, seed: rand() * TAU }); }
  function blob(c: CanvasRenderingContext2D, b: { x: number; y: number; seed: number }, rr: number) {
    c.beginPath();
    for (let i = 0; i <= 36; i++) {
      const a = i / 36 * TAU, k = 1 + .16 * Math.sin(3 * a + b.seed) + .09 * Math.sin(5 * a + 2 * b.seed) + .05 * Math.sin(9 * a + 3 * b.seed);
      const x = b.x + Math.cos(a) * rr * k, y = b.y + Math.sin(a) * rr * k; if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.closePath();
  }
  function draw() {
    if (!cx) return;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = colour; cx.strokeStyle = colour; cx.lineCap = 'round'; cx.lineJoin = 'round';
    blooms = blooms.filter(b => T - b.t0 < b.life);
    for (const b of blooms) {
      const age = T - b.t0, g = reduced ? 1 : 1 - Math.pow(1 - Math.min(1, age / b.grow), 3), fade = age > b.life - 5 ? Math.max(0, (b.life - age) / 5) : 1, r = b.r * g;
      if (r < .5) continue;
      for (const [sc, al] of LAYERS) { cx.globalAlpha = al * fade; blob(cx, b, r * sc); cx.fill(); }
      cx.globalAlpha = .1 * fade; cx.lineWidth = 1; blob(cx, b, r); cx.stroke();
    }
    const am = AM[ST], wm = (.8 + .45 * m) * (ST === 'core' ? 1.4 : 1), vis = Math.round(visCur);
    // The core's veils: three slow, overlapping washes that drift around the centre and keep changing shape.
    if (MC && veilR >= 2) for (let i = 0; i < 3; i++) {
      const b = { x: MC.x + noise3(T * .23, i * 7.3, 1.5) * veilR * .7, y: MC.y + noise3(i * 5.1, T * .19, 2.5) * veilR * .6 - i * veilR * .08,
        seed: i * 2.1 + T * (.3 + .1 * i) * (i % 2 ? 1 : -1) };
      for (const [sc, al] of VEIL) { cx.globalAlpha = al * am * WASH; blob(cx, b, veilR * (1 - i * .2) * sc); cx.fill(); }
    }
    // Weight follows the body: a stroke is brush-thick in the core and thins to a hairline out at the tips.
    const R2 = Math.max(900, (Rcur * .85) ** 2), cX = MC ? MC.x : W / 2, cY = MC ? MC.y : H / 2;
    for (const s of S) {
      const n = Math.min(s.len, s.knot ? 10 : vis);
      if (n < 4) continue;
      const a = s.a * am;
      if (s.knot) { const k = knotSpan(s, n); if (k > 1) { strandPath(cx, s, k, 0); cx.globalAlpha = Math.min(1, a); cx.lineWidth = s.w * wm; cx.stroke(); } continue; }
      const seg = (n - 1) / 3;
      for (let c = 0; c < 3; c++) {
        const j0 = Math.round(n - 1 - c * seg), j1 = Math.round(n - 1 - (c + 1) * seg);
        if (j0 <= j1) continue;
        const [x, y] = trailAt(s, (j0 + j1) >> 1), g = Math.exp(-((x - cX) ** 2 + (y - cY) ** 2) / R2);
        strandPath(cx, s, j0, j1);
        cx.globalAlpha = Math.min(1, a * CH[c] * (.6 + .4 * g)); cx.lineWidth = s.w * wm * (.28 + 1.5 * g); cx.stroke();
      }
      // A few crisp hairlines carry the detail on top of the washes.
      if (s.crisp) { strandPath(cx, s, Math.min(n - 1, 12), 0); cx.globalAlpha = Math.min(1, .75 * am); cx.lineWidth = .55; cx.stroke(); }
    }
    // Dim, not erase: ink in the quiet fields keeps about a fifth of its strength.
    if (mask.width && mask.height) {
      cx.globalAlpha = DIM; cx.globalCompositeOperation = 'destination-out'; cx.drawImage(mask, 0, 0, W, H);
      cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
    }
  }

  /* ---------- the loop ---------- */
  function frame(now: number) {
    raf = 0;
    if (reduced || !running) return;
    const dt = Math.min(2.5, Math.max(.2, (now - last) / 16.667)); last = now;
    T += dt / 60; tick(dt, false); draw();
    raf = requestAnimationFrame(frame);
  }
  function startLoop() { if (!raf && running && !reduced && W && H) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  /** Reduced motion: each state is one still drawing, and nothing loops. */
  function renderStill() {
    if (!W || !H) return;
    measure();
    for (let i = 0; i < 110; i++) { T += 1 / 60; tick(1, true); }
    draw();
  }
  function seedStrands() {
    if (!MC) return;
    for (const s of S) { s.x = MC.x + (rand() - .5) * 40; s.y = MC.y + (rand() - .5) * 40; s.vx = s.vy = 0; s.len = 0; s.dead = false; }
  }

  /* ---------- presence ---------- */
  function setState(s: State) { ST = s; stT0 = T; if (s === 'core') { tight = 0; Cc = MC ? hub(MC.x, MC.y, 30) ?? { ...MC } : Cc; } if (reduced) renderStill(); }
  /** Returns to rest after ms, unless a newer cue has taken over. */
  function settle(id: number, ms: number) { later(() => { if (id === seq) setState('rest'); }, ms); }
  function burst(p: number) {
    ST = 'burst'; stT0 = T;
    const o = MC ?? { x: W / 2, y: H / 2 }, r0 = 70 * p + rand() * 40, c = hub(o.x, o.y, r0 * 1.3) ?? o;
    for (const s of S) {
      if (s.knot) continue;
      s.dead = false; s.race = 0; s.x = c.x + (rand() - .5) * 16; s.y = c.y + (rand() - .5) * 16; s.len = 0;
      const a = rand() * TAU, v = (5 + rand() * 15) * p; s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v * .85;
    }
    addBloom(c.x, c.y, r0);
    for (let i = 0; i < 3; i++) addBloom(c.x + (rand() - .5) * 170 * p, c.y + (rand() - .5) * 170 * p, 18 + rand() * 50);
    for (let i = 0; i < 6; i++) { const a = rand() * TAU, d = (120 + rand() * 140) * p; addBloom(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * .85, 3 + rand() * 5); }
    if (reduced) renderStill();
  }
  function smallBloom() {
    const on = S.filter(s => !s.knot && s.len > 4 && clearAt(s.x, s.y, 21));
    const s = on[Math.floor(rand() * on.length)];
    if (s) addBloom(s.x, s.y, 6 + rand() * 10);
    if (reduced) renderStill();
  }
  function say(text: string) {
    const id = ++seq;
    if (reduced) { showLine(text); setState('speak'); settle(id, holdMs(text)); return; }
    prepareLine(text); setState('gather');
    later(() => {
      if (id !== seq) return;
      setState('speak'); showLine(text); settle(id, holdMs(text));
    }, 420);
  }
  function cue(signal: InkSignal) {
    const id = ++seq;
    switch (signal.kind) {
      // A clean run makes it busier; every eighth right note it gives a small burst.
      case 'right':
        m = Math.min(1, m + .07); streak++;
        if (streak % 8 === 0) { const back = ST === 'burst' ? 'rest' : ST; burst(.5); later(() => { if (id === seq) setState(back); }, 600); }
        else smallBloom();
        return;
      case 'wrong': m = Math.max(.12, m * .6); streak = 0; setState('core'); settle(id, 900); return;
      case 'pass': burst(1); settle(id, 1400); return;
      // A failed attempt holds the knot longer than one wrong note, and tightens it all the way.
      case 'fail': m = .12; streak = 0; setState('core'); settle(id, 1800); return;
      // Moving on: the body sets off to a new patch of water nearby.
      case 'next': setState('rest'); planRoute([140, 360]); moveUntil = T + 1.8; if (reduced) { const w = ROUTE.at(-1); if (w && MC) { MC.x = w.x; MC.y = w.y; } renderStill(); } return;
      case 'say': say(signal.text); return;
    }
  }

  return {
    resize() {
      const first = !(W && H);
      DPR = Math.min(1.5, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      // Strands seed on the first real viewport: a page that loads at zero size would pile them all on the origin.
      measure(); if (first && W && H) seedStrands();
      if (line.textContent) placeLine();
      if (reduced) renderStill(); else startLoop();
    },
    setZones(zones) {
      // Re-read every few hundred ms; most reads find the page as it was, and a still drawing should not redraw for them.
      const key = zones.map(z => [z.l, z.t, z.r, z.b].map(Math.round).join()).join(';');
      if (key === pagesKey) return;
      pages = zones; pagesKey = key;
      // A page that grew under the line moves the line to open water again.
      if (TR && !zones.every(z => TR!.right <= z.l || TR!.left >= z.r || TR!.bottom <= z.t || TR!.top >= z.b)) placeLine(); else measure();
      if (reduced) renderStill();
    },
    setPerch(p) {
      if (p && perch ? Math.hypot(p.x - perch.x, p.y - perch.y) < 1 : p === perch) return;
      perch = p; if (reduced) renderStill();
    },
    setPointer(p) {
      if (p && pointer) { const dx = p.x - pointer.x, dy = p.y - pointer.y, d = Math.hypot(dx, dy); if (d > 2) { lead.x += (dx / d - lead.x) * .2; lead.y += (dy / d - lead.y) * .2; const l = Math.hypot(lead.x, lead.y) || 1; lead.x /= l; lead.y /= l; } }
      pointer = p; if (p) pointerT = T;
    },
    setGuide(g) { guide = g; if (reduced) renderStill(); },
    setColour(c) { if (c === colour) return; colour = c; if (reduced) renderStill(); },
    setReduced(r) { reduced = r; if (r) { stopLoop(); renderStill(); } else startLoop(); },
    setRunning(r) { running = r; if (r) startLoop(); else stopLoop(); },
    cue,
    clearLine() { line.textContent = ''; delete line.dataset.writing; delete line.dataset.pending; measure(); if (reduced) renderStill(); },
    destroy() { stopLoop(); for (const t of timers) clearTimeout(t); timers.clear(); },
  };
}
