---
name: "Calibration: tap along to clicks to set the latency offset"
depends_on: []
owns: ["web/src/app/calibrate/", "web/src/game/calibration/"]
assignee: "eric"
---

# Calibration

Today the latency offset gets set by playing a whole song and reading the timing panel (`timing-feedback`), or by
dragging a slider. At `/calibrate` you tap along to a few clicks instead, and the mean offset becomes
`pianoArcade.latencyOffsetMs`. That gives a fair first game on any laptop or speaker (catalog G10; the fixed delay
was never measured, `spikes/piano-midi/RESULTS.md`).

## Plan
1. The pure math in `web/src/game/calibration/`, with its tests. The page goes in `web/src/app/calibrate/`.
2. **A `fix(song-select)` PR:** a "Calibrate latency" link on `/`.

## Requirements
- **The clicks:** 12, at 100 BPM. They play on the piano when it's connected, the way beat-track plays its beat
  (find the output by `name` "Portable Grand", channel 10, the same drum sound). That matches the clock players hear
  in a game. Without a piano they play as a Web Audio click. All are scheduled on their output's clock.
- **The taps:** any piano key or laptop key counts as a tap, timed the way `/play` times input (`InputEvent.timeMs`,
  the `performance.now()` domain).
- **The result:** each tap pairs with the nearest click within ±250 ms. Taps on the first 4 clicks are dropped as
  settling in. The offset is the mean of `tap - click` over the rest, rounded to whole ms and clamped to
  `LATENCY_MIN`–`LATENCY_MAX`. Its sign matches `/play`: a positive offset means taps arrive late.
- **Too few or too spread:** with fewer than 6 paired taps, or a spread (standard deviation) over 40 ms, nothing is
  saved. The page says which happened and offers Try again.
- **Saving:** the page shows the offset and the spread, and saves the offset with `saveLatencyOffset` from
  `web/src/game/core/settings.ts`. `/play`'s slider shows the new value on its next load.
- Nothing is saved from a run you abandon partway.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: taps at a steady +30 ms give 30. Taps with the first 4 off by 200 ms still give 30. Five taps
  save nothing. A spread of 60 ms saves nothing. +200 ms clamps to `LATENCY_MAX`. (+400 can't: at 100 BPM
  the clicks are 600 ms apart, so +400 pairs with the next click as -200.)
- `verify.py --slug calibration` passes.
- In Chrome: open `/calibrate` and tap Space along to the clicks -> the page shows an offset and a spread. Open
  `/play` -> the slider shows the same offset. Tap randomly -> "too spread", and nothing changes.
- On the piano (Eric; mark it in the done note): calibrate on the DGX, then play Twinkle. The timing panel's mean
  should be within about 10 ms of zero. Write both numbers in the done note.

## Defaults
- A start-screen link on `/play` can follow as a `fix(calibration)` once play-slots is on `main`.
