## What shipped
ESP32 firmware with two light modes on the WS2812B strip. Quiet, the default, is key light plus a ripple (700 ms), breathing hints, and a dim rainbow after 15 s with no bytes. Full is the show: hint build-up, wrong-key red, count-in bar, fever, pause rainbow, finale and idle aurora, with ripples off until setting 6 turns them back on. Setting 15 (`0xB0`) switches them. The tester and the playground each have that menu. Save (setting 20) keeps the choice.
## Where it lives
`firmware/piano_leds/piano_leds.ino` (setting 15 at the top) · `firmware/tester.html` (section 2) · `firmware/playground.html` (Look) · `firmware/hosttest/` · `firmware/README.md` · `specs/decisions/led-strip-light-modes.md`
## How to check it
`firmware/hosttest/run.sh` → `all checks passed` (quiet is the default, setting 15 switches both ways, the show still runs, the dim rainbow stays quiet). ESP32 Dev Module, esp32 core 2.0.17, FastLED 3.9.4: no errors, 305,813 bytes flash (23%), 29,148 bytes RAM (8% of 327,680). Not uploaded. AddressSanitizer + UBSan, 3 runs, no findings. `verify.py`: not verified. It plays the web app, which this change does not touch, and seeing the two looks needs the strips.
## Gaps
- **Not flashed, and not watched on the strip.** Quiet versus full, the menu, and the saved choice are laptop checks only. Earlier strip-1 notes are in `firmware/RESULTS.md` and do not cover this firmware.
- **The game does not send setting 15.** Switch from the tester or the playground, then Save to board, if the game should use Full. The in-game menu row is a needs-human issue for Eric.
- A board saved from unmerged #720 can boot with the show's fields still set while `light=0`, until Quiet or Full is picked again.
