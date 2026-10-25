## What shipped
Charts under `web/public/songs/x/` stay off the song select and its search, as `songs/rounds/` already did (#1165). The code landed in #1176, which added `"x"` to `LAB_ONLY`. This PR adds `rounds/` to its loader test and records the feature done.
## Where it lives
`web/src/game/song-select/load.ts` (`LAB_ONLY`), `web/src/game/song-select/load.test.ts`
## How to check it
`pnpm -C web exec vitest run src/game/song-select src/game/difficulty src/game/easy-charts src/game/sheet-beams src/game/sheet-xml src/game/song-jacket`: 7 files, 304 tests pass. `SONG_ID` matches `x/build-sonata` (true). No browser check: nothing visible changed. Not verified with verify.py.
## Gaps
No chart under `songs/x/` is on main yet (build-sonata's #1166 adds the first), so the skip has only been seen in the temp-folder test.
