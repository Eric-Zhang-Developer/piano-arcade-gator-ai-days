# Hit particles: the wisps, measured on the PianiCast reference (#1373)

## Measured
All at 1920×1080. The source is 60 fps but every frame is doubled, so it moves at 30 fps; times are ±33 ms.
- **Hit line / keyboard.** The red hit line sits at y ≈ 598–606 (centre 601). The white keys run to y ≈ 834, so the
  keyboard is ≈ 230 px tall (21 % of the screen). Space above the hit line: 601 px (0.56 of the screen).
- **Height.** Wisp tips, in px above the hit line: A 490, B 380, the 13.3 s hit's wisps 260–310. On held notes in the
  outro, wisps reach the top edge (≥ 560). Range 260–600 px = **0.24–0.55 of 1080**, **0.45–1.0 of the space above the
  hit line**; a typical single tap tops out at 0.6–0.8 of that space.
- **Lifetime.** Wisps come out of the dust cloud at 0.4–0.6 s after the hit, are longest and brightest at 1.5–1.8 s,
  and are gone at 2.4–2.6 s (A gone at 2.4 s, B still a faint speck at 2.5 s). After the last note of the outro, wisps
  stay visible 2.2 s.
- **Count.** A single tap gives 0–3: one hit (12.6 s) gave none (dust only), one gave 2 (9.6 s), one gave about 2
  (13.3 s). **Held notes keep emitting**: 6–8 wisps alive per held key at once, so ≈ 3 per second for each held key.
- **Shape.** A tapered blade (crescent, comma, S), never a long tendril. Visible length **40–135 px** (typical 90–110,
  one red outlier ≈ 210); width at the widest **5–9 px** (one cross-section: a 7 px core, then a 1 px soft edge). So
  length:width ≈ **12–18:1**. Both ends taper. While it moves fast the leading end is a thin needle and you can see
  stamps along it (a beaded trail); when it slows, one end turns into a blunt round head with a needle tail. It doesn't
  widen as it rises; it gets shorter.
- **Motion (wisp A, height above the hit line vs time since the hit).** 0.6 s 115 px, 1.0 s 182, 1.2 s 258, 1.4 s 323,
  1.6 s 419, 1.7 s 460, 1.8 s 480, 1.9 s 488, then it holds at ≈ 485. So ≈ 170 px/s inside the dust, ≈ 400 px/s at the
  middle, then a hard stop. Wisp B: a steady ≈ 165 px/s from 1.0 s (150 px) to 2.4 s (380 px), easing at 2.0 s. It's
  slow-fast-stop, not fast-then-slow.
- **Drift and curl.** Overall lateral wander ±40–60 px, zig-zagging (A went right, then left). During the fast phase
  A's head moved ≈ 110 px sideways in 0.33 s while it rose. The heading swings 90–180° over the life (C → S → straight
  diagonal → horizontal comma): about half a turn, no spirals. **It trails like a ribbon, not a rigid body**: the body
  bends along the head's past path, and when the head stops the tail catches up, so the length falls from 110–135 px to
  a 25–35 px comma in 0.2–0.3 s.
- **Colour.** Note hue, brightened to clipping, not white: a pink core (255,150,255), a yellow core (255,255,≈100); in
  the lavender section they read near-white lavender. No real glow halo (≤ 2 px). Wisps are drawn **over** the dust,
  and they're far brighter: the dust is the same hue at ≈ 20–30 % of the brightness, with soft dots.
- **Fade.** First it shrinks (the tail catches the head), then the little comma dims and thins over ≈ 0.3–0.5 s. It
  never breaks up.
- **Juice.** Busy passage (131.5 s): ≈ 16 wisps at once in a 1000 px wide band. Each lives ≈ 2.4 s against notes
  every ≈ 0.1–0.2 s, so the space above the keys stays full of slow blades. The height (up to the top of the screen)
  and the long life sell it, not the size of any single wisp.

## What our wisps need
- Height: tip at 0.45–1.0 of the hit-line-to-top space, median ≈ 0.7. Taps reach 0.5–0.8; wisps from held notes can
  reach the top.
- Life: 2.2–2.6 s. First visible 0.4–0.6 s after the hit (hidden in or behind the dust), longest at 1.5–1.8 s.
- Count: 0–3 per tap (mean ≈ 1.5, sometimes zero); held notes emit ≈ 3 per second per key for the whole hold.
- Shape: a ribbon 80–130 px long (at 1080p), 5–9 px wide at the widest, length:width ≈ 15:1, both ends tapered. Length
  comes from the trail spacing, so it's longest at top speed.
- Motion: ease in (≈ 170 px/s), cruise (≈ 400 px/s), then stop and hang. ±50 px wander; the heading turns 90–180°
  across the life (one C or S bend), no spirals; the body follows the head's past path.
- Fade: the tail collapses into the head (25–35 px comma), then alpha goes to 0 over 0.3–0.5 s. No breakup.
- Colour: note hue pushed to clipping (one channel at 255, a lighter tint), not pure white. A sharp edge with ≤ 2 px
  soft falloff, no big bloom. Drawn above the dust, ≈ 3–4× the dust's brightness.

## Method
I extracted frames with ffmpeg into a local scratch dir (nothing from the video is in the repo). Overview stills every
15–30 s. Contact sheets: 8–16 s at 4 fps, 128–144 s at 2 fps, 262–286 s at 1.33 fps. Dense 60 fps bursts: 9.3–12.5 s
(an isolated held left-hand note, hit at frame 18 of the burst, wisps A/B tracked every 0.1 s and zoomed 2× every 4
frames), 12.2–15.4 s (two isolated taps), 270.5–275.3 s (held outro chord and its release). Hit line from a raw
1-px pixel column at x = 100 and x = 1700. Lengths and heights read from the tiled crops at known scale, ±5 px. Colour
from raw RGB samples at 273.3 s and a 40-px cross-section at 131.5 s.
