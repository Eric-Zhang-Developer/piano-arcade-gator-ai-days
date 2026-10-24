## What shipped
`?capture=1` (kept per tab; `?capture=0` turns it off) hides the cursor and setup text while the video is recorded: /play's MIDI status, laptop-keys hint, latency slider, effects controls and latency suggestion; `/`'s Calibrate link and the preview's status line; beat-track's "Beat:" text (the beat still plays). Without the flag nothing changes. Recording guide: `specs/features/capture-mode/recording.md`.
## Where it lives
`web/src/game/capture-mode/` (#285); attributes in `web/src/app/play/page.tsx` and the mount in `layout.tsx` (#290), `web/src/app/page.tsx` (#292), `web/src/game/beat/` (#293), `web/src/game/song-preview/` (#295).
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at b04546d, and `node web/src/game/capture-mode/verify-capture.mjs --out <dir>` (production build, 1920×1080, video on) prints `verify-capture: pass`: no cursor or setup text on the select, start and results, and every word present without the flag. Then record by [recording.md](../specs/features/capture-mode/recording.md).
## Gaps
Not recorded by Eric yet (record a take by `recording.md` with your own recorder: any cursor or debug text?). The flag applies after hydration, so a page's first frames can show both. The guide's macOS menus and shortcuts were written from Chrome and macOS as documented, not clicked through here.
