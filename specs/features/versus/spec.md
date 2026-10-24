---
name: "Versus: two players on one piano"
depends_on: ["play-slots"]
owns: ["web/src/game/versus/"]
assignee: "eric"
---

# Versus

Made for the booth: the 88 keys split at middle C, and each half plays the same chart an octave apart. Each player
gets a score, and a winner banner closes the take.

It's one plugin in `layers.ts`, and core doesn't change. The judge sees one chart that holds both players' copies.

## Requirements
- **Turning it on:** `?versus=1`. The plugin uses the chart's right-hand notes (`hand: "R"`, or all the notes for a
  one-hand chart).
- **The two copies:** P1, the upper half, gets the part moved by whole octaves to sit as low as it can with its
  lowest note at or above middle C (MIDI 60). P2, the lower half, gets P1 moved down by the fewest whole octaves
  that put its highest note below 60: one octave for Twinkle (60–69), two for the Minuet (66–79). Note ids become
  `p1:<id>` and `p2:<id>`.
- **Off the keyboard:** if either copy falls outside 21–108, `/play` shows "This song doesn't fit versus" and plays
  normally.
- **Scores:** from `noteHit` and `noteMiss`, each player's score counts their own notes by the id prefix. An extra
  or WRONG note counts against the half its pitch is in. Accuracy uses the formula in `Results`, per player.
- **During play:** "P1" and "P2" labels over each half, with each player's live combo and accuracy, drawn on the
  plugin's layer. The HUD keeps showing the shared combo, because the judge has one combo.
- **Results:** a `resultsPanel` shows both scores side by side, and "P1 WINS", "P2 WINS" or "DRAW" when the
  accuracies match to 0.1%.
- **Laptop keys** can't split, so versus is for the piano. `?input=test` drives it for verify.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: Twinkle (60–69) gives P1 at 60–69 and P2 at 48–57, with ids prefixed. A part 15 semitones
  wide lands two octaves apart. A part spanning 30–100 is refused. A fixed event list where P1 hits everything and
  P2 misses half gives P1 100%, P2 50% and "P1 WINS". An extra at pitch 50 counts against P2.
- `verify.py --slug versus` passes, plain mode unchanged.
- In Chrome: `/play?versus=1&input=test` (the Perfect player plays both copies) -> both halves show notes, and the
  results show "DRAW" at 100%. Keep a screenshot.
- On the piano (Eric and a second player; mark it in the done note): play Twinkle head to head. The halves are
  clear, and the banner names the right winner.

## Defaults
- One shared combo is fine. A second judge in core would be a much larger change.
