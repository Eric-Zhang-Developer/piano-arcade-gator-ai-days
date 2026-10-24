---
name: "Song options: Hands and Speed on the select's preview, remembered per song, passed to play and learn"
depends_on: ["song-preview", "hand-mode", "bar-loop", "learn-from-select", "easy-charts"]
owns: ["web/src/game/song-options/"]
assignee: "eric"
---

# Song options

Hand mode and slower tempos exist, but only as URL params and /play's start screen. The preview offers them where
the song is chosen: Hands (Both / Right / Left) and Speed (50 / 70 / 100%), remembered per song.

Issue: #361

## Plan
Small PRs, in this order. The done note merges last.
1. `fix(bar-loop)`: `tempo` with no `from` or `to` plays the whole song at that tempo, in one pass (from 1 to the
   chart's last bar). Today it's ignored, but records still count it as practice. No other URL changes.
2. `feat(song-options)`: in `web/src/game/song-options/`, `options.ts` (per-song store, `withOptions(href, o)`) and
   `<SongOptions />`, with tests. No done note.
3. `fix(select-layout)`: card hrefs and L's URL become `withOptions(withLevel(...), options[id])`, with
   `useSongOptions()` read like `useBestGrades`.
4. `fix(song-preview)`: `<SongOptions />` mounts in the preview panel under the row, and LEARN and PRACTICE carry the
   level and hands. PRACTICE keeps its own `tempo=70`.
5. `feat(song-options)`: `verify-options.mjs`, screenshots and the done note.

## Requirements
- **Params:** Hands is hand-mode's `hands`: `both` is absent, `R`, `L`. Speed is bar-loop's `tempo`: 100 is absent,
  then 70 and 50. Hands shows only on charts with both hands (from the chart SongPreview loads), and is never stored
  or sent for a one-hand chart: records would count it as practice.
- **Keys** on `/`, for the focused song, from `<SongOptions />`'s own listener (it mounts for that song only):
  H cycles Both → Right → Left; ← and → step Speed (50 ↔ 70 ↔ 100), stopping at the ends. Keys are ignored when the
  target is inside a `dialog`, an `input` or a `textarea` (options-panel's drawer), and with Ctrl, Meta or Alt. Both
  controls are button groups with `aria-pressed`, reachable with Tab.
- **Remembered:** `localStorage["pianoArcade.songOptions"]` = `{ [id]: { hands, speed } }`. A song set back to Both
  and 100% drops its entry. Blocked storage means the page only. Corrupt JSON reads as empty, with one console line.
- **Honest:** when Hands isn't Both or Speed isn't 100%, the panel reads `practice · not recorded`, matching records'
  `practiceReason`.
- **Enter, click and L** open `/play` with the song's options and easy-charts' level. Learn at 70% is wait mode at
  70% (chunk-practice already uses that pair).

## Validation
- `pnpm -C web test`: `withOptions` adds only non-default params and keeps others (`level`, `mode`). The store
  round-trips, drops defaults and survives corrupt JSON. H skips Hands on a one-hand chart. bar-loop: `tempo=70`
  alone plays every note at 0.7× bpm in one pass, `tempo=70&from=1&to=2` is unchanged, and no `tempo` is no loop.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/song-options/verify-options.mjs --out <dir>`. It prints `verify-options: pass` or names each
  failed step:
  1. On `/`, focus Für Elise, press H and then ←: Right and 70% are pressed, and the panel reads
     `practice · not recorded`.
  2. Enter opens params `song=fur-elise&hands=R&tempo=70`, where `__pianoArcade.chart` has only R notes at 0.7×
     the bpm. Pressing every note gives a results screen with no NEW RECORD.
  3. Back on `/` after a reload, Für Elise still shows Right and 70%. Twinkle shows no Hands and default Speed, and its
     href is exactly `/play?song=twinkle`.
  4. L on Für Elise opens params with `mode=wait&hands=R&tempo=70`. LEARN's href matches.
  5. Screenshots of the panel at 1280×720 and 1920×1080, kept in `<dir>`.
- `verify.py --slug song-options` passes, with plain links unchanged.
- Eric (mark it in the done note): set Für Elise to Right at 70% with the keyboard alone, and play it on the piano.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots
go in the PR.

## Defaults
- PRACTICE 70% stays, though Speed 70% now does the same. Eric decides whether to drop it.
- /play's start-screen hand picker stays: it reloads `/play` with `hands=` and doesn't write the stored options.
- W (watch-demo) plays the Normal chart with both hands at 100%: a demo shows the song as written.
- Log choices the spec doesn't make in `specs/decisions/song-options-*.md`.
