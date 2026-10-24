## What shipped
ESP32 firmware that lights the WS2812B strip over the DGX-660's keys from small serial messages: key on/off with a hit flash and fade, a breathing hint layer for "play this next", a ripple of the key's color along the strip on every key on (setting 6, default 700 ms, 0 = off), a 2.5 s stuck-key watchdog, a 15 s idle rainbow, and settings saved to flash. Plus a Chrome tester that works with no game (connect, hour-0 tests, calibration, free play, Twinkle guide lights, latency) and reconnects the board and piano by itself after the first click.
## Where it lives
`firmware/piano_leds/piano_leds.ino` (protocol at the top) · `firmware/tester.html` · `firmware/hosttest/` · `firmware/README.md` (wiring, flashing, calibration, the game's protocol) · `firmware/TEST-PLAN.md`
## How to check it
`firmware/hosttest/run.sh` → `all checks passed` (mapping, no shared LEDs, resync, fade, hint layer, ripple, settings save, joint gap, watchdog). ESP32 Dev Module compile with esp32 core 2.0.17 and FastLED 3.9.4: no errors, 22% flash. On a real ESP-WROOM-32 with no strip: upload passed, hello answered, 100 pings round trip median 2.6 ms, p95 2.7 ms, 0 lost; `show()` 5.5 ms for 177 LEDs. `verify.py`: not verified. It plays the web app, which this feature doesn't touch, and the LED steps need the strips (see Gaps).
## Gaps
- **Not verified on hardware with LEDs:** the strips haven't arrived. Every Validation step that needs light is open: boot test, GRB color order, calibration sweep, free play, guide lights, watchdog unplug, ripple feel, and whether 3.3 V data drives the strip without a level shifter. `firmware/TEST-PLAN.md` is the run.
- **Plug and play is checked against a simulated serial port only,** not Chrome holding a real port.
- **The game link is `led-game` (Eric).** The protocol it uses is in `firmware/README.md`, "For the game".
