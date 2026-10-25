## What shipped
Every key-only action on `/` and `/play` has a control: LEARN and WATCH beside PLAY and PRACTICE (a 2×2), Easy and Normal as two chips, and on `/play` a Pause button plus ◀ ▶ a bar in learn mode, in the HUD's top-right gutter. The `<kbd>` badges and hint lines are off `/` and `/simon`; every key is still bound and named in its control's `title` and `aria-keyshortcuts`. The `?` card lists them all behind a quiet "? Controls" link on both pages, has a Simon section, and a test fails when a card line's control is missing from its screen.
## Where it lives
`web/src/game/help-overlay/` (HelpLink, keys.ts's `control`/`keyOnly`, the test), `duo-select/Select.tsx` and `select.module.css`, `select-layout/index.tsx`, `easy-charts/level.tsx`, `app/play/page.tsx`, `app/simon/page.tsx`, the badge removals in `song-options`, `options-panel`, `first-run`, `song-preview`; `specs/decisions/mouse-first-placement.md`; shots in `specs/features/mouse-first/`.
## How to check it
vitest over the touched features: 14 files, 102 tests pass. verify-select, verify-learn, verify-easy (they click LEARN, WATCH and both chips), verify-preview, verify-capture and verify-simon: not verified locally; covered by main's scheduled full run. Pause, ▶ and the card were clicked by hand in the dev server at 1280×720.
## Gaps
- **Validation 4 open:** Eric hasn't looked at it yet.
- No browser check clicks Pause or ◀ ▶ yet; they call the same functions as Esc and ← →.
- `/play`'s start-screen and pause-menu key lines stay, as the spec scopes them to duo-start.
