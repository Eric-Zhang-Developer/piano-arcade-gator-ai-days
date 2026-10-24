---
name: "Capture mode: ?capture=1 hides the cursor, debug text and setup controls while the video is recorded"
depends_on: ["core-loop", "beat-track", "song-select"]
owns: ["web/src/game/capture-mode/"]
assignee: "eric"
---

# Capture mode

The video is recorded off `/` and `/play`. Today the frames carry things a viewer shouldn't see: the mouse cursor,
beat-track's "Beat: laptop" status (`web/src/game/beat/index.ts:169`), /play's MIDI status line and laptop-keys hint,
the latency slider and `<SfxControls />` (juice-sound's) under the start and results screens, the timing panel's
"Set latency offset to N ms" suggestion, and the Calibrate latency link on `/`. `?capture=1` hides them and changes
nothing else.

Issue: #272

## Plan
Small PRs, in this order:
- a `feat(capture-mode)` with step 1's module and tests, but no done note;
- a `fix(core-loop)`: the `layout.tsx` mount and `/play`'s attributes;
- a `fix(song-select)`: the `/` link;
- a `fix(beat-track)`: beat's `draw`;
- a last `feat(capture-mode)` with `recording.md` and the done note.

Other features' files stay with their owners: a spec that isn't done holds its `owns` exclusively (`in_flight` in
`.agents/scripts/lib.py`), so owning `/play`'s page would block every other feature's PR there until this one is done.
1. `web/src/game/capture-mode/`: a pure `isCapture(search, stored)` with its tests, `captureOn()` (reads `<html
   data-capture>`), and a `<CaptureMode />` client component that sets `data-capture` on `<html>` and adds one style
   element: under `html[data-capture]`, `cursor: none !important` on everything (buttons set their cursor inline)
   and `[data-capture-hide]` gets `display: none !important`. `web/src/app/layout.tsx` mounts it.
2. `data-capture-hide` in `web/src/app/play/page.tsx` on the MIDI status line, the laptop-keys hint, the latency
   slider, the timing panel's suggestion (button and note) and a `display: contents` wrapper around `<SfxControls />`
   (no box, so nothing moves without the flag); in `web/src/app/page.tsx` on the Calibrate latency link. Beat's
   `draw` skips its status text when `captureOn()`; the beat still plays.
3. `specs/features/capture-mode/recording.md`, the recording guide below.

## Requirements
- **On and off:** `?capture=1` turns it on and `?capture=0` off, on any page. It's kept in sessionStorage
  (`pianoArcade.capture`), so `/?capture=1` stays on through the song select's link into /play, in that tab only.
  Storage blocked: the URL alone decides.
- **Hidden:** the cursor everywhere, and each element listed above. They leave the layout, so the start and results
  overlays center what's left. The game doesn't move, timing and input don't change, and without the flag every page
  is exactly today's.
- **Kept:** everything that's the game: song cards and the select hint, the stage card, the start panels (hand
  picker, labels, Learn it first), the HUD, judgments, results and their panels, the pause menu.
- **Moved elements:** results-layout (in flight) takes the timing line and the settings from /play's page as nodes,
  so the attributes stay in `play/page.tsx`; rebase on its `fix(core-loop)` PR if it lands first. An element moved
  into an in-flight feature's folder is a Gap until that owner's fix PR. Later features mark their own setup controls
  (sheet-view's button, laptop-octaves' Z / X line).

## The recording guide
One page at `specs/features/capture-mode/recording.md`, linked from the done note's "How to check it" (the done note
stays 3–8 lines). Each step as it works on main when written:
- build and start: `pnpm -C web build && pnpm -C web start`, then open `http://localhost:3000/?capture=1`;
- the browser: Chrome at a 1920×1080 viewport with its own UI hidden (full screen on a 1080p display, or the window
  size that gives it), the bookmarks bar and extensions out of view;
- before recording: calibrate latency at `/calibrate` (capture hides the link) and set Labels to Note names or Off
  on /play's start screen (it's remembered): `auto` shows laptop letters until the first piano note after a page load;
- what the computer adds: notifications (Do Not Disturb), the Dock and menu bar;
- start recording after the page has loaded (the flag applies after hydration, with no `<head>` script), and
  `?capture=0` to turn it off.

## Validation
- `pnpm -C web test`: `isCapture` is on for `?capture=1`, off for `?capture=0` even when stored, and the stored value
  decides with no param. Beat's `draw` writes no "Beat:" text under capture (a fake canvas context).
- `verify.py --slug capture-mode` passes, without the flag.
- Recording on `pnpm -C web build && pnpm -C web start`, Playwright at 1920×1080 with video on: `/?capture=1` for
  3 s, then `/play?song=twinkle&bot=perfect` in the same tab (no param: sessionStorage carries it), Start, through to
  results. On the select, the start screen and the results: computed `cursor: none` on `body` and on Start or Retry,
  and no visible element whose text has "MIDI:", "Laptop keys", "Latency", "Effects" or "Calibrate". The same run
  without the flag finds each of those words on one of the three screens, so the check can fail. Keep the .webm and
  screenshots of the select, mid-take and the results.
- Eric (mark it in the done note): record a take by `recording.md` with his own recorder; any cursor or debug text?

## How it's built and checked
It adds no look, only removes, so no frontend-design build or taste review. Before and after screenshots of `/` and
/play at 1280×720 and 1920×1080 go in the PR.

## Defaults
- midi-watchdog's reconnect notice and scenes' unknown-bot notice stay: they show only on a fault or a typo, and that
  take gets recorded again.
- Something else turns up in a recording: hide it with the same attribute, in its owner's files.
- Log choices the spec doesn't make in `specs/decisions/capture-mode-*.md`.
