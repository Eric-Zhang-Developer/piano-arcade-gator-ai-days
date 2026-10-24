---
name: "Chord sync: flag chords rolled by more than 30 ms"
depends_on: ["play-slots"]
owns: ["web/src/game/chord-sync/"]
assignee: "eric"
---

# Chord sync

The results flag chords whose notes landed more than 30 ms apart, per hand (catalog G02). Each note can still be
PERFECT on its own while the chord sounds rolled. This matters now that the song packs chart both hands. It's a
`resultsPanel` (play-slots).

## Requirements
- **A chord:** 2 or more chart notes in the same hand at the same `beat`. The two hands at one beat are two chords.
- **Spread:** the latest press time minus the earliest among the chord's hit notes
  (`take.events[eventIndex].timeMs`). A chord with fewer than 2 hits has no spread, and counts as incomplete rather
  than rolled.
- **Rolled:** a spread over `chordSyncSettings.maxSpreadMs` (default 30). Exactly 30 is not rolled. The panel also
  names the roll's direction: "low to high" if the lowest pitch came first and the highest last, "high to low" the
  other way round, otherwise "mixed".
- **The panel:** "3 of 14 chords rolled". Under it, one row per rolled chord: "Bar 4, beat 1, left hand: 48 ms, low
  to high". A chart with no chords renders nothing. Every number comes from this take.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`:
  - A chord pressed 40 ms apart is rolled, one 20 ms apart isn't, and exactly 30 ms isn't (catalog G02's acceptance).
  - One hit and one MISS is incomplete.
  - A beat where both hands hold a chord gives two chords.
  - The direction is right for ascending, descending and mixed presses.
  - Twinkle (no chords) renders nothing.
- `verify.py --slug chord-sync` passes.
- In Chrome: a Playwright check kept in the PR plays a chart with left-hand chords through
  `window.__pianoArcade.press` (`?input=test`), with one chord spread over 45 ms -> the panel lists exactly that
  chord. Keep a screenshot.
- On the piano (Eric; mark it in the done note): roll one chord on purpose and play the others together -> only that
  one is flagged.

## Defaults
- Per hand only. Sync between the hands is a different skill and isn't in the issue.
