## What shipped
/play's start screen reads on video: the LEARN → FLOW → PERFORM ladder, the mode buttons, the mode's caption, and Songs and Options are 16 px at 1280×720 and 24 px at 1920×1080 (#1239). The notice toast's ring is the kit's hairline instead of the retired cyan (#1240).
## Where it lives
`web/src/game/play-modes/ladder.module.css`, `web/src/game/duo-start/start.module.css`, `web/src/game/notice-toast/index.ts` (its test), `specs/decisions/play-polish-start-type.md`.
## How to check it
`pnpm -C web exec vitest run src/game/duo-start src/game/play-modes src/game/notice-toast` (25 pass). verify-toast: not verified locally; covered by main's scheduled full run.
## Gaps
The hand picker's chips stay at 12 px: at 16 px they don't fit the bar row at 1280, so they need a layout decision of their own (in the decision note).
