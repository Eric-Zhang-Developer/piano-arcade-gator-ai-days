## What shipped
A thin bar centered in the top band: Play, Learn, Lab, Progress, a dev-only Status (`/operator`) and GitHub ↗ (new tab).
A slot shows once its feature's done note is on main; the current page is primary blue with `aria-current`. It's off
`/play`, `/cabinet`, `/attract`, `/operator` and capture mode. The root-layout mount is #741 (fix(core-loop)).

## Where it lives
`web/src/game/nav-bar/` (slots, done, NavLinks, CSS, test, `verify-nav.mjs`); decisions `specs/decisions/nav-bar-*`.

## How to check it
`node web/src/game/nav-bar/verify-nav.mjs --out <dir>`: not verified locally; covered by main's scheduled full run.
Vitest `src/game/nav-bar` passes (7). Design rounds were looked at live on a dev server at 1280×720 and 1920×1080.

## Gaps
Login stays bottom-right (sharan's AccountChip, decision nav-bar-login). Eric's look on `/` (Validation 3) is pending.
