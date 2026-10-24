---
name: "Hand mode: play one hand while the DGX plays the other"
depends_on: []
owns: ["web/src/game/hand-mode/"]
assignee: "eric"
---

# Hand mode

This is Synthesia's best learning feature, on a real piano: pick Right, Left or Both. The game judges only the hand
you play, and the piano plays the other hand in time through MIDI out. The playtest asked for "the rest of the band"
(`specs/context/findings.md`), and the song packs' charts now have two hands.

It's one plugin in `layers.ts`, and core doesn't change.

## Requirements
- `?hands=R`, `?hands=L` or `?hands=both` (the default). In `transformChart`, the plugin removes the skipped hand's
  notes from the chart that gets drawn and judged, and keeps them for playback. A chart with only one hand ignores
  the setting.
- **Playback:** each skipped note goes to the piano at its chart time, with its `velocity` when the chart has one
  and 80 when it doesn't. Note on and off go on channel 1, scheduled on the MIDI clock from `songStart`, the way
  piano-sim's bot times itself. Find the output by `name` "Portable Grand", as beat-track and piano-out do.
- **Without a piano:** a Web Audio tone plays the skipped hand instead, quieter than the beat.
- **Echo guard:** if the piano echoes a sent note back on its MIDI input, the plugin's `wrapInput` drops a note-on
  with the same pitch within 30 ms of one it sent, so the echo is never judged as an extra.
- **Ending:** on `songEnd`, `quit` or `pagehide`, the plugin sends All Notes Off on channel 1 and cancels anything
  queued, so no note hangs.
- **The picker:** Right, Left and Both on `/play`'s start screen, as a `startPanel` once play-slots is on `main`.
  Each choice reloads `/play` with `hands=` set. Until play-slots lands, the URL alone works.
- **Results:** score only the played hand. That follows on its own, because the skipped notes aren't in the judged
  chart.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: `?hands=R` on a two-hand chart keeps exactly the R notes, and the playback list holds exactly
  the L notes at their chart times and velocities. The echo guard drops a same-pitch note-on at +20 ms but not at
  +40 ms. A one-hand chart is unchanged. Ending sends All Notes Off.
- `verify.py --slug hand-mode` passes. With `?hands=R&input=test` on a two-hand chart, the Perfect player gets all
  PERFECT on the R notes.
- In Chrome, on `/sim` with the fake piano: `/play?song=fur-elise&hands=R&midi=sim` -> the sim's log shows the left
  hand's notes arriving on time, and the highway shows only right-hand notes.
- On the piano (Eric; mark it in the done note): play Für Elise's right hand with `?hands=R`. The DGX plays the
  left hand in time, nothing hangs after the song, and no echo shows up as an extra.

## Defaults
- Don't draw the skipped hand. With fewer pitches the highway's lanes get wider, which helps.
