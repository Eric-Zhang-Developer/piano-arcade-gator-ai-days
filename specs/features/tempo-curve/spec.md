---
name: "Tempo curve: a rubato score beside the strict one"
depends_on: ["play-slots"]
owns: ["web/src/game/tempo-curve/"]
assignee: "eric"
---

# Tempo curve

After a take, a second score is judged against a smooth tempo curve fitted to your playing, so rubato isn't
punished. Strict metronome judging stays the main score, the rank and everything else (catalog G01). It's made for
the Nocturne, Clair de lune and Chopin's Prelude. It's a `resultsPanel` (play-slots), and it's computed after the
take: nothing in the playing loop changes.

## Requirements
- **The curve** maps chart time to played time. It's a local linear fit of played time against chart time over
  `tempoCurveSettings.windowBars` bars on each side (default 2), evaluated at each note.
- **Fitting:** start from the strict results' hits, then walk forward through the song. Match each unmatched note
  to the nearest unmatched press of its pitch within ±400 ms of the curve fitted so far, and refit as you go. A press
  matches at most one note and a note at most one press, as `mission.md` requires.
- **The local tempo is clamped** to 50–150% of the chart's `bpm`, so the curve can't chase random playing.
- **Rubato judging:** each note's rubato offset is its press time minus the curve at its chart time, judged with the
  same windows as strict (25, 50 and 100 ms from `web/src/game/core/settings.ts`). Accuracy uses `Results`'
  formula, WRONG notes included.
- **The panel:** "Rubato score 96% · strict 71%". Under it, the tempo range the curve found ("82 to 104 BPM") and how
  many notes rubato judging recovered from MISS. It never changes the strict results, the rank or a record.
- **Too few:** with fewer than 8 hits, the panel says there isn't enough to fit a curve.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`:
  - A take that slows steadily from 100% to 80% tempo over Twinkle is all PERFECT in rubato judging, and drifts to
    GREAT and MISS in strict (catalog G01's acceptance).
  - A take at a steady +10 ms is all PERFECT both ways.
  - Random ±80 ms jitter on every note is not all PERFECT in rubato. The window can't follow note-to-note jitter.
  - The clamp holds at 50% and 150%.
  - The one-to-one matching rule holds.
- `verify.py --slug tempo-curve` passes.
- In Chrome: a Playwright check kept in the PR plays Twinkle through `window.__pianoArcade.press` (`?input=test`),
  slowing steadily -> the panel shows a rubato score above the strict one. Keep a screenshot.
- On the piano (Eric; mark it in the done note): play Chopin's Prelude with your own rubato. Say whether the rubato
  score matches how it felt.

## Defaults
- Prefer a wider window to a narrower one: a curve that bends too easily hides real timing faults.
