## What shipped
/sheet opens at 100% and remembers only a zoom picked with − or +. The score snaps to a beat grid for display, so near-grid eighths beam (mountain-king: 0 → 40 beams). Moonlight's triplets print as triplets with a 3, and its melody prints as voice 1. Staves change clef where a hand climbs, and 8va/8vb replace the ledger stacks (maple-leaf-rag, mountain-king). Chart times, judging and the highway are untouched.
## Where it lives
`web/src/game/sheet-xml/index.ts` (DIVISIONS 12, `snapper`, `staffPlan`, tuplets), `web/src/game/sheet-beams/index.ts`, `web/src/game/sheet-view/SheetView.tsx` (zoom), `sheet-view.module.css` (title size), `specs/decisions/sheet-engraving-{quantize,tuplets,clefs}.md`
## How to check it
`pnpm -C web exec vitest run src/game/sheet-xml src/game/sheet-beams src/game/sheet-view` (142 pass). In the in-app browser, OSMD drew every beam sheet-beams asks for: maple-leaf-rag 470/470, moonlight-1 111/111, mountain-king 80/80, fur-elise 260/260. verify.py: not verified locally; covered by main's scheduled full run (verify-sheet, verify-beams).
## Gaps
Eric hasn't looked yet: /sheet?song=fur-elise and ?song=moonlight-1, readable? The clef and 8va thresholds come from the median-pitch rule, not from a published edition. Clefs change only at a barline. Charts off any grid (Flower Dance, Golden's) stay rough until #831.
