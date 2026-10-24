## What shipped
The judgment line is a gently moving white stroke within ±2 px, with a soft glow and a soft shadow on the key tops so it reads against white keys. Over each pressed key it brightens into a white-hot blob fading to that key's light color (the hand's color when it hit a note). Under reduced motion it's a static line. The path helper landed in #218; `drawHighway` draws it since #225.
## Where it lives
`web/src/game/hit-line/` (`hitLinePath` and its test); `web/src/game/core/highway.ts` (#225); `specs/decisions/hit-line-look.md`; screenshots in `specs/features/hit-line/`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at f14deab. `pnpm -C web test` checks that the path stays within ±3 px at every time from −4 s to 60 s, is the same for the same time, moves, spans the width, and is flat when still. There's a line crop with two keys lit (Ode to Joy's beat-8 chord) at 1280×720 and 1920×1080, with and without reduced motion. Eric's eye: **not verified by Eric** (is the line lively but not distracting?).
## Gaps
The pressed-key blob reaches 10 px above the line, past the spec's 6 px, only over a key whose note just landed (decision file). The screenshots composite the page's canvases, so DOM layers aren't in them.
