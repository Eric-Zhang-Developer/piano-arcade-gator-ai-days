## What shipped
The HUD in the direction's look. Its numbers (counts, score, multiplier, the giant combo and its ghost) and the song title are drawn in Saira italic once the face has loaded, the body face until then. Labels stay in the body face. Tier colors, judgment colors and the panel come from `ui-tokens`, with unchanged values. Layout, sizes and numbers are unchanged (#206).
## Where it lives
`web/src/game/hud/index.ts` (#206); `specs/decisions/hud-skin-great-and-font.md`; before/after screenshots in `specs/features/hud/skin-*.png`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at 8574384. Hud's tests and `verify-hud.mjs` pass unchanged (`verify-hud: pass, HUD {"PERFECT":20,"GREAT":21,"GOOD":0,"MISS":1,"extra":1,"wrong":0,"score":7250,"combo":39}`). There are mid-song shots at 1280×720 and 1920×1080, with and without reduced motion. Eric's eye: **not verified by Eric** (does the HUD read at a glance while playing?).
## Gaps
GREAT has no token, so it keeps its literal mint. The combo swell and ghost still animate under reduced motion; that's hud's behavior and out of this spec's scope. Notes draw over the HUD panel's top edge, as before. Fever-gauge's FEVER label still uses the body face (`hudSettings.font`).
