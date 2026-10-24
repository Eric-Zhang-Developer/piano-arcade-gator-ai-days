// Ghost (spec: ghost): your last take on this chart, drawn as dashed outlines where you actually played, while you
// play it again. Kept in memory for the page's lifetime; a quit take never replaces it.
import type { Chart, Frame, GamePlugin } from "../../contracts";
import { settings } from "../core/settings";
import { ink } from "../ui-tokens";
import { GHOST_KEY, emptyGhost, ghostKey, ghostOff, ghostSettings, recordGhost, yAt, type Ghost } from "./ghost";

export { ghostKey, recordGhost, yAt } from "./ghost";

function readStored(): string | null {
  try {
    return localStorage.getItem(GHOST_KEY);
  } catch {
    return null;
  }
}

function draw(ctx: CanvasRenderingContext2D, f: Frame, g: Ghost): void {
  const line = f.judgmentLineY;
  const y = (atMs: number) => yAt(atMs, f.nowMs, line, settings.lookaheadMs);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, f.width, line);
  ctx.clip();
  ctx.globalAlpha = ghostSettings.alpha;
  ctx.strokeStyle = ink;
  ctx.lineWidth = ghostSettings.lineWidthPx;
  ctx.setLineDash(ghostSettings.dashPx);
  for (const h of g.hits) {
    const bottom = y(h.atMs);
    const top = y(h.atMs + h.durationMs);
    if (bottom < 0 || top > line || h.pitch < f.lowPitch || h.pitch > f.highPitch) continue;
    const k = f.keyX(h.pitch);
    const inset = k.width * 0.08; // the highway's own note inset
    ctx.strokeRect(k.x + inset, top, k.width - 2 * inset, bottom - top); // never filled: the real note reads through
  }
  for (const x of g.extras) {
    const at = y(x.atMs);
    if (at < 0 || at > line || x.pitch < f.lowPitch || x.pitch > f.highPitch) continue;
    const k = f.keyX(x.pitch);
    ctx.beginPath();
    ctx.moveTo(k.x + k.width / 2, at - ghostSettings.tickPx / 2);
    ctx.lineTo(k.x + k.width / 2, at + ghostSettings.tickPx / 2);
    ctx.stroke();
  }
  ctx.restore();
}

declare global {
  interface Window {
    __pianoArcadeGhost?: { hits: number; extras: number; on: boolean }; // read by verify-ghost.mjs
  }
}

export function ghost(): GamePlugin {
  const saved = new Map<string, Ghost>(); // finished takes, by chart key, for this page's lifetime
  let chart: Chart | null = null;
  let key = "";
  let off = false;
  let perspective = false;
  let shown: Ghost | null = null; // the previous take's, while this one plays
  let recording: Ghost | null = null;

  return {
    id: "ghost",
    transformChart(c, params) {
      chart = c;
      key = ghostKey(c.id, params);
      off = ghostOff(params.get("ghost"), readStored());
      perspective = Number(params.get("perspective")) > 0;
      return c;
    },
    onEvent(e) {
      if (e.type === "songStart") {
        shown = saved.get(key) ?? null;
        recording = emptyGhost();
        if (typeof window !== "undefined") window.__pianoArcadeGhost = { hits: shown?.hits.length ?? 0, extras: shown?.extras.length ?? 0, on: !off && !perspective };
        return;
      }
      if (e.type === "quit") return void (recording = null);
      if (e.type === "songEnd") {
        if (recording) saved.set(key, recording);
        recording = null;
        return;
      }
      if (recording && chart) recording = recordGhost(chart, recording, e);
    },
    draw(ctx, frame) {
      if (!off && !perspective && shown) draw(ctx, frame, shown);
    },
  };
}
