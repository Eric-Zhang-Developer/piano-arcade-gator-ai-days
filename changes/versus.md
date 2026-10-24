## What shipped
`/play?versus=1`: the right-hand part twice, P1 at or above middle C and P2 the fewest octaves below it, judged as one chart. P1/P2 labels with each player's live combo and accuracy over each half; a results panel with both players' accuracy and counts and "P1 WINS", "P2 WINS" or "DRAW" (within 0.1%). Extras and WRONG notes count against the half their pitch is in. A song that would leave the 88 keys (only Moonlight 3rd mvt on main) says "This song doesn't fit versus" and plays normally. Versus takes aren't records.
## Where it lives
`web/src/game/versus/` (`split.ts` pure, `index.tsx` plugin, `verify-versus.mjs`), registered in `web/src/game/layers.ts` before scenes and the sim.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at 77201e6 (plain mode unchanged), and `node web/src/game/versus/verify-versus.mjs --out <dir>`: 7/7, including Twinkle at DRAW with 100.0% each.
## Gaps
Not played head to head on the piano yet (Eric and a second player: Twinkle; the halves are clear and the banner names the right winner). The HUD keeps one shared combo and score, as the spec allows. Laptop keys can't split, so outside the piano it runs only through ?input=test.
