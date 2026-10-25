// Clear card (spec: clear-card): ALL PERFECT, FULL COMBO or CLEAR from the moment the last note is judged until the
// results show. It fills the tail /play already has (songEnd comes 1.0–1.4 s later), so it delays nothing.
import type { Chart, GamePlugin, Judgment } from "../../contracts";
import { hudLayout } from "../hud";
import { gold, ink, whenDisplayFontReady } from "../ui-tokens";
import { isWaitMode } from "../wait-mode";

export type ClearKind = "ALL PERFECT" | "FULL COMBO" | "CLEAR";

export const clearSettings = {
  easeMs: 200,
  fromScale: 1.12, // the card eases in from a little larger
  sizeOfPlayfield: 0.3, // text height, of the space between the HUD band and the judgment line
  maxWidth: 0.9, // of the canvas
  dim: 0.72, // black over the playfield under the HUD band: the last judgment and the combo recede
  font: "system-ui, sans-serif",
};

type Counts = { PERFECT: number; GREAT: number; GOOD?: number; MISS: number; wrong?: number };

// How the take ended. Extras that aren't WRONG don't count, as in Judge.finish (full combo iff no MISS and no WRONG).
export function clearKind(c: Counts): ClearKind {
  if (c.MISS > 0 || (c.wrong ?? 0) > 0) return "CLEAR";
  return c.GREAT === 0 && (c.GOOD ?? 0) === 0 ? "ALL PERFECT" : "FULL COMBO";
}

declare global {
  interface Window {
    __pianoArcadeClearCard?: { kind: ClearKind; shownAtMs: number } | null; // read by verify-clear.mjs
  }
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function clearCard(): GamePlugin {
  let notes = 0;
  let wait = false;
  let counts: Record<Judgment | "wrong", number> = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0 };
  let card: { kind: ClearKind; shownAtMs: number } | null = null;
  // Body face until the display face has loaded (or 1 s has passed), as the HUD does.
  let display = clearSettings.font;
  if (typeof document !== "undefined")
    void whenDisplayFontReady().then(() => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (family) display = `${family}, ${clearSettings.font}`;
    });
  const publish = () => {
    if (typeof window !== "undefined") window.__pianoArcadeClearCard = card && { ...card };
  };
  const gone = () => {
    card = null;
    publish();
  };
  return {
    id: "clear-card",
    transformChart(chart: Chart, params: URLSearchParams) {
      notes = chart.notes.length;
      wait = isWaitMode(params);
      return chart;
    },
    onEvent(e) {
      if (e.type === "songStart" || e.type === "quit" || e.type === "songEnd") {
        counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0 };
        return gone();
      }
      if (e.type === "noteHit") counts[e.judgment]++;
      else if (e.type === "noteMiss") counts.MISS++;
      else if (e.type === "wrongNote") counts.wrong++;
      else return;
      if (wait) return; // wait-mode takes aren't scored
      if (card) card.kind = clearKind(counts); // a WRONG after the last note turns it to CLEAR
      else if (counts.PERFECT + counts.GREAT + counts.GOOD + counts.MISS >= notes) card = { kind: clearKind(counts), shownAtMs: e.atMs };
      else return;
      publish();
    },
    draw(ctx, f) {
      if (!card || wait) return;
      const t = f.nowMs - card.shownAtMs; // the chart clock, so Esc freezes the card with everything else
      if (t < 0) return;
      const s = clearSettings;
      const e = reducedMotion() ? 1 : easeOut(Math.min(1, t / s.easeMs));
      const band = hudLayout(f.width, f.judgmentLineY).panel.h;
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.globalAlpha = e * s.dim;
      ctx.fillRect(0, band, f.width, f.height - band);

      let size = Math.max(24, (f.judgmentLineY - band) * s.sizeOfPlayfield);
      ctx.font = `900 ${size}px ${display}`; // upright, the kit's display type (no italic in the Duo look)
      const w = ctx.measureText(card.kind).width;
      if (w > f.width * s.maxWidth) size *= (f.width * s.maxWidth) / w;
      const color = card.kind === "CLEAR" ? ink : gold;
      const scale = s.fromScale + (1 - s.fromScale) * e;
      ctx.translate(f.width / 2, (band + f.judgmentLineY) / 2);
      ctx.scale(scale, scale);
      ctx.font = `900 ${size}px ${display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = e;
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 0.35;
      ctx.fillStyle = color;
      ctx.fillText(card.kind, 0, 0);
      ctx.restore();
    },
  };
}
