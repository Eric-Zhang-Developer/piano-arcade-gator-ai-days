## What shipped
Esc mid-take shows a styled PAUSED menu over a dimmed, blurred playfield: Resume, Retry and Quit, Resume focused with a magenta ring. ↑/↓ (stopping at the ends), Enter and Esc drive it, with ui-sounds' move, confirm and back. Resuming runs the one-bar countdown with a click per beat on the audio clock, accented first. Quit now opens the music select (`/`).
## Where it lives
`web/src/game/pause-skin/` (#389); `/play` renders it, resets the countdown's count and sends Quit to `/` (#404); play-slots' old `PauseOverlay` removed and its spec's Quit line updated (#409). Screenshots in `specs/features/pause-skin/look/`.
## How to check it
`node web/src/game/pause-skin/verify-pause.mjs --out <dir>`: pass on main at bfc8cf9, all 12 steps. Countdown 4, 3, 2, 1, with clicks accent-tick-tick-tick at 600, 600, 600 ms on the audio clock (Twinkle, 100 bpm) and the first due 0 ms after scheduling. Quit → `/`; Retry → a new take. `verify.py --slug pause-skin` pass at 9174617; `verify.py --slug core-loop` pass at ed58c9a.
## Gaps
Not verified by Eric: on the piano, does the beat come back on time on the clicks? The clicks play on the laptop even when beat-track uses the piano (spec default). The countdown isn't phased to the chart's beat grid (open question).
