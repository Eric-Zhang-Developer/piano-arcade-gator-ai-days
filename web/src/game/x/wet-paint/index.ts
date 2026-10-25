// Wet Paint (spec: wet-paint): the registry entry. Free play has no chart, so it can't run on /play: it lives at
// /paint, and its plugin has no hooks (?x=wet-paint on /play does nothing). Importing this runs nothing.
import type { Experiment } from "..";

export const wetPaint: Experiment = {
  name: "wet-paint",
  title: "Wet Paint",
  group: "Wow",
  line: "Free play: every note blooms as paint, wet while the pedal is down (#1106)",
  issue: 1106,
  href: "/paint?x=wet-paint", // the frame's test wants every entry's flag in its URL
  plugin: () => ({ id: "x-wet-paint" }),
};
