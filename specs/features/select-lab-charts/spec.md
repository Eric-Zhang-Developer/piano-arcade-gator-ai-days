---
name: "Select lab charts: experiment-only charts under songs/x/ stay off the song select and its search"
depends_on: ["song-select", "song-finder", "round"]
owns: ["specs/features/select-lab-charts/", "changes/select-lab-charts.md", "specs/decisions/select-lab-charts-"]
assignee: "eric"
---

# Select lab charts

Issue #1165, from the polish refill.

**Today (origin/main, `web/src/game/song-select/load.ts`):** `loadSongs` lists every `chart.json` under
`web/public/songs/` at any depth, except folders in `LAB_ONLY`. `LAB_ONLY` is `["rounds"]`, added for the round's
charts (#1123), so it skips `songs/rounds/` and nothing else. **#1165 is not met:** a chart under `songs/x/` would
still be listed. None is on main yet; build-sonata's draft PR #1166 adds `web/public/songs/x/build-sonata/`, which
its spec notes "appears in the song select". The difficulty, easy-charts, sheet-beams, sheet-xml and song-jacket tests
already import `LAB_ONLY`, so they follow whatever it holds.

## The change
- Add `"x"` to `LAB_ONLY`, so `loadSongs` skips any chart under `songs/x/`. The search (song-finder) filters the list
  `loadSongs` returns, so it follows.
- Update the comment above `LAB_ONLY` to name `x/` as the folder for experiment-only charts.
- `/play?song=x/<id>` still loads such a chart directly: `/play`'s `SONG_ID` (`app/play/page.tsx:39`) already takes
  a path with `/`. Nothing there changes.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
these:

| File | Owning feature |
|---|---|
| `web/src/game/song-select/load.ts`, `load.test.ts` | song-select |

## Validation
- **(a) A loader test** in `load.test.ts`, on a temporary songs folder with one chart at the top level, one under
  `x/<id>/` and one under `rounds/<id>/`: `loadSongs` returns only the top-level one.
- **(b) /play still loads it:** a test (or a one-line check in the PR) that `SONG_ID` from `app/play/page.tsx`
  accepts `x/build-sonata`; if `SONG_ID` isn't exported, show the regex match in the PR instead of exporting it.
- **(c) The library tests stay green:**
  `pnpm -C web exec vitest run src/game/song-select src/game/difficulty src/game/easy-charts src/game/sheet-beams src/game/sheet-xml src/game/song-jacket`.
- **Design pass:** none. No `.tsx`, `.css` or draw code changes; the select only stops listing charts that aren't on
  main yet. The PR's Design section says so.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/select-lab-charts-*.md`.
- `songs/x/` charts stay validated by `songs/library.test.ts`, as the round's are.
