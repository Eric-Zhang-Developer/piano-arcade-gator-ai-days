# black-key-lanes: the stage cap makes room for the tint

**Context.** fever-stage caps its canvas so the brightest pixel behind the lanes is `maxLaneLuma` (0.35) after the
highway's 0.55 backdrop: opacity 0.35 / 0.45 ≈ 0.78. black-key-lanes then lays white at `tint` (0.04) over each black
key's lane, so that lane's worst case is `tint + (1 − tint) × opacity × (1 − stageBackdropAlpha)` ≈ 0.376, over the cap.

**Options.** (A) Take the tint out of the cap: opacity `(maxLaneLuma − tint) / ((1 − tint) × (1 − stageBackdropAlpha))`
≈ 0.72, the whole stage about 8% dimmer. (B) Lower the tint until it fits under the old cap: a 0.04 lift can't fit
under a cap the stage already reaches. (C) Shade the lanes only with the stage off: two looks for one highway.

**Choice.** A, as the spec says. `stageOpacity(tint)` in `web/src/game/stage/index.ts` (#393). select-stage keeps its
own `opacity: maxLaneLuma`: no highway lies over it, so no black lanes.

**How to undo.** `blackKeyLaneSettings.tint = 0` gives back the old 0.78 and draws no lanes.
