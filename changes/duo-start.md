## What shipped
`/play`'s start screen in the Duo look, in one bracketed two-column panel that fits 1280×720 and 1920×1080 without scrolling:
- **Left:** the stage card, with ARE YOU READY, the song's piano roll, the title and composer, and LV / NOTES cells.
- **Right:** Start (the only primary button, focused on load), the four play modes as secondary buttons, and one quiet Settings panel. Settings holds hands, labels, lights, latency, effects, Mute, Miss sound, the MIDI status and the key hints.
- Every control is still its own plugin's code, with the same handler, test id and keys. The kit gains `kitButton` and `kitChip`.
## Where it lives
- `web/src/game/duo-start/`: `StartScreen.tsx`, `start.module.css`, `start.test.tsx`.
- The restyled stage card is in `web/src/game/stage-card/`. The mount is in `web/src/app/play/page.tsx`.
- Shots are in `specs/features/duo-start/shots/`.
## How to check it
Not verified locally (no-local-checks rule): the start-screen browser checks are covered by main's scheduled full run. Validation 1 (vitest duo-start plus the touched features) passes, 13 files and 91 tests. In the dev server, Enter on the focused Start begins the count-in.
## Gaps
- **Validation 4, Eric's look, not done yet.** The taste v2 look loop scored 7.3 (uncapped) in round 3.
- At 1280, "Connect lights" wraps to a second chip row, and the left column ends about 30 px above the settings panel.
