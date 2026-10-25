# count-in: the ruler, the numerals and the pulse

- **Context:** the spec fixes the two halves, the numerals' fade-in (40 ms), settle (1.04 → 1.0 over 120 ms) and
  fade-out (the beat's last 30%), and asks the worker to log the easing curves, tick weights, the pulse's peak and
  where things sit. Five look rounds at 1280×720 and 1920×1080 on Twinkle and Maple Leaf Rag decided these.
- **Options and choices:**
  - *Ruler:* hairline ticks (round 1: unreadable at 1280) or 4 cells, one per beat. **Cells**, `min(30% width, 520 px)`
    wide, centered 12 px above the hit line, under hand-colors' L/R legend (72 px above the line), so the two never
    touch. An accented beat's cell (beat-track's rule: each bar's beat 1) is 1.75× taller; filled is solid
    `--pa-primary`, wiping in over 90 ms (ease-out cubic), and empty is a hairline frame in `--pa-ink-dim` at 55%.
  - *Count half:* the ruler stays full or drains. **Drains:** as many cells stand as the numeral says (4 under "4",
    1 under "1"), the next one emptying on its beat, so the ruler is empty when the first note lands.
  - *Numerals:* `canvasFonts.numeral` (Saira, 800, condensed) at 0.34 of the hit line's height, centered at 0.6 of it
    (the old digit sat at 0.45; lower keeps the eye near the line, round 3). An accented beat's numeral is
    `--pa-primary`, the others `--pa-ink`, so the eye stresses the beats the click does. A ground-colored edge (3.5%
    of the size) knocks the numeral out of falling notes (round 2's 7% read as a sticker). Canvas has no tabular
    figures; a single centered digit doesn't need them. The settle eases out cubic.
  - *Pulse:* over the hit line on its own path, peak 1 on accents and 0.55 otherwise, decaying as (1 − t/0.6 beat)^1.5;
    width 3 + 3 × pulse, glow 26 × pulse, primary on accents and ink otherwise. Beat 0: one frame of a 6 px white line
    with a 40 px glow.
  - *Reduced motion:* numerals whole for the beat, cells filled at once, the pulse a steady tint (60% alpha, no glow),
    beat 0 white without the glow.
- **How to undo:** `countInSettings` and `countInLayout` in `web/src/game/count-in/index.ts`.
