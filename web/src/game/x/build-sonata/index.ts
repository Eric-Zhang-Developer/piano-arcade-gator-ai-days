// The Build Sonata (spec: build-sonata, #1162): the DGX performs the night the agents built Étude, one note per merged
// PR. Its page is /sonata; on /play, ?x=build-sonata adds the merged-PR counter and the night's clock under the HUD
// band, each note's subject riding beside it, and a link back to /sonata on the results.
import { createElement } from "react";
import type { Experiment } from "..";
import type { Frame, GamePlugin } from "../../../contracts";
import { msPerBeat, settings } from "../../core/settings";
import { canvasFonts, kitButton } from "../../duo-tokens";
import { hudLayout } from "../../hud";
import { buildSonata, clockAt, counterAt, type Snapshot, type SonataNote } from "./sonata";

export const sonataSettings = {
  stripPx: 30, // the counter's strip under the HUD band
  labelPx: 12, // a riding subject's size
  labelAlpha: 0.42, // low contrast: it rides with the music, it isn't read like the HUD
  labelGapPx: 15, // a label closer than this to the last one on its side is skipped
  labelChars: 54,
};

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function sonataPlugin(): GamePlugin {
  let notes: SonataNote[] = [];
  let bpm = 120;
  // The snapshot loads with the take, not with /play's bundle.
  void import("./snapshot.json").then((m) => (notes = buildSonata(m.default as Snapshot).notes));
  return {
    id: "x-build-sonata",
    transformChart(chart) {
      bpm = chart.bpm;
      return chart;
    },
    draw(ctx: CanvasRenderingContext2D, f: Frame) {
      if (!notes.length) return;
      const beatMs = msPerBeat(bpm);
      const beat = f.nowMs / beatMs;
      const top = hudLayout(f.width, f.judgmentLineY).panel.h; // under the HUD band
      const s = sonataSettings;
      // The strip: how many merged PRs have sounded, of how many, and when that was.
      ctx.fillStyle = "rgba(3, 6, 7, 0.82)";
      ctx.fillRect(0, top, f.width, s.stripPx);
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = canvasFonts.data(14);
      ctx.fillStyle = "#e2e6f0";
      const count = beat < 0 ? 0 : counterAt(notes, beat);
      ctx.fillText(`MERGED PR ${String(count).padStart(3, "0")} / ${notes.length}`, 16, top + s.stripPx / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#7d8496";
      ctx.fillText(`${beat < 0 ? "" : clockAt(notes, beat).toUpperCase()} ET`, f.width - 16, top + s.stripPx / 2);
      if (reducedMotion()) return; // the counter only: no riding labels
      // Each upcoming note's subject rides beside it: the right hand's to its right, the left hand's to its left.
      const line = f.judgmentLineY;
      const pxPerMs = line / settings.lookaheadMs;
      const last = { R: -Infinity, L: -Infinity };
      ctx.font = canvasFonts.data(s.labelPx);
      ctx.globalAlpha = s.labelAlpha;
      ctx.fillStyle = "#e2e6f0";
      for (const n of notes) {
        const y = line - (n.beat * beatMs - f.nowMs) * pxPerMs;
        if (y > line || y < top + s.stripPx + s.labelPx) continue;
        if (Math.abs(y - last[n.hand]) < s.labelGapPx) continue;
        last[n.hand] = y;
        const k = f.keyX(n.pitch);
        const text = n.subject.length > s.labelChars ? `${n.subject.slice(0, s.labelChars - 1)}…` : n.subject;
        ctx.textAlign = n.hand === "R" ? "left" : "right";
        ctx.fillText(text, n.hand === "R" ? k.x + k.width + 8 : k.x - 8, y - 6);
      }
      ctx.globalAlpha = 1;
    },
    resultsPanel: () => createElement("a", { ...kitButton("secondary"), href: "/sonata", "data-testid": "x-build-sonata-back" }, "Back to the Build Sonata"),
  };
}

export const buildSonataX: Experiment = {
  name: "build-sonata",
  title: "The Build Sonata",
  group: "Wow",
  line: "The night the agents built Étude, as music (#1162)",
  issue: 1162,
  href: "/sonata?x=build-sonata", // x= is the registry's own rule; the page ignores it
  plugin: sonataPlugin,
};
