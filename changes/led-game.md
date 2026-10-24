## What shipped
With the LED board connected, the strip plays along. Each next key glows in its hand color 600 ms before its note. A hit lights its key in the HUD's judgment color, a release turns it off, and a miss flashes red. A heartbeat goes out every second, and the strip clears at song end, on quit and on page hide. "Connect lights" on /play's start screen opens Web Serial. A board Chrome granted before reconnects on load; with no Web Serial the button says so and play is unchanged.
## Where it lives
`web/src/game/leds/` (`messages.ts` the bytes, `serial.ts` the link, `index.tsx` the plugin and button, `leds.test.ts`, `verify-leds.mjs`) · one line in `web/src/game/layers.ts` · `specs/decisions/led-game-colors.md`
## How to check it
`verify: … pass at f060ccb` (verify.py, plain play unchanged). `node web/src/game/leds/verify-leds.mjs --out <dir>` → `verify-leds: pass` at 9f58e38: a fake board got 42 of 42 hints from 500 ms ahead, 42 gold key ons, 42 offs, a heartbeat a second, and f0 at the end. `pnpm -C web exec vitest run src/game/leds`: 6 pass.
## Gaps
- **Not run with the real board or strip:** the spec's piano step (Eric) is open, and so is whether Chrome holding a real port behaves like the fake one.
- At 1280×720 the button's row pushes the start screen's last line (MIDI status) about 15 px below the fold; fine at 1920×1080. The start screen's stacked rows are the cause.
- A wrong (extra) key doesn't light; the spec names only judged notes.
