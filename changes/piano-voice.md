## What shipped
A chart can name a General MIDI voice (`Chart.voice`, 1–128). At `songStart` the game sends Program Change `[0xC0, voice − 1]` on channel 1 to "Portable Grand". On `songEnd`, `quit` and `pagehide` it sends `[0xC0, 0]`, Acoustic Grand (`pianoVoiceSettings.restoreVoice`), because MIDI can't read the piano's current voice. A "Replay on piano" of the take plays in the chart's voice, and the restore waits until it stops. `?voice=<1–128>` overrides the chart and `?voice=off` sends nothing. No piano means no message and no error. Beat-track's channel 10 is untouched.
## Where it lives
`web/src/game/piano-voice/` (`index.ts`, `piano-voice.test.ts`, `verify-voice.mjs`), one entry in `web/src/game/layers.ts` (after the sim and piano-out).
## How to check it
`verify.py --slug piano-voice` pass at 0de50a0: 42/42 PERFECT with test input and through the MIDI path on /sim. `node web/src/game/piano-voice/verify-voice.mjs --out <dir>` pass at 0de50a0: on `/play?song=twinkle&voice=4&midi=sim`, the fake piano got `[0xC0, 3]` at songStart, before beat-track's first kick, and `[0xC0, 0]` after the results. Without `?voice`, no Program Change.
## Gaps
- **Unknown until Eric tries it:** whether the DGX-660 answers a GM Program Change over USB, and which voice it picks (`/play?song=twinkle&voice=4`). If it ignores it, a `needs-human` issue should ask whether it needs Bank Select (CC 0 and 32) first.
- No chart names a voice yet. Maple Leaf Rag's `voice: 4` is song-pack-2's change (a `fix(song-pack-2)` PR, spec step 3).
- The spec's "unmount" restore: plugins have no unmount hook. `quit`, `songEnd` and `pagehide` cover leaving a take; a client-side navigation away mid-take without Quit isn't covered.
- The /sim page's log shows only the fake piano's input, so the check reads its output's sent list.
