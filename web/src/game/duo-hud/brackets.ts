// Corner brackets (spec: duo-hud; visual-direction.md: "corner brackets mark what matters"): four L-shaped corners
// drawn inside a box, each arm `arm` long, as hairlines. The HUD's song tag and combo cluster use them; the stroke is
// inset by half its width so nothing spills outside the box.
export interface BracketStyle {
  color: string;
  arm?: number; // px; default 18% of the box's shorter side
  lineWidth?: number; // px; default 1
}

export function drawBrackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: BracketStyle): void {
  const lw = s.lineWidth ?? 1;
  const i = lw / 2;
  const [l, t, r, b] = [x + i, y + i, x + w - i, y + h - i];
  const a = Math.max(0, Math.min(s.arm ?? Math.min(w, h) * 0.18, r - l, b - t));
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.lineWidth = lw;
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [
    [l, t, 1, 1],
    [r, t, -1, 1],
    [r, b, -1, -1],
    [l, b, 1, -1],
  ]) {
    ctx.moveTo(cx + dx * a, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * a);
  }
  ctx.stroke();
  ctx.restore();
}
