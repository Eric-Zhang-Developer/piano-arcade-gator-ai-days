## What shipped
Notes drawn as `visual-direction.md` says. They are rounded pills sized to their key, with black-key notes 56% the width of white-key notes. A note rises from 35% brightness at the top of the lookahead to 100% at the line, its flare head clipped to the rounded end and white-hot at the line. Hue still comes from `hand-colors`, and repeated notes keep core's gap. The helpers `pillRect` and `brightness` landed in #209; `drawHighway` uses them since #213.
## Where it lives
`web/src/game/note-pills/` (helpers and test); `web/src/game/core/highway.ts` (#213); `specs/decisions/note-pills-dimming.md`; before/after screenshots in `specs/features/note-pills/`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at d9801d0. `pnpm -C web test` checks the 56% ratio on the real layout, centering, rounded ends, the brightness ends (0.35, 1) and that brightness only rises; core's highway tests pass unchanged. Screenshots show Maple Leaf Rag (the densest song) mid-passage at 1280×720 and 1920×1080, with and without reduced motion. Eric's eye: **not verified by Eric** (play two hands; can you tell what's next and which hand?).
## Gaps
note-labels still sizes black-key labels to 84% of the key, but black-key pills are now about 78% of it, so a label can be a little wider than its pill. The fix is for note-labels to use `pillRect`.
