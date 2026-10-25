## What shipped
ESP32 firmware for the WS2812B strip over the DGX-660's keys, with two modes. **Calm**, the default: each key lights in its hit color and fades, the next key's hint brightens evenly (as the eye sees it) to the full hand color as its note lands, a key released without lighting flashes red, and the count-in, fever, pause, the end and idle get soft brightness-only glows; idle with no laptop is a dim standby pulse. **Demo** adds the ripple on every hit, as the first firmware did. Setting 15 switches them: the board's BOOT button, the tester, the playground, or the game's pause menu (#1235). Shows draw at ~60%, brightness 110.
## Where it lives
`firmware/piano_leds/piano_leds.ino` (protocol and settings at the top) · `firmware/tester.html` · `firmware/playground.html` · `firmware/hosttest/` · `firmware/README.md` · `specs/decisions/led-strip-light-modes.md`
## How to check it
`firmware/hosttest/run.sh` → `all checks passed` (mapping, protocol, the hint ramp, wrong-key red, the count-in, fever mirrored from the hit colors, pause, finale, idle and standby, calm never sparks, the BOOT switch, old saves still load). AddressSanitizer + UBSan clean. ESP32 Dev Module, esp32 core 2.0.17, FastLED 3.9.4: no errors, 23% flash. Flashed to the board on 2026-10-25; it answers and keeps its saved settings. The game's own Twinkle messages replayed through the sketch: 0 false reds, 0 false pauses. `verify.py`: not verified, it plays the web app, which this feature doesn't touch.
## Gaps
- Watched on strip 1 only in part (earlier builds); this exact build hasn't been played on the strip end to end. Strip 2 isn't wired.
- Fever reads the HUD's judgment colors: if `ui-tokens` changes them, `judgedFrom` must follow.
- Wait mode holding a note, or a rest over 2 s, also starts the pause glow; it stops at the next message.
