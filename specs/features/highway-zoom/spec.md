---
name: "Highway zoom: the visible key range follows the music"
depends_on: []
owns: ["web/src/game/highway-zoom/"]
assignee: "eric"
---

# Highway zoom

Today the highway shows the chart's whole range for the whole song (`makeLayout` in `web/src/game/core/highway.ts`),
so a wide chart has thin lanes from start to finish. Für Elise spans 40–88. Moonlight's 3rd movement, in
`song-pack-2`, will be wider. This feature pans and zooms the highway smoothly to the range the music is using right
now. `Frame` already carries `lowPitch`, `highPitch` and `keyX` per frame, so plugins follow along with no change.

## Plan
1. The pure range function in `web/src/game/highway-zoom/`, with its tests.
2. **A `fix(core-loop)` PR:** `/play` asks that function for the range each frame and builds the layout from it.
   With zoom off, the layout is exactly today's, and `verify.py` passes unchanged.

## Requirements
- **The target range:** the lowest and highest pitch of every note between `nowMs - GOOD_MS` and
  `nowMs + lookaheadMs + 1000`, padded by 2 white keys on each side and at least 15 white keys wide.
- **No cut-off notes:** the range always contains every unjudged note in that window. The easing below never
  narrows the range past a note that's on screen.
- **Easing:** the range moves toward its target with a time constant of about 400 ms (`zoomSettings.easeMs`), and
  never jumps.
- **When it's on:** automatically for charts wider than `zoomSettings.minWhiteKeys`, default 22 white keys (about
  three octaves). `?zoom=off` or `?zoom=on` overrides that. Twinkle is narrow, so it never zooms.
- **The keyboard drawing** follows the same range. Laptop keys stay mapped from the chart's lowest pitch, as today.
- **Cost:** the range takes O(notes in the window) per frame, using the chart's notes in time order.

## Validation
- `pnpm -C web test`: on a synthetic chart that jumps from C2 to C6, every frame's range contains every note
  between `nowMs - GOOD_MS` and `nowMs + lookaheadMs`. The width never drops under 15 white keys. Across a jump, the
  range moves over several frames, not in one. A narrow chart gives exactly `makeLayout`'s range.
- `verify.py --slug highway-zoom` passes, Twinkle unchanged.
- In Chrome: on `/play?song=fur-elise`, the lanes widen while the right hand plays alone and pan out when the left
  hand comes in. No note appears cut off at an edge. `?zoom=off` shows today's full range. Keep a screenshot of
  each in the PR.
- On the piano (Eric; mark it in the done note): play Für Elise and say whether the motion helps or distracts.

## Defaults
- If the motion distracts on the piano, raise `easeMs` before cutting the feature.
