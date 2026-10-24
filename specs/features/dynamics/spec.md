---
name: "Dynamics: grade how loud you played against the score"
depends_on: ["song-pack-1", "play-slots"]
owns: ["web/src/game/dynamics/"]
assignee: "eric"
---

# Dynamics

The four leading learning apps don't grade dynamics (`mission.md`, Why; catalog G03). This feature does. Charts
carry note velocities from the score's notation export, and the results say, phrase by phrase, where you played
too loud or too soft. It's a `resultsPanel` (play-slots).

## Plan
1. **First:** the overnight `contract:` batch (#143) must be on `main`. If `ChartNote` in
   `web/src/contracts/index.ts` has no `velocity`, this feature is blocked: take the next ready feature.
2. **A `fix(song-pack-1)` PR:** the converter (`game-tools/midi-to-chart/convert.py`) writes each note's `velocity`
   from its note-on, and the three song-pack-1 charts are re-exported with it from the same sources and bar ranges.
   The note count, pitches and beats don't change, and the library test still passes. Write in the done note which
   charts turned out to have more than one velocity.
3. The pure grading and the panel in `web/src/game/dynamics/`.

## Requirements
- **When it grades:** only when every chart note has a `velocity` and the take's input senses velocity (`midi` or
  `test`). Otherwise the panel says why, in one line: "This score marks no dynamics" (all chart velocities are
  equal or missing) or "Laptop keys don't sense how hard you play".
- **Phrases:** groups of `dynamicsSettings.phraseBars` bars (default 2) from bar 1, numbered as bar-loop numbers
  bars (bar n holds beats `(n-1)×beatsPerBar` up to `n×beatsPerBar`). That's the same split weak-bars uses.
- **The rule grades shape, not absolute level,** because the DGX's touch response isn't the export's. For each
  phrase with at least 3 hit notes: the score's shape is the phrase's mean chart velocity minus the whole chart's
  mean. The played shape is the phrase's mean played velocity minus the mean over all hit notes. Played velocities
  come from `take.events[eventIndex]`. If the played shape minus the score's is more than `toleranceVel` (default
  12), the phrase is "too loud"; less than `-toleranceVel`, "too soft"; otherwise "ok". A phrase with fewer hits gets
  no verdict.
- **The panel:** a summary ("2 of 6 phrases too soft"), one row per phrase with a verdict ("Bars 3–4: too soft,
  -18"), and one line comparing levels ("You played at velocity 71 on average; the score averages 64"). Every number
  comes from this take and this chart.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: played velocities equal to the chart's -> every phrase ok. One phrase marked forte and played
  at the chart's piano level -> that phrase too soft. Every note played 20 louder -> every phrase ok, and the level
  line shows the difference. Laptop keys and an all-equal chart each get their one-line message. A phrase with 2
  hits gets no verdict.
- `verify.py --slug dynamics` passes.
- A Playwright check kept in the PR plays a chart that has dynamics through `window.__pianoArcade.press` with
  `?input=test`. With the chart's own velocities, every phrase is ok. With one phrase at velocity 30, that phrase is
  flagged too soft. Keep a screenshot of the panel.
- On the piano (Eric; mark it in the done note): play a phrase much louder than marked -> the panel flags it.

## Defaults
- If no chart on `main` has more than one velocity, ship the panel with its message, and say so in the done note.
  Don't invent velocities.
