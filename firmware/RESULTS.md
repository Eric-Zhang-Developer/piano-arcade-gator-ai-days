# LED hardware results

Evidence for `led-strip`, filled in as `TEST-PLAN.md` runs. Empty cells are not run yet; nothing here is estimated.

## Setup

| | |
|---|---|
| Date | 2026-10-24 (board only); strips: not yet |
| Board | AITRIP ESP-WROOM-32, 30-pin, USB-C, CP2102 USB-serial |
| Port (macOS) | `/dev/cu.usbserial-0001`; no driver install needed |
| Firmware | `led-strip` at `c723641` |
| Toolchain | arduino-cli from Arduino IDE 2, esp32 core 2.0.17, FastLED 3.9.4, board `esp32:esp32:esp32` (ESP32 Dev Module) |
| Strips | 2× BTF-LIGHTING WS2812B 144/m, 1 m, white PCB, IP30: not connected yet |
| PSU | BTF-LIGHTING 5 V 6 A, 5.5×2.1 mm barrel: not connected yet |

## 1. Flash and first light

| Check | Result |
|---|---|
| Compile | Pass: 297,081 bytes flash (22%), 26,224 bytes RAM (8%) |
| Upload | Pass, first try, no BOOT button needed |
| Boot test (A0 red, C8 blue for 1 s) | |
| Color order is GRB | |

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
| Connect LED board → "ready" | |
| Raw LED 0 and last both green | |
| All keys dim white, no tint | |

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
