# main-page: the level bands

- **Context:** the spec asks for Level sections as bands labeled by number (`LV 01–03`), chosen so no band is empty or
  holds most of the library, and logged.
- **The library on 2026-10-25 (40 songs):** levels 1 (1), 2 (1), 3 (2), 4 (3), 5 (6), 6 (7), 7 (4), 8 (4), 9 (4),
  10 (1), 11 (3), 12 (1), 14 (1), 15 (2).
- **Options:**
  - **(a) Fixed bands:** 01–03, 04–05, 06–07, 08–09, 10–15. That's 4, 9, 11, 8 and 8 songs.
  - **(b) Quantile bands** computed from the library each load: always even, but a chip's meaning moves with every
    pack.
  - **(c) One section per level:** 14 sections, several of one song, and a chip strip as long as Composer's.
- **Choice:** (a). The top band is wide (10–15) because only 8 songs sit above 9; it stays short as long as packs
  add mostly middle levels.
- **How to undo:** edit `LEVEL_BANDS` in `web/src/game/main-page/index.ts`. The vitest checks that the bands cover
  1–15 with no gap or overlap.
