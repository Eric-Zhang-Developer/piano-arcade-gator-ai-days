# Combo in the HUD: slots and size

**Context.** The spec gives the slot bounds and asks that the combo be the band's biggest number.

**Choices.**
- The spec's bounds as given: card 0–28%, hits 28–44%, combo 44–56%, breaks 56–66%, score 66% to the gutter.
  Measured in the page with Saira, Twinkle's title is 257 px of a 335 px card at 1280×720 and 338 of 506 at
  1920×1080, so it isn't shrunk; at 1024×768 it is 271 of 262 and `fitText` shrinks it about 3%.
- The combo's em is 0.62 × the band (vs the multiplier's 0.5), centered at 0.4 × band with COMBO at 0.83 × band.
  It is sized against "888", so the number doesn't jump smaller at 100; it shrinks only if three digits overflow.
- The ghost (1.6×) is clipped to the combo's slot and the band, so it shows as a tinted flash behind the number.

**How to undo.** `hudLayout`'s slots and `combo` in `web/src/game/hud/index.ts`.
