---
name: "Wait hint: after 3 s on a note, its key pulses, it sounds once and its name shows"
depends_on: ["wait-mode", "note-labels", "hand-colors", "operator-replay"]
owns: ["web/src/game/wait-hint/"]
assignee: "eric"
---

# Wait hint

In wait mode, a player who doesn't know the next note can only guess keys until one lands. After a few seconds, the
game shows the note and plays it. It's part of Eric's quick practice ask (2026-10-24).

Issue: #253

## Plan
One PR: one plugin in `web/src/game/wait-hint/`, one line in `layers.ts` after `noteLabels()`, so it sees the final
chart (after bar-loop and hand-mode: with `hands=R` it hints only right-hand notes). No other feature's files
change. It reuses:
- wait-mode's `shouldHold` and `isWaitMode` (`web/src/game/wait-mode/index.ts`), to find the held note. A plugin
  never sees the judge's `noteState`, so it keeps its own map from `noteHit` events, cleared on `songStart`;
- note-labels' `noteName` (`web/src/game/note-labels/labels.ts`), for the name;
- the replay's voices (`pickOutput`, `pianoVoice`, `toneVoice` in `web/src/replay/piano.ts`), for the sound. MIDI is
  asked for at `songStart`, as hand-mode does: `?midi=sim` installs its stand-in after `transformChart`.

## Requirements
- **When:** only with `?mode=wait`. The hint starts once the clock has stood on a note for
  `waitHintSettings.afterMs` (3000) of wall time (`performance.now()`, since the chart clock stands still).
  Pressing every waiting key ends it. A pause ends it too; after the resume a new 3 s wait starts, and that hint
  may sound once more. `songStart`, `quit` and `songEnd` clear it.
- **The waiting keys** are the held time's notes not yet hit (a chord's unpressed notes). Each one's key pulses in its
  note's color (hand-colors' `noteColorFor`), over the keyboard below the line, until it's pressed.
- **Sound, once per hint:** the waiting notes sound together, once, on the DGX through `pianoVoice` (velocity 80)
  when `pickOutput` finds it, else through `toneVoice`. Each lasts its chart length at the take's tempo, at most
  1 s (`toneVoice` already cuts at 900 ms).
- **The name:** `noteName(pitch)` for each waiting note, lowest first, joined by spaces, large, centered over the
  waiting keys. Its bottom edge sits 500 ms of highway above the line (`judgmentLineY × (1 − 500 / lookaheadMs)`;
  the highway is linear in time), so it never covers a note due within 500 ms. `--pa-ink`, Saira italic 900,
  `0.089 × height` (96 px at 1080, 64 px at 720).
- **Test hook:** `window.__pianoArcadeWaitHint = { pitches, name, sounded }` while a hint shows, else `null`.
- **Reduced motion:** the keys light steadily instead of pulsing, and the name shows at once.

## Validation
- `pnpm -C web test`: the waiting pitches for a chord with one key pressed are the other key's. The hint is due at
  3000 ms of wall time and not at 2999, sounds once, and starts over at the next note. A pause at 2000 ms and a
  resume give a hint 3000 ms after the resume, not 1000. With no `mode=wait`, the plugin draws nothing and sends
  nothing.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/wait-hint/verify-wait-hint.mjs --out <dir>`. It starts its own dev server, prints
  `verify-wait-hint: pass` and exits 0, or names each failed step and exits 1. On
  `/play?song=twinkle&mode=wait&midi=sim&input=test`, timing from the moment `__pianoArcade.now()` reaches the first
  note's time:
  1. 2.5 s into the first hold -> `__pianoArcadeWaitHint` is `null`, and the stand-in DGX got no note-on.
  2. At 3.5 s -> it holds the first note's pitch and `noteName`, and the stand-in DGX got exactly one note-on, of
     that pitch. At 6 s, still one. Screenshots at 1280×720 and 1920×1080, and one with reduced motion, kept in
     `<dir>`: the name and the lit key show in them.
  3. Press the note -> the hint is `null`; at the next note it's still `null` 2.5 s in and shows at 3.5 s.
- `verify.py --slug wait-hint` passes, plain mode unchanged.
- On the piano (Eric; mark it in the done note): wait on a Für Elise note. After 3 s the DGX plays it once, its key
  pulses and its name shows. The hint's own note never counts as your press.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2's step 8,
"Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- No echo guard: the piano spike found the DGX echoes nothing back (R7, `spikes/piano-midi/RESULTS.md`). If the
  piano check shows the hint's note judged as a press, wrap MIDI input with hand-mode's `echoGuard`.
- `afterMs` is a constant in `waitHintSettings`, like every other tunable here; a URL or menu control waits until
  someone asks. The pulse is a 1 s loop, the lit overlay's opacity going between 0.35 and 0.9.
- The name always uses note names (C4, E), whatever note-labels' mode is; the lit key shows where it is.
- Log any choice the spec doesn't make in `specs/decisions/wait-hint-*.md`.
