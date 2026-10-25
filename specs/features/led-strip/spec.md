---
name: LED strip: the keys light up from the board, with a standalone tester
depends_on: []
owns: ["firmware/"]
assignee: "sharan"
---

# LED strip

Two 1 m WS2812B strips (144/m, GRB, chained over JST) sit along the back of the DGX-660's keys, driven by an ESP32
dev board over USB serial. The browser decides what lights; the board maps notes to LEDs and animates. Lives in
`firmware/`: the sketch (`piano_leds/`), a Chrome tester page (`tester.html`) that works with no game, and a laptop
build of the sketch with checks (`hosttest/`). Wiring, flashing and calibration are in `firmware/README.md`.

## Requirements
- **Protocol** (115200 baud; status bytes have the high bit set, data bytes are 0-127, so a lost byte resyncs on
  the next status byte): `0x90 note r g b` key on, `0x80 note` key off, `0xA0 note r g b` hint (0,0,0 clears),
  `0xB0 param lo hi` setting, `0xC0 lo hi r g b` raw LED, `0xF0` clear, `0xF1` hello, `0xFE` heartbeat.
  On boot and on `0xF1` the board prints one line starting `PAL1 leds=` with its current settings.
- **Mapping:** MIDI 21-108 spread evenly by semitone between two calibrated points (A0 and C8). Neighbouring keys
  never share an LED, except a key whose slot falls in the gap at the strip joint, which borrows the nearest LED.
- **Layers:** a held or fading key beats a hint on the same key. Released keys fade over `fadeMs` (default 180).
- **Watchdog:** 2.5 s with no bytes releases every held key. In quiet mode, 15 s with no bytes plays a dim idle animation.
- **Light modes** (setting 15): **Quiet** (0, the default) is key light plus a ripple, breathing hints, and that dim rainbow. **Full** (1) is the show: hint build-up, wrong-key red, count-in bar, fever, pause rainbow, finale and idle aurora, with ripples off until setting 6 turns them back on. The tester and the playground each open a menu that sends setting 15. Save (setting 20) keeps the choice. The game does not send it yet.
- **Power:** `FastLED.setMaxPowerInVoltsAndMilliamps(5, 3000)`.
- **Settings** (brightness, fade, calibration, joint gap, reverse, and the light mode) save to flash and survive power off.
- **Tester:** connect board and piano, hour-0 tests, calibration nudges and save, free play, a Twinkle guide-lights
  demo (the next key glows; hit it and it turns green, a wrong key flashes red).

## Validation
- `firmware/hosttest/run.sh` -> ends with `all checks passed` (mapping, no shared LEDs, resync, fade, hint layer,
  settings save, joint gap, watchdog). Keep the output.
- Arduino IDE, board "ESP32 Dev Module" -> the sketch compiles and uploads. Keep the compile output.
- Power on -> lowest key's LEDs red, highest key's blue for 1 s. Photo.
- `tester.html` -> Connect LED board shows "ready"; after calibration, Sweep all keys lights every key over its own
  key, left to right. Video.
- Piano connected, free play -> each key lights while held and fades after release; a 10-note chord lights all ten.
- Guide-lights mode -> Twinkle plays through once with every next key lit before it's pressed. Video.
- Unplug the USB serial cable while a key is held -> the light goes out within 3 s.

## Defaults
- Data pin GPIO18. No level shifter: short data wire and shared ground first; README lists the fixes if it flickers.
- If a frame takes too long (288 LEDs show in about 9 ms), drive only the LEDs the calibration uses.
