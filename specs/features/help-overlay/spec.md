---
name: "Help overlay: ? shows every control on one card, and a test fails when a key handler has no help line"
depends_on: ["select-layout", "learn-from-select", "laptop-octaves", "play-slots", "sheet-view", "records", "replay-view"]
owns: ["web/src/game/help-overlay/"]
assignee: "eric"
---

# Help overlay

Judges play it themselves, and the controls are spread over hints on several screens: ↑ ↓ Enter L on the select,
the laptop-keys line and Z / X on the start screen, Esc to pause, Sheet music ↗, the records' initials. One card on
`?` lists them all. The key handlers live in seven features' folders, so the card can't read them at run time; a
test reads their source instead and fails when one handles a key the card doesn't list.

Issue: #375

## Plan
1. `feat(help-overlay)`, no done note: in `web/src/game/help-overlay/`, `keys.ts` (the card's lines as data),
   `<HelpOverlay />`, the `helpOverlay()` plugin (one line in `layers.ts`, which is open: it knows when a take is
   running) and the drift test.
2. `fix(core-loop)`: `web/src/app/layout.tsx` mounts `<HelpOverlay />` beside `<CaptureMode />`. Then a last
   `feat(help-overlay)` with `verify-help.mjs` and the done note: before the mount, CI's every-check runs would run
   it against a page without the card.

## Requirements
- **Opening:** `?` (`e.key === "?"`, no Ctrl, Meta or Alt) toggles the card on `/` and `/play`, and Esc closes it.
  On `/play` only on the start screen and the results: not during a take or its pause menu, where /play's own Esc
  listener would also see the Esc that closes the card and resume. The plugin's `onEvent` keeps that flag
  (`songStart` on; `songEnd`, `quit` off).
- **The card,** grouped by screen, each line `keys · what it does · where`:
  - Music select: ↑ ↓ choose, Enter play, L learn in wait mode.
  - Start screen: Enter start; the laptop keys (white and black), rendered from core's exported `keyMap(60)` so the
    letters can't drift; Z / X octave down / up; Sheet music ↗ opens the score in its own window, − / + zoom there.
  - Playing: Esc pause, and again to resume; the menu's Resume, Retry, Quit.
  - Results: Enter retry; a new record's initials: letters, ↑ ↓ change the last letter, Backspace, Enter saves;
    Esc closes the replay.
  - `?` this card. Later lines (options-panel's O, demo-reset's Shift+Esc) come with the drift test below.
- **Native:** a `<dialog>` with `showModal()`: Esc, the focus trap, focus return and an inert page are the browser's.
- **Drift test** (`help-overlay.test.ts`, Vitest, reading files with `node:fs`): every non-test `.ts`/`.tsx` under
  `web/src/game/` and in `web/src/app/page.tsx`, `web/src/app/play/` and `web/src/app/sheet/` that adds a `keydown`
  listener or an `onKeyDown` must be a `source` in `keys.ts` or in its `unlisted` list with a reason (cabinet's
  any-key idle reset; song-preview stopping its preview on Enter and L). Each key literal in that file's
  `key`/`code`/`k` comparisons (`/(key|code|\bk)\s*[!=]==\s*"([^"]+)"/`) must be in one of that source's lines. On
  main today it finds records, sheet-view, core input, laptop-octaves, replay-view, select-layout, song-preview and
  `/play`. The failure names the file, the key and the fix: a line in `keys.ts` through a `fix(help-overlay)` PR.
- **Look:** `--pa-panel` card on a dimmed page, headings in the display face, keys as `<kbd>` chips with a
  `--pa-cyan` edge, `--pa-magenta` focus ring, text at least 16 px at 1280×720 and 24 px at 1920×1080. It fades in
  over 150–250 ms, ease-out; under reduced motion it appears at once. `data-testid="help"`.

## Validation
- `pnpm -C web test`: the drift test passes on main; a scratch handler file under `web/src/game/` comparing
  `e.key === "q"` makes it fail naming that file and `q` (shown in the PR, not committed).
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/help-overlay/verify-help.mjs --out <dir>`. It starts its own dev server, prints
  `verify-help: pass`, or names each failed step and exits 1:
  1. `/`, press `?` -> `help` open, focus inside; it lists L and Z / X. Esc -> closed, focus back on the song card.
  2. `/play?song=twinkle`, `?` on the start screen -> open. Close, Start, `?` mid-take -> no card, the take goes on.
     Esc (pause), `?` -> no card.
  3. Results of `bot=perfect` -> `?` opens it. Screenshots of the card at 1280×720 and 1920×1080 go in `<dir>`.
- `verify.py --slug help-overlay` passes.
- Eric (mark it in the done note): hand the laptop to someone new with only "press ? for help".

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2's step 8,
"Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots in the PR.

## Defaults
- No on-screen hint for `?` here: the select's hint line is select-layout's (a `fix(select-layout)` if Eric wants it).
- Whichever of options-panel and demo-reset lands after this one adds its line to `keys.ts` (a `fix(help-overlay)`
  PR before its own), since the drift test fails its CI otherwise.
- Log choices the spec doesn't make in `specs/decisions/help-overlay-*.md`.
