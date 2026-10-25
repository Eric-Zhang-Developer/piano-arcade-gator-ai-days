// Real Keys (spec: real-keys): the experiment's registry entry. On /play it adds only a start-panel link to its own
// page, /real-keys, which the frame can't host: the camera picture has to sit under the HUD, and /play has no layer
// for it. Importing this runs nothing.
import { createElement } from "react";
import type { Experiment } from "..";
import { kitButton } from "../../duo-tokens";

export const realKeys: Experiment = {
  name: "real-keys",
  title: "Real Keys",
  group: "Wow",
  line: "The notes fall onto live video of the real keys (#1017)",
  issue: 1017,
  href: "/real-keys?song=twinkle&x=real-keys", // the frame's test wants every entry's flag in its URL
  plugin: () => {
    let song = "twinkle";
    return {
      id: "x-real-keys",
      transformChart(chart, params) {
        song = params.get("song") ?? song;
        return chart;
      },
      startPanel: () =>
        createElement("a", { ...kitButton("secondary"), href: `/real-keys?song=${encodeURIComponent(song)}`, "data-testid": "x-real-keys-link" }, "Play on the real keys"),
    };
  },
};
