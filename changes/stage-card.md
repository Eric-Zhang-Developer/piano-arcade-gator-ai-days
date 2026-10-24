## What shipped
`/play`'s start screen opens on an arcade stage card: a full-width "ARE YOU READY?" band, the song's jacket, title,
composer and level ("—" when there's none). The page's Start and controls stay below it; the overlay clears on Start.
## Where it lives
`web/src/game/stage-card/`, one line in `web/src/game/layers.ts`; screenshots in `specs/features/stage-card/`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (stage-card, 684e81f)
## Gaps
The page's own `<h1>` title still repeats under the card until a `fix(core-loop)` drops it. Eric's eye: not verified
by Eric.
