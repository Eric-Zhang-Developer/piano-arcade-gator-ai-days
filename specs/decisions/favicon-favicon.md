# favicon: the É mark and how its files were made

**Context.** #1386 asked for an SVG favicon; Eric picked direction A (the É, its accent a blue note pill) in Saira.
**Glyph.** No font-outline tool is installed (no fontTools, no opentype.js; the local Saira is WOFF2 only), so the E is
hand-drawn as Saira's squared heavy E on a 32-unit grid, every edge on an even unit so 16 px lands on whole pixels.
The accent is a `--pa-primary` pill, set right of centre like an acute.
**Files.** `web/src/app/icon.svg` is the source. `apple-icon.png` (180) and `favicon.ico` (16/32/48, PNG-in-ICO) were
rendered from it with the sharp Next already ships (pnpm store) and Python's `struct`; no new dependency.
**Why keep favicon.ico.** Next emits both `<link rel=icon>` tags; browsers that take SVG use icon.svg, old ones the .ico,
so both now show the same mark instead of the default.
**Undo.** Revert the PR; the old favicon.ico comes back.
