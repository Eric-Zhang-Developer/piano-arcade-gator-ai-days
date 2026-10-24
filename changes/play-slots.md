## What shipped
- **Panels:** plugins add panels to `/play`'s start screen (`startPanel`) and results screen (`resultsPanel`). Each sits in a `slot-<id>` wrapper behind an error boundary. piano-out's "Replay on piano" is the first one.
- **Pause:** Esc mid-take opens Resume / Retry / Quit. The chart clock stops and keys are ignored. Resume runs a one-bar countdown, and no note goes MISS for the wait. beat-track goes silent and comes back on the beat. midi-watchdog counts no stall. piano-out records nothing while paused.
## Where it lives
- `web/src/game/play-slots/`: `index.ts` (pause clock, menu states), `ui.tsx` (slots, pause overlay), `play-slots.test.ts`.
- `/play`: #165 and #174.
- beat-track #170, midi-watchdog #172.
## How to check it
- `verify.py --slug play-slots` passed at 9de5f76 (evidence `.git/agent-evidence/play-slots/20261024T085459Z`). It checks: no results-screen errors, and on `/sim`, Replay inside `slot-piano-out`.
- Chrome, laptop keys, Twinkle, Esc sent as a synthetic keydown:
  - MISS 5 before a 5 s pause and 5 after it; the countdown showed;
  - Quit went to the start screen, where Esc was ignored;
  - Retry gave a new count-in.
## Gaps
- **Not verified on the piano** (Eric): pause while the beat plays, no hung note, the beat back on time after Resume.
- **Queued drum hits:** Chrome's support for `MIDIOutput.clear()` is unknown. Without it, up to 300 ms of already-queued drum hits may sound after Esc.
- **Not done:** the countdown is visual only (no clicks), and `SfxControls` didn't move into a panel (optional per the spec).
