// A sample experiment (spec: experiments), labeled as one: it proves the frame end to end with a corner tag on the
// highway and a line on the start screen, and does nothing else. Pruning it is the prune rule's first use.
import { createElement } from "react";
import type { Experiment } from "..";
import { MonoLabel } from "../../duo-tokens";
import { primary } from "../../ui-tokens";

export const sample: Experiment = {
  name: "sample",
  title: "Sample experiment",
  group: "The frame",
  line: "A SAMPLE tag in the highway's corner and a line on the start screen: proof that ?x= reaches /play's hooks.",
  issue: 878,
  href: "/play?song=twinkle&x=sample",
  plugin: () => ({
    id: "x-sample",
    draw(ctx, f) {
      const size = Math.max(12, Math.round(f.height / 60));
      ctx.font = `600 ${size}px ui-monospace, monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = primary;
      ctx.fillText("X · SAMPLE", f.width - size, f.judgmentLineY - size);
    },
    // The kit's data label in a hairline frame, in the slot under Start, which takes its height from Start, not the modes.
    startPanel: () =>
      createElement(
        "p",
        { "data-testid": "x-sample-panel" },
        createElement(
          MonoLabel,
          { dim: false, style: { display: "inline-block", border: "1px solid var(--pa-line)", padding: "0.4em 0.8em", fontSize: "clamp(16px, 1.25vw, 24px)" } },
          "Experiment on · x=sample",
        ),
      ),
  }),
};
