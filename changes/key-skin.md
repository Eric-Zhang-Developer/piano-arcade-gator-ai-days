## What shipped
The drawn keyboard polished. White keys have a top-to-bottom sheen; black keys have a beveled near end with a thin highlight. A pressed key fills with the hand color of the note it played, or plain white when it matched no note (never red), glows onto its neighbors and shades darker toward the near end. Positions and widths are unchanged. The painters landed in #232; `drawHighway` uses them since #237.
## Where it lives
`web/src/game/key-skin/` (painters and test); `web/src/game/core/highway.ts` and `settings.ts` (#237, `keyLitColor` is now white); `specs/decisions/key-skin-look.md`; screenshots in `specs/features/key-skin/`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at 42ece74. `pnpm -C web test` pins `keyX` across a full 88-key layout (whites tile the width, blacks are 0.6 wide and centered on their boundary) and checks that a pressed key fills with exactly its light. There's a keyboard crop with both hands pressing (Ode to Joy's beat-8 chord) at 1280×720 and 1920×1080, with and without reduced motion. Eric's eye: **not verified by Eric** (are pressed keys clear while playing?).
## Gaps
The white "no note" press has no screenshot (the scripted take hits every note); its fill is covered by core's highway test. juice's lane light for a stray press turns white along with the key.
