# LED hardware results

Evidence for `led-strip`, filled in as `TEST-PLAN.md` runs. Empty cells are not run yet; nothing here is estimated.

## Setup

| | |
|---|---|
| Date | 2026-10-24 (board only); 2026-10-25 (strip 1 on the DGX-660) |
| Board | AITRIP ESP-WROOM-32, 30-pin, USB-C, CP2102 USB-serial |
| Port (macOS) | `/dev/cu.usbserial-0001`; no driver install needed |
| Firmware | `led-strip` at `c723641` |
| Toolchain | arduino-cli from Arduino IDE 2, esp32 core 2.0.17, FastLED 3.9.4, board `esp32:esp32:esp32` (ESP32 Dev Module) |
| Strips | 2× BTF-LIGHTING WS2812B 144/m, 1 m, IP30 (label `HD-5V-WS2812E-144L`). Strip 1 connected; strip 2 not yet |
| PSU | BTF-LIGHTING 5 V 6 A, 5.5×2.1 mm barrel, into BTF's barrel-to-screw-terminal adapter |
| Wiring (strip 1) | BTF pigtail clicked into the strip's input plug (`V+ D G`). Pigtail's loose red → adapter +, loose white → adapter −. Pigtail's other plug: D (green) → ESP32 D18, G (white) → ESP32 GND, V+ (red) empty. ESP32 powered by USB only. No series resistor, no capacitor, no level shifter |
| ESP32 on the breadboard | DevKit V1 is too wide for the half-size breadboard: with both pin rows in, no hole is free beside any pin. Only the D18/GND row goes in (outer column), the other row hangs off the edge |

## 1. Flash and first light

| Check | Result |
|---|---|
| Compile | Pass: 297,081 bytes flash (22%), 26,224 bytes RAM (8%) |
| Upload | Pass, first try, no BOOT button needed |
| Boot test (A0 red, C8 blue for 1 s) | A0 red: pass (Sharan, by eye, after EN reset). C8 blue: not visible, it falls on strip 2 |
| Color order is GRB | Pass: raw LEDs 0, 1, 2 sent red, green, blue showed red, green, blue (Sharan) |

## 2. Board-only protocol checks (no strip connected)

Run with a Python script over the USB serial port at 115200 baud, no browser.

| Check | Result |
|---|---|
| Hello (`0xF1`) | Pass: `PAL1 leds=288 bright=160 fade=180 flash=1 attract=1 calLow=4.00 calHigh=175.70 joint=144 gap=0.00 reverse=0 pulse=900 ripple=700 active=177` |
| Latency, 100 pings (`0xF2`) | Round trip median 2.6 ms, p95 2.7 ms, max 3.2 ms, lost 0/100 |
| Frame cost (`PONG` report) | `show()` 5,516 µs for 177 LEDs driven |
| Settings echo | Pass: brightness → 70 and ripple → 1200 ms both echoed back; reset to defaults (`0xB0 21`), not saved |
| Key on/off with ripples | Sent a C major scale; no errors, board kept answering. Lights not observable without a strip |

Notes:
- Opening the port from macOS does **not** reset this board: a fresh open got no boot line, and `0xF1` was answered in about 20 ms.
- The first hello right after the upload got no `PAL1` match. A later raw capture showed a clean reply, so the likely cause
  is leftover boot bytes from the post-upload reset run into the line. Not reproduced since.
- Ping time is the serial round trip only (Python, no Chrome); the browser path is in section 4.

## 2b. Tester basics

| Check | Result |
|---|---|
| Connect LED board → "ready" | Pass (Chrome, 2026-10-25) |
| Piano connected, keys light the strip | Pass: keys played on the DGX-660 light the strip (Sharan). Not yet calibrated, so on-key placement is unchecked |
| Guide hint shows | Pass: the next key's hint breathes blue near middle C (Sharan) |
| Raw LED 0 and last both green | |
| All keys dim white, no tint | |

Notes:
- Two Chrome tabs can't share the board: a second tab's connect fails with `Failed to open serial port` until the
  first tab closes. The app's built-in browser pane lists no serial ports at all; use desktop Chrome.
- Bumping the breadboard pulled the ESP32's USB-C cable out once; the strip went dark until it was back in.

## 3. Calibrate on the piano

| Check | Result |
|---|---|
| A0 / C8 nudged; calLow, calHigh | |
| Middle C on middle C | |
| Keys around the joint (A6) | |
| Sweep: every key over itself | |
| Saved, survives power cycle | |

## 4. Feel and numbers

| Test | Result |
|---|---|
| Latency from `tester.html`, 200 pings | |
| Slow-mo 240 fps, key down to light on | |
| Stress: chords + trill | |
| 10-finger chord held | |
| Same key pounded fast | |
| Unplug USB with a key held (watchdog) | |
| Idle 15 s → rainbow | |

## 5. Brightness, diffusion, hints, ripple, plug and play

| Test | Result |
|---|---|
| Brightness 70 vs 160 | |
| Bare vs paper diffuser | |
| Hint pulse 600 / 900 / 1400 ms | |
| Ripple 400 / 700 / 1200 ms | |
| Plug and play: reload, then replug | |
| Guide mode, Twinkle, new player | |
