# screen-shake: what shakes, and the curve

**Context.** The spec leaves the shaken layers, the curve and the registry URL to the worker
(`specs/features/screen-shake/spec.md`). eric-agent-3, 2026-10-25.

## What shakes
- **Options:** (A) the overlay canvas alone; (B) the highway and overlay canvases together; (C) `/play`'s whole
  `<main>`, buttons and background included.
- **Choice: B.** The experiment reaches the overlay from `ctx.canvas` and the highway as its previous sibling, so
  `/play` and `layers.ts` stay unedited. A would split the notes (highway) from the judgment word (overlay). C would
  shake the pause button and drag the three.js background along, which isn't the take. The background stays still, so
  at most 6 px of it shows at an edge for under 250 ms.

## The curve
- **Shape:** a swing at 28 Hz on each axis (y a quarter turn behind x) under a straight fall to 0 at 250 ms, rounded
  to whole px, so it's exactly 0 from 250 ms on. Round 1's squared fall was under 1 px after about 130 ms in a
  real take; the straight fall keeps it visible for most of the 250 ms.
- **Strength:** combo 25 shakes at three quarters of the cap (`round(height / 180)`, 6 px at 1080), 50 at seven
  eighths, 100 and later at the whole cap. Round 1 had 25 at half, which peaked at 2 px at 1080 in a real take: too
  small to see. The phase comes from the milestone's `atMs`: no `Math.random()`.
- **Allocation:** nothing is allocated while idle. During a shake each new offset sets one transform string; a
  repeated offset sets nothing. That's at most about 15 strings per milestone.

## The registry URL
`/play?song=minuet-g&bot=fever&x=screen-shake`, as the spec suggests. The test runs the real judge and confirms the
fever bot's first milestone is combo 25, at about 10 s.

## How to undo
Remove `screenShake` from `web/src/game/x/index.ts` and delete `web/src/game/x/screen-shake/`.
