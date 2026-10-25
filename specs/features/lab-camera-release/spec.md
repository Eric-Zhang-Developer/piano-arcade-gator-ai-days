---
name: "Lab camera release: camera, mic and media let go on every exit, and capture holds on the /shots links"
depends_on: ["conductor", "real-keys", "speaking-piano", "speak-polish", "highlight-reel", "video-shots", "hum-level-spike", "hit-particles"]
owns: ["specs/features/lab-camera-release/", "changes/lab-camera-release.md", "specs/decisions/lab-camera-release-"]
assignee: "eric"
---

# Lab camera release

Issues #1315-#1322, from a post-merge bug review of the features merged on Oct 25. Most are a camera light or a mic
that stays on after the player said stop or left, which breaks the experiments' own privacy promise (nothing leaves
the page, and the camera stops when you do). One PR: the moment a person sees is the light going off.

**The shared cause.** An async start (`getUserMedia`, a CDN load, `play()`) hands its stream to the stop path only
at the end. Stop, unmount or a second click in between reach nothing. The fix is the same shape each time: a
generation ref taken before the first await, checked after each one, and every exit (Stop, unmount, catch, a newer
start) stops what that start opened.

## The changes
1. **#1315 conductor:** the stream is stopped on Stop, unmount and the catch, and a stale start creates no session.
2. **#1316 conductor:** a song change stops the session and the camera (or `<Conduct key={song}>`).
3. **#1317 real-keys:** `startCamera` stops its stream in its catch, on unmount and when superseded.
4. **#1318 real-keys / hit-particles:** `HitParticles` gets a `dispose()`, and RealKeys calls it in cleanup.
5. **#1319 speak-polish:** a release while the mic is opening is remembered; no 3 s take plays after it.
6. **#1320 highlight-reel:** `encode` takes an `AbortSignal` the page aborts on unmount; the reel's object URL is
   revoked on change and unmount.
7. **#1321 video-shots:** the /shots index cards open in capture mode (plain `<a href>`, or CaptureMode re-runs on
   navigation).
8. **#1322 hum-level-spike:** Record guards before its first await; a failed start stops its stream.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/x/conductor/Conduct.tsx`, `conductor.test.ts`; `web/src/app/conduct/page.tsx` | conductor | free; lab-midi-release edits `session.ts` and `conductor.test.ts` |
| `web/src/game/x/real-keys/RealKeys.tsx`, `real-keys.test.ts` | real-keys | free |
| `web/src/game/hit-particles/gl.ts` | hit-particles | free |
| `web/src/game/x/speaking-piano/mic.ts`, `speaking-piano.test.ts` | speaking-piano | free; lab-midi-release edits `playback.ts`, `Speak.tsx` and the test |
| `web/src/game/x/highlight-reel/Highlight.tsx`, `encode.ts`, `highlight.test.ts` | experiments (`x/`) | free |
| `web/src/game/video-shots/Cards.tsx`, `verify-shots.mjs` | video-shots; **video-cards** (#1306, in `extras` ahead of this) owns `web/src/game/video-shots/` while in flight | switch once video-cards' PR frees it, or fix #1321 in `capture-mode/index.tsx` alone |
| `web/src/game/capture-mode/index.tsx` | capture-mode | free |
| `spikes/hum-level/index.html` | hum-level-spike | free |

`conductor.test.ts` and `speaking-piano.test.ts` are shared with lab-midi-release: if its PR is open, rebase on it
once it merges rather than editing the same test blocks.

## Validation
Only #1321 changes what a person sees (the cursor, nav bar and build stamp leave the card). Design pass for it alone:
invoke `frontend-design`, then `design-taste-frontend` (taste v2); shots of `/shots?card=title&capture=1` reached
by clicking the index, before and after, at 1280×720 and 1920×1080, from your own dev server in the in-app browser;
score against `references/critique.md`. If the after shot equals the direct-load shot, one round is enough.
- **(a)** Each issue's Done-when, in unit tests with stubbed `getUserMedia` and `play()`:
  - #1315 a deferred or rejecting `loadLandmarker` and a teardown before it resolves: `track.stop()` called, no session.
  - #1316 changing the song calls the session's `stop()`.
  - #1317 two overlapping starts and an unmount mid-start: every track gets `stop()`.
  - #1318 the frame loop's cleanup calls `dispose`.
  - #1319 deferred `open`; `down()`, `up()`, resolve, advance 3 s: `stop` once, no 3 s take.
  - #1320 an aborted encode closes its AudioContext.
  - #1322 by hand, noted in the PR: a double-click gives one session; Stop silences everything.
- **(b)** #1321: a `verify-shots.mjs` step clicks an index link and asserts `html[data-capture]` and no nav bar. Not
  run locally (AGENTS.md interim load rule): the done note names the step and says "covered by main's scheduled full
  run".
- **(c)** `pnpm -C web exec vitest run src/game/x/conductor src/game/x/real-keys src/game/hit-particles
  src/game/x/speaking-piano src/game/x/highlight-reel src/game/video-shots src/game/capture-mode` passes, plus the
  Checks in `specs/tech-stack.md`.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/lab-camera-release-*.md`.
- No new dependency, no change to `web/src/contracts/`. Nothing new is stored or sent.
