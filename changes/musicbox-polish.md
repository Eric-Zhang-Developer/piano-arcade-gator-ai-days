## What shipped
/musicbox's tab reads "Pinned · Étude"; every crank reuses one AudioContext, closed when you leave; the crank and
Macro buttons name the action they take (no `aria-pressed`) and keep one width, so the row never jumps; the rail's
mono labels are 12 px or more.
## Where it lives
`web/src/app/musicbox/layout.tsx`, `web/src/game/x/pinned/{Pinned.tsx,crank-audio.ts,pinned.module.css,polish.test.tsx}`
## How to check it
`pnpm -C web exec vitest run src/game/x/pinned` (13 pass). Browser: not verified locally; covered by main's scheduled full run.
## Gaps
At 1280 the macro camera still puts the gold drum behind the rail's stat labels while cranking (out of this spec).
