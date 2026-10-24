---
name: "Options panel: one styled drawer for latency, effects and labels"
depends_on: ["juice-sound", "calibration", "note-labels"]
owns: ["web/src/game/options-panel/"]
assignee: "eric"
---

# Options panel

Settings are scattered: raw controls at the bottom of `/play`'s screens, a labels button on the start screen, and a
loose Calibrate link on `/`. One styled Options drawer on `/` holds them all, on the storage they already use.

Issue: #268

## Plan
Two PRs, about an hour: the drawer on `/` only.
1. `OptionsDrawer` in `web/src/game/options-panel/`.
2. A `fix(song-select)` PR: `web/src/app/page.tsx` renders it, and its "Options" button takes the place of the fixed
   "Calibrate latency" link. If capture-mode has put `data-capture-hide` on that link by then, the button keeps it.

Later, each its own spec if wanted, not built here: an Options item in pause-skin's menu (it needs `/play` to re-read
the latency and labels at each take's start, a `fix(core-loop)` and a `fix(note-labels)`), and an Options button in
place of the results screen's raw slider and `SfxControls` once results-layout is done.

## Requirements
- **Opening:** O on `/` and the Options button toggle the drawer, and Esc closes it.
- **Rows, in order:** Latency offset (`LATENCY_MIN` to `LATENCY_MAX` in 1 ms steps, showing "N ms") with a Calibrate
  link to `/calibrate`; Effects volume (0–100%); Mute; Miss sound; Note labels (Auto, Note names, Laptop keys, Off).
- **Same storage, no new keys:** `loadLatencyOffset` and `saveLatencyOffset` (`web/src/game/core/settings.ts`);
  juice-sound's `getPrefs`, `savePrefs` and `subscribePrefs`; note-labels' `LABELS_KEY`. `/play`'s own controls
  show what the drawer set, and the drawer, read each time it opens, shows what `/play` set.
- **When it applies:** effects, mute and miss sound at once. Latency and labels when `/play` next loads, since it
  reads both then (`loadLatencyOffset()` in its load effect, note-labels in `transformChart`).
- **Keyboard:** opening moves the focus into the drawer, and Tab stays inside. ↑/↓ move between rows (the slider's
  own ↑/↓ included), ←/→ change the slider and the labels, Enter or Space toggles. Closing puts the focus back where
  it was. While it's open, ↑/↓ don't move the song list.
- **Look:** a drawer from the right edge on `--pa-panel`, headings in the display face, labels in the body face, the
  `--pa-magenta` focus ring. It moves in 150–250 ms, ease-out; under reduced motion it doesn't move. Text is at least
  24 px at 1920×1080 and 16 px at 1280×720.

## Validation
- `pnpm -C web test`: stored values render; row movement stops at the ends. `verify.py --slug options-panel` passes.
- Headless Chrome (Playwright), at both sizes:
  1. On `/`, press O -> the drawer, focus on the first row. Press → ten times -> latency +10 ms. Press Esc -> closed,
     focus back on the song card. Open `/play` -> its slider shows the new value.
  2. Tick Mute and set Labels to Off -> on `/play`, Mute is ticked and `__pianoArcadeLabels.setting` is `off`.
  3. On `/play`, move its latency slider, go back to `/` and press O -> the drawer shows that value.
- Eric's eye (mark it in the done note): set up a game from the drawer alone. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before/after screenshots in the PR.

## Defaults
- A native `<dialog>` opened with `showModal()`: it keeps Tab inside, closes on Esc, puts the focus back and makes
  the page behind inert, so there's no hand-rolled focus trap and ↑/↓ can't reach the song list.
- The start screen keeps its own controls: stage-card requires volume and mute to stay reachable there. The MIDI
  status line stays too (`web/e2e/verify.mjs` reads it). Labels follow note-labels' `nextSetting` order.
- No sounds of its own. Log choices in `specs/decisions/options-panel-*.md`. Prefer the smaller option.
