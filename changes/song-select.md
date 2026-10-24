## What shipped
`/` is the song list: every `chart.json` under `web/public/songs/` (any depth), read at build time, easiest first (#182). Since #198 it renders select-layout's `MusicSelect` (cards with jackets and levels) instead of plain rows. Click, or ↑/↓ and Enter, opens `/play?song=<id>`. Invalid charts are skipped and named in the build log.

## Where it lives
`web/src/app/page.tsx`, `web/src/game/song-select/load.ts` (+ `load.test.ts`) (the view is `web/src/game/select-layout/`)

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/song-select/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/song-select/20261024T065443Z && node /Users/ericzhang/.worktrees/gator-ai-days-2026/song-select/web/src/game/sim/verify-sim.mjs --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/song-select/20261024T065443Z/sim` pass at 1cb70c0

## Gaps
- verify doesn't open `/` yet: `web/e2e/` is core-loop's, so that step comes in a follow-up `test(core-loop)` PR. Checked by hand instead (headless Chromium on `next start`): Twinkle row focused on load, Enter → `/play?song=twinkle`, Twinkle title shown.
- Only one chart exists, so "pick each row in turn" was checked with one row; the loader test covers several charts and nested folders.
- Not tried on the piano or by a person.
