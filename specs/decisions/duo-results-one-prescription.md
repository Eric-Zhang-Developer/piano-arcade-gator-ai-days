# duo-results: one practice prescription per results screen (#1026)

**Context.** One scored take got two prescriptions: the tutor's PRACTICE BARS 5–8 at 70% (`duo-results/scores.ts`,
`weakestRun`, runs grown up to 4 bars) and Details' "Practice bars 7–8 at 80%" (`weak-bars`, fixed 2-bar phrases).

**Options.** A: the tutor wins; weak-bars keeps its per-phrase numbers and drops its button and weakest mark.
B: weak-bars' phrases win and the tutor reads them. C: weak-bars' button links to the tutor's run.

**Choice: A.** The tutor is the screen's primary action, it's the one "next for you" saves, and its run follows the
weak bars instead of a fixed 2-bar grid. C would show the same button twice. On a wait take there is no tutor, so
weak-bars keeps its mark and button there.

**How to undo.** In `weak-bars/index.ts`, set `prescribes` back to `true`.
