## What shipped
The music select on `/` in the Duo look:
- Each row draws the song's own piano roll in the two hand colors, and the WebGL stage is gone.
- The focused song sits in a bracketed panel: its roll, the title, LV / NOTES / BEST cells, and Next for you (only after a real take).
- PLAY, plus PRACTICE, which opens adaptive practice (`practice=adapt`). P does the same, and the help card lists it.
- Hands, Speed and the level stay in the panel as square Duo chips.
## Where it lives
- `web/src/game/duo-select/`: `roll.ts`, `PianoRoll.tsx`, `Select.tsx`, `next-for.ts` and `verify-select.mjs`.
- The mount is in `web/src/game/select-layout/` (#714). The look-loop fixes are in #734. The before and after shots are in `specs/features/duo-select/shots/`.
## How to check it
`node web/src/game/duo-select/verify-select.mjs --out <dir>`: not verified locally (Eric's load rule, 2026-10-25). It's covered by main's scheduled full run. Validation 1 (vitest duo-select) passes 7/7.
## Gaps
- **Validation 3, Eric's look, not done yet.** The taste v2 look loop scored round 2 at 7.5. It leaves a dead band under the panel at 1920×1080.
- verify-select hasn't passed a run yet. Its first local attempt timed out waiting for the shared lock, and then the load rule stopped local runs.
