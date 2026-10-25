# video-cards: the end card's hierarchy and the facts line

Context: the spec orders the end card as the name, the tagline, the URL to type and a facts line, and leaves sizes and
the facts wording to the worker. Values are in `cards.module.css`, `endSlots` (`index.ts`) and `facts.ts`.

| Choice | Taken | Why, and the alternative |
|---|---|---|
| The lead link | The live URL when `NEXT_PUBLIC_LIVE_URL` is set, else the repo; in the ink, 6vh or smaller to fit one line | The URL is the card's job. The kit's blue measures 7.00:1 on the black, on the line; the ink is 16.27:1. |
| Fitting the lead | `min(6vh, 78.4vw / (chars × 0.51))`, the character count set inline | The 58-character repo URL ran off the right edge at 6vh (round 1). Saira 700 averages 0.502em per character on it; at 1920 it fits at 50.9 px with an x-height of 25.9 px (spec: 24 or more). A shorter live URL keeps 6vh. |
| The second link | The repo at 3.2vh in the kit's blue, only when a live URL exists | Smaller and coloured, so the eye lands on the URL to type first. |
| Facts wording | "766 pull requests merged, Oct 23–25, 2026", JetBrains Mono at 2.2vh, dim | Counts what git can prove. It never says "by agents": git can't tell who wrote a PR. |
| Range format | Same month: "Oct 23–25"; across months: "Sep 30–Oct 2"; one day: "Oct 25"; the year once at the end | The shortest unambiguous form. Dates are Eastern time, the event's zone. |
| Counting rule | build-sonata's: the first-parent log of `origin/main`, a commit counted when its subject ends in a PR number or is GitHub's "Merge pull request #n" | git counts 766 where GitHub counted 768 merged PRs when the snapshot was taken: #608's squash subject carries no PR number, and #5's merge commit reads "#4". The line shows git's count, the one a reader can re-run. |
| Freshness | `facts.json` is a snapshot from `node web/src/game/video-shots/make-facts.mjs` | Re-run it at the freeze; the spec accepts the gap. |
