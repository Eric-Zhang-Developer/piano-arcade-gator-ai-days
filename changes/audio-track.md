## What shipped
A local song's own recording plays under `/play`, in sync with the chart clock, with the player's piano on top. Each song reads a sidecar `songs/local/<id>/audio.json` (`{ "src", "offsetMs" }`); with no sidecar, nothing changes.
- Pause, resume, quit and leaving `/play` stop and restart it on the chart's time. A bar loop replays the window's stretch of the recording on each pass.
- `tempo` other than 100, wait mode, flow mode and `?audio=off` play no recording.
- A "Recording volume" row in Options sets its level, shown only where a local song has a recording.
- Parts: #680, #732, #737.

## Where it lives
`web/src/game/audio-track/` (`index.ts`, `audio-track.test.ts`, `verify-audio.mjs`) · one line in `web/src/game/layers.ts` · the row in `web/src/game/options-panel/` and the flag in `web/src/app/page.tsx` · `specs/decisions/audio-track-fixture.md`

## How to check it
`node web/src/game/audio-track/verify-audio.mjs --out <dir>`: not verified locally; covered by main's scheduled full run. Before the load rule, verify.py printed `pass at dc2bd33`: worst drift 0.1 ms over 20 s and 0.1 ms after a resume (tolerance 20 ms); silent while paused and at Quit.

## Gaps
- **Validation 3, Golden on Eric's machine:** not played by Eric yet. Whether it feels locked is his call.
- **The MP3's 23 ms of encoder padding** is unmeasured in Chrome. If it isn't trimmed, Golden plays 23 ms late (`offsetMs` 3957 fixes it).
- **The volume is read at each take's start;** the row lives on `/`, so nothing changes it mid-take.
