## What shipped
From the last judged note until the results, the playfield dims and one card says how the take ended: ALL PERFECT or
FULL COMBO in gold, CLEAR in ink, Saira 900 italic, easing in over 200 ms (at once under reduced motion). It fills the
existing 1.2 s tail and is gone at songEnd; juice's 2 s FULL COMBO banner over the results is gone (#309).
## Where it lives
`web/src/game/clear-card/` (`clearKind`, the plugin, `verify-clear.mjs`), one line in `web/src/game/layers.ts`;
screenshots in `specs/features/clear-card/`; choices in `specs/decisions/clear-card-order.md`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (clear-card, 9c8ba82); verify-clear: pass,
ALL PERFECT at 1920, 1280 and 1024 (and reduced motion), FULL COMBO for bot=late, CLEAR for bot=rank-c, each gone before
the results (1180–1295 ms on screen).
## Gaps
Silent by design (the fanfare stays on fullCombo). Eric's eye: not verified by Eric.
