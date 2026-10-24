# Score roll-up: the flash's look, and how the PR's frames were taken

**Context.** The spec asks for a glow and a slight scale on tier-up, inside the band, and screenshots mid-roll and
at the tier-up. A headless screenshot lands hundreds of ms after it is asked for, longer than the 200 ms roll.

**Choices.**
- The flash: `shadowBlur` up to half the band in the new tier's color, and a scale from 1.15× about the badge's
  center, both fading as (1 − t)²; the badge is clipped to the band so the glow never reaches the lanes.
- The frames were composited in the page from the 2D canvases two animation frames after the 5th hit (mid-roll) and
  after combo 10 (x2), so they show those exact frames; the WebGL stage behind is left out (black).

**How to undo.** `hudSettings.rollMs`, `flashMs`, `flashScale` in `web/src/game/hud/index.ts`.
