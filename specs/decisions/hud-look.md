# hud: the combo draws over the notes, Guitar Hero's multiplier timing, and the look

- Date: 2026-10-24   Decided by: eric-agent-2   Feature: hud
- **Context:** the spec left the look open ("log the choice"). Building it turned up four more gaps: plugin layers
  can't draw behind the notes, the multiplier timing at a tier boundary, beat-track's status line in the top-right
  corner, and the mid-song screenshot, which belongs in `web/e2e/verify.mjs` (core-loop's file).
- **Options / Choice:**
  - **Combo layer.** `/play` gives each plugin a canvas *above* the highway, and the highway paints an opaque
    background, so "behind the notes" can't be done from a plugin. Options: A) draw it over the notes, faint;
    B) a contract change adding a draw-behind hook, plus a core-loop change. **A:** white at 20% opacity, so notes
    read through it; its milestone ghost uses the tier color. B stays open if Eric finds it distracting.
  - **Multiplier timing.** A hit scores at the multiplier its combo had *before* the hit, as in Guitar Hero: the
    10th hit is still x1, the 11th is x2. The judge sends `noteHit` before the `combo` event that counts it, so
    the reducer gets this for free. A test pins that order against the real `Judge`.
  - **Look.** Dark panel `rgba(12,12,16,0.72)` across the top, system-ui, heavy weights for numbers. Counter colors
    match core's highway (PERFECT `#ffe27a`, GREAT `#5ef2c4`, MISS `#c98a9a`). Tier colors are Guitar Hero 3's:
    x1 white, x2 orange `#ff9f43`, x3 green `#8ee05e`, x4 purple `#c47cff`.
  - **Beat-track's status line** ("Beat: piano", 13px, top-right). The HUD registers before `beatTrack()`, so the
    status draws over the panel, and the score cluster keeps a 120px gutter clear of it.
  - **Mid-song screenshot.** `web/e2e/` is core-loop's, so the HUD has its own `web/src/game/hud/verify-hud.mjs`
    (the pattern piano-sim set). It also checks the HUD's numbers against the results screen.
- **How to undo:** each is a value in `hudSettings` or one line in `web/src/game/layers.ts`.
