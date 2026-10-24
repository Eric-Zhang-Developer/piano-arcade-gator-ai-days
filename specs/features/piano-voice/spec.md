---
name: "Piano voice: a chart names its GM voice and the DGX switches to it"
depends_on: []
owns: ["web/src/game/piano-voice/"]
assignee: "eric"
---

# Piano voice

A chart can name a General MIDI voice in `Chart.voice` (Maple Leaf Rag on honky-tonk piano, say). The game sets the
DGX to that voice when a take starts and puts it back when the take ends. Only a real piano can do this.

It's one plugin in `layers.ts`, and core doesn't change.

## Plan
1. **First:** the overnight `contract:` batch (#143) must be on `main`. If `Chart` in `web/src/contracts/index.ts`
   has no `voice`, this feature is blocked: take the next ready feature.
2. Build the plugin in `web/src/game/piano-voice/`.
3. Setting `voice` on a real chart is that chart's owner's change: a `fix(song-pack-2)` gives `maple-leaf-rag` voice
   4, Honky-tonk Piano in the General MIDI Level 1 sound set table published by the MIDI Association. Cite the table
   in that PR.

## Requirements
- **On `songStart`**, if the chart has a `voice`, send Program Change `[0xC0, voice - 1]` on channel 1 to the piano.
  Find the output by `name` "Portable Grand", as beat-track does. No piano means no message and no error.
- **On `songEnd`, `quit`, `pagehide` and unmount,** send Program Change `[0xC0, restoreVoice - 1]`.
  `pianoVoiceSettings.restoreVoice` defaults to 1, Acoustic Grand Piano. MIDI can't read the DGX's current voice, so
  the game restores a fixed one.
- **`?voice=<1–128>`** overrides the chart's voice for testing. `?voice=off` sends nothing.
- **Channels:** beat-track's drums on channel 10 are untouched. piano-out's replay on channel 1 plays in the
  chart's voice until the take ends, so restoring waits until the replay stops, if one is playing.
- **Unknown:** whether the DGX-660 answers a GM Program Change over USB, and which of its voices it picks. Eric
  checks this on the piano. If the DGX ignores it, the done note says so and a `needs-human` issue asks whether the
  DGX needs a Bank Select (CC 0 and 32) first.

## Validation
- `pnpm -C web test`: a chart with `voice: 4` gives `[0xC0, 3]` on `songStart` and `[0xC0, 0]` on `songEnd` and
  `quit`. A chart without `voice` gives no messages. `?voice=off` gives none. `?voice=19` overrides the chart.
- `verify.py --slug piano-voice` passes.
- In Chrome on `/sim`: `/play?song=twinkle&voice=4&midi=sim` -> the sim's log shows the Program Change before the
  first note and the restore after the results.
- On the piano (Eric; mark it in the done note): `/play?song=twinkle&voice=4`. The DGX sounds honky-tonk during the
  take and goes back to grand piano after. Write what the DGX did.

## Defaults
- If the DGX needs a Bank Select, add CC 0 = 0 and CC 32 = 0 before the Program Change, and log it in
  `specs/decisions/piano-voice-*.md`.
