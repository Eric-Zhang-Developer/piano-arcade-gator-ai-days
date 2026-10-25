## What shipped
Three very hard songs from Mutopia notation MIDI: `chopin-ballade-coda` (Ballade No. 1's coda, bars 208–264, 168 BPM, 947 notes, D1–E7, level 15), `chopin-etude-10-5` (Black Key, bars 1–64, 96 BPM, 1220 notes, G♯1–E♭7, level 15) and `chopin-op10-1` (Op. 10 No. 1, bars 1–16, 120 BPM, 272 notes, D1–E7, level 10). Beside `chopin-revolutionary` 15, `moonlight-3` 15, `chopin-fantaisie-impromptu` 11; the WARNING card (13+) shows for the Ballade coda and the Black Key.
## Where it lives
`web/public/songs/{chopin-ballade-coda,chopin-etude-10-5,chopin-op10-1}/chart.json`; `specs/decisions/song-pack-10-sources.md`; a `CREDITS.md` line for the CC BY-SA Ballade.
## How to check it
`pnpm -C web exec vitest run src/game/songs src/game/difficulty src/game/song-jacket`: passes. `/play?song=<id>&input=test`: not verified locally; covered by CI.
## Gaps
- Tempo: Ballade "Presto con fuoco", no number, MIDI 210 → 168 (80%); Black Key "Vivace ♩=116", MIDI 116 → 96 (83%); Op. 10 No. 1 "Allegro ♩=176", MIDI 176 → 120 (68%). Eric's piano pass not done.
- The nocturnes B. 49 and Op. 48 No. 1 are not in it (#1399). Ballade No. 4's coda was dropped (14 same-pitch overlaps).
- Levels: rows added to `reviewed.ts` at the formula's level (no Henle, RCM or ABRSM grade read for these excerpts in the ship window).
- Note counts weren't checked against the score bar by bar. Edits: 130 off-grid run notes and one rolled-chord note dropped in the Ballade, 9 Black Key notes moved to R; ids renamed off taken jackets (all in the decisions file).
