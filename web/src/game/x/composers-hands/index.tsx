// The Composer's Hands (spike: composers-hands, #1069): the piano plays a composer's own roll, then duets his left hand
// with your right. Its page is /composers-hands; on /play, ?x=composers-hands only adds a link there, for songs with a roll.
import { createElement } from "react";
import type { Experiment } from "..";
import { kitButton } from "../../duo-tokens";
import { ROLLS } from "./rolls";

export const composersHands: Experiment = {
  name: "composers-hands",
  title: "The Composer's Hands",
  group: "Wow",
  line: "The DGX plays the composer's own roll, then you duet with his left hand (#1069)",
  issue: 1069,
  href: "/composers-hands?song=maple-leaf-rag&x=composers-hands", // x= is the registry's own rule; the page ignores it
  plugin: () => ({
    id: "x-composers-hands",
    startPanel: ({ chart }) =>
      ROLLS[chart.id]
        ? createElement("a", { ...kitButton("secondary"), href: `/composers-hands?song=${chart.id}`, "data-testid": "x-composers-hands-link" }, "Hear the composer play it")
        : null,
  }),
};
