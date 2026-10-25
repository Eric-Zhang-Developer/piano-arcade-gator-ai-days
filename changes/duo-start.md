## What shipped
`/play`'s start screen in the Duo look, in one bracketed two-column panel that fits 1280×720 and 1920×1080 without scrolling:
- **Left:** the stage card, with ARE YOU READY, the song's piano roll, the title and composer, and LV / NOTES cells.
- **Right:** a large Start (the only primary, focused on load), the four play modes, the hands, and Options.
- **Settings are behind Options** (Eric's feedback on #763): latency, effects and piano volume, Mute, Miss sound, labels, Connect lights and the MIDI status, in the select's own drawer.
- **No key hints on the screen** (#772): the laptop keys line, Z / X and ← → are on the `?` card.
## Where it lives
- `web/src/game/duo-start/`: `StartScreen.tsx`, `start.module.css`, `start.test.tsx`.
- The stage card is in `web/src/game/stage-card/`, the drawer's /play props in `web/src/game/options-panel/`, and the mount in `web/src/app/play/page.tsx`.
- The choice is recorded in `specs/decisions/duo-start-settings.md`. Shots are in `specs/features/duo-start/shots/`.
## How to check it
Not verified locally (no-local-checks rule): the start-screen browser checks run in main's scheduled full suite. This PR updates verify-options, verify-reset, verify-labels, verify-leds, verify-ui-sounds, verify-rewind and verify-capture for the drawer and the dropped hints. Validation 1 (vitest duo-start plus the touched features) passes. In the dev server: Start begins the count-in, and a latency or label set in the drawer is used by the take.
## Gaps
- Validation 4, Eric's look: done. He approved #763 to merge on 2026-10-25 ("Looks good").
- The updated browser checks haven't run yet; CI's browser job is their first run.
- The rewind and laptop-octaves specs still describe start-screen hints that no longer show.
