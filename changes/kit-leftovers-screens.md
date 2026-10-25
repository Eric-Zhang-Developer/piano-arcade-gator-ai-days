## What shipped
The chunk-practice panel, the phone guard and the crash screen now wear the Duo kit: square corners, upright type, no hype-pink glow. The crash card is the kit's `Panel` and `Button`s; the chunk panel's links and the phone guard's Play anyway are `kitButton`s. Copy and behavior are unchanged.
## Where it lives
`web/src/game/chunk-practice/`, `web/src/game/phone-guard/`, `web/src/game/crash-guard/` (CSS, the components, and a kit test each for the chunk panel and the crash card); decision `specs/decisions/kit-leftovers-screens-choices.md`; shots `specs/features/kit-leftovers-screens/shots/`.
## How to check it
`pnpm -C web exec vitest run src/game/chunk-practice src/game/phone-guard src/game/crash-guard`: 21 pass (plus adaptive-chunks, 28 in all). The grep of the three CSS files for `italic`, `border-radius` and `255 47 208` finds nothing. `verify-chunks.mjs`, `verify-phone.mjs`, `verify-crash.mjs`: not verified locally; covered by main's scheduled full run.
## Gaps
The adaptive panel's Next and Slower (`adapt-next`, `adapt-slower`) get the same `kitButton`s but have no render test; only the fixed walk's Next and Learn again do. The way on's `:focus` ring isn't in the shots: the browser pane was hidden, so the page had no focus.
