// A sample experiment (spec: experiments), labeled as one: it proves the frame end to end with a corner tag on the
// highway and a line on the start screen, and does nothing else. Pruning it is the prune rule's first use.
import { createElement } from "react";
import type { Experiment } from "..";
import { inkDim, primary } from "../../ui-tokens";

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
    startPanel: () =>
      createElement("p", { style: { margin: 0, color: inkDim }, "data-testid": "x-sample-panel" }, "Experiment on: sample (x=sample)"),
  }),
};
