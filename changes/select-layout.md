## What shipped
`MusicSelect`, the arcade music select. The "Piano Arcade" wordmark sits on top. On the left: the focused song's jacket, large, with its title, composer, level and note count. On the right: the `SongCard` list with jackets, the focused card framed. ↑/↓ move focus and keep the focused card centered (the list scrolls inside its column, never the page); Enter and click play; the first song is focused on load. Each card is still a link with song select's `data-testid`.
## Where it lives
`web/src/game/select-layout/`; `specs/decisions/select-layout-scroll-and-accent.md`; screenshots in `specs/features/select-layout/`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at 5d06bdf. In Chrome (Playwright) on a throwaway harness page: ↑/↓ visits all 10 songs in order with the focused card in view, Enter on Für Elise opens `/play?song=fur-elise`, and a click on Clair de lune opens `/play?song=clair-de-lune`. There's no page scroll at 1280×720 or 1920×1080. Eric's eye: **not verified by Eric** (pick a song with the keyboard; does it feel like an arcade?).
## Gaps
`/` still renders the old list: `page.tsx` belongs to song-select, so it switches to `MusicSelect` in the follow-up `fix(song-select)` PR. That PR runs the verify path against the new screen.
