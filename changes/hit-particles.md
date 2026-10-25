## What shipped
Every hit throws a white-violet bloom at the contact point (held while the note is held), violet glitter clouds that rise off the key and linger 2–3 s, and a few white sickle wisps. A fixed 16k GPU pool sits under a 6,000/s spawn cap and a governor that never freezes; reduced motion gets a quarter. The layer draws over the notes and under the HUD, with or without the stage; without WebGL, juice keeps its 2D particles.
## Where it lives
`web/src/game/hit-particles/` (pool.ts, gl.ts), the hookup in `web/src/game/juice/index.ts`, `specs/decisions/hit-particles-*.md`, shots in `specs/features/hit-particles/shots/`.
## How to check it
`pnpm -C web exec vitest run --passWithNoTests src/game/hit-particles src/game/juice src/game/stage` (34 pass). perf.mjs at 1920×1080: p95 1.7–2.5 ms after, 2.1–2.8 ms before on main 5f59a10, run locally under verify.lock. Seen in the in-app browser on /play?song=maple-leaf-rag&bot=fever. Not seen by Eric.
## Gaps
No verify.py run (no verify script; the look loop and perf run are the live checks). The look loop ended at 7.2, under 7.5: the clouds are lighter than the reference's. GPU time isn't measured; perf.mjs counts main-thread work only.
