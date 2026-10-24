---
name: "Sheet pickups: a pickup prints as a short bar 0, so the sheet's bar numbers match the printed score"
depends_on: ["sheet-xml", "sheet-view"]
owns: ["web/src/game/sheet-pickups/"]
assignee: "eric"
---

# Sheet pickups

The contract puts beat 0 at bar 1, so a chart with a pickup (anacrusis) pads it to a full bar, and sheet-xml prints
that bar as rests and then the pickup (`changes/sheet-xml.md`, Gaps). Every later bar number runs one ahead of the
source score. Measured on the charts at 2e18582: chopin-prelude-4's first note is at beat 3 of a 4-beat bar,
fur-elise's at 1 of 1.5, maple-leaf-rag's at 1.5 of 2, nocturne-op9-2's at 5.5 of 6 (11 eighths of rest).
clair-de-lune's is at 0.5 of 4.5 and isn't a pickup: its first bar opens on a rest. So the notes give the length,
and the source says whether there is a pickup at all.

Issue: #377

## Plan
Three small PRs, the done note last.
1. A `fix(sheet-view)`: `follow.ts` reads the sheet's offset from the render itself: when OSMD's first source
   measure is shorter than a bar, the sheet's time 0 is chart beat `beatsPerBar - (its length in beats)`. It adds
   that to every notehead onset and cursor stop. It's 0 for every chart today, so this PR changes nothing visible
   and can merge first. It also adds `firstMeasure: { number, beats }` (OSMD's printed number and length of the first
   measure) to `window.__pianoArcadeSheet`.
2. A `fix(sheet-xml)`: `overrides.ts` gains `pickup: true` for each chart whose source opens with `\partial`, each
   cited by file and line as the key entries are. The writer prints that bar as `<measure number="0"
   implicit="yes">`, holding only the pickup, and numbers the next bar 1. It also exports `pickupBeats(chart, song)`
   for the tests and for later bar numbering elsewhere. Tests run over the ten charts.
3. `feat(sheet-pickups)`: `web/src/game/sheet-pickups/verify-pickups.mjs`, before-and-after shots, the done note.

## Requirements
- **Length from the notes:** `pickupBeats = beatsPerBar - (the song's first note's beat)`, when the table marks the
  song and that first note falls inside bar 1 after beat 0. Otherwise 0, and the sheet prints as today. Nothing is
  rounded or guessed: a pickup that isn't a whole number of 16ths throws, as a bar does today.
- **Which song:** the pickup comes from `song` (the whole chart), as the key already does, so `?hands=L` still opens
  on bar 0. It applies to the chart as played only when none of that chart's notes start before the pickup. A
  bar-loop from bar 3 starts on a barline, so it prints as today.
- **The score:** bar 0 holds the pickup's length in each voice, rests included, and has the key, time and clefs.
  Bar 1 is the source's bar 1. The last bar keeps whatever length the notes give. The key and voices don't change.
- **Following:** every judged note still finds its notehead, and the cursor still lands on the note being played,
  pickup included.
- **Not here:** the highway's bar numbers (bar-lines), bar-loop's `from` and `to`, and weak-bars stay chart bars, so
  on these four songs the highway reads one ahead of the sheet. That's an open question for Eric (below).

## Validation
- `pnpm -C web test` (sheet-xml): with the table entries, chopin-prelude-4's bar 0 is 4 divisions (a quarter's
  length), and fur-elise's, maple-leaf-rag's and nocturne-op9-2's are 2 (an eighth's), as the notes give. The
  entry's comment quotes its source's `\partial`; if a source disagrees with the notes, file a `needs-human` issue
  and leave that chart out, don't edit the test. clair-de-lune, twinkle and the other four have no bar 0. In every chart, every
  voice in every bar sums to that bar's divisions. sheet-xml's read-back of every note still passes. A synthetic
  chart marked `pickup` whose first note is at beat 0 has no bar 0, and `hands=L` on fur-elise keeps bar 0.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/sheet-pickups/verify-pickups.mjs --out <dir>`. It starts its own dev server, prints
  `verify-pickups: pass` and exits 0, or names each failed song and exits 1. For each of the ten,
  `/sheet?song=<id>`: `firstMeasure` is `{ number: 0, beats: <pickup> }` for the four and `{ number: 1, beats:
  beatsPerBar }` for the rest. On main today it fails on all four. Screenshots of each of the four's first system.
- `node web/src/game/sheet-view/verify-sheet.mjs --out <dir>`: fur-elise still ends with 294 gold noteheads, and
  chopin-prelude-4, nocturne-op9-2 and maple-leaf-rag still follow, with counts no lower than sheet-view's done note.
- `verify.py --slug sheet-pickups` passes, /play unchanged. Eric (mark it in the done note): Für Elise on /sheet next to the printed score. Do the bar numbers agree?

## How it's built and checked
Only the short bar changes; before and after shots of Für Elise's and the Nocturne's first system go in the PR.

## Defaults
- No table entry: no pickup, so a ripped song prints as today. OSMD prints no number on an `implicit` bar 0.
- Open question for Eric: should the highway and bar-loop count bars the printed score's way too? That would be a
  `fix(bar-lines)` reading `pickupBeats`, and a bar-loop change to `from`, which is a URL other features build.
  Until he answers, they stay chart bars, and the done note says so.
- Log other choices in `specs/decisions/sheet-pickups-*.md`.
