---
name: "Beat track: a drum beat on the piano under every song, so players can hear the time"
depends_on: ["core-loop"]
owns: ["web/src/game/beat/"]
assignee: "eric"
---

# Beat track

The first playtest (`specs/context/findings.md`, 2026-10-24) scored 10%, 15% and 40% on one-hand Twinkle. The players
played the right notes but 100–200 ms off, with their eyes fixed on the judgment line. The game had no clock they
could hear: the piano is the only music, and they were playing it. Rhythm games work because the music is an
outside clock you hear, so your eyes can read ahead. This feature adds that clock: a drum beat played by the piano
itself, from the count-in to the last note. It stands in for a backing band; a richer pattern can replace it later
on the same scheduler (decision `beat-track-accompaniment.md`).

Read first: `spikes/piano-midi/RESULTS.md` R4, R5 and R7 (sending to the piano works, timing is exact with
`send(data, timestamp)`, the piano doesn't echo what it's sent back as input).

## Requirements
- One `GamePlugin` in `web/src/game/beat/`, registered with one line in `web/src/game/layers.ts`. No change to
  `web/src/contracts/` or `web/src/game/core/`.
- **Clock:** on `songStart`, the plugin maps the chart clock to `performance.now()` (the event arrives
  synchronously, so `zero = performance.now() - atMs`). Every beat is scheduled ahead on that clock, never with
  timers: a lookahead scheduler queues beats due in the next 300 ms on each `draw` call, so stopping never leaves
  more than 300 ms of beats queued.
- **Pattern** (General MIDI drums, channel 10): during the count-in, a side stick (37) on every beat; from beat 0, a
  kick (36) on beat 1 of each bar and a closed hi-hat (42) on every beat. It runs until the end of the bar after the
  last note ends, then stops.
- **Output:** the MIDI output whose name contains "Portable Grand". Only that port: never another port such as the
  IAC bus (the playtest's input silently picked the IAC bus). Each drum hit is a note-on, then a note-off 50 ms
  later, both sent with `MIDIOutput.send(data, timestamp)`.
- **Laptop fallback:** with no Portable Grand output, the same pattern plays as short synthesized clicks through Web
  Audio, scheduled on the audio clock (higher pitch for the accented beat 1, lower for the others).
- **Stopping:** on `songEnd`, and when a new `songStart` arrives (Retry), scheduling stops; on the piano, send All
  Notes Off (CC 123) on channel 10.
- **Off switch:** `?beat=off` turns it off. The layer shows where the beat plays ("Beat: piano", "Beat: laptop" or
  "Beat: off") in a corner, small.
- Tuning numbers are named settings in the plugin (velocities, click volume, lookahead), per decision 000 D1.

## Validation
- `pnpm -C web test`: a pure function lists the beat's drum hits for a chart and a time range, as `(atMs, note,
  velocity)`. For Twinkle (100 BPM, 4/4, 48 beats, the core-loop count-in) it must return exactly: a side stick at
  each count-in beat, a hi-hat at every beat 0–51, a kick at beats 0, 4, …, 48, and nothing at or after beat 52.
  Asking for a time window returns only the hits inside it, so the scheduler never sends a beat twice.
- `[verify].command` still passes (headless Chrome has no MIDI, so it takes the laptop fallback and must not error).
- On the piano (Eric, plus one more player; mark it in the done note): play Twinkle with the beat, mostly watching
  the piano rather than the screen. Record both scores in `specs/context/findings.md` next to the 10/15/40% baseline.
  Also note whether the beat sounds in time with the falling notes.

## Out of scope
A bass line or band (needs a sourced accompaniment part per song), tap-along latency calibration, a GOOD judgment
tier, FAST/SLOW labels, a wait mode, note names on notes. Each waits for this feature's playtest (findings.md lists
them as candidates).

## Defaults
- The smaller option; the beat is a reference, not music, so keep it quiet under the melody.
- If Chrome refuses MIDI output, fall back to the laptop click and say so in the layer.
