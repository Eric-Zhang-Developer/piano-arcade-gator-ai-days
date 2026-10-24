---
name: "Demo reset: Shift+Esc, or 60 s idle on a plain take's results, returns to / clean between judges"
depends_on: ["core-loop", "cabinet", "piano-out", "replay-view"]
owns: ["web/src/game/demo-reset/"]
assignee: "eric"
---

# Demo reset

Between judges Eric needs the game back at `/` with nothing left over: no falling notes, nothing held on the DGX, the
latency calibration kept. Today a take's results sit there until someone clicks Songs, and cabinet's idle return
(`armReturn` in `web/src/game/cabinet/plugin.tsx`) covers only `?cabinet=1` games, back to `/cabinet` after 30 s.
This adds one combo everywhere and the same idle return for plain takes. It doesn't touch the kiosk loop.

Issue: #371

## Plan
Three small PRs, in this order:
1. `refactor(cabinet)`: `armReturn`'s idle watch (keydown, pointerdown, MIDI note-on) moves to an exported
   `whenIdle(ms, onIdle): () => void` in `web/src/game/cabinet/idle.ts`, and the plugin calls it with 30 s and
   `location.assign(CABINET_URL)`. No behavior change; the pin is `verify-cabinet.mjs` (its idle return), passing
   before and after.
2. `feat(demo-reset)`, no done note: `web/src/game/demo-reset/` with `reset()`, `isResetKey(e)`, the `demoReset()`
   plugin (one line in `layers.ts`, which is open), `<DemoReset />` (the window listener) and `verify-reset.mjs`.
3. `fix(core-loop)`: `web/src/app/layout.tsx` mounts `<DemoReset />` beside `<CaptureMode />`, outside crash-guard's
   `<GameBoundary>` (if that has landed), so the combo still works on its error card. Then a last
   `feat(demo-reset)` with the done note.

## Requirements
- **`reset()`:** sends piano-out's `allNotesOff` (CC 123 on all 16 channels; reuse it, don't rewrite it) to every
  MIDI output, now and again timestamped 250 ms ahead (beat-track's pattern for sends already queued), then
  `location.assign("/")`. A full page load, as cabinet's return is: no game state, timer or MIDI listener survives,
  and piano-voice's and hand-mode's `pagehide` handlers run. It calls `requestMIDIAccess()` only where it exists (already granted on any page that played or
  previewed a song), and navigates at once if that rejects or finds no outputs.
- **The combo:** Shift+Esc (`isResetKey`: `key === "Escape"`, `shiftKey`, no Ctrl, Meta or Alt, not a repeat) on
  every page under the layout except `/cabinet`, `/attract`, `/operator` and `/sheet` (the score's own window on the
  second monitor must not turn into the select). A window listener in the capture phase, so replay-view's and
  records' capture handlers can't swallow it. Esc alone is unchanged everywhere.
- **Idle on results:** after `songEnd` on a take without `cabinet` in its URL, 60 s with no key, pointer, wheel or
  MIDI note-on calls `reset()`. Any of them restarts the 60 s; `songStart` or `quit` disarms it. The 60 s don't run
  while a replay plays (piano-out's `getReplayState().playing`, or replay-view's `replay-overlay` in the DOM): Replay
  on piano is the video's last beat and a long song's replay outlasts 60 s. They restart when it ends. `?idle=<s>` (a
  positive number) shortens it for a check, as cabinet's `?title=` does.
- **Kept:** all of localStorage (latency offset, records, labels, ghost, sheet zoom, stage) and sessionStorage
  (`?capture=1` stays on). Nothing is deleted.

## Validation
- `pnpm -C web test`: `isResetKey` is true for Shift+Escape, false for Escape, Shift+Escape with Meta, and a repeat.
  The plugin arms on `songEnd` without `cabinet` and not with `cabinet=1` or `cabinet=demo` (fake timers: `reset` at
  60 s, not at 59 s after a keydown at 1 s).
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/demo-reset/verify-reset.mjs --out <dir>`, with a stand-in "Portable Grand" output recording sends
  (`verify-cabinet.mjs`'s `fakePiano`). It starts its own dev server, prints `verify-reset: pass`, or names each
  failed step and exits 1:
  1. Set the latency offset to 37 on `/play`. `/play?song=twinkle&bot=perfect`, Start, Shift+Esc mid-take -> the URL
     is `/`, the stand-in got `[0xB0 + ch, 123, 0]` for ch 0–15, and `/play`'s slider shows 37 ms.
  2. `/play?song=twinkle&bot=perfect&idle=3`, through to results, no input -> `/` within 5 s. A key at 2 s -> still on
     the results at 4 s.
  3. `/play?song=twinkle&bot=perfect&cabinet=1&idle=3` -> still on the results at 5 s.
  4. `/play?song=twinkle&bot=perfect&idle=3` with the stand-in piano, results, click Replay on piano -> still on the
     results while it plays past 3 s, then `/` within 5 s of its end.
  5. Esc alone mid-take -> the pause menu, still on `/play`.
- `verify.py --slug demo-reset` and `verify-cabinet.mjs` pass.
- Eric (mark it in the done note): on the DGX, hold a chord while the left hand plays (`hands=R`) and press Shift+Esc.
  Does anything keep sounding?

## Defaults
- Shift+Esc on Eric's Mac. Chrome on Windows and Linux takes Shift+Esc for its Task Manager, so the page never sees
  it there; the combo is one constant (`resetSettings`) to change if the demo laptop isn't the Mac.
- Open question for Eric: should a reset clear the ghost (`pianoArcade.ghost`), so the next judge doesn't race the
  last one's take? Default: kept.
- The `/sheet` window stays open on the last song; it follows the next take's chart when one posts.
- No UI and no frontend-design pass: the reset only removes state. Log choices in `specs/decisions/demo-reset-*.md`.
