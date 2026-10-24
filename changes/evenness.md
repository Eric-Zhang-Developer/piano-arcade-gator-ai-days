## What shipped
A results panel scores each hand's evenness (0–100) over its runs (4+ single notes at equal chart gaps) from the spread of the played gaps, and names the least even run ("Bars 5–6, right hand: gaps varied ±57 ms on a 600 ms beat").

## Where it lives
`web/src/game/evenness/index.ts` (settings in `evennessSettings`), `web/src/game/evenness/evenness.test.ts`, one line in `web/src/game/layers.ts`.

## How to check it
`verify: … pass at 8019aec` (panel in `slot-evenness`). Headless Chrome, `.git/agent-evidence/evenness/`: Twinkle `?bot=perfect` → "Right hand evenness 100"; `?bot=sloppy` → 92 and names bars 5–6; Minuet `?bot=sloppy` → 93, bars 6–7.

## Gaps
The piano check is Eric's and not done: play the Minuet and say whether the run it names felt uneven. Two hands checked in headless Chrome on Ode to Joy (`perfect` R 100 · L 100, `sloppy` R 94 · L 95). Für Elise scores only the right hand: its left hand plays three-note broken chords, under `minRun`. One `verify` run failed in verify-sim (3 MISS + 3 extra, on time ±0, likely a main-thread stall under load); the rerun passed and it didn't reproduce.
