# real-keys: the latency step and the compositing, chosen

**Context:** the spec fixes the method: 8 presses, each press's first frame past a brightness threshold, the median as
the delay. It leaves the numbers open. The numbers below come from synthetic clips
(`spikes/real-keys/synth.mjs`), not from Eric's camera.

| choice | options | taken | how to undo |
|---|---|---|---|
| Brightness threshold | A fixed step in luma, or one learned per key. | 12 luma steps (0–255) from the level over the 150 ms before the press (`latencySettings`). A guess: the synthetic press is a 30-step drop, and a real key's isn't known yet. | `latencySettings.threshold`. |
| The delay's rounding | Whole ms, or whole frames. | Whole ms (`Math.round` of the median). The median already carries the half-frame wait for the next frame: 83 ms planted reads 90.5–92.5 ms at 60 fps. | Round to frames in `finishLatency`. |
| The spread in frames | An assumed 30 or 60 fps, or the frames' own period. | The median gap between the picture's frames. The first build assumed 30 fps for clips and 60 for cameras. | `finishLatency`. |
| A repeated note's key-down (scoring only) | `pressDelays`' level-before-the-press, or the press's own edge. | `score.mjs sparks` finds the first two-frame step in the press's direction. The level before a repeated press still holds the last release, which read as the press (7 of 13 sparks within a frame on Twinkle, 13 of 13 after). The page's latency step keeps `pressDelays`: its presses are a beat apart. | `keyDown` in `score.mjs`. |
| Compositing | The video drawn into the canvas each frame, or a `<video>` under a transparent canvas. | The `<video>` under the canvas (the default; `?composite=draw` switches). Measured in the look loop at 1920 with the 1080p synthetic clip, it had p95 JS frame work 0.40–0.60 ms over three runs, against 0.80 ms drawn (one run). Both numbers are the page's own frame timer, from a dev build in a hidden pane, with no GPU time. | Default `composite` to `draw` in `RealKeys.tsx`. |
