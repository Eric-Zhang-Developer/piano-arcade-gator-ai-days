## What shipped
`/play?song=<id>&bot=take&take=<file>.mid` replays a downloaded take from `web/public/takes/`: judged like the live take, sounding on the piano at its velocities, the same every run. Take files carry a "bar 1" marker; a bad name, another song's take, another tempo or a broken file shows a toast and plays normally. A replay is a bot take, so it never writes a record.
## Where it lives
`web/src/game/take-midi/` (marker, `readTakeMidi`), `web/src/game/scenes/index.ts` (`bot=take`), `web/src/game/hero-replay/verify-hero.mjs`, `web/public/takes/`
## How to check it
`node web/src/game/hero-replay/verify-hero.mjs --out <dir>` -> `verify-hero: pass` (two replays equal the live rank-c take: 30 PERFECT, 4 GREAT, 8 MISS, every judgment, 34 note-ons for 34 presses). `verify.py --slug hero-replay` pass at a0818e2 (42/42 PERFECT, test input and the MIDI path on /sim); `replay-view/verify-replay.mjs` still passes.
## Gaps
Not verified on the piano: Eric's Für Elise take, replayed twice on the DGX with `capture=1` (results equal, no hung note), is his to run. The take is fetched at Start, so a slow fetch could delay the count-in's first notes (local fetches are fast). No take file is committed yet: one goes in when Eric hands it over.
