// Wait HUD (spec: wait-hud): in wait mode the HUD band says LEARN and which note you're on, where plain mode shows
// the counters and the score. hud draws the band and song card; this draws into it, and nothing in plain mode.
import type { Frame, GameEvent, GamePlugin } from "../../contracts";
import { hudLayout, hudSettings } from "../hud";
import { cyan, whenDisplayFontReady } from "../ui-tokens";
import { isWaitMode } from "../wait-mode";

export interface WaitHudState {
  N: number; // notes in the chart the judge gets (after hand-mode and bar-loop)
  hits: number;
}

// The note you're on: the next one to play, or the last once every note is hit.
export const noteOn = (s: WaitHudState) => Math.min(s.N, s.hits + 1);

export function reduceWaitHud(s: WaitHudState, e: GameEvent): WaitHudState {
  if (e.type === "songStart") return { ...s, hits: 0 };
  if (e.type === "noteHit") return { ...s, hits: s.hits + 1 }; // a chord's notes count one each
  return s; // a WRONG, an extra or anything else changes nothing
}

function drawWaitHud(ctx: CanvasRenderingContext2D, f: Frame, s: WaitHudState, display: string): void {
  const { h } = hudLayout(f.width, f.judgmentLineY).panel;
  const pad = Math.max(10, h * 0.25);
  ctx.textBaseline = "middle";

  // Where the counters were, on the screen's center column (the judgment word's and the combo's): the note count in
  // the score's face and size, labelled as the counters are. Alone in that zone, its own center looked off.
  const mid = f.width / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `italic 800 ${Math.round(h * 0.42)}px ${display}`;
  ctx.fillText(`${noteOn(s)} / ${s.N}`, mid, h * 0.42);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 ${Math.round(h * 0.16)}px ${hudSettings.font}`;
  ctx.fillText("NOTE", mid, h * 0.8);

  // Where the score and multiplier were: a LEARN badge in the cabinet's cyan, the word at the multiplier's size in a
  // cyan frame, so it reads as a mode and not as a number.
  const size = Math.round(h * 0.5);
  ctx.font = `italic 900 ${size}px ${display}`;
  const right = f.width - pad - hudSettings.statusGutterPx;
  const w = ctx.measureText("LEARN").width + size * 0.7;
  const bh = size * 1.15;
  ctx.strokeStyle = cyan;
  ctx.lineWidth = Math.max(2, h * 0.03);
  ctx.beginPath();
  ctx.roundRect(right - w, h * 0.5 - bh / 2, w, bh, bh * 0.22);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = cyan;
  ctx.fillText("LEARN", right - w / 2, h * 0.5 + size * 0.04);
}

declare global {
  interface Window {
    __pianoArcadeWaitHud?: { n: number; N: number }; // read by verify-wait-hud.mjs
  }
}

export function waitHud(): GamePlugin {
  let wait = false;
  let state: WaitHudState = { N: 0, hits: 0 };
  let display = hudSettings.font; // the display face once it has loaded, as the HUD does
  if (typeof document !== "undefined")
    void whenDisplayFontReady().then(() => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (family) display = `${family}, ${hudSettings.font}`;
    });
  const publish = () => {
    if (wait && typeof window !== "undefined") window.__pianoArcadeWaitHud = { n: noteOn(state), N: state.N };
  };
  return {
    id: "wait-hud",
    transformChart(chart, params) {
      wait = isWaitMode(params);
      state = { N: chart.notes.length, hits: 0 };
      publish();
      return chart;
    },
    onEvent(e) {
      if (!wait) return;
      state = reduceWaitHud(state, e);
      publish();
    },
    draw(ctx, frame) {
      if (wait) drawWaitHud(ctx, frame, state, display);
    },
  };
}
