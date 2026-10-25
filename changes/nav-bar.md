## What shipped
A thin bar centered in the top band: Play, Learn, Lab, Progress, a dev-only Status (`/operator`); GitHub is a small
mark in the bottom-right corner (new tab). One top band (decision nav-bar-top-band): on `/` the wordmark shares the
links' baseline, and the build stamp, Controls and Lights sit in its right end with set gaps.
A slot shows once its feature's done note is on main; the current page is primary blue with `aria-current`. It's off
`/play`, `/cabinet`, `/attract`, `/operator` and capture mode. The root-layout mount is #741 (fix(core-loop)).

## Where it lives
`web/src/game/nav-bar/` (slots, done, NavLinks, CSS, test, `verify-nav.mjs`); decisions `specs/decisions/nav-bar-*`.

## How to check it
`node web/src/game/nav-bar/verify-nav.mjs --out <dir>`: not verified locally; covered by main's scheduled full run.
Vitest `src/game/nav-bar` passes (7). Design rounds were looked at live on a dev server at 1280×720 and 1920×1080.

## Gaps
The top-band pass (#PR) is not verified locally; covered by CI. One look at 1280×720 on `/` only.
Login stays bottom-right (sharan's AccountChip, decision nav-bar-login). Eric's look on `/` (Validation 3) is pending.
