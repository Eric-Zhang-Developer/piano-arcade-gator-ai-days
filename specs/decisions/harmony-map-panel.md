# harmony-map: the live panel

Context: the spec asks the worker to log the panel's corner (`web/src/game/x/harmony-map/live.ts`, `index.tsx`).

| Choice | Taken | Why, and the alternative | How to undo |
|---|---|---|---|
| /play placement | The wider run of keys outside the song's lowest and highest notes, under the HUD, up to 24% of the width; no panel when that's under 140 px (logged once) | The spec's "beside the highway, never over the lanes". stage-view offers no slot without editing its files, so the corner is the placement. | `cornerSettings` |
| Patch | A rectangle in the plane, ±3.6 units across, 5 rows: each pitch class 2–3 times | A leaning 7 × 5 parallelogram left empty corners in a square frame. | `panelSettings.patch` |
| A live note's hand | Below middle C the left hand's colour, from it the right's | A live MIDI note carries no hand; `handColor` keeps hand-palette's pick. | `panelSettings.splitPitch` |
| Trail | The last 6 chord changes, each fading over 2.4 s; reduced motion: the last edge only, no fade | The spec's still for reduced motion. | `panelSettings` |
| Pedal on /play | A bot take's from `pedal.json`; a live player's doesn't arrive (core input drops CC) | The spec's accepted gap. | — |
| Perf | Measured as work time per frame (update and draw) in the in-app browser, 1920×1080, dpr 2, 10-note chords with the pedal down: p95 0.2 ms in each of 3 runs | rAF ran from a MessageChannel stub because the pane was hidden; work time doesn't depend on the scheduler. Canvas raster on the GPU isn't in it. | — |
