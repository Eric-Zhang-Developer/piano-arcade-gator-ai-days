// Inside the Piano (spec: inside, #1226): a live cutaway of a grand's action, driven by the DGX, at /inside. On /play
// it does nothing; the Lab links to its page.
import type { Experiment } from "..";

export const inside: Experiment = {
  name: "inside",
  title: "Inside the Piano",
  group: "Wow",
  line: "A grand's hammers and dampers, moved live by the DGX's keys and pedal (#1226)",
  issue: 1226,
  href: "/inside?x=inside", // x= is the registry's own rule; the page ignores it
  plugin: () => ({ id: "x-inside" }),
};
