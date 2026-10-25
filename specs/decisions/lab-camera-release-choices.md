# lab-camera-release: choices the spec left open

**One helper, not a fix per page.** #1315 and #1317 have the same shape: an async start that hands its stop over only
at the end. `web/src/game/x/media-run` holds each thing as it opens (stream, object URL, session, tracker) and
releases them in reverse on a newer start, Stop, song change, pagehide or unmount. Undo: inline the old start bodies.
lab-midi-release's `runGuard` (composers-hands' `rolls.ts`) is the same idea without releases. Folding it into
`mediaRun` is a later refactor, not this PR.

**#1319, a release while the mic opens.** The spec says no 3 s take. When the mic arrives it stops at once and its
near-empty take goes to `onTake`, which the page already answers with "Hold Speak a little longer". The other option
was to drop the take silently, which would leave a press with no answer. Undo: `return` instead of
`onTake(m.stop())`.

**#1321, where the fix and its check live.** video-cards (#1347) holds `web/src/game/video-shots/`, so the fix is in
`capture-mode/index.tsx` alone: `CaptureMode` re-syncs when the query changes, with `useSearchParams` behind its own
Suspense. The browser check is a step in `verify-capture.mjs` (it clicks a /shots index link, then checks for
`html[data-capture]` and no nav bar) rather than in `verify-shots.mjs`. Undo: revert the capture-mode commit.

**Tests without a DOM.** There's no DOM test environment and no new dependency is allowed, so the pages' wiring isn't
rendered. `mediaRun` is tested in each page's start shape (#1315, #1316, #1317). `micHold`, `encode` and
`hitParticles().dispose()` are tested directly. #1322's spike was checked by hand with a stubbed `getUserMedia`.
