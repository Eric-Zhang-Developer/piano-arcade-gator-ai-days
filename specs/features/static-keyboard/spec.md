---
name: "Static keyboard: one fixed C-to-C range per song, zoom off by default"
depends_on: ["core-loop", "highway-zoom", "laptop-octaves"]
owns: ["specs/features/static-keyboard/", "changes/static-keyboard.md"]
assignee: "eric"
---

# Static keyboard

Eric, 2026-10-24, after playing it: the keyboard resizing during a song "feels wrong". A pianist finds notes by where
the keys sit, so the keyboard must never move during a take. Approved: "static keyboard for the whole song, range
snapped outward to C-to-C octaves, zoom off by default (keep ?zoom=on), and laptop keys stop auto-following."

Today three things move it. highway-zoom turns itself on for charts wider than 22 white keys
(`zoomOn`, `web/src/game/highway-zoom/index.ts:34-39`, `minWhiteKeys` at line 10), and /play then rebuilds the layout
from the eased range every frame (`web/src/app/play/page.tsx:196` and `:291`). laptop-octaves moves the laptop map by
itself when the view leaves it behind (`follow`, `web/src/game/laptop-octaves/index.tsx:45-55`, called each frame at
`:187`). Without zoom, `makeLayout` (`web/src/game/core/highway.ts:77-82`) pads the chart's range by one white key
each side, so a song starts and ends on whatever key that lands on (Twinkle: B3 to B4).

Issue: #384

## Plan
The code lives in other features' folders, so it lands as fixes to them, each starting from a test that fails on
`origin/main`. Any order works; the done note comes last.
1. **`fix(core-loop)`:** the snapped range below in `web/src/game/core/highway.ts` (`makeLayout`'s no-view path, or a
   range it's given), with its tests in `highway.test.ts`. Its pins at `highway.test.ts:21-28` (`[59, 71]` and
   `[59, 72]`) are today's padded range and change on purpose: say so in the PR. /play computes the range once from
   the chart as loaded, before any `transformChart` (`page.tsx:91` keeps only the transformed chart), and uses it for
   every layout of the take, the resize at `:209` included.
2. **`fix(highway-zoom)`:** `zoomOn` returns true only for `?zoom=on`. Its spec text says so, and
   `specs/decisions/highway-zoom-static.md` records Eric's decision and how to undo it (restore the auto rule).
3. **`fix(laptop-octaves)`:** `draw` stops calling `follow`; the hint's rule changes (below). Its spec's Following
   and hint requirements change in the same PR.
4. **`feat(static-keyboard)`:** `changes/static-keyboard.md` and the screenshots in `specs/features/static-keyboard/`.

## Requirements
- **The range:** from the C at or below the chart's lowest pitch to the C at or above its highest; a chart whose
  highest note is a C ends on it. Both ends are C, so the keyboard starts and ends on a white key with no padding.
- **Minimum 2 octaves:** if that is under 24 semitones, add the missing octaves split between the ends, the odd one
  above (a one-octave chart gets the octave above it). Clamp both ends to 21–108; an octave that can't go on one side
  goes on the other.
- **The library at 198c902** (lowest and highest pitch from each `web/public/songs/<id>/chart.json` → range, white
  keys; today's padded range in brackets):

  | Song | Pitches | Range | White keys |
  |---|---|---|---|
  | twinkle | 60–69 (C4–A4) | C4–C6 (60–84) | 15 [8] |
  | minuet-g | 66–79 (F#4–G5) | C4–C6 (60–84) | 15 [11] |
  | ode-to-joy | 43–74 (G2–D5) | C2–C6 (36–84) | 29 [21] |
  | chopin-prelude-4 | 47–74 (B2–D5) | C2–C6 (36–84) | 29 [19] |
  | clair-de-lune | 44–80 (G#2–G#5) | C2–C6 (36–84) | 29 [25] |
  | fur-elise | 40–88 (E2–E6) | C2–C7 (36–96) | 36 [31] |
  | gymnopedie-1 | 33–81 (A1–A5) | C1–C6 (24–84) | 36 [31] |
  | moonlight-3 | 33–85 (A1–C#6) | C1–C7 (24–96) | 43 [34] |
  | nocturne-op9-2 | 34–86 (A#1–D6) | C1–C7 (24–96) | 43 [34] |
  | maple-leaf-rag | 32–92 (G#1–G#6) | C1–C7 (24–96) | 43 [39] |

- **Fixed for the whole take:** the same range from the count-in to the results, through pause, resume and a window
  resize (the width changes, the keys don't). A retry gets the same range.
- **The whole chart's range:** `hands=`, bar-loop (`from=`/`to=`), chunk-practice and wait-mode takes use the range of the chart as
  loaded, not of the notes left after `transformChart`. Für Elise with `hands=R` is C2–C7, as without it.
- **Zoom off by default:** no chart zooms by itself. `?zoom=on` keeps today's pan and zoom (`createZoom` and its
  tests unchanged); `?zoom=off` means static.
- **Laptop keys:** the map never moves by itself. Z and X still shift it an octave under today's rule (`canMove`: on
  the piano, at least 5 of its white keys in range), and the cyan highlight shows the mapped keys. The start screen's
  "Z / X: octave down / up" shows when the range is wider than the map's 10 white keys, which with the 15-key minimum
  is every song.
- **Unchanged:** sheet-view, bar-lines, practice (chunk-practice, wait-mode), `hands=` and their tests work with the static layout. Every visible
  key's lane lines up with its key (`keyX` serves both). `verify.py`'s Twinkle run stays 42/42 PERFECT.

## Validation
- `pnpm -C web test`: the range function gives twinkle C4–C6, minuet-g C4–C6, fur-elise C2–C7 and moonlight-3 C1–C7
  from their real charts; a chart of only C4 gives C3–C5; a chart reaching 21 or 108 stays inside 21–108 and at
  least 24 semitones wide; Für Elise after hand-mode's `transformChart` with `hands=R` still lays out C2–C7. `zoomOn` is
  false with no `zoom` param on fur-elise and true with `?zoom=on`. On a laptop-octaves plugin fed frames whose
  range jumps, k stays put; the hint shows on twinkle. Each of these fails on `origin/main` before its fix.
- Headless 1920×1080, `/play?song=fur-elise&bot=perfect`: the keyboard shows 36 white keys, C2 to C7, in the
  count-in, at 25% and at 75% of the notes judged. Keep the three screenshots.
- `/play?song=fur-elise&zoom=on`: the lanes still pan and zoom as in highway-zoom's done note. Keep a screenshot.
- `node web/src/game/song-sweep/sweep.mjs` over all ten songs: in each song's start, 25%, 50%, 75% and first-fever
  frames the keyboard has the same white-key count, the one in the table above (count the keys in the frames, or read
  the range from the page). Keep the contact sheet.
- Screenshots of twinkle and fur-elise mid-song at 1280×720 and 1920×1080, kept in
  `specs/features/static-keyboard/`.
- `verify.py --slug static-keyboard` passes.
- Eric's piano check (mark it in the done note): Für Elise on the DGX feels right. `not verified by Eric` until he
  does.

## Defaults
- If lanes on the 43-key songs read too thin, raise nothing here: say so in the done note and let Eric decide.
- replay-view's overlay (`web/src/game/replay-view/overlay.tsx:59`) calls `makeLayout` with the chart it's given, so
  a whole-song replay matches the take. For a `hands=` or bar-loop take it may show a narrower range than the take
  did; note it in the done note's Gaps and file it for replay-view rather than changing its folder here.
- Log choices the spec doesn't make in `specs/decisions/static-keyboard-*.md`.
