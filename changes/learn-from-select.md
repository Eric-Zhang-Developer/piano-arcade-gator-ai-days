## What shipped
On `/`, L (plain l or L; Cmd+L and Ctrl+L stay the browser's) opens the focused song in wait mode, `/play?song=<id>&mode=wait`, and stops its preview at once. The focused song's preview row has a LEARN link to the same URL, shown before the chart loads. Enter and click still open a judged take. The hint reads `↑ ↓ choose · Enter play · L learn`. The preview row now scales with the screen, so its links are 24 px at 1920×1080.
## Where it lives
`web/src/game/select-layout/` and `web/src/game/song-preview/` (#283); `web/src/game/learn-from-select/verify-learn.mjs`; screenshots in `specs/features/learn-from-select/look/`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at 26d0f32 (Enter still opens Twinkle from `/`). `node web/src/game/learn-from-select/verify-learn.mjs --out <dir>` prints `verify-learn: pass` after all 5 steps; a build with the modifier rule removed fails step 4. `verify-preview.mjs`: 13/13, including L's queue clear and All Notes Off.
## Gaps
Not tried on the piano (Eric: highlight Für Elise on `/`, press L, learn its first bar). The taste v2 Look pass ended at 7.0 overall after two rounds; the cap is the rubric's photography rule, which this screen doesn't follow by design. ui-sounds' `confirm` hasn't landed, so L plays no sound.
