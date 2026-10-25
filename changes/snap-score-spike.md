## What shipped
A tech spike: `claude-opus-5-5` reads a page of printed score into a chart, and a scorer diffs it against the committed chart with a no-image recall control. On clean renders it reads 98.7–100%, but only fur-elise meets the full yes: minuet-g is recall (100% without the image), and ode-to-joy fails the rules on its SATB inner voices. Verdict: iterate. Photos are pending.
## Where it lives
`spikes/snap-score/` (`snap.mjs`, `prompt.md`, `score.mjs`, `FINDINGS.md`), `specs/decisions/snap-score-spike-measure.md`
## How to check it
`node spikes/snap-score/snap.mjs --self-test` (passes, no network). `node spikes/snap-score/score.mjs` prints the table; it needs the local renders and reads, which stay uncommitted. This spike has no game change, so there's no verify.py line to run.
## Gaps
No phone photos read yet (Validation 2 is partly done: 3 clean reads and 3 recall reads of 9). Clef changes, 8va and triplets aren't on any of the three pages. All three pieces are famous.
