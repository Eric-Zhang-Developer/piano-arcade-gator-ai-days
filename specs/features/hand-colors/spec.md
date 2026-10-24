---
name: "Hand colors: left and right hands in two colors"
depends_on: []
owns: ["web/src/game/hand-colors/"]
assignee: "eric"
---

# Hand colors

Two-hand charts already play (catalog G09), but both hands share one color. This feature gives the left and right
hands two colors that stay distinct under color blindness, on falling notes, lit keys and hit bursts, with a legend.

## Plan
1. The two colors and a `handColor(hand)` function in `web/src/game/hand-colors/`. The legend goes there too, as a
   plugin in `layers.ts`.
2. **A `fix(core-loop)` PR:** `drawHighway` colors each note, and each lit key, by the hand of its note through
   `handColor`, in place of `settings.noteColor` and `keyLitColor`. A one-hand chart looks the same as today.
3. **A `fix(juice-visual)` PR:** flares and wisps take their hit note's hand color. juice-visual looks the note up by
   `noteId` in the chart it sees in `transformChart`.

## Requirements
- **The colors:** pick them with `specs/context/visual-direction.md` once that file exists; keep the current note
  color for the right hand until then. Check that the pair stays distinguishable under protanopia, deuteranopia and
  tritanopia (DevTools > Rendering > Emulate vision deficiencies), and keep one screenshot per mode in the PR.
- **Lit keys:** a key lights in the hand color of the note it hit. A key pressed with no note lights as today.
- **The legend:** "L" and "R" swatches, drawn on the plugin's layer during the count-in and fading out by beat 1. It
  shows only when the chart has both hands.
- **Misses:** `missColor` is unchanged, whatever the hand.
- **Nothing else changes:** judging, layout and the HUD stay as they are.

## Validation
- `pnpm -C web test`: `handColor` returns two different colors for "L" and "R". For a one-hand chart, every note
  gets today's color.
- `verify.py --slug hand-colors` passes, Twinkle's look unchanged.
- In Chrome: `/play?song=fur-elise` -> the two hands fall in two colors, and the legend shows during the count-in.
  Hit a left-hand note -> its key and burst take the left color. Keep the three vision-deficiency screenshots.
- On the piano (Eric; mark it in the done note): play Für Elise's opening and say whether you can tell the hands
  apart at a glance.

## Defaults
- If the two colors fight the stage's palette, the stage's `maxLaneLuma` rule wins: lanes stay readable.
