## What shipped
On two-hand charts the left hand is azure and the right mint (the visual direction's tokens), on falling notes, lit keys, flares, wisps, sparks and lane light, with an L/R legend during the count-in. One-hand charts look as before; MISS color unchanged.

## Where it lives
`web/src/game/hand-colors/index.ts` (`handColor`, `noteColorFor`, the legend), `web/src/game/core/highway.ts` and `web/src/app/play/page.tsx` (#201), `web/src/game/juice/` (#204), one line in `web/src/game/layers.ts`.

## How to check it
`verify: … pass at 546dc58`. Headless Chrome, `.git/agent-evidence/hand-colors/`: `legend-count-in.png`, `fur-elise-left-key-lit.png`, and `fur-elise-{none,protanopia,deuteranopia,tritanopia}.png` (DevTools vision emulation) with a left-hand burst.

## Gaps
The piano check is Eric's and not done: play Für Elise's opening and say whether the hands are easy to tell apart at a glance. Tritanopia is the weakest mode: both hands turn cyan and differ mainly in lightness (simulated ΔE 26). The colors are the visual direction's tokens, so changing them is a visual-direction call.
