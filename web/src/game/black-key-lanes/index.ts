// Black-key lanes (spec: black-key-lanes): the lanes under black keys a little lighter than the white ones, as
// Synthesia shades them, so the keyboard's 2-and-3 pattern runs up the whole highway.
import type { Layout } from "../core/highway";

export const blackKeyLaneSettings = {
  tint: 0.04, // 0–1: white over a black lane; 0.04 lifts #000 to about #0a0a0a. 0 turns the shading off
};

// Each black key's lane, exactly its keyX span at the line, from the top of the highway down, through the perspective.
// Drawn after the backdrop and before everything else on the highway.
export function drawBlackKeyLanes(ctx: CanvasRenderingContext2D, L: Layout, tint = blackKeyLaneSettings.tint): void {
  if (tint <= 0) return;
  const line = L.judgmentLineY;
  ctx.fillStyle = `rgba(255,255,255,${tint})`;
  for (let p = L.lowPitch; p <= L.highPitch; p++) {
    if (!L.isBlack(p)) continue;
    const { x, width } = L.keyX(p);
    ctx.beginPath();
    ctx.moveTo(L.project(x, 0), 0);
    ctx.lineTo(L.project(x + width, 0), 0);
    ctx.lineTo(x + width, line);
    ctx.lineTo(x, line);
    ctx.closePath();
    ctx.fill();
  }
}
