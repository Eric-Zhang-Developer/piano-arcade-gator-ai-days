## What shipped
One CSS pass on `/veritas` in visual-direction's look (#607):
- The hero has a cabinet marquee.
- Each take's strip is a black lane, and its notes flare white as the playhead passes.
- Marks stamp in their own color, and the dashboard reads as a framed scoreboard.
- At 1920 the takes run two to a row.
- Read text is at the video floor (16 px at 1280, 24 px at 1920), except dense EARLY/LATE/ROLLED marks.
## Where it lives
- `web/src/app/veritas/veritas.module.css`, the only file #607 changed.
- `specs/decisions/veritas-polish-pass-1.md`: the choices, two Look rounds, and why there's no pass 2.
- `specs/features/veritas-polish/`: `shoot.mjs` and the before and pass-1 screenshots.
## How to check it
`verify: node web/src/veritas/verify-veritas.mjs --out <dir> pass at 2e6f52d`, run on main after #607. `pnpm -C web exec vitest run src/veritas`: 74 passed plus 1 expected fail.
## Gaps
- The Look stopped at round 2 (7.8). Chord Roller's 89 ROLLED marks still read as three thin magenta lines. Fixing that needs markup (#610), which a CSS pass can't add.
- Dense marks at 0.6em (14 px at 1920) are under the 24 px floor on purpose: not one of 79 is readable at any size, and the tally beside them is.
- No pass 2.
- Eric's eye: not verified by Eric.
