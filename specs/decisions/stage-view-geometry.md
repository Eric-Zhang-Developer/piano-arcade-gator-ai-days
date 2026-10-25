# stage-view: the lane's geometry, measured and chosen

**Context:** the lane comes from `specs/context/nostalgia-stage-findings.md`. A few things the findings can't pin
had to be chosen. Each choice is listed here; the code marks it "a choice".

**Measured, used as is** (`web/src/game/stage-view/lane.ts`):
- the 1033 ms approach and the crest 497 ms before the hit;
- the front-face fit y(τ), and a fit of the back slope to one measured note;
- the field width W(y), and u constant along each path;
- the note's width at 0.1 of the field and its thickness 0.015 → 0.021;
- the dimmer back slope.

**Choices:**

| choice | options | taken | how to undo |
|---|---|---|---|
| Screen frame | The reference frame includes the keyboard below the game screen. Options: map the full frame, or the screen alone. | The screen is the frame's top 16:9 (y 0–0.667, read off a frame), so screen y = frame y × 1.5. | Change `SCREEN` in `lane.ts`. |
| Pitch to u | Keys (the reference's 28 strip keys), or the chart's own range. | The chart's lowest to highest pitch covers u ±0.85 (`uSpan`), with at least 12 semitones each side of the middle (`minHalfRange`), so a narrow song isn't spread to the edges. | Change those two values in `stageLane`. |
| Width at the crest | The width fit gives 0.63 there; the reference stalls at 0.55–0.59. | The fit is kept, which puts a note up to 0.02 too far out at the crest only. `lane.test.ts` pins that tolerance. | Clamp W near the crest. |
| Guides | The reference's 10 guides arch over the top near y≈0.079 (visual, not measured). | Each guide runs at its measured u at the bar, from the crest to the bar, with no arch over the top. | Draw the arch in `hill()` in `draw.ts`. |
| Notes past the bar | Run on past the bar, or leave. | An unjudged note leaves the lane at its time, as `onLane` filters it; the judge's MISS arrives on the channel. | Extend `onLane` past 0. |
