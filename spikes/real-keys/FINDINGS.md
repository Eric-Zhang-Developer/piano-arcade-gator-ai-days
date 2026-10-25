# Real Keys: findings

**Camera runs pending.** Eric's still and clips (the spec's morning-page asks) don't exist yet. Everything below comes
from unit tests and synthetic clips. A synthetic clip is a key bed drawn in perspective by `synth.mjs`, with keys
darkening a planted 83 ms after each logged note-on, at an exact 60 fps.

## The question
Can a plain-JS homography from a 4-corner click place every key of the DGX in a camera picture closely enough, with the
camera's latency measured and taken out, that sparks land on the right key at the right frame at 60 fps?

## The measured answer

**(a) The homography.**
- **Unit tests** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/real-keys`): 15 pass. They cover:
  - DLT recovering a known transform: 4 points within 1e-6, 20 random points within 1e-3 px;
  - the key quads tiling 21–108 and a 61-key range;
  - the black keys against core's geometry;
  - the latency estimator on planted steps.
- **Reprojection on the DGX:** pending. It needs Eric's still and hand-marked edges (`score.mjs edges`).

**(b) Latency and sparks,** on synthetic clips (`score.mjs analyse`, then `latency` and `sparks`).
- **Latency, three clips of one key pressed 8 times,** with the presses at different frame phases:
  - medians 90.5, 92.5 and 91.5 ms against the planted 83 ms;
  - each run finds 8 of 8 presses, with a spread of 0.8–0.9 frames;
  - the medians agree within 0.1 frame (bar: ±1).
  - The ~8 ms over the planted lag is the half-frame wait for the next frame. It's real, and it belongs in the delay.
- **Sparks, the first 14 beats of Twinkle** (13 presses, delay 91 ms): 13 of 13 sparks land within ±1 frame of their
  key going down, each at +0 or +1 frame.
  - The first scorer had 7 of 13. It took the brightness before a repeated note's press as the key's rest level, but
    the previous release was still arriving. The scorer now finds the press's own edge
    (`specs/decisions/real-keys-latency.md`).
- **In the page, clip mode:** the play clip ran end to end, with the count-in, the judge and the HUD. It scored 13
  PERFECT on the 13 pressed notes, with the overlay 91 ms behind the keys.

**Compositing,** p95 JS frame work from the page's own timer at 1920 with the 1080p synthetic clip (dev build, hidden
pane, no GPU time):
- a `<video>` under the canvas: 0.40–0.60 ms over three runs;
- the video drawn into the canvas: 0.80 ms, one run.

Both are far inside a 16.7 ms frame. The video element is kept.

**The skin mask:** not built. It's a logged gap.

## What worked
- The geometry is plain JS with no dependency: a homography by DLT, the key quads, and lanes that recede in the
  camera's own perspective.
- The same chart, judge and HUD as `/play` worked in clip mode with no game edits.
- `score.mjs` imports the page's own `homography.ts` and `latency.ts` (Node strips the types), so the scores measure
  the shipped math.

## What didn't
- **`requestVideoFrameCallback` never fires in a hidden pane,** so the page's own luma log is empty when an agent drives
  it. `score.mjs analyse` reads the clip through ffmpeg instead, with each frame at its own timestamp, the page's way.
- **The browser can't make the synthetic clip:** a canvas recorder in a hidden pane kept 9 frames of 600. `synth.mjs`
  pipes frames to ffmpeg instead.
- **Clip mode starts the chart where the clip is when Start is pressed.** A recorder clip has no count-in mark, so
  scrub to the right moment before Start. The synthetic play clip needed 0.3 s.

## What to keep
- The homography, the key quads, `laneDepth` and the latency step are generic, with no restricted content.
- `score.mjs` and `synth.mjs` stay as the test bed for the camera runs.

## Recommendation
**Iterate: run the 5-minute camera asks.** Then check:
- the still's reprojection, against the 3 px bar;
- the three latency clips' agreement;
- the play clip's sparks.

Everything else is ready for them.
