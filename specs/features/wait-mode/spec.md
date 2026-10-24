---
name: "Wait mode: the highway waits for each note while you learn a song"
depends_on: ["play-slots"]
owns: ["web/src/game/wait-mode/"]
assignee: "eric"
---

# Wait mode

A learn mode on `/play`: the highway stops at each note until you press it, and there's no score. Then you play the
song judged. The first playtest asked for "a wait mode for learning a song before it's judged"
(`specs/context/findings.md`). It's the game lane's by Eric's call (2026-10-24). The coach stays with the learning
lane; sheet music moved to the game lane too, in a second window (`sheet-view`, Eric's call later the same day).

## Plan
1. A pure `shouldHold(...)` in `web/src/game/wait-mode/`, with its tests.
2. **A `fix(core-loop)` PR:** with `?mode=wait`, `/play`'s clock holds at each note (Requirements), and the results
   screen shows the plugins' panels and Retry but no rank, counts or timing panel. Without `?mode=wait`, nothing
   changes, and `verify.py` passes unchanged.
3. **A `fix(beat-track)` PR:** no beat while `?mode=wait`. A beat is meaningless while the clock keeps stopping.
4. The plugin in `layers.ts`: a "Learn it first" `startPanel` and a "Play it judged" `resultsPanel`.

## Requirements
- **The hold:** when the earliest unjudged note reaches the judgment line, the chart clock stops. It stays stopped
  until every note due at that moment, a chord included, has been pressed. Core shifts its clock origin by the time
  held, as a pause does, so a press during a hold is judged at the held time.
- **No MISS:** nothing is ever called a MISS in wait mode. Wrong keys are counted as extras, as always, but nothing
  shows them as a score.
- **The highway** keeps drawing while held, so the waiting note sits on the line and its key glows.
- **Panels:** "Learn it first" on the start screen reloads `/play` with `mode=wait`. "Play it judged" on the
  results screen reloads it without `mode`. Both keep the other params (`song`, `hands`, `from`, `to`).
- **Not saved:** a wait-mode take is never saved as a record or best grade. `records` checks `mode`.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: `shouldHold` is true at a note's time until its pitch is pressed, true at a chord until every
  pitch is pressed, and false between notes. With holds, a pressed note is judged at offset 0 whenever the press
  came.
- `verify.py --slug wait-mode` passes, plain mode unchanged.
- In Chrome:
  1. `/play?mode=wait` -> the first note stops on the line. Press its key 3 s later -> the highway moves on.
  2. Finish -> no rank, and "Play it judged" opens the normal game.
  3. A two-hand chart -> a chord waits for both keys.
- On the piano (Eric; mark it in the done note): learn the first two bars of Für Elise in wait mode, then play them
  judged.

## Defaults
- No timeout on a hold. The player moves on by playing.
