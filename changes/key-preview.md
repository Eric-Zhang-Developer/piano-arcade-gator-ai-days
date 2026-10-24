## What shipped
A key glows faintly in its note's hand color for the last 500 ms before the note reaches the line, rising linearly to alpha 0.35, and drops out once the note is hit or its time passes; in wait mode a held note keeps its key at peak. A white key's fill is clipped around its black neighbours, and there's no glow, so it reads calmer than a press. On for every input; `?keypreview=0` turns it off.
## Where it lives
`web/src/game/key-preview/` (`previewAlpha`, `previewKeys`, the layer, `verify-key-preview.mjs`), one line in `web/src/game/layers.ts` after `ghost()`
## How to check it
`node web/src/game/key-preview/verify-key-preview.mjs --out <dir>` -> `verify-key-preview: pass` (held Twinkle: C4 at 0.35, G4 unlit; `keypreview=0` lights nothing; C4's pixel differs from the off run by 38, G4's by 0; Ode to Joy mid-take at 1280×720 and 1920×1080). `verify.py --slug key-preview` pass at 881b4b2 (42/42 PERFECT, test input and the MIDI path on /sim).
## Gaps
Not tried (Eric): Twinkle on laptop keys and Für Elise on the piano. Does the preview help, and is a previewed key ever mistaken for a pressed one? 500 ms and 0.35 are starting values for that. The 0.62 black-key height is mirrored from drawHighway, not imported.
