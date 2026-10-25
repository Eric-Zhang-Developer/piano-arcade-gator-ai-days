## What shipped
Level forge phase 1 (spike): `game-tools/forge/forge` (download, convert, check, save, diff) turns a public-domain source into a checked local level, and five forges from a worker's session answer the spike's question: yes, 5 of 5 in 19–25 s each, re-forges at 96.4% and 100%. Recommendation: phase 2 on Eric's go.
## Where it lives
`game-tools/forge/` (`forge`, `forge.py`), `web/src/app/api/forge/check.test.ts` (the library's rules, via `web/src/game/songs/rules.ts`), `spikes/level-forge/FINDINGS.md`
## How to check it
`game-tools/forge/forge --self-test` -> `self-test: ok` (every refusal, no network); the five forges' commands and numbers are in FINDINGS.md. `verify.py --slug level-forge` pass at e1482bf (the app's main check and the MIDI path on /sim: the forge changes nothing it plays).
## Gaps
Not done: phase 2 (the app route, the API key, dollars per level), waiting for Eric. The re-forges weren't blind (the session had read the converter README). IMSLP untried; levels are the first N bars as notated; nobody played the five from song select (they're local, gitignored, on this machine only).
