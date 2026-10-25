// The Duo kit's canvas twins (duo-tokens): the HUD draws brackets, panels and type with these, so the canvas matches
// the DOM kit (Kit.tsx). Same values: ui-tokens.
import { line, panel, primary } from "../ui-tokens";

export const kitSettings = {
  bracketLen: 10, // px, each arm of a corner bracket
  bracketWidth: 2, // px
  hairline: 1, // px, a panel's frame
  dataTracking: "0.14em", // the monospace caps' letter spacing
  condensed: "75%", // the display face's font-stretch for numerals
};

// Canvas can't read var(): resolve the next/font families once they exist, with layout.tsx's fallbacks.
const family = (v: string, fallback: string) => {
  if (typeof document === "undefined") return fallback;
  const f = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return f ? `${f}, ${fallback}` : fallback;
};

// Font strings for ctx.font. "condensed" is the shorthand's stretch keyword (75%); percentages aren't allowed there.
export const canvasFonts = {
  numeral: (px: number) => `800 condensed ${px}px ${family("--pa-font-display", "system-ui, sans-serif")}`,
  moment: (px: number) => `italic 900 ${px}px ${family("--pa-font-moment", family("--pa-font-display", "system-ui, sans-serif"))}`, // type-moments: Saira italic
  display: (px: number) => `800 ${px}px ${family("--pa-font-display", "system-ui, sans-serif")}`,
  data: (px: number) => `500 ${px}px ${family("--pa-font-data", "ui-monospace, monospace")}`,
};

type Ctx = Pick<CanvasRenderingContext2D, "save" | "restore" | "beginPath" | "moveTo" | "lineTo" | "stroke" | "fillRect" | "strokeRect"> & {
  lineCap: CanvasRenderingContext2D["lineCap"];
  strokeStyle: CanvasRenderingContext2D["strokeStyle"];
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  lineWidth: number;
};

export interface BracketStyle {
  color?: string; // default --pa-primary
  arm?: number; // px, each arm; default kitSettings.bracketLen
  lineWidth?: number; // px; default kitSettings.bracketWidth
}

// Four L-shaped corners inside the box (x, y, w, h): the stroke is inset by half its width, so nothing spills outside.
// duo-hud's own drawer had this signature, so switching to the kit is one import.
export function drawBrackets(ctx: Ctx, x: number, y: number, w: number, h: number, s: BracketStyle = {}) {
  const color = s.color ?? primary;
  const width = s.lineWidth ?? kitSettings.bracketWidth;
  const i = width / 2;
  const [l, t, r, b] = [x + i, y + i, x + w - i, y + h - i];
  const arm = Math.max(0, Math.min(s.arm ?? kitSettings.bracketLen, (r - l) / 2, (b - t) / 2));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [
    [l, t, 1, 1],
    [r, t, -1, 1],
    [r, b, -1, -1],
    [l, b, 1, -1],
  ]) {
    ctx.moveTo(cx + dx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * arm);
  }
  ctx.stroke();
  ctx.restore();
}

// A panel: the fill, then a hairline frame inside the box. Sharp corners.
export function drawPanel(ctx: Ctx, x: number, y: number, w: number, h: number, fill = panel, stroke = line) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = kitSettings.hairline;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}
