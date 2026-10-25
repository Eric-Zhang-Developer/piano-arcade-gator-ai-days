## What shipped
The music select's preview has Hands (Both / Right / Left, two-hand charts only) and Speed (50 / 70 / 100%): H cycles Hands, ← → step Speed, both are aria-pressed button groups. They're remembered per song in `localStorage["pianoArcade.songOptions"]`, read `practice · not recorded` when not default, and ride every way into /play: card hrefs, Enter, L, LEARN and PRACTICE (which keeps its 70%). `tempo` alone now plays the whole song once at that speed (#547). Steps: #547, #548, #588, #589, this PR.
## Where it lives
`web/src/game/song-options/`, `web/src/game/bar-loop/index.ts`, `web/src/game/select-layout/`, `web/src/game/song-preview/index.tsx`, `specs/decisions/song-options-layout.md`
## How to check it
verify: `pnpm -C web verify --out {out} && node web/src/game/sim/verify-sim.mjs --out {out}/sim` pass at 8d02fa8; `verify-options: pass` (all 5 steps; every song fits at 1280×720 and 1920×1080).
## Gaps
Not tried by a person: Eric sets Für Elise to Right at 70% with the keyboard alone and plays it on the piano. The jacket shrank 38vh → 30vh to fit (decision log); no before/after screenshot pair in a PR and no reduced-motion look (nothing here animates). Eric decides whether PRACTICE 70% stays now that Speed 70% exists. W (watch-demo) isn't reachable yet, so its "Normal, both hands, 100%" default is untested.
