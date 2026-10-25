// Highlight reel (spike: highlight-reel, #913): a take becomes a 15-second broadcast replay, rendered from the take and
// saved as WebM. On /play, only with ?x=highlight-reel: the results panel saves the finished take for /highlight and
// links there. The page is web/src/app/highlight/; FINDINGS.md has the spike's answer.
import Link from "next/link";
import type { Experiment } from "..";
import { kitButton } from "../../duo-tokens";
import { saveLast } from "./take";

export const highlightReel: Experiment = {
  name: "highlight-reel",
  title: "Highlight reel",
  group: "Wow",
  line: "A take becomes a 15-second broadcast replay video (#913)",
  issue: 913,
  href: "/highlight?take=last&x=highlight-reel",
  plugin: () => ({
    id: "x-highlight-reel",
    resultsPanel: ({ chart, take, results }) => {
      saveLast({ chart, take, results }); // the chart as played: after every transformChart
      return (
        <Link href="/highlight?take=last" data-testid="highlight-reel-link" {...kitButton("secondary")}>
          Highlight reel →
        </Link>
      );
    },
  }),
};
