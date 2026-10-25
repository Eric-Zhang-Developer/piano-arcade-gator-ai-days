## What shipped
The results' PRACTICE BARS / NEXT SONG is a real link in the kit's primary look (#1244). Watch replay opens a native modal dialog named by its caption: Stop has focus, the page behind is inert, and focus returns to Watch replay on close (#1245). The replay's caption and Stop are on the kit at 16 px at 1280 and 24 px at 1920, with Esc in Stop's title instead of the caption (#1246). NEW RECORD's initials and the saved line are announced by one polite live region (#1247).
## Where it lives
`web/src/game/duo-results/index.tsx`, `web/src/game/replay-view/overlay.tsx` (and `verify-replay.mjs`'s focus step), `web/src/game/record-moment/index.tsx` (`InitialsSaid`), `specs/decisions/results-polish-replay-dialog.md`.
## How to check it
`pnpm -C web exec vitest run src/game/duo-results src/game/replay-view src/game/record-moment` (30 pass). Browser checks (verify-results, verify-replay with its new focus step, verify-moment): not verified locally; covered by main's scheduled full run.
## Gaps
No reduced-motion shot of NEW RECORD. The in-app browser can't emulate it in CSS, and this change touches no motion: the live region is out of flow, and the stamp and cells keep their existing reduced-motion rules.
