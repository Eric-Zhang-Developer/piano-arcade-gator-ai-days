# Piano LED firmware

An ESP32 drives a WS2812B strip over the DGX-660's 88 keys. The browser does all the thinking and sends
small serial messages; the board maps notes to LEDs, fades, flashes hits, shows "play this next" hints,
and releases stuck keys if the browser goes quiet.

| Path | What |
|---|---|
| `piano_leds/piano_leds.ino` | The firmware. The protocol is documented at the top of the file. |
| `tester.html` | Chrome page: connect board and piano, hour-0 tests, calibration, free play, guide-lights demo. Works without the game. |
| `playground.html` | Chrome page to play the strip with no piano: on-screen keys, computer-keyboard keys (A W S E D F ...), color, brightness, ripple and fade, and five effects (rainbow wave, sparkle, chase, ripple rain, breathe). |
| `hosttest/run.sh` | Builds the sketch on a laptop against FastLED's stub and checks mapping, protocol, fades, settings and the watchdog. |
| `platformio.ini` | Optional PlatformIO build instead of the Arduino IDE. |
| `TEST-PLAN.md` | **Hardware day:** the step-by-step run with pass lines and what's still unproven. |

## Wiring

```
            5V 6A PSU
                │ barrel
        barrel→screw adapter
          +5V │      │ GND
              │      │
              │      ├──────────────────────────────┐
     1000 µF across +5V/GND here if you get one     │
              │      │                              │
   strip 1  [5V]  [GND]  [DIN] ◄── 330 Ω ◄── GPIO18 │  ESP32 ◄── USB-C ── laptop
   (bass)     │      │     ▲                  GND ──┘  (power + Web Serial)
              │      │     └ arrows on the strip point AWAY from this end
   ═══════════════════════════  JST  ═══════════════════════════
   strip 1, LEDs 0-143                strip 2, LEDs 144-287 (treble)
```

- Every ground is tied together: PSU, strip, ESP32. Without a shared ground the data line has no reference and
  the strip flickers or shows garbage.
- The ESP32 runs off USB. Never connect the PSU's +5V to the ESP32's 5V/VIN pin while USB is plugged in.
- Keep the GPIO18 → DIN wire short (under ~15 cm). This is the main defense against having no level shifter.
- The 330 Ω resistor and 1000 µF capacitor are nice to have, not blockers. Ask the hardware table.
- Put DIN at the bass end. If you have to mount it at the treble end, tick "Strip runs right to left" in the tester.

### With the parts we bought (how it was wired on 2026-10-25)

No soldering or cutting. The BTF strip's input end is a 3-pin plug molded `V+ D G`, with a small arrow pointing
toward the strip. The bag has a short **pigtail**: one plug clicks into the strip, the other plug has red, green and
white wires, and two loose wires (red, white) with bare tips stick out.

| From | To |
|---|---|
| Pigtail loose **red** | PSU's screw adapter **+** |
| Pigtail loose **white** | PSU's screw adapter **−** |
| Pigtail plug, **green** hole (D) | ESP32 **D18**, through the breadboard |
| Pigtail plug, **white** hole (G) | ESP32 **GND**, through the breadboard |
| Pigtail plug, **red** hole (V+) | nothing |

The ESP32 DevKit V1 (30-pin) is too wide for the half-size breadboard: with both pin rows in, every hole beside a
pin is under the board. Put in **only the row with D18 and GND**, in the outermost column, and let the other row
hang off the edge. On that row, counting from the USB end: 3V3, **GND** (2nd), D15, D2, D4, RX2, TX2, D5, **D18** (9th).
The kit's jumper wires are pin-to-pin, so each goes into a free hole in the same numbered row as its pin.

## Flash it (Mac, Arduino IDE 2)

1. Boards Manager: install **esp32 by Espressif**. Library Manager: install **FastLED** (3.9.x).
2. Open `piano_leds/piano_leds.ino`, pick **ESP32 Dev Module** and the board's port, click Upload.
   "Failed to connect": hold the BOOT button when "Connecting..." shows.
   No port at all: install the driver for the USB chip printed on the board (CP2102 or CH340), and use a data
   cable, not a charge-only one.
3. On every boot, the lowest key's LEDs light red and the highest key's light blue for one second. That alone
   proves power, data, color order and direction.
4. **Close the Arduino Serial Monitor** before opening `tester.html`. Only one program can hold the port.

## Calibrate (about 10 minutes, once it's taped down)

1. Open `tester.html` in Chrome, click **Connect LED board**, wait for "ready" (the board resets when the port
   opens, about 1 to 2 s). Then **Connect piano**.
2. **Raw LED 0 and last**: both ends light green. Red instead means the color order isn't GRB.
3. **A0**: nudge ◀ ▶ until the red light sits over the lowest key. **C8**: same for the blue light on the highest
   key. Those two points set the whole keyboard.
4. **Show A0, middle C, C8**, then play keys near the joint between the strips (around A6). If keys just right of
   the joint sit too far right, press **Joint gap +** until they line up. Measure the gap if you like: 1 LED = 6.94 mm.
5. **Sweep all keys** and eyeball every key. Then **Save to board** (settings survive power off).

## Plug and play

After the first connect, there's nothing to click. Chrome remembers the board and the piano, so opening
`tester.html` connects both by itself, and unplugging and replugging the board reconnects it. Free play is the default:
every key lights over itself and sends a **ripple** of its color out along the strip, brighter for harder hits.
**Colors** switches between the two-hands palette and a rainbow by pitch. **Ripple ms** sets how long a ripple lasts
(default 700; 0 turns it off), and **Save to board** keeps it.

The mapping spaces the 88 keys evenly by semitone, about 2 LEDs each. It assumes standard 23.5 mm white keys
(52 × 23.5 mm = 1222 mm, which matches the DGX-660's ~1.22 m key span). At 144 LEDs/m the pitch is 6.94 mm, so an
octave (164.5 mm) is 23.7 LEDs, or 1.97 per semitone. A light can sit up to ~6 mm off a key's
real center, still inside a 23.5 mm white key. That's the same trade the 1:2 mode in
[PianoLux](https://github.com/serifpersia/pianoled-arduino) makes. A handful of keys get 1 LED instead of 2.

## For the game (Eric's lane)

The game opens the port at 115200, waits for the line that starts `PAL1 leds=`, then sends:

- `[0x90, note, r, g, b]` when a note is played (colors 0-127), `[0x80, note]` on release;
- `[0xA0, note, r, g, b]` to show a hint ("this key is next"), with `0, 0, 0` to clear it. This is the guide-lights
  layer: light the next key before the note arrives;
- nothing extra for ripples: every `0x90` key on starts one in its color. `[0xB0, 6, lo, hi]` sets their length
  in ms (0 = off), in case the game wants them off during a song;
- `[0xF2, id]` to measure: the board answers `PONG id showMicros ledsDriven` at once;
- `[0xFE]` every second as a heartbeat. After 2.5 s of silence the board releases every held key, so a stalled
  Chrome tab can't leave lights stuck on. After 15 s it plays a dim idle rainbow.

`tester.html` has a working client in about 40 lines of plain JS (`send`, `keyOn`, `keyOff`, `hint`, `param`).

## What's verified and what isn't

- **Checked here:** the sketch compiles and passes `hosttest/run.sh` against the real FastLED 3.9.4 source on the
  laptop stub (mapping, no shared LEDs, protocol resync, fade, hint layer, settings save, joint gap, watchdog).
  `tester.html` loads in headless Chromium with no errors, sends the right bytes, and its latency test works
  against a simulated board. Hints breathe from 35% to 100% (setting 5, default 900 ms). Only the LEDs under
  the keys get driven (~177 of 288), which cuts each frame from ~8.6 ms to ~5.3 ms
  (WS2812B data is 24 bits × 1.25 µs = 30 µs per LED; computed, not yet measured on the board).
- **ESP32 build (2026-10-24, Mac):** compiles with no errors for ESP32 Dev Module with arduino-cli, esp32 core
  2.0.17 and FastLED 3.9.4: 296,185 bytes of flash (22%), 26,024 bytes of RAM (7%). Core 3.3.x also needs ~6 GB of
  disk to install; 2.0.17 is the smaller one, and the one this build used.
- **Not checked:** any real hardware, including an upload to a board.

## Known risks

1. **No level shifter.** The ESP32 sends 3.3 V; WS2812B at 5 V is specified for at least 3.5 V. It usually works
   with a short wire and a shared ground. If the first LEDs flicker or show random colors: shorten the wire,
   check the ground, then try the "sacrificial pixel" trick (feed LED 0's 5V through a 1N400x diode, about 4.3 V,
   so it accepts 3.3 V and regenerates a clean 5 V signal for the rest), or get a 74AHCT125 from the hardware table.
2. **Power cap.** The firmware caps current at 3 A with `setMaxPowerInVoltsAndMilliamps(5, 3000)`, below a JST
   plug's rating. (The shopping list's `setMaxPowerInVoltsAndMilliwatts(5, 3500)` isn't a FastLED call, and 3500 mW
   would be a 0.7 A cap.) Key lights draw well under 1 A.
3. **Two PCB colors.** One strip is white, one black. The color mismatch is visible unless the strips sit in a channel or are covered.
4. **Chrome MIDI stalls** (seen twice in the spike) aren't fixed by this. The watchdog only stops lights getting stuck.
