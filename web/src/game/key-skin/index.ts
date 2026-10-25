// The drawn keyboard's look (key-polish): ivory white keys with a front lip, black keys with a lit top face, a
// front face and a gloss stripe, and a pressed key lit from the hit line down, its light pouring toward the near end.
// A pressed key travels: its front lip shrinks and its neighbours shade its top. Positions and widths stay the
// highway's (keyX); this only paints.

export const keySkinSettings = {
  white: { top: "#dcdce4", under: "#f8f8fb", mid: "#ebebf0", bottom: "#cdcdd7", lipTop: "#b9b9c5", lipBottom: "#8a8a99" },
  black: { top: "#2a2a33", body: "#141419", end: "#0c0c10", faceTop: "#4a4a56", faceBottom: "#1b1b21" },
  highlight: "rgba(255,255,255,0.32)", // the line where a key's top meets its front
  gloss: "rgba(255,255,255,0.09)", // a black key's lacquer, a thin stripe down its top face
  edge: "rgba(0,0,0,0.26)", // the gap between white keys
  bevel: "rgba(255,255,255,0.7)", // the lit left edge of a white key, beside the gap
  castShadow: "rgba(0,0,0,0.45)", // a black key's shadow on the whites in front of it
  lipFrac: 0.075, // a white key's front edge, of its height
  faceFrac: 0.12, // a black key's front face, of its height
  downLip: 0.4, // how much of the lip or face still shows on a pressed key
  pourFrac: 0.3, // the solid part of a pressed key's light, from the line down; below it the light fades
  pourEnd: 0.14, // the light's alpha at the near end
  hotPx: 10, // the white-hot band just under the line
  spill: 0.4, // a pressed key's light on its neighbours, at the line
  radiusPx: 3, // the keys' near ends
};

type Rect = { x: number; y: number; w: number; h: number };

// "#rrggbb" at an alpha. Anything else comes back as it is (the light then fades by globalAlpha alone).
function withAlpha(color: string, a: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Every white key shares one top and height, as does every black key, so a frame needs only a handful of gradients:
// built once per canvas and keyboard size, plus one per light color.
type Cache = { key: string; grads: Map<string, CanvasGradient> };
const caches = new WeakMap<CanvasRenderingContext2D, Cache>();
function grad(ctx: CanvasRenderingContext2D, r: Rect, name: string, stops: [number, string][], y0 = r.y, y1 = r.y + r.h): CanvasGradient {
  const key = `${r.y},${r.h}`;
  let c = caches.get(ctx);
  if (!c || c.key !== key) caches.set(ctx, (c = { key, grads: new Map() }));
  const id = `${name}:${y0},${y1}`;
  let g = c.grads.get(id);
  if (!g) {
    g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [at, color] of stops) g.addColorStop(at, color);
    c.grads.set(id, g);
  }
  return g;
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [0, 0, keySkinSettings.radiusPx, keySkinSettings.radiusPx]);
}

// The light on a pressed (or releasing) key, over its top part [y, y + h): exactly its color from the line down to
// pourFrac, then fading toward the near end, with a white-hot band where the line touches it.
function light(ctx: CanvasRenderingContext2D, r: Rect, h: number, color: string, alpha: number): void {
  const s = keySkinSettings;
  const pour = h * s.pourFrac;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, pour);
  ctx.fillStyle = grad(ctx, r, `pour${color}`, [[0, color], [1, withAlpha(color, s.pourEnd)]], r.y + pour, r.y + h);
  ctx.fillRect(r.x, r.y + pour, r.w, h - pour);
  ctx.fillStyle = grad(ctx, r, "hot", [[0, "rgba(255,255,255,0.85)"], [1, "rgba(255,255,255,0)"]], r.y, r.y + s.hotPx);
  ctx.fillRect(r.x, r.y, r.w, s.hotPx);
  ctx.globalAlpha = 1;
}

// glow: 1 while held, below 1 while the light fades after a release (the key is already back up).
export function drawWhiteKey(ctx: CanvasRenderingContext2D, r: Rect, lit: string | null, glow = 1): void {
  const s = keySkinSettings;
  const down = lit !== null && glow >= 1;
  const lip = r.h * s.lipFrac * (down ? s.downLip : 1);
  const body = r.h - lip;
  ctx.fillStyle = grad(ctx, r, "white", [[0, s.white.top], [0.06, s.white.under], [0.7, s.white.mid], [1, s.white.bottom]]);
  ctx.fillRect(r.x, r.y, r.w, body);
  if (lit) light(ctx, r, body, lit, glow);
  if (down) {
    // Sunk below its neighbours: their edges shade its top.
    ctx.fillStyle = grad(ctx, r, "sunk", [[0, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,0)"]], r.y, r.y + 6);
    ctx.fillRect(r.x, r.y, r.w, 6);
  }
  ctx.fillStyle = grad(ctx, r, `lip${lip}`, [[0, s.white.lipTop], [1, s.white.lipBottom]], r.y + body, r.y + r.h);
  round(ctx, r.x, r.y + body, r.w, lip);
  ctx.fill();
  ctx.fillStyle = s.highlight;
  ctx.fillRect(r.x, r.y + body, r.w, 1);
  ctx.fillStyle = s.edge;
  ctx.fillRect(r.x + r.w - 1, r.y, 1, body);
  ctx.fillStyle = s.bevel;
  ctx.fillRect(r.x, r.y, 1, body);
  if (lit) spill(ctx, r, lit, glow);
}

// A lit key's light on its neighbours' tops, under the line: an ellipse fading out over a key and a half each side.
function spill(ctx: CanvasRenderingContext2D, r: Rect, color: string, alpha: number): void {
  const s = keySkinSettings;
  const cx = r.x + r.w / 2;
  const g = ctx.createRadialGradient(cx, r.y, 0, cx, r.y, r.w * 2);
  g.addColorStop(0, withAlpha(color, s.spill));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(cx - r.w * 2, r.y, r.w * 4, r.h * 0.35);
  ctx.globalAlpha = 1;
}

export function drawBlackKey(ctx: CanvasRenderingContext2D, r: Rect, lit: string | null, glow = 1): void {
  const s = keySkinSettings;
  const down = lit !== null && glow >= 1;
  const face = r.h * s.faceFrac * (down ? s.downLip : 1);
  const top = r.h - face;
  // Its shadow on the white keys in front of it and to its right.
  ctx.fillStyle = grad(ctx, r, "cast", [[0, s.castShadow], [1, "rgba(0,0,0,0)"]], r.y + r.h, r.y + r.h * 1.14);
  ctx.fillRect(r.x + 1, r.y + r.h, r.w, r.h * 0.14);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(r.x + r.w, r.y, 2, r.h);
  ctx.fillStyle = grad(ctx, r, "black", [[0, s.black.top], [0.12, s.black.body], [1, s.black.end]]);
  ctx.fillRect(r.x, r.y, r.w, top);
  if (lit) light(ctx, r, top, lit, glow);
  if (!down) {
    ctx.fillStyle = s.gloss;
    ctx.fillRect(r.x + r.w * 0.18, r.y + 2, Math.max(1, r.w * 0.12), top - 4);
  }
  ctx.fillStyle = grad(ctx, r, `face${face}`, [[0, s.black.faceTop], [1, s.black.faceBottom]], r.y + top, r.y + r.h);
  round(ctx, r.x, r.y + top, r.w, face);
  ctx.fill();
  ctx.fillStyle = s.highlight;
  ctx.fillRect(r.x + 1, r.y + top, r.w - 2, 1.5);
}
