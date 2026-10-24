---
name: "Ghost: your last take drawn on the highway when you retry"
depends_on: []
owns: ["web/src/game/ghost/"]
assignee: "eric"
---

# Ghost

When you retry, each note of your previous take shows as a dashed outline at the time you actually played it. You
see your own habits (always late on the jump, rushing the run) while you play again (catalog G04).

It's one plugin in `layers.ts`, built from `GameEvent`s only, and core doesn't change.

## Requirements
- **Recording:** during a take, the plugin keeps every `noteHit` (pitch, chart time plus `offsetMs`), `extra` and
  `wrongNote` (pitch, `atMs`). It drops the take on `quit`, and keeps it on `songEnd` as the ghost for the next take.
- **Same song only:** a ghost is keyed by the chart id plus the URL params that change the chart (`song`, `from`,
  `to`, `tempo`, `hands`). It shows only on a take with the same key. It lives in memory for the page's lifetime,
  with no storage.
- **Drawing:** a hit's ghost is a dashed outline of the note's own length, in its lane, shifted by its offset, and
  scrolling with the highway. Extras and WRONG notes get a short dashed tick in their lane. Misses get nothing:
  there was no press.
- **Under the play:** ghosts draw under every other plugin's layer, at low opacity. They never fill, so a real note
  is always readable through one.
- **Placement:** uses `Frame.keyX`, and the flat highway's scroll from core's `lookaheadMs` and `judgmentLineY`.
  With perspective above 0, ghosts hide.
- **Off:** `?ghost=off` or `localStorage["pianoArcade.ghost"] === "off"`.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: from a fixed event list, the ghost holds each hit at its note time plus its offset, plus the
  extras and WRONG notes. A `quit` keeps the previous ghost. A different `from` doesn't show the ghost. A note at
  +40 ms draws 40 ms later than its note, in px at a known `lookaheadMs`.
- `verify.py --slug ghost` passes, with two takes in a row and all PERFECT both times.
- In Chrome: play Twinkle late on purpose, then Retry -> dashed outlines trail the notes by your lateness. Keep a
  screenshot in the PR. `?ghost=off` -> none.
- On the piano (Eric; mark it in the done note): two takes of Twinkle. Say whether the ghost reads at a glance or
  gets in the way.

## Defaults
- Opacity and dash length live in `ghostSettings`. If the ghost gets in the way, lower the opacity first.
