# Round: voices, colors, the echo guard, the lookahead

Feature: `round` (#1123). The spec leaves these to the worker; each is a value in `roundSettings` or `voiceColors`
(`web/src/game/x/round/`), so undoing one is a one-line change.

## Programs
- **Context:** voices 2–4 each get a General MIDI program on channels 2, 3 and 4.
- **Choice:** 49 String Ensemble 1, 74 Flute, 53 Choir Aahs (1-based), in that order. Each is far from piano and
  from the others, so a listener can follow three entries.
- **Not checked:** how the DGX-660 voices them, and whether it plays channels 2–4 at all. That's Validation (d),
  Eric at the piano. If it can't, the spec's fallback is the piano voice an octave apart per voice.
- **Undo:** change `roundSettings.programs`.

## Colors
- **Choice:** voice 2 gold `#ffe27a`, voice 3 ink `#e2e6f0`, voice 4 secondary `#a07cff`, all from `ui-tokens`, as
  2 px outlines only. Voice 1 keeps the chart's own blue fill. No hype pink: the Duo look keeps that for hype moments.
- **Why outlines:** a filled echo would read as a note to play. Outlines say "not yours", and still show the lane
  and the length.
- **Undo:** change `voiceColors`.

## The echo guard ships off
- **Context:** the spec cited #429 for "the DGX echoes received MIDI back out". #429 is a headless CI check. The
  piano-midi spike (`spikes/piano-midi/RESULTS.md` R7) measured no echo at the DGX's default settings.
- **Measured cost:** on `/sim`, and again on laptop sound, the perfect bot lost 6 of 32 presses to the guard, at
  5 ms and then with a velocity match too. A round puts one pitch in two voices at the same moment, and the bot and
  laptop keys play one velocity, so a unison press and its echo look the same.
- **Options:** (A) guard on at 5 ms, 6 of 32 lost; (B) guard on with a velocity match, still 6 of 32 on the bot and
  laptop keys; (C) guard off, the exact channel 2–16 filter on.
- **Choice:** C. `echoWindowMs: 0`. The channel filter matches pitch and timestamp on channels 2–16, so it can't
  take a channel-1 press. With C the bot plays 32 of 32 (rank S).
- **Undo:** set `echoWindowMs: 5` if Eric's run shows a channel-1 echo. The velocity match stays in the guard.

## Lookahead
- **Choice:** 300 ms, as beat-track. Echoes go out window by window through `MIDIOutput.send`'s timestamp. A Stop,
  pause or quit clears the port and sends pedal-up and All Notes Off on channels 1–4.
- **Measured** (`/sim`, Frère Jacques, bot): 156 echoes, |error| against press + k × interval median 0 ms, max 0 ms.
  Each was handed to `send` 257–300 ms ahead of its time, 0 late.
- **Ceiling:** a background tab throttles timers to about 1 per second, more than the lookahead. While the game is
  on screen this doesn't apply.
