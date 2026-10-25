## What shipped
The Round (#1123), a Lab experiment behind `?x=round`. You play Frère Jacques or Row, Row, Row Your Boat once, and the piano plays your take back as voices 2, 3 and 4. Each voice comes in 2 bars later, on its own channel (2–4) and program. The voices fall as outlines in gold, ink and violet, with VOICE n on its lane, and the results card links to the highlight reel. Only voice 1, you, is judged.
## Where it lives
`web/src/game/x/round/` (echo.ts is the pure engine) · `web/public/songs/rounds/`, kept off the song select by `LAB_ONLY` in `song-select/load.ts` · `specs/decisions/round-entries.md`, `round-voices.md` · shots in `specs/features/experiments/shots/round/`
## How to check it
Unit: `pnpm -C web exec vitest run src/game/x/round` (13 pass). `/sim` log (Frère Jacques, bot): 156 echoes, |error| against press + k × interval median 0 ms, max 0 ms, every one handed over 257–300 ms early, 0 late. Bot rank S, 0 filtered. Perf gate not run locally; main's scheduled run covers it.
## Gaps
Not verified live: Validation (c) live, (d) multitimbral on channels 2–4 and (f) Eric's 1-minute round all need Eric at the DGX. The programs aren't picked by ear. The channel-1 echo guard ships off: R7 measured no echo, and it cost the bot 6 of 32 presses (decision round-voices). No Canon toggle (optional, not built). Row, Row's tempo of 102 is our choice.
