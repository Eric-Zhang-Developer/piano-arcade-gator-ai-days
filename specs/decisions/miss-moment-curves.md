# miss-moment: the curves, the outline, late misses and the hit it's measured against

**Context.** The spec gives the targets (about 40% alpha and 60% width by the end of a ~120 ms fade, gone by 300 ms;
an outline for about 400 ms) and leaves the curve shapes, the outline's weight and anything it doesn't foresee to the
worker. eric-agent-3, 2026-10-25.

## The curves
- **Tail:** an ease-out over 120 ms from full to 0.4 alpha, 0.6 width and grey, with no glow; then a straight fade
  from 0.4 to 0 at 300 ms. **Outline:** full for 250 ms, then a straight fade to 0 at 400. **Wrong-key pulse:** 0.55
  alpha, squared fall to 0 at 180 ms. **Break:** the old digits drop `round(height / 180)` px (6 at 1080) on an
  ease-out while their alpha falls straight to 0 over 200 ms.
- The ease-out makes the change of state land at once; the straight falls after it keep each part visible for
  most of its time. The pulse is the one squared curve: it should read as a sharp tap, not a glow.

## The outline's weight
- **Round 1:** a 1.5 px stroke in `--pa-miss` (`#8a8f98`) vanished on the ivory white keys at 1920×1080.
- **Choice:** a fill at 18% of the token plus a `round(height / 540)` px stroke (2 at 1080, 1 at 720). It reads as a
  grey cap, quieter than any hit's light. **Undo:** `outlineFill: 0` and `outlinePerHeight: 720`.

## Misses the game learns of late
- **Found in the look loop:** the judge calls a miss `INPUT_GRACE_MS` (50) plus the latency offset after its window
  closes. That was 53 to 130 ms after `atMs` in these runs. Timed from `atMs`, the 120 ms fade had already finished
  before the first frame drew it, so a live note snapped to the grey rest look.
- **Options:** (A) time from `atMs` and lose the fade; (B) time from the first frame that knows and let the tail
  live to about 430 ms, past the spec's 300 ms bar; (C) play the whole curve between the first frame that knows and
  the same deadlines.
- **Choice: C** (`lateT`). The 300/400/200 ms deadlines and verify-miss's bar stay as written. With a large latency
  offset (over 300 ms) the tail is past its deadline before it's seen and never drawn; the outline still is.
  **Undo:** make `lateT` return `now - atMs`.

## The hit a miss is measured against
- rank-c Twinkle makes no GOOD (23 PERFECT, 11 GREAT, 8 MISS in each run here), so the spec's "a miss moves the
  playfield less than a GOOD" has nothing to compare against. verify-miss compares with the weakest tier the take
  has: GOOD if any, else GREAT, else PERFECT. **Undo:** pin `tier = "GOOD"` (it then fails on this take).
