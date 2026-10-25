# mascot-spike: choices the spec left to the worker

eric-agent-5, 2026-10-25.

## Top 2 sheets: sheet-01 and sheet-06
- **Context:** the spec has the worker pick its top 2 of the 6 sheet candidates for pose sets.
- **Options:** sheet-01 (teacher proportions, clasped hands, calm smile), sheet-02 (round head, hands behind the
  back), sheet-03 (long snout, half-lidded: the most dapper, but reads smug and the snout eats a small spot),
  sheet-04 (chubby app mascot, big eyes: the hype end of the direction), sheet-05 (older, teeth: least friendly),
  sheet-06 (big-head avatar).
- **Choice:** sheet-01 and sheet-06. sheet-01 is closest to "a calm, slightly dapper piano teacher". sheet-06 is the
  one that still reads in the HUD band and beside the highway, where the gator is small. They are the two ends of the
  proportions question, so Eric's pick answers that too.
- **How to undo:** pose sets for any other sheet are one run of the same script with that sheet as reference.

## One image per pose candidate, frames side by side
- **Context:** the spec wants 2–3 frames per pose and at least 3 candidates per pose, inside 120 images.
- **Options:** one image per frame (6 poses × 3 frames × 3 candidates × 2 sheets = 108, plus 6 sheets = 114), or one
  image per candidate holding its 3 frames left to right, split by code (36 + 6 = 42).
- **Choice:** one strip per candidate. Frames drawn in one image share a scale and a character far more than frames
  drawn in separate calls, and it leaves room under the cap for a second round of prompt fixes. `pack.mjs` splits at
  the transparent gaps.
- **How to undo:** generate per frame with the same prompts, one frame each; `pack.mjs` then needs no split.

## "Opaque" in the colour check means alpha ≥ 250
- **Context:** codex's fills come out at alpha 253–254, almost never 255 (sheet-01: 2,744 pixels at 255, 658,000 at
  253–254).
- **Choice:** the colour check counts pixels at alpha ≥ 250. A strict 255 would judge 0.3% of the figure.
- **How to undo:** `limits.solid` in `check.mjs`.
