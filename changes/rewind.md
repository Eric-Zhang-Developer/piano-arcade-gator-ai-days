## What shipped
In wait mode, and so in chunk-practice's learn steps, ← moves back a bar and → skips ahead one, one bar per press. The clock moves to the bar start and holds there. ← makes that bar's notes playable again, while → skips the notes in between. The HUD's note count, the wait hint and the LED hints follow. Plain mode ignores the keys, and wait mode's start screen says "← → back or ahead a bar".
## Where it lives
`web/src/game/rewind/` (the hint, `verify-rewind.mjs`) · `web/src/game/wait-mode/` (`barStep`, `holdClock.seek`, the hold floor, #562) · `Judge.rewind` in `web/src/game/core/judge.ts` and the keys in `web/src/app/play/page.tsx` (#571) · `web/src/game/wait-hud/` (#565) · `web/src/game/wait-hint/` (#572) · the `resume` comment in `web/src/contracts/index.ts` (#561)
## How to check it
`verify: … pass at b0955a7` (verify.py, plain play unchanged). `node web/src/game/rewind/verify-rewind.mjs --out <dir>` → `verify-rewind: pass`: CI on b0955a7, and locally at e7f3c0d. It checks spec steps 1–5: the clock holds at 3000 → ← 0 → bar 1 replayed to 2400 → → 4800, wait-hud 6/1/5/8, plain mode keeps running, a chunk step rewinds within its chunk, and the hint shows at 1280 and 1920.
## Gaps
- **Eric's piano step is open:** Für Elise bars 1–4 with ← after a slip, and whether `hands=R` replays the left hand.
- A rewound take keeps its events' chart times, so they overlap; replay and Download MIDI play them in time order (spec Defaults). The sheet window's colored noteheads stay until re-judged.
- CI on b0955a7 also failed verify-learn (#594) and verify-options. Main's own run fails both too, and neither is in rewind's area.
