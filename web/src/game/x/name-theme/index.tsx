// Your Name, in Music (spec: name-theme, #1190): on /play with ?x=name-theme, the name's letters above the highway,
// each lighting as its note is hit or played, and each motif note's letter beside it. /name makes the theme; with
// none held (a reload, or no name typed) the take is the committed HAYDN placeholder and its letters.
import { createElement } from "react";
import type { Chart, Frame } from "../../../contracts";
import type { Experiment } from "..";
import { msPerBeat, settings } from "../../core/settings";
import { isBlack } from "../../core/highway";
import { canvasFonts, kitButton } from "../../duo-tokens";
import { pillRect } from "../../note-pills";
import { ink, inkDim, primary } from "../../ui-tokens";
import { FRENCH } from "./cipher";
import { compose, type Theme } from "./compose";
import { heldTheme, SONG } from "./memory";

export const nameSettings = {
  lettersY: 0.2, // of the canvas height: under the HUD's band
  letterPx: 40, // at 720 px tall, scaled
  noteLetterPx: 13,
  sweepMs: 240, // a letter's light-up: from 1.3× to its size
};

// The anchor: what a reload, or a visit with no name, plays. web/public/songs/x/name-theme/chart.json is this chart.
export const ANCHOR = "HAYDN";
export const anchorTheme = (): Theme => compose(ANCHOR, FRENCH)!;

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Where each lettered note's leading end is this frame, as the highway places its pill (perspective off).
export function lettered(chart: Chart, f: Frame, letterOf: Record<string, number>): { x: number; y: number; letter: number }[] {
  const line = f.judgmentLineY;
  const pxPerMs = line / settings.lookaheadMs;
  const beatMs = msPerBeat(chart.bpm);
  const out: { x: number; y: number; letter: number }[] = [];
  for (const n of chart.notes) {
    const letter = letterOf[n.id];
    if (letter === undefined) continue;
    const y = line - (n.beat * beatMs - f.nowMs) * pxPerMs;
    if (y < 0 || y > line) continue;
    const pill = pillRect(f.keyX(n.pitch), isBlack(n.pitch));
    out.push({ x: pill.x + pill.width + 4, y, letter });
  }
  return out;
}

export const nameTheme: Experiment = {
  name: "name-theme",
  title: "Your Name, in Music",
  group: "Wow",
  line: "A name becomes a theme the DGX plays and a level you can play (#1190)",
  issue: 1190,
  href: "/name?x=name-theme", // x= is the registry's own rule; /name ignores it
  plugin: () => {
    let theme: Theme | null = null;
    let chart: Chart | null = null;
    const lit = new Map<number, number | null>(); // a letter → when it first drew lit (null until then)
    const still = reducedMotion();
    return {
      id: "x-name-theme",
      transformChart(c, params) {
        lit.clear();
        chart = c;
        theme = params.get("song") === SONG ? (heldTheme()?.theme ?? anchorTheme()) : null;
        return c;
      },
      onEvent(e) {
        if (e.type === "songStart") lit.clear();
        else if (e.type === "noteHit" && theme && theme.letterOf[e.noteId] !== undefined && !lit.has(theme.letterOf[e.noteId])) lit.set(theme.letterOf[e.noteId], null);
      },
      draw(ctx, f) {
        if (!theme || !chart) return;
        const k = f.height / 720;
        const now = performance.now();
        ctx.save();
        ctx.textBaseline = "alphabetic";
        // Each motif note's letter, beside its pill.
        ctx.font = canvasFonts.data(Math.round(nameSettings.noteLetterPx * k));
        ctx.textAlign = "left";
        ctx.fillStyle = ink;
        for (const n of lettered(chart, f, theme.letterOf)) ctx.fillText(theme.letters[n.letter], n.x, n.y - 4 * k);
        // The name, lighting letter by letter.
        const px = Math.round(nameSettings.letterPx * k);
        const step = px * 0.95;
        const x0 = f.width / 2 - (step * (theme.letters.length - 1)) / 2;
        const y = f.height * nameSettings.lettersY;
        ctx.textAlign = "center";
        [...theme.letters].forEach((ch, i) => {
          const on = lit.has(i);
          if (on && lit.get(i) === null) lit.set(i, now);
          const p = on && !still ? Math.min(1, (now - lit.get(i)!) / nameSettings.sweepMs) : 1;
          const scale = on ? 1.3 - 0.3 * p : 1;
          ctx.font = canvasFonts.display(Math.round(px * scale));
          ctx.globalAlpha = on ? 1 : 0.35;
          ctx.fillStyle = on ? primary : inkDim;
          ctx.fillText(ch, x0 + i * step, y);
        });
        ctx.restore();
      },
      startPanel: () =>
        heldTheme()
          ? null
          : createElement(
              "p",
              { style: { margin: 0, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }, "data-testid": "x-name-theme-anchor" },
              "Playing HAYDN, the 1909 centenary's motif. Your own name is made on /name.",
              createElement("a", { ...kitButton("secondary"), href: "/name" }, "Type a name"),
            ),
    };
  },
};
