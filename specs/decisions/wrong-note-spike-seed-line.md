# Wrong-note spike: where the seed shows

**Context.** The spec says "The page shows the seed, so a set can be replayed." The page met that with a footer line
("SEED 9522 · SHIFT 2 · ON PORTABLE GRAND"). Issue #1039 calls that line debug, off /simon's Duo pattern.

**Options.**
- A: keep the footer line.
- B: drop it and show the seed in the session's set list, which the spec already has Eric copy into FINDINGS.md.
- C: drop it and also put the seed under the score.

**Choice.** B. The list has carried each finished set's song, shift and seed from the start, so a set can still be
replayed. The seed of a set in play isn't on screen until it ends. `window.__wrongNote.seed` and `?seed=` still give
it, and verify-wrong-note reads both. The footer keeps the piano's status, as /simon's does.

**How to undo.** Put the `seed … · shift …` MonoLabel back at the top of the footer in `app/wrong-note/page.tsx`.
