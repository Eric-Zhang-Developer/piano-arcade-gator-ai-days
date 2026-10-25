# Mascot spike: findings

eric-agent-5, 2026-10-25. Spec: `specs/features/mascot-spike/spec.md` (#903). **Pick pending.**

## The question
Can codex image generation give one gator that stays the same character across six poses, in the Duo look, and that
animates as stop motion from 2–3 frames per pose?

## The answer: yes, on sheet-06 (Eric's pick confirms it)
- **sheet-06 has a full pose set that passes the code checks.** Every pose has at least two candidates whose three
  frames all pass. That is 15 of its 18 candidate sets, and all of its idle, thinking and celebrating sets.
- **sheet-01 fails on one pose.** 9 of its 20 sets pass, and none of its 5 pointing candidates do, including 2 from a
  colour-fix round.
- **By eye, side by side, both sheets hold one character across all six poses:** same head, eyes, snout, proportions
  and bow tie.
- **Measured cost:**
  - 44 images in all, under the cap of 120: 6 sheets, 36 pose strips and 2 fix-round strips.
  - About 55 s per image (43 timed runs). The 36 strips took about 15 minutes, three at a time.
  - Every image saved; none came back missing.
- **Across 114 frames: 74 pass, 40 fail.** `node spikes/mascot/check.mjs spikes/mascot/out` exits 0, and its
  self-test passes. Lines it printed:

```
pass sheet-06/idle-1/f1.png  green cream ink
pass sheet-06/oops-2/f1.png  green cream ink
FAIL sheet-06/oops-2/f2.png  colors green 51% cream 22% ink 17% off(60,-24,36) 2%
FAIL sheet-06/pointing-2/f1.png  colors off(60,-24,36) 44% cream 23% ink 19% green 4% off(48,-24,36) 2%
FAIL sheet-01/pointing-4/f1.png  colors green 51% cream 27% ink 11% off(36,-12,24) 2%
set sheet-06/thinking-1: 3/3 frames pass
set sheet-01/pointing-5: 0/3 frames pass
```

## Consistency
- **Every failure is colour.** No frame failed the corner or framing checks.
- **The usual failure is the back ridge drawn in a second, darker green** at 2–3% of the figure, just over the spec's
  2% floor. sheet-01's own sheet has that ridge, so its poses inherit it. A colour-fix line in the prompt (round 2)
  did not remove it: the reference outweighs the words.
- **The worst drift:**
  - sheet-06 pointing-2: the whole skin turned a brighter yellow-green (44% off-palette).
  - sheet-06 happy-1, frame 3: a pink tongue.
  - sheet-01: the "two-thirds of the body" crop line moves between poses, so the tail and legs are cut in different
    places.
- **Scale differs between pose sets, not within one.** `pack.mjs` scales each set so its tallest frame fills 90% of
  the canvas, so the piano sets show the gator at a different size from idle. Promotion should use one scale for all
  sets, for example idle's.
- **The checks don't verify the blue bow tie.** It is under 2% of the figure, so it drops out of the colour list. It
  is there in every frame by eye.

## The recipe that worked (every prompt as sent is in `prompts.md`)
1. **Sheets:** one prompt per sheet, varied within the direction. It names the 4 hex colours, a monoline ink outline,
   a transparent background, "not UF's Albert", and three views at one scale.
2. **Poses:** one image per candidate, holding its 3 frames left to right. The sheet goes in as a reference with
   `--image=` (a bare `-i` is variadic and swallowed the prompt). Each frame is described in one sentence; the
   framing line asks for one baseline and clear space between frames.
3. **Clean-up by code:**
   - `pack.mjs` splits each strip by connected figure, because a pointing finger can reach over the next frame.
   - It scales each set by one factor and anchors it bottom-centre on a 384 px canvas.
   - It writes one horizontal sprite per set. CSS `steps(3, jump-none)` plays the sprite at 200 ms a frame; idle
     loops over 4 s with the blink last.

## What to keep
- `gen.sh`, `pack.mjs`, `png.mjs` and `check.mjs` as written. A promotion spec can lift them into `tools/`.
- One strip per candidate rather than one image per frame: frames drawn together kept the character.
- Codex's fills come out at alpha 253–254. Anything downstream should treat alpha ≥ 250 as solid.

## Recommendation: promote, with sheet-06
- **Why sheet-06:** it passes in every pose, keeps its proportions best, and its big head still reads in the HUD band
  and beside the highway, where the gator is small.
- **The cost:** sheet-01 is the closer fit to "slightly dapper teacher" at full size. Eric's pick decides.
- **Pick page:** `spikes/mascot/pick.html`, opened from disk. Eric picks in chat, or on the `sheet:` line of
  `PICK.md`.
- **Pick pending.**
