# results-landing: the choices the spec left open

## Durations and curves (`web/src/game/results-landing/timeline.ts`, `landingSettings`)
- **Out:** 400 ms from T0 to the results' mount. The highway's clock rate is `(1-u)^2`, its advance the integral
  `400·(1-(1-u)^3)/3`, so it eases to a stop with no jump. The keyboard dims to 0.6 on a cubic ease-in-out.
- **Slide:** 300 ms from the mount, cubic ease-in-out; the score and the combo fly from where the HUD drew them.
- **Combo tick:** 250 ms after the slide, from the HUD's combo at T0 up to MAX COMBO.
- **Tally:** each count runs 450 ms (results-tally's own run); the four starts sit on the beat, halved until three
  gaps and one run fit in 1.2 s; the first start is the next grid line at or after the mount, in chart time.
- **Stamp:** 180 ms, `1 + 0.08·(1-u)^1.0349·cos(1.5πu)`: lands at 1.08, one dip to 0.97, rests at exactly 1.0. Tint is
  one 60 fps frame at impact; shake `2·(1-u)·sin(6πu)` px. The corners snap home over two frames from impact.
- **After:** 250 ms after the stamp, 200 ms fade. The stamp waits for both the tally and the combo tick.

## Other choices
- **Scored takes only:** wait mode and bar-loop practice (`from`, `to`, `practice`) keep today's results, which say
  "not scored". Undo: drop the check in `landingRuns`.
- **The slide starts at the mount, not at T0:** during the out the HUD still owns its numbers, and the results'
  cells don't exist until the mount to measure.
- **Flying numbers ride on a solid tile** the color of the page, opaque until the last fifth of the flight, so they
  never cross the count labels as bare text (look round 2).
- **The fly's origin mirrors the HUD's draw math** (`play/page.tsx`: the badge and score fonts, the status gutter).
  If the HUD moves its score, that code has to move with it; duo-hud will need a new look round.
- **Record-moment stays CSS** and starts at the landing's after time through `setStampTiming`; it isn't seekable from
  the hook. Only the landing's own elements are.
- **Juice's CSS stamp is overridden by a stylesheet** scoped to `[data-landing]`, from `results-landing/`, because
  `juice/index.ts` belongs to another PR. Undo: remove `ensureStyle`.
- **The WebMs are 800×450,** the in-app pane's screenshot size of a 1280×720 page, VP9 crf 34, 60 fps.
- **The two WebMs are different takes.** The after is a scripted `input=test` take (33 PERFECT, 9 GREAT), stepped through the
  seek hook. The before is `bot=perfect` with no flag, stepped by a virtual clock (`performance.now`, rAF and the
  page's CSS animations advanced 1/60 s per frame), because today's results have no seek hook. In the before,
  frames 99–139 are copies of frame 98: frames 98 and 140 were byte-identical captures, so nothing moved between.
