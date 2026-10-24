# LED hardware-day test plan

Run this top to bottom the moment the strips arrive. Each step has a pass line. Don't move on from a fail:
every later step assumes the earlier ones. About 90 minutes.

Write the results into `firmware/RESULTS.md` (what you saw, the numbers, a photo or video per step) as you go.
That file becomes the evidence for the `feat(led-strip)` PR.

## 0. Before power (10 min)

| Check | Pass |
|---|---|
| Arrows on the strip point away from the end you wire | DIN is at the bass end |
| PSU unplugged while wiring; polarity at the screw adapter: red to +, white to − | Meter or eyes: + to +5V |
| One shared ground: PSU −, strip GND, ESP32 GND | Continuity, or a wire you can point to |
| PSU +5V goes nowhere near the ESP32's 5V/VIN pin | It doesn't |
| Data wire GPIO18 → DIN under ~15 cm | It is |

## 1. Flash and first light (15 min)

1. Arduino IDE: install esp32 by Espressif and FastLED 3.9.x, then upload `piano_leds/piano_leds.ino` to "ESP32 Dev Module".
   **Pass:** the upload finishes. The compile already passes on the Mac (esp32 core 2.0.17), so a failure
   here is most likely the port, the cable or the BOOT button; keep the output.
2. Plug in the PSU, then press the board's EN (reset) button. **Pass:** for 1 s, the LEDs near the left end light red
   and the LEDs near 1.2 m light blue. Clean colors, no flicker.
3. If they light the wrong color: red/green swapped means the color order isn't GRB, so change `COLOR_ORDER`.
   Nothing lights: check the data direction, then ground. Random colors or flicker: see "No level shifter" below.

## 2. Tester basics (10 min)

1. Close the Arduino Serial Monitor. Open `tester.html` in Chrome, then **Connect LED board**. **Pass:** "ready" within 3 s.
2. **Raw LED 0 and last.** **Pass:** LED 0 and LED 287 both green (the second strip and the JST joint work).
3. **All keys dim white.** **Pass:** an even white over all 88 keys; no pink or yellow tint toward the far end. A
   tint means voltage drop: add a second power wire to the strip 2 end.

## 3. Calibrate on the piano (15 min)

Tape the strip where it will live first. Calibrating and then moving it wastes the step.

1. Nudge A0, then C8, until each light sits centered on its key. Then **Show A0, middle C, C8**.
   **Pass:** middle C's light is on middle C. If it's off by more than half a key while both ends are right, the
   strip isn't straight or isn't 144/m.
2. Play the 6 keys on either side of the strip joint (about A6). **Pass:** each lights its own key. If keys right of
   the joint sit too far right, press **Joint gap +**.
3. **Sweep all keys.** **Pass:** one smooth run left to right, every key lit over itself, no skips, no doubles.
4. **Save to board**, unplug the USB, plug it back in, reconnect. **Pass:** calibration is still there.

## 4. Feel and numbers (15 min)

Thresholds in this table are estimates set before any hardware ran, not measurements. Replace them with measured
numbers in `RESULTS.md`.

| Test | Pass |
|---|---|
| **Latency: 200 pings** | Round trip median < 15 ms, p95 < 25 ms, 0 lost (estimates). If they fail, try 921600 baud in both the sketch and the tester. |
| Slow-mo video, 240 fps, of one key press with its light in frame | Key down to light on ≤ 8 frames (~33 ms). Above 12 frames (~50 ms) it will feel late. |
| **Stress: chords + fast trill** | No LED left on afterwards, no flicker, board still answers |
| Free play: a 10-finger chord, held | All 10 keys lit; release, and all 10 fade |
| Free play: pound the same key fast | No stuck light |
| Unplug the USB serial cable with a key held | Light goes out within 3 s (watchdog) |
| Leave everything idle for 15 s | A dim rainbow starts; the first key press stops it |

## 5. Brightness, diffusion and hints (15 min)

| Test | Pass |
|---|---|
| Brightness 70 vs 160 (setting 1), viewed from the player's seat | Note which one keeps hue at a glance; 160 tends to wash colors toward white at 144/m |
| Bare LEDs vs white paper or parchment 5 to 10 mm in front | Note which one reads as one patch per key rather than separate dots |
| Hint pulse 600 / 900 / 1400 ms (setting 5) | Note which period a player notices without it feeling frantic; keep it in `RESULTS.md` |
| Guide mode, Twinkle, played by someone who doesn't know the tune, with no help | They finish using only the lights; record the time and misses the tester logs |

## No level shifter

The ESP32 sends 3.3 V and the WS2812B wants ≥3.5 V at 5 V. In order:
1. Shorter data wire, and a solid shared ground.
2. The 330 Ω resistor in series at DIN.
3. Sacrificial pixel: power LED 0 through a 1N400x diode (~4.3 V). It accepts 3.3 V and re-sends clean 5 V data.
   Cut LED 0 off the main 5V pad and move `calLow` up by 1.
4. A 74AHCT125 from the hardware table.

## Unproven until this runs

- An upload to a real board. (The ESP32 build itself compiles, with esp32 core 2.0.17 and FastLED 3.9.4.)
- Whether 3.3 V data drives this strip with no flicker.
- Real latency: USB-serial chip buffering on macOS is the unknown. The ping test measures it.
- Whether 2 LEDs per key reads as one patch per key from the player's seat.
- Voltage drop along 1.2 m at full white (only the power test shows this; key lights alone are light load).
- That the BTF strip really is GRB (the listing says so).
- The game integration (`led-game`) doesn't exist yet. Until it exists, `tester.html` is the only client.
