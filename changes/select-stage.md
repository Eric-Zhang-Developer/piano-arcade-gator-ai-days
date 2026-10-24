## What shipped
The music select (`/`) has fever-stage's synthwave scene behind it: grid, sun and stars in the tier-1 look, at `/play`'s stage brightness (0.35), scrolling one grid line per beat at 60 bpm. Reduced motion gets one still frame. `?stage=off`, the stage storage switch, or no WebGL shows the old gradient.
## Where it lives
`web/src/game/select-stage/` (driver, `<SelectStage />`, tests, `verify-select-stage.mjs`), mounted by `MusicSelect` (#325); screenshots in `specs/features/select-stage/look/`.
## How to check it
`node web/src/game/select-stage/verify-select-stage.mjs --out <dir>`: pass on main at efa8489, 1280×720 and 1920×1080. Exactly one live WebGL context across / → /play (0) → Start (1) → / (1). Lowest text contrast 4.95:1, no page scroll. `verify.py --slug select-stage` passed on the combined branch.
## Gaps
Not verified by Eric (does the stage help or distract when picking a song?). Freeze guard under load: no freeze on / in the verify runs or in a 60 s soak, on GPU or software GL, at load average 7–14. Headless runs use Metal GPU flags on a Mac, as perf-budget does.
