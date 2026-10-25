## What shipped
- **The replay now draws the take's own keyboard.** Before, for a `hands=` or bar-loop take on fur-elise, it drew 29 white keys against the take's 36, with the presses on different lanes.
- **How:** a one-line `replayKeys()` plugin, first in `layers.ts`, keeps the loaded chart's range for the overlay (#419).

## Where it lives
- `web/src/game/replay-view/keys.ts`, `overlay.tsx` (one argument), `replay-view.test.ts`
- `web/src/game/layers.ts` (the mount)
- `specs/decisions/replay-keys-range.md`
- Shots: `specs/features/replay-keys/shots/`

## How to check it
- `pnpm -C web exec vitest run src/game/replay-view`
- `verify-replay`: not verified locally; covered by main's scheduled full run.
- Live, counted from the canvas pixels:

  | Take | The take | The replay before | The replay after |
  |---|---|---|---|
  | fur-elise `hands=R` | 36 | 29 | 36 (at 1280 and 1920) |
  | `from=9&to=12` | 36 | — | 36 |

## Gaps
- **The bar-loop "before"** comes from the code reproduction (29), not a live replay.
- **highway-zoom:** with it on, the take's own keyboard follows the transformed chart (page.tsx, #600). The replay keeps the loaded chart's.
