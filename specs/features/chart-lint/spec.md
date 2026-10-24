---
name: "Chart lint: a hand-span rule in the library test, every rule pinned by a synthetic chart, and a library table"
depends_on: ["song-pack-1", "song-pack-2"]
owns: ["web/src/game/songs/library.test.ts"]
assignee: "eric"
---

# Chart lint

Charts come from converters (song-pack-1's `midi-to-chart`) and soon from song ripping. Some mistakes only show
later, as an unplayable hand or a broken score in `sheet-view`. `web/src/game/songs/library.test.ts` (song-pack-1's,
done) already runs four of the issue's six rules over every chart: same-pitch overlap, time order, and through
`validateChart` pitches outside 21–108 and duplicate ids. So this feature extends that test rather than adding a
second lint that would run the same rules over the same files. What it adds: a hand-span rule, a synthetic chart
that proves each rule fires (today none does, so a rule could silently stop working), and a printable table.

Dropped from the first draft:
- **Past the last bar:** the converter already ends a note held past the last chosen bar at that bar (midi-to-chart's
  README), and sheet-xml runs its bars to the last note's end, so such a note breaks nothing.
- **`known.ts`:** a planning check at 2e1c3fd found no failures, and the library test already fails on any.

Issue: #274

## Plan
1. One `feat(chart-lint)` PR that changes only `library.test.ts`: song-pack-1 is done, so the file is in `owns`.

## Requirements
- **Hand span:** `problems()` adds a rule: at one onset (same `beat`), one hand's notes span more than a major 10th,
  highest − lowest > 16 semitones (`MAX_SPAN = 16`). The message names the beat, the hand and the note ids. It runs
  wherever the other rules run, `local/` included.
- **Synthetic charts:** for each rule (same-pitch overlap, pitch range, duplicate id, time order, hand span) a chart
  that breaks only that rule gets that rule's problem from `problems()`, naming the right notes (validateChart names
  them by index); a clean synthetic chart gets none.
- **The table:** `CHART_LINT_TABLE=1 pnpm -C web test library` prints one Markdown row per chart: id, notes, bars,
  lowest and highest pitch (MIDI numbers), and its widest one-hand span at one onset. Without the variable it prints
  nothing.
- It edits no chart.

## Validation
- `pnpm -C web test`: the synthetic charts as above, and the library passes. At 2e1c3fd the widest one-hand span at
  one onset is 14 semitones (gymnopedie-1's left hand), so no chart should fail. If one does, file a `bug` issue for
  its owner's `fix(<owner>)` PR and don't merge red.
- The table printed for today's library goes in the PR body.

## Defaults
- A 10th means more than 16 semitones (a major 10th), as `MAX_SPAN`.
- Every rule fails the test. No warnings.
- Log choices the spec doesn't make in `specs/decisions/chart-lint-*.md`.
