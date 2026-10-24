---
name: "Pause skin: a PAUSED menu, keyboard first, with a countdown that clicks"
depends_on: ["play-slots", "ui-sounds"]
owns: ["web/src/game/pause-skin/"]
assignee: "eric"
---

# Pause skin

play-slots' Esc menu works but is unstyled, and its resume countdown is visual only (`changes/play-slots.md`). This
skins it, drives it from the keyboard, and clicks each countdown beat so the player hears the time before notes move.

Issue: #267

## Plan
A feat and two few-line fix PRs, about an hour.
1. `web/src/game/pause-skin/`: `PauseMenu`, with play-slots' `PauseOverlay` props (`mode`, `count`, `onResume`,
   `onRetry`, `onQuit`; not its `button` style) plus `beatMs`, and the tick schedule as a pure function.
2. A `fix(core-loop)` PR: `/play` renders `PauseMenu` in place of `PauseOverlay` and passes
   `beatMs = msPerBeat(chart.bpm)`. Quit opens `/` after it emits `quit`.
3. A `fix(play-slots)` PR: delete the now unused `PauseOverlay`, and change play-slots' spec line "Quit returns to
   the start screen" to Quit opens `/` (issue #267's acceptance, from Eric's polish list). The pause clock and
   `nextPause` stay.

## Requirements
- **Menu:** Esc mid-take dims the playfield and shows "PAUSED" in the display face (Saira, italic, 900), the largest
  thing on screen. Under it, stacked on `--pa-panel`: Resume, Retry and Quit to select. Resume has the focus, which
  gets the `--pa-magenta` ring. Text is at least 24 px at 1920×1080 and 16 px at 1280×720 (the video rule).
- **Keyboard first:** ↑/↓ move the focus and stop at the ends. Enter chooses, and Esc resumes, as now. The mouse
  works too. ui-sounds: `move` on ↑/↓, `confirm` on a choice, `back` on Esc.
- **Quit to select:** emits `quit`, so beat-track, piano-out and midi-watchdog react as now, then opens `/`. Retry
  is unchanged: `quit`, then a new count-in.
- **Countdown with clicks:** Resume or Esc starts play-slots' one-bar countdown. Each number shows large, and each
  beat clicks: `tickAccent` on the first, `tick` on the rest. The clicks are `beatMs` apart on the audio clock, and
  the first lands within one frame of the countdown showing. They follow mute and the effects volume. Esc during the
  countdown still waits for it to finish (play-slots' rule). No note goes MISS for the time paused (unchanged).
- **Motion:** the menu enters in 150–250 ms, ease-out. Under reduced motion it shows at once, and the countdown's
  numbers don't animate. `data-testid="pause"` and `data-testid="pause-countdown"` stay.

## Validation
- `pnpm -C web test`: the tick schedule for 4 beats at 500 ms is 0, 500, 1000 and 1500 ms, the first accented; for 3
  beats it's three ticks. Focus: ↓ on Quit stays on Quit. play-slots' tests pass unchanged.
- `verify.py --slug pause-skin` passes.
- Headless Chrome (Playwright) on `/play?song=twinkle&beat=off` with laptop keys (`?input=test` never pauses;
  `beat=off` keeps out beat-track's clicks, which share the tick's pitches), and a page-side spy logging each
  `OscillatorNode.start`'s frequency and time:
  1. Press Start, then Esc -> PAUSED, with Resume focused (screenshots at both sizes). Press ↓ ↓ Enter -> `/`.
  2. Open it again, Start, Esc, Enter -> the countdown runs 4, 3, 2, 1 (Twinkle is in 4/4): one `clickAccentHz`
     start, then three at `clickHz`, 600 ms apart (100 bpm). Then `pause` is gone and play goes on.
  3. Press Esc, then ↓ Enter -> a new count-in.
  No MISS for the pause is play-slots' rule, unchanged and pinned by its tests: with no keys pressed here, every note
  misses anyway, so this run can't show it.
- On the piano (Eric; mark it in the done note): pause mid-song, Resume, and come back in on the clicks. Does the beat
  return on time? `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before/after screenshots in the PR.

## Defaults
- The clicks play on the laptop (Web Audio), even when beat-track plays on the piano. The countdown has no event
  that beat-track could hear without a contract change. Open question for Eric: the piano's side stick instead.
- The countdown keeps play-slots' timing: one bar from the Resume press, not phased to the chart's beat grid.
  Phasing it, so the clicks run straight into beat-track's beat, is an open question (core-loop's countdown math).
- Log other choices in `specs/decisions/pause-skin-*.md`. Prefer the smaller option.
