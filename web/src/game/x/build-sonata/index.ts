// The Build Sonata (spec: build-sonata, #1162): the DGX performs the night the agents built Étude, one note per merged
// PR. Its page is /sonata; on /play, ?x=build-sonata adds the merged-PR counter and the night's clock under the HUD
// band, each note's subject riding beside it, and a link back to /sonata on the results.
import { createElement } from "react";
import type { Experiment } from "..";
import type { Frame, GamePlugin } from "../../../contracts";
import { msPerBeat, settings } from "../../core/settings";
import { canvasFonts, kitButton } from "../../duo-tokens";
import { meterLayout } from "../../fever-gauge";
import { buildSonata, clockAt, counterAt, type Snapshot, type SonataNote } from "./sonata";

export const sonataSettings = {
  stripPx: 30, // the counter's strip under the fever gauge
  labelPx: 12, // a riding subject's size
  labelAlpha: 0.42, // low contrast: it rides with the music, it isn't read like the HUD
  labelGapPx: 28, // a label closer than this to the last one on its side is skipped
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
      const top = meterLayout(f.width, f.judgmentLineY).bottom; // under the HUD band and the fever gauge's word
      const s = sonataSettings;
      // The strip: how many merged PRs have sounded, of how many, and when that was. The clock follows the counter
      // (the right end is under the pause button), and the backing stops at the text, so the judgment's word stays lit.
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = canvasFonts.data(14);
      const count = beat < 0 ? 0 : counterAt(notes, beat);
      const counter = `MERGED PR ${String(count).padStart(3, "0")} / ${notes.length}`;
      const clock = beat < 0 ? "" : `${clockAt(notes, beat).toUpperCase()} ET`;
      const cw = ctx.measureText(counter).width;
      ctx.fillStyle = "rgba(3, 6, 7, 0.82)";
      ctx.fillRect(0, top, 16 + cw + 24 + ctx.measureText(clock).width + 16, s.stripPx);
      ctx.fillStyle = "#e2e6f0";
      ctx.fillText(counter, 16, top + s.stripPx / 2);
      ctx.fillStyle = "#7d8496";
      ctx.fillText(clock, 16 + cw + 24, top + s.stripPx / 2);
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
        const subject = n.subject.replace(/^Merge pull request (#\d+) from [^/]+\//, "$1 "); // the early merge commits
        const text = subject.length > s.labelChars ? `${subject.slice(0, s.labelChars - 1)}…` : subject;
        // A label that would run off its edge goes to the note's other side.
        const w = ctx.measureText(text).width;
        const right = n.hand === "R" ? k.x + k.width + 8 + w < f.width - 8 : k.x - 8 - w < 8;
        ctx.textAlign = right ? "left" : "right";
        ctx.fillText(text, right ? k.x + k.width + 8 : k.x - 8, y - 6);
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
