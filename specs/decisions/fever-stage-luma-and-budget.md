# fever-stage: how the lane-luma cap and the frame budget are kept

**Context.** The spec asks that the stage's brightness behind the lanes stay under `maxLaneLuma` (0.35), and that the
stage freeze if the mean frame time over 1 s goes above 20 ms. It doesn't say how either is enforced.

**Luma, options.** (A) Tune every palette color so that, after the highway's backdrop, none can pass 0.35.
(B) Cap the stage canvas's CSS opacity at `maxLaneLuma / (1 - stageBackdropAlpha)` (0.35 / 0.45 ≈ 0.78).
**Choice: B.** The lanes span the whole width (core pads the key range to the screen edges), so every stage pixel is
behind a lane. No pixel can pass luma 1. The backdrop lets 0.45 of it through, and the opacity takes that to 0.35 or less, whatever
the palette or the fever does. Colors stay free to tune. Cost: the darkest colors dim too.

**Budget, two additions the spec doesn't name.** Frames in the first 1 s after mount don't count: in Chrome on Eric's laptop
the first second had one 348 ms frame (dev server; likely the first render compiling shaders, not measured apart),
then a steady 6.9 ms. A gap of a whole window (hidden tab, debugger
pause) restarts the window instead of tripping it, and frames while `document.hidden` aren't counted. The built-in
browser pane, while hidden, throttled frames and froze the stage on the first try.

**How to undo.** Luma: set the canvas opacity to 1 in `stage/index.ts` and lower the palette instead.
Budget: set `warmupMs` to 0 and drop the gap reset in `frameBudget`.
