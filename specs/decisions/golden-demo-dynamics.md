# golden-demo: how a sheet's dynamic marks become the bot's velocities

**Context.** The bot now presses at `note.velocity ?? KEYS_VELOCITY` (spec golden-demo, Requirement 2). Golden's three
local charts get velocities from the scans' marks. The spec leaves the mark→velocity map, the hairpin ramp and the
level before the first mark to this file. The velocities themselves stay local with the charts (decision 003).

**Options.**
- A. One fixed level per mark, hairpins ramped note by note between the levels they join.
- B. A plus a per-hand balance (melody over accompaniment) and accents.
- C. A curve fitted to the recording's loudness.

**Choice: A.** It reads only what the sheet writes, so nothing is invented, and every number below is a rule a
person can check against the scan. B adds an arrangement choice the sheet doesn't make; C reads Eric's recording,
which isn't the sheet.
- **Levels** (MIDI velocity, the common 16-step ladder): pp 33, p 49, mp 64, mf 80, f 96, ff 112. mf is
  `KEYS_VELOCITY`, so a chart with no marks sounds as it did.
- **Before the first mark:** mf.
- **A mark** applies from its note to the next mark, both hands.
- **A hairpin** ramps linearly by onset time, from the level where it starts to the mark that ends it. A hairpin that
  ends on no mark ramps one step (16) up or down and holds there.
- **A bar whose marks can't be read** keeps the previous level and is listed below.

**Bars kept at the previous level.** Filled in when the marks are read from the scans.

**How to undo.** Strip `velocity` from the local charts (or one hand's notes): the bot falls back to `KEYS_VELOCITY`.
