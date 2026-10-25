// Conductor (spike: conductor, #985): wave a hand at the laptop camera and the piano plays the song at your tempo.
// Its page is /conduct; on /play, ?x=conductor only adds a link there from the start screen.
import { createElement } from "react";
import type { Experiment } from "..";
import { kitButton } from "../../duo-tokens";

export const conductor: Experiment = {
  name: "conductor",
  title: "Conductor",
  group: "Wow",
  line: "Wave a hand at the camera and the piano follows your tempo (#985)",
  issue: 985,
  href: "/conduct?song=moonlight-1&x=conductor", // x= is the registry's own rule; /conduct ignores it
  plugin: () => ({
    id: "x-conductor",
    startPanel: ({ chart }) => createElement("a", { ...kitButton("secondary"), href: `/conduct?song=${chart.id}`, "data-testid": "x-conductor-link" }, "Conduct this song"),
  }),
};
