## What shipped
The video's shot list (`shot-list.md`: 14 rows, each with its URL and what still shows), a trailer brief for the cards, capture mode's flag and rules set in `<head>` before the first paint, and `/shots?card=title|end`: the title card (Étude and the tagline) and the end card (the repo URL; the live URL too once `NEXT_PUBLIC_LIVE_URL` is set), still from 1.5 s.
## Where it lives
`specs/features/video-shots/` (shot list, shots), `specs/decisions/video-shots-brief.md`, `web/src/game/video-shots/`, `web/src/app/shots/page.tsx`, `web/src/game/capture-mode/index.tsx`, `web/src/app/layout.tsx`.
## How to check it
vitest `src/game/video-shots src/game/capture-mode`: 8 passed. `verify-shots.mjs`: not verified locally; covered by main's scheduled full run. Not yet recorded by Eric (Validation 5).
## Gaps
L2 (the laptop letters and Z/X chips drawn on canvas in bot takes) still shows under capture: `laptop-octaves/index.tsx` is in open PR #780, so it waits for that. Rows 8 (a red slip) and 11 (Var. XII's chart) have no footage yet; both are on #852 for the planner. Row 6 needs a human take. Reduced motion was checked by stopping the animations in the in-app browser, not with the OS setting; verify-shots checks the real setting. A live URL longer than the repo's would need a smaller size; none is set yet.
