# frozen-clock-fades: fever's handoff without results-landing (#1333)

**Context.** A song that ends in fever should drain its heat from 1 to 0 rather than cut.
- With `?x=results-landing`, this PR drains it over the landing's out on `landingT()`: `arcAt`'s new `landingMs`.
- Without the landing, `/play` calls `finish(now)` on the tail. That draws one last frame and mounts the results in
  the same frame, so there is no time on screen to drain in.

**Options.**
- A. Hold the results back by `handoffMs` in `app/play/page.tsx`. That file is held by #600 and #747.
- B. Leave the cut and log the gap.

**Choice.** B for now.
- The landing is the path the video and the demo use.
- A needs the held file and would delay every take's results by 400 ms, which is results-landing's job to time.
- `changes/fever-arc.md` now says so.

**Undo.** Delete this note and the fever-arc done note's added sentence once a drain runs before the plain results.
