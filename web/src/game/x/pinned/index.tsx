// Pinned (spec: pinned, #1171): your take as a brass music-box cylinder, a steel comb and an STL, at /musicbox. With
// ?x=pinned on /play, the results get a link that pins the take just played.
import Link from "next/link";
import type { Experiment } from "..";
import { kitButton } from "../../duo-tokens";
import { saveLast } from "./take";

export const pinned: Experiment = {
  name: "pinned",
  title: "Pinned",
  group: "Wow",
  line: "Your take as a brass music-box cylinder, with an STL (#1171)",
  issue: 1171,
  href: "/musicbox?x=pinned",
  plugin: () => ({
    id: "x-pinned",
    resultsPanel: ({ chart, take }) => {
      if (!take.events.length) return null;
      saveLast({ chart, take }); // the chart as played: after every transformChart
      const k = kitButton("secondary");
      return (
        <Link href="/musicbox?take=last" data-testid="x-pinned-link" className={k.className} style={k.style}>
          Pin it on a music box →
        </Link>
      );
    },
  }),
};
