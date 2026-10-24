import { settings } from "../core/settings";

// The drawn keyboard's look: white keys with a top-to-bottom sheen, black keys with a thin top highlight, and a
// pressed key filled in saturated orange with an outline and down-state marker. Positions and widths stay the highway's (keyX); this only paints.

export const keySkinSettings = {
  white: { top: "#f4f4f7", bottom: "#d2d2da" }, // the sheen, around today's #e8e8ec
  black: { body: "#16161a", end: "#34343d", highlight: "rgba(255,255,255,0.28)" },
  glowPx: 24,
  radiusPx: 3, // the keys' far ends
};

type Rect = { x: number; y: number; w: number; h: number };

function shape(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, [0, 0, keySkinSettings.radiusPx, keySkinSettings.radiusPx]);
}

// Pressed state uses a saturated fill plus an outline and bottom marker on both key types.
// The hand color remains a small top accent/glow; upcoming notes and hold targets keep their own colors.
function pressed(ctx: CanvasRenderingContext2D, r: Rect, light: string): void {
  ctx.save();
  ctx.shadowColor = light;
  ctx.shadowBlur = keySkinSettings.glowPx;
  ctx.fillStyle = settings.keyLitColor;
  shape(ctx, r);
  ctx.fill();
  ctx.restore();
  const shade = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  shade.addColorStop(0, "rgba(255,255,255,0.35)");
  shade.addColorStop(0.25, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = shade;
  shape(ctx, r);
  ctx.fill();
  ctx.fillStyle = light; // retain matched-hand information without washing out the pressed fill
  ctx.fillRect(r.x + 2, r.y + 2, Math.max(1, r.w - 4), Math.min(4, r.h * .05));
  ctx.strokeStyle = "#151020";
  ctx.lineWidth = 3;
  shape(ctx, { x: r.x + 1.5, y: r.y + 1.5, w: Math.max(1, r.w - 3), h: Math.max(1, r.h - 3) });
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.stroke();
  // A solid bar near the key end is a geometric down-state cue, independent of color.
  ctx.fillStyle = "#151020";
  ctx.fillRect(r.x + r.w * .23, r.y + r.h * .8, r.w * .54, Math.max(3, r.h * .06));
}

export function drawWhiteKey(ctx: CanvasRenderingContext2D, r: Rect, light: string | null): void {
  if (light) return pressed(ctx, r, light);
  const { top, bottom } = keySkinSettings.white;
  const sheen = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  sheen.addColorStop(0, top);
  sheen.addColorStop(1, bottom);
  ctx.fillStyle = sheen;
  shape(ctx, r);
  ctx.fill();
}

export function drawBlackKey(ctx: CanvasRenderingContext2D, r: Rect, light: string | null): void {
  if (light) return pressed(ctx, r, light);
  const { body, end, highlight } = keySkinSettings.black;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, body);
  g.addColorStop(0.86, body);
  g.addColorStop(0.87, end); // the bevel at the near end, where light catches a real black key
  g.addColorStop(1, body);
  ctx.fillStyle = g;
  shape(ctx, r);
  ctx.fill();
  ctx.fillStyle = highlight; // a thin highlight along the bevel's top edge
  ctx.fillRect(r.x + 1, r.y + r.h * 0.86, r.w - 2, 1.5);
}
