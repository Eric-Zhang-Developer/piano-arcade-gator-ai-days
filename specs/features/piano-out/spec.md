---
name: Piano out: replay your take on the piano, and a piano count-in
depends_on: ["core-loop"]
owns: ["web/src/game/piano-out/"]
assignee: "eric"
---

# Piano out

Make the real piano play back to you. The spike proved sending works (R4–R6 in `spikes/piano-midi/RESULTS.md`).
Register as one `GamePlugin` in `web/src/game/layers.ts`.

## Requirements
- **Replay:** a "Replay on piano" button on the results screen plays the last `Take` through the piano's MIDI
  output, with its real timing and velocities, scheduled with `MIDIOutput.send(data, timestamp)`.
- **Local Control:** before a replay, send CC 122 = 0 so the piano's own keys go silent; after it ends or stops,
  send CC 122 = 127.
- **Stop:** a Stop button ends a replay at once and sends All Notes Off (CC 123) on all 16 channels.
- **Count-in from the piano:** covered by `beat-track`, which plays the count-in and the beat on the piano
  (decision `beat-track-accompaniment.md`). Not built here.
- With no MIDI output (laptop keys), the replay button is hidden; nothing errors.

## Validation
- Vitest: a pure function turns a `Take` into a list of `(bytes, timestamp)` messages, including the Local Control
  and All Notes Off messages, exactly.
- On the piano (Eric): the replay sounds like the take, the keys are silent during it, and Stop leaves no stuck notes.

## Defaults
- Never leave Local Control off: restore it on stop, on song end, and when the page unloads.
