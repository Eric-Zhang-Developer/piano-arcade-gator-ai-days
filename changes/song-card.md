## What shipped
`SongCard`: one song as a music-select card. It has a square jacket slot, the title in Saira italic 800 (one line, ellipsis, full title in `title=`), the composer and catalog dimmed, the note count, and a LEVEL box (the `level` prop, which song select now gets from `difficulty`; "—" when absent). When focused, it gets a magenta frame and glow and scales to 1.05 over 200 ms ease-out; under reduced motion it keeps the frame and doesn't scale. Nothing uses it yet: `select-layout` places the cards.
## Where it lives
`web/src/game/song-card/` (component, CSS module, test); `specs/decisions/song-card-jacket-slot.md`; screenshots in `specs/features/song-card/`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at c37a4af. `pnpm -C web test` renders the card with `renderToStaticMarkup` (title, composer, count, "—", a given level, no stray number). Three cards (short title, long title, focused) at 1280×720 and 1920×1080, plus reduced motion, from a throwaway harness page that isn't committed. Eric's eye: **not verified by Eric** (does the card read well on a laptop?).
## Gaps
The jacket slot stays an empty faint square until `song-jacket` lands. The screenshots show "—" because the harness passed no level; song select now has real levels (#182), and `select-layout` passes them in.
