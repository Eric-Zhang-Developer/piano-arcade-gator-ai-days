## What shipped
The Duo palette across the game (#657):
- Colors: ink on near-black `#030607`, the right hand blue `#2b9bff`, the left hand purple `#a07cff`, and hype pink
  `#ff2fd0` for the big moments.
- Type: Saira for display and JetBrains Mono for data.
- Every corner sharp, except on `/learn`.
- The fever stage shows only in fever.

The Duo kit for the screens still to come (#655):
- React: `Panel` (with a paper variant), `Brackets`, `Button` (primary and secondary), `MonoLabel` and `DataCell`.
- Canvas: `drawBrackets` and `drawPanel`, so duo-hud, duo-results and sheet-paper share one set of brackets.
## Where it lives
- `web/src/app/globals.css`, `web/src/app/layout.tsx` and `web/src/game/ui-tokens/`: the tokens and fonts.
- `web/src/game/duo-tokens/`: the kit, its test and `verify-duo.mjs`. Screenshots are in `specs/features/duo-tokens/shots/`.
- `specs/decisions/duo-tokens-paper.md` and `duo-tokens-radius.md`.
## How to check it
`verify: node web/src/game/duo-tokens/verify-duo.mjs --out <dir> pass at b7c3590`. Tokens on `/` and `/play`; the stage at opacity 0 in all 430 frames outside fever and full in 1255 of 1261 in fever; every element 0 px on `/`; `/learn` keeping its radii; no page errors.
- Validation 1: the token, hand-color, LED, key-skin and kit tests pass (52/52).
- Validation 2: the only old hex left is GREAT's mint, in its three expected places.
## Gaps
- **Eric's eye, not checked yet:**
  - The LED strip showing blue for the right hand and purple for the left (Validation 5).
  - The palette on the cabinet screen.
- **GREAT keeps its mint;** duo-hud and duo-results decide it.
