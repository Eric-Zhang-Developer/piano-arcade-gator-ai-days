## What shipped
A virtual DGX-660 behind the standard Web MIDI interfaces (Portable Grand / Yamaha Corporation; releases as note-on with velocity 0; 1 ms timestamps; no echo; Active Sensing unmeasured, so none sent). Faults: stall, unplug/replug, seeded jitter, stuck note. Vitest drives core's real `midiDevice` and `Judge` through it. `/play?midi=sim` runs the game on it. `/sim` shows the game, a virtual keyboard, a raw MIDI log, fault buttons, "Watch the bot", a replay of the spike's real capture, and the profile with a source for each value. `/sim?record` records the real piano into a fixture.

## Where it lives
`web/src/game/sim/` (fake, bot, plugin, tests, `verify-sim.mjs`, `fixtures/python-piano.json` and its converter) · `web/src/app/sim/page.tsx` · one line in `web/src/game/layers.ts` (before beat-track, so beat-track's output also goes to the fake) · `specs/decisions/piano-sim-behavior.md`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/piano-sim/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/piano-sim/20261024T061320Z` pass at 83f547d (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/piano-sim/20261024T061320Z)
MIDI path: `node web/src/game/sim/verify-sim.mjs --out <dir>` passes at 83f547d. It clicks "Watch the bot" on `/sim` headless: 42/42 PERFECT, the game picked "MIDI: Portable Grand", and the log shows 84 key messages (screenshot `sim-results.png` in .git/agent-evidence/piano-sim/sim-20261024T061357Z).

## Gaps
- **Piano Validation step not done:** it needs Eric. Open `/sim?record` in Chrome, leave the piano idle 60 s, play Twinkle, download the fixture, and record whether 0xFE arrived and how often. Until then `activeSensingMs` stays `null`.
- **Record mode untested:** checked only that it renders and reports `NotAllowedError` in a browser without Web MIDI.
- **Chrome's real unplug behavior is unmeasured**, and labeled so.
- **Not in `[verify].command`:** `verify-sim` stays separate. Adding it there is a follow-up `fix(core-loop)` to `web/e2e/`.
- **"Replay a real take" isn't Twinkle:** the capture is scales and play-along, so the game counts it as extras. It shows the MIDI path, not a score.
- **Jitter and stuck note on `/sim`:** checked by unit tests, not clicked by hand.
