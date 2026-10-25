## What shipped
/sheet's score sits on the Duo paper panel (#f2ede3), in ink (#16130f, staff and ledger lines too), never inverted, with a primary cursor; the title, legend and zoom stay dark (#725). Judged noteheads and the legend use darker HUD hues at 3.5:1 on the paper (#730). The paper stands 1.5rem clear of the header.
## Where it lives
`web/src/game/sheet-view/` (SheetView.tsx, paper-colors.ts, sheet-view.module.css), `web/src/game/sheet-paper/verify-paper.mjs`, `specs/decisions/sheet-paper-colors.md`, shots in `specs/features/sheet-paper/shots/`.
## How to check it
Validation 1, `verify.py --cmd ".../verify-paper.mjs"`, printed `verify-paper: pass` at 1280×720 and 1920×1080 on #725 plus #730, before the 1.5rem spacing change (CSS only); not re-run since (load rule), covered by main's scheduled full run. The look loop (in-app browser, both sizes) went from 5.7 on main to 7.4.
## Gaps
Validation 2, Eric reading a page of Für Elise on paper: not done (not seen by Eric). Resizing the window in review mode drops the judgment colors until a reload; that's on main too and left for sheet-engraving (#827). Note size, beams and clefs are #827's.
