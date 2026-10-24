## What shipped
Z and X move the laptop keys an octave down or up, and on zooming charts the map follows the view when fewer than 5 of its white keys are on screen. A cyan bar and wash mark the keys the laptop plays, with Z and X chips when that move is allowed; it hides after the first MIDI note-on. The start screen says "Z / X: octave down / up" when a move is possible. Twinkle and other non-zooming charts play exactly as before.
## Where it lives
`web/src/game/laptop-octaves/` (rules, plugin, tests, `look-octaves.mjs`), one line in `web/src/game/layers.ts`, `setLaptopShift` in note-labels (#303), `specs/decisions/laptop-octaves-highlight.md`.
## How to check it
`verify.py --slug laptop-octaves` pass at 23f996a, 42/42 PERFECT with test input and on /sim. `node web/src/game/laptop-octaves/look-octaves.mjs --out <dir>` takes the Für Elise and Chopin screenshots in `specs/features/laptop-octaves/look/`.
## Gaps
Stranger's first 60 seconds: **not done** (it needs a real person; nobody has run it). Whether the auto-follow confuses anyone is unknown. The spec's default if it does: keep Z/X and drop the follow. Chrome checks ran in headless Playwright Chromium with simulated keys, not on a real laptop. In this run Für Elise's map stayed put through the count-in (5 keys still on screen) and moved before the right hand's first notes were under it, so a player may need X early.
