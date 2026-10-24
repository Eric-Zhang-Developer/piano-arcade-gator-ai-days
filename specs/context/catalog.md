# Game-lane idea catalog

This is the overnight planner's source (`specs/decisions/002-overnight-planner.md`). An item counts as specced when
`specs/features/<slug>/` exists; nothing else marks it. "In" items come before "Maybe". Every item cites where it
came from; an item without a source doesn't belong here. New items the planner thinks of arrive only through a
`contract:` PR that Eric merges.

| # | Slug | Idea | Acceptance (one line) | Rubric | Priority | Source |
|---|---|---|---|---|---|---|
| G01 | tempo-curve | Judge timing against a smooth tempo curve fitted to the take, so rubato isn't punished; strict metronome mode stays the other option | A steadily slowing take judges all PERFECT in tempo-curve mode and drifts to GREAT/MISS in metronome mode | Technical | In | `specs/context/raw/piano-arcade-v4.md` (Scoring; The Weekend Version) |
| G02 | chord-sync | Flag chords whose notes land more than ~30 ms apart | A chord rolled over 40 ms is flagged; one within 20 ms isn't | Technical | In | v4 Scoring |
| G03 | dynamics-judge | Compare key velocity with the chart's dynamics | A take played forte where the chart says piano is flagged on those notes | Technical | Maybe (needs charts with dynamics) | v4 Scoring |
| G04 | ghost | The last take's timing drawn as a ghost on the highway | On a retry, each note of the previous take shows as a dashed outline at its played time | Design | In | v4 The Weekend Version ("Replay and ghost"); `specs/context/raw/piano-arcade-writeup.md`, gameplay wireframe item 7 |
| G05 | warning-card | A WARNING card plus a siren before the hardest pieces | Starting a piece marked hardest shows the card and plays the siren before the count-in | Presentation | Maybe | v4 Juice |
| G06 | section-results | Accuracy for each section of the song on the results screen | The results screen lists every section of the chart with its own accuracy | Design | In | `specs/context/references/guitar-hero-3/README.md` (per-section stats) |
| G07 | best-grade | The best grade per song, stored locally and shown in song select | After a take beats the stored grade, song select shows the new best grade for that song | Design | In | Writeup, song-select wireframe |
| G08 | song-preview | A song-select preview panel with notes per second and the best grade, plus a PRACTICE 70% button | Selecting a song shows its notes per second and best grade; PRACTICE 70% starts it at 70% tempo | Design | Maybe | Writeup, song-select wireframe |
| G09 | left-hand | Two-hand charts drawn and judged | A chart with `hand: "L"` notes draws and judges both hands | Technical | In | `Chart`'s `hand` field in `specs/features/core-loop/spec.md`; the v4 library needs both hands |
| G10 | latency-calibration | Set the latency offset by tapping along to clicks | Tapping along to the clicks sets `pianoArcade.latencyOffsetMs` to the mean tap offset | Technical | In | v4 "calibration setting" (What Could Break Live); `spikes/piano-midi/RESULTS.md` (the fixed delay wasn't measured) |
| G11 | band-playback | During play, send a chart's band channels (drums ch 10, bass ch 2) to the piano | Playing a band chart sounds its drums and bass from the piano, and stopping leaves no stuck notes | Presentation | Maybe (needs a band chart) | v4 closing wow; `spikes/piano-midi/RESULTS.md` R5 |
| G12 | key-labels | Laptop-key letters on the drawn keys, so judges can play in the browser | With laptop keys as input, every drawn key shows the letter that plays it | Impact | In | v4 "browser version on laptop keys" and the "Can I try it?" answer |
| G13 | screen-shake | A small shake on combo milestones | Each `comboMilestone` event shakes the screen briefly; judgments stay readable | Design | Maybe | v4 Juice |
| G14 | local-leaderboard | A local leaderboard per song | Song select or results shows the top local scores for that song, stored in the browser | Design | Maybe | v4 The Weekend Version, Maybe list |
| G15 | mascot-panel | The Mozart gator in a Chunithm-style side panel | The gator shows in a panel beside the highway without covering any lane | Design | Maybe (Eric: only with extra time) | `specs/context/references/chunithm-chart/README.md`; v4 Look and Feel |
| G16 | build-replay | A page that lights up each feature as it merged, for the Devpost deep dive | The page steps through merged features in merge order | Presentation | Maybe | v4 The Weekend Version, Maybe list |
| G17 | level-requests | An agent turns an `idea` issue naming a public-domain piece into a cited, verified chart in song select; shown as a pre-recorded time-lapse, never live | One real run goes from issue to merged chart with a cited `source` and passing synthetic players, and its issue-to-merge time is recorded | Presentation | Maybe (measure one run's time first; needs `chart-compiler` or a hand-charting path) | Eric, issue #10 comment (2026-10-24) |
| G18 | fever-stage | A three.js synthwave stage behind the 2D highway that scrolls on the beat and reacts to combo, fever and misses | The grid scrolls one line per beat, speeds up with the HUD's multiplier, and `?stage=off` plays exactly as before | Design | In | Eric, chat 2026-10-24, issue #91 |
