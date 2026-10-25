## What shipped
The Duo HUD, in five steps:
1. Two bracketed clusters drawn with the kit's `drawBrackets`: the song tag with `BAR n / N` and progress, and the combo with ACC and SCORE (#713).
2. The white-hot 2 px hit line, 2 px note pills, and the judgment word in the display face (#747, #860).
3. Sparks: dropped for hit-particles.
4. The overlays square, in hairline frames (#777 #779 #780 #778 #781).
5. `verify-hud.mjs` and the shots.
## Where it lives
`web/src/game/hud/`, `web/src/game/duo-hud/` (test, `verify-hud.mjs`), the overlays' own folders, shots in `specs/features/duo-hud/`.
## How to check it
not verified locally; covered by CI (`verify-hud` runs in main's scheduled full run). Unit tests: `vitest run src/game/duo-hud src/game/hud` 33/33.
## Gaps
Eric's 10 s cold-open shot on the DGX with the LED strip (Validation 3) isn't taken. Not seen by Eric.
