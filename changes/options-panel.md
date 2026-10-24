## What shipped
On `/`, an Options button (bottom left, `O`) opens a drawer from the right: latency offset with Calibrate beside it, effects volume, Mute, Miss sound, and note labels (Auto / Note names / Laptop keys / Off). ↑/↓ move between rows, ←/→ change the value, Enter ticks a box, Esc closes and puts the focus back on the song card. It reads and writes the storage each setting already used, so `/play` picks the values up with no change; latency and labels apply from the next song. The standalone "Calibrate latency" link is gone. A native `<dialog>` does the focus trap and the inert page behind it.
## Where it lives
`web/src/game/options-panel/` (drawer, CSS module, tests, `verify-options.mjs`) · `web/src/app/page.tsx` renders it (#385) · screens in `specs/features/options-panel/screens/`
## How to check it
`node web/src/game/options-panel/verify-options.mjs --out <dir>` prints `verify-options: pass`: the spec's three steps at 1280×720 and 1920×1080, plus reduced motion. `verify.py --slug options-panel`: pass at 187951f.
## Gaps
- **Not verified by Eric:** set up a game from the drawer alone.
- The drawer is on `/` only; `/play`'s own sliders stay where they were.
