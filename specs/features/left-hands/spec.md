---
name: "Left hands: the Minuet in G gets its left hand from its cited source; Twinkle's sources have none"
depends_on: ["minuet-g", "core-loop"]
owns: []
assignee: "eric"
---

# Left hands

Twinkle ("first verse, right hand") and the Minuet in G are the library's only right-hand-only charts. This adds a
left hand where the chart's own cited source has one, and stops where it doesn't.

Issue: #366

**What the planner found in the sources (2026-10-24):**
- **Minuet** (`source`: Mutopia 75, `anna-magdalena-04.mid`, sha256 `fd87a667…cb75`): the `.ly` has a bass staff
  (`voicetwo`) for bars 1–16. The MIDI's track 2 ("two:") is that staff. Counted from the `.ly` bar by bar, the left
  hand has 4+1+1+1+1+1+3+5+2+3+1+5+2+2+3+2 = 37 notes per pass, so 74 with the repeat. A scratch run of the converter
  (`--rh 1 --lh 2 --spans 0-48,0-48`) gave the same per-bar counts, pitches 43–62.
- **Twinkle:** neither cited source has a left hand. Wikipedia's `<score>` at revision 1378689555 is a single
  `\relative c'` staff with lyrics, and Mutopia 2236 is an arrangement for two guitars (`spikes/twinkle-13/SOURCE.md`).
  **Stop for Twinkle.** Ten verify scripts also pin its 42 notes, so a Twinkle left hand would be a larger change anyway.

## Plan
Owned files change only through their owners' PRs. `owns` stays empty, because a spec that isn't done holds its
`owns` exclusively (`in_flight` in `.agents/scripts/lib.py`).
1. **`fix(minuet-g)`:** the left hand goes into `web/public/songs/minuet-g/chart.json`, and `minuet-g.test.ts` is
   updated. Use the converter's `L` notes from the command above (`game-tools/midi-to-chart/`, sources fetched as its
   README says). Merge them into today's chart and leave its right hand alone: the converter shortens two right-hand
   G4s (beats 20.5 and 68.5) to 0.4167 because of the grace note, while the score prints eighths.
2. **Twinkle:** file a `needs-human` issue: "Twinkle's cited sources have no left hand. Take Mozart's theme bass from
   TAVERN `K265.xml` (CC BY-SA 4.0, checked against the Peters scan, as twinkle-13 did)?" Options: A, that source,
   through a `fix(core-loop)` with a new decision file / B, keep Twinkle right hand only. Default: B. No `fix(core-loop)`
   PR from this spec.
3. **`feat(left-hands)`:** the done note, with a Minuet highway screenshot in `specs/features/left-hands/`.

## Requirements
- **Right hand unchanged:** all 128 `R` notes keep their pitch, beat and duration.
- **Left hand:** every note of the source's bass staff in bars 1–16, chords and both voices of bar 1 included, with
  `hand: "L"`. The repeat is written out, as the right hand's is. A pitch both hands strike at one beat is kept once,
  in the hand the score gives it, the converter's rule.
- **The chart's rules:** notes in beat order, unique ids (renumbering to `n1`…`n202` in beat order is fine), and the
  library test's span, overlap and order rules. No dynamics: the source's MIDI marks none (the converter says so).
- **`source`:** it says both hands, A section, repeat written out, with the same URL, file and hash, and the ornament
  note as today. `catalog`, `bpm` and the title don't change.
- No game code changes.

## Validation
- `pnpm -C web test`, all passing. `minuet-g.test.ts` must check that the right hand equals today's 128 notes
  exactly, that the left hand has 37 notes per pass in the per-bar counts above, and that the second pass is the
  first pass plus 48 beats in both hands. It must also check the bar rule for each hand, and that the Perfect player
  gets 202/202 PERFECT, rank S. `library.test.ts` passes. `versus.test.ts` passes unchanged: versus plays the right
  hand only.
- Headless, from a clone: `node web/src/game/song-sweep/sweep.mjs --song minuet-g --params bot=perfect --out <dir>`
  exits 0 with rank S. The contact sheet shows the left hand in azure (hand-colors) under the right.
- `node web/src/game/sheet-view/verify-sheet.mjs --out <dir> --songs minuet-g` passes. The Minuet is in its exact
  set, so every note must end PERFECT on the sheet.
- `verify.py --slug left-hands` passes. Twinkle doesn't change.
- On the piano (Eric; mark it in the done note): play the Minuet with both hands. It's the piece you know, and the
  bass is readable at `bpm` 100.

## Defaults
- A bass note the MIDI and the `.ly` disagree on: the `.ly` wins. Log it in `specs/decisions/left-hands-minuet.md`.
- Laptop keys may not reach G2 (43). That's laptop-octaves' Z and X, not this spec.
- B section: still out, as in minuet-g.
