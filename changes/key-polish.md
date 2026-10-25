## What shipped
The drawn keyboard and the falling notes, polished in one pass. White keys are ivory with a gap bevel and a front lip; black keys have a top face, a front face, a gloss stripe and a shadow on the whites. A pressed key dips (its lip shrinks) and is lit from the hit line down: exactly its hand color at the top, fading toward the near end, spilling onto its neighbours, and fading over 140 ms after release (a cut under reduced motion). Notes keep their width and exact hue, with 2 px corners, a lifted leading end, a fine rim, a soft white-hot head and a glow over their last 400 ms. A held note's remainder feeds into its key instead of vanishing on the hit.
## Where it lives
`web/src/game/key-skin/index.ts`, `web/src/game/core/highway.ts` (notes, release fade, `notePolish`), `web/src/game/note-pills/index.ts` (#749's 2 px corners), `web/src/game/core/key-polish.test.ts`, `specs/decisions/key-polish-brief.md` and `key-polish-note-width.md`, and shots in `specs/features/key-polish/`.
## How to check it
`pnpm -C web exec vitest run --passWithNoTests src/game/key-skin src/game/note-pills src/game/core src/game/key-preview src/game/hit-line`: 66 pass. Perf: `perf.mjs` on maple-leaf-rag in fever at 1920×1080, run locally against a dev server under verify.lock. p95 was 1.8–2.4 ms before (origin/main's painters) and is 2.0–2.7 ms after; the budget is 6 ms. Browser checks are not verified locally; they're covered by main's scheduled full run. Seen in the in-app browser on Maple Leaf Rag and Clair de Lune. Not seen by Eric.
## Gaps
- **Perf:** measured on a dev server, not a production build, because the disk was nearly full. perf.mjs marks some runs invalid ("fever-stage froze the stage" about 45 s in), before and after alike, so that's existing stage behaviour.
- **Velocity:** dropped. No chart carries it, and the press's velocity doesn't reach the draw code.
- **Rebase:** #747's hit line and #600 also change `highway.ts`. Whichever lands second rebases.
