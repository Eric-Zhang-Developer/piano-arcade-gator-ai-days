## What shipped
Eight Lab fixes from the Oct 25 bug review: /wrong-note leaves Space and Enter on links and buttons (#1323); hand-palette restores today's colours on any exit from /play and re-applies on a Retry (#1324, #1325); screen-shake follows a second /play's canvases (#1326); /paint's pedal survives framing and Space leaves buttons alone (#1327, #1328); /musicbox shows an alert line when the demo chart fails, with its buttons dimmed (#1329); the Build Sonata keeps each hand to four voices, so /sheet prints it (#1330).
## Where it lives
`web/src/game/wrong-note/index.ts`, `web/src/app/wrong-note/page.tsx`, `web/src/game/x/{hand-palette,screen-shake,wet-paint,pinned,build-sonata}/`, `web/public/songs/x/build-sonata/chart.json`, `web/src/game/sheet-xml/sheet-xml.test.ts`, `specs/decisions/lab-state-keys-choices.md`, shots in `specs/features/lab-state-keys/shots/`.
## How to check it
`pnpm -C web exec vitest run src/game/x src/game/sheet-xml src/game/wrong-note`: each issue has a test; #1324–#1326 and #1330 seen failing on main first, #1329 and #1330 in the before shots. Browser checks: not verified locally; covered by main's scheduled full run. Not seen by Eric.
## Gaps
/paint's Again-takes-the-pedal wiring and the Space keyup path are tested at the painter and `spaceIsPedal` level, not through the page (no DOM in vitest, no verify-paint check). Before shots are at 1280 only; the bugs don't depend on size.
