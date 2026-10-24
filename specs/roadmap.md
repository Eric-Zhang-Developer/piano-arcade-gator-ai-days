# Roadmap

## Where this is going
A real piano that plays like an arcade machine, and actually teaches you. The game lane (Eric) makes playing feel
great and judges every note; the learning lane (teammate) reads your takes and tells you what to fix. Milestones set
the order only: `start` in `milestones.toml` is empty, so no deadlines are enforced (decision 001, row 15).

## Milestones
- **playable:** `core-loop`. Twinkle plays on the real piano and on laptop keys, every note judged, with a results
  screen. The skeleton and the shared formats everyone builds on.
- **audible:** `beat-track`, `timing-feedback`. A drum beat on the piano from count-in to the end, so players can
  hear the time; then the results screen says how early or late they played; then `judging-tiers`: a GOOD tier
  that keeps the combo, early/late labels, and wrong notes that break it.
  Added after the first playtest (`specs/context/findings.md`): without it the game was unplayable.
- **arcade:** `song-select` and `minuet-g` (a front door with two songs), `operator-board` (the team's live view of
  the build, at `/operator`), `piano-sim`, `hud`, `juice-visual`, `juice-sound`, `midi-watchdog`. It feels like an
  arcade, MIDI features are testable without the piano, and the one known MIDI risk is handled. These run in parallel
  once `core-loop` merges.
- **submission:** `bar-loop`, `piano-out`. The coach's drill can play, and the piano plays your take back.
  `operator-replay` (`/attract`) shows judges the build, one merge per note of Twinkle, on the piano.

## Learning lane (provisional, not scheduled)
`coach`, `practice-mode`, `chart-compiler`, `song-rip-spike`. Their specs record what was discussed; the learning
lane's person fills them in, sets an `assignee` and adds them to a milestone. The game lane provides `Results`,
`Take` and `Chart` (`web/src/contracts/`) and the `bar-loop` link.

## Lights
Milestone **lights**, between `arcade` and `submission`: `led-strip` (Sharan) and `led-game` (Eric). The keys light
up: the next note glows before it arrives, and every hit shows on the piano itself. `led-strip` needs no game and
can start now.

## Open
- The challenge statement's technology (first public in the past 12 months, central to the project) isn't chosen.
- The learning lane's person and GitHub handle, for `AGENTS.md` Lanes and `.github/CODEOWNERS`.
- Flat or mild perspective: Eric decides after playing both (`core-loop`'s perspective setting).

## Not doing
See `mission.md` Not doing. Also out for now: the mascot (a Maybe if there's time), the in-app camera
overlay (the overhead hands shot is made in the video edit), and "Golden" unless `song-rip-spike` passes.
