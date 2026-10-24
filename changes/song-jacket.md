## What shipped
Generated cover art for each song. `jacketFor(id, title, composer)` is pure: the id's hash picks one of ten hand-picked cabinet-color palettes and one of eight angles. The word is the title's first word, or the composer's surname when the title starts with an article. `SongJacket` draws it as a square with the word in Saira italic 900, cropped by the edge, and fills whatever holds it (song-card's `jacket` slot).
## Where it lives
`web/src/game/song-jacket/` (`index.ts`, `SongJacket.tsx`, CSS module, test); `specs/decisions/song-jacket-palettes.md`; screenshots in `specs/features/song-jacket/`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at 270b01b. `pnpm -C web test` checks that the same id gives the same jacket, that every stop is a cabinet color, that no two library songs share both angle and first color, and the word rule. Every song's jacket is shown side by side at 1280×720 and 1920×1080, plus reduced motion, from a throwaway harness page that isn't committed. Eric's eye: **not verified by Eric** (do the jackets look designed, not random?).
## Gaps
Song select doesn't show jackets yet; `select-layout` wires `SongJacket` into `SongCard`. With ten palettes, two songs can share one (Twinkle and Nocturne do); they differ in angle and word.
