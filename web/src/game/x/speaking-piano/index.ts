// The Speaking Piano (spike: speaking-piano, #1153): the DGX says a short phrase, the voice's spectrum struck on the 88
// keys. Its page is /speak; on /play its plugin has no hooks, so ?x=speaking-piano there does nothing.
import type { Experiment } from "..";

export const speakingPiano: Experiment = {
  name: "speaking-piano",
  title: "The Speaking Piano",
  group: "Wow",
  line: "The piano speaks a phrase (#1153)",
  issue: 1153,
  href: "/speak?x=speaking-piano", // x= is the registry's own rule; /speak ignores it
  plugin: () => ({ id: "x-speaking-piano" }),
};
