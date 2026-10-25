---
name: "Real Keys spike: the highway's notes fall onto live video of the real DGX keys and spark on the key pressed"
depends_on: ["experiments", "core-loop", "hud", "hand-colors", "hit-particles", "duo-tokens", "capture-mode"]
owns: ["specs/features/real-keys/", "changes/real-keys.md", "specs/decisions/real-keys-", "web/src/game/x/real-keys/", "web/src/app/real-keys/", "spikes/real-keys/"]
assignee: "eric"
---

# Real Keys (spike)

Issue #1017, from Eric's overnight wow feeder (relayed by eric-planning-agent). Eric: "just build a bunch of cool crap
that has a maximum wow factor ... Some of them can be polished. Some of them can be spikes." This is a prototype spike
(decision 004), mounted as an experiment (#878). It stays out of the main game until Eric picks it.

**The pitch:** a camera looks down at the DGX, and the highway's notes fall onto the live video of the real keys,
bursting into sparks on the exact key pressed: the NFL yellow-line trick. MIDI already says which key is down, so that
needs no computer vision, only a one-time calibration of where each key sits in the picture.
- **Not finger-cam-spike (#339):** that one asks which finger pressed a key.
- **Not the Conductor (#985):** that one is a hand leading the tempo.

## The question
Can a plain-JS homography from a 4-corner click place every key of the DGX in a camera picture closely enough, with
the camera's latency measured and taken out, that sparks land on the right key at the right frame at 60 fps?
- **Yes:** (a) and (b) in Validation pass on Eric's still and clips, and the page holds 60 fps at 1920 with a 1080p
  feed.
- **No:** after the time box, reprojection, latency agreement or the frame rate misses its bar. FINDINGS.md says
  which, by how much, and why.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state. Without Eric's still and clips, it
  says "camera runs pending" and reports the synthetic results.

Every bar here is the planner's, not a measured threshold.

## How it mounts
- **`/real-keys`** (`web/src/app/real-keys/page.tsx`, a client page over `web/src/game/x/real-keys/`). The
  experiments frame can't host it on `/play`:
  - every plugin draws on one shared overlay canvas in `layers.ts` order, and `xFrame` is late, above the HUD;
  - the frame has no background layer;
  - the plugins before it (juice, key preview, note labels, ghost) draw on the flat highway's geometry.

  So the camera picture can't go under the HUD there, and the flat effects would float in the wrong places.
- **Registry entry** (`web/src/game/x/index.ts`, its one line, under the lane rule): group "Wow", line "The notes
  fall onto live video of the real keys (#1017)", href `/real-keys?song=twinkle`.
- **On `/play` with `?x=real-keys`:** its plugin adds only a start-panel link, "Play on the real keys", to
  `/real-keys?song=<id>`. So `/play?song=twinkle&x=real-keys` leads there.
- **Imported, never edited:**
  - core's `Judge`, `noteTimeMs`, `midiDevice` and `keysDevice`, plus the song loader `/play` uses: the same chart
    and judge, as a new view of a take, not a new game;
  - `hud()`'s `draw` and `onEvent`, fed with the judge's events and drawn flat in screen space;
  - `noteColorFor` (hand-colors);
  - `hitParticles()` (hit-particles), whose `hit` and `hold` take any x, width and y;
  - the Duo kit.
- **Modes:** Perform first. Wait and flow come in only if their clocks (`holdClock`, `FlowJudge`) import without
  edits; otherwise they're a logged gap.

## What to build
1. **Camera:** `getUserMedia` with a device picker. A Continuity Camera above the keys is ideal; an angled view is
   fine. Ask for 1920×1080 and show what the camera actually gave.
   - Frames stay in the browser. The page records nothing (the one exception is the "Save still" button, which saves
     one frame only when clicked), and capture mode (`?capture=1`) only hides the setup text
     while Eric's own recorder runs (capture-mode's `recording.md`).
   - A "camera on" dot shows while it runs. Stop and `pagehide` end the tracks.
2. **Calibration:**
   - Click the 4 corners of the key bed in view.
   - **Key range:** no MIDI config stores one, so don't assume C2–C6. Press the leftmost and then the rightmost key in
     view, and MIDI names them. With the whole bed in view, that's the DGX-660's 88 keys, 21–108 (`mission.md`).
   - **The homography:** by DLT in plain JS (`homography.ts`, normalized points, an 8×8 solve), no OpenCV and no new
     dependency.
   - **Each key's quad** comes from white- and black-key geometry in key-bed space:
     - white keys are evenly split;
     - black keys follow the same proportions core's highway uses (`BLACK_KEY_WIDTH` 0.6 × a white key,
       `core/highway.ts:46`), imported if it's exported, else a copy pinned by a test;
     - the black keys' length on the bed is a logged choice.
   - **Overlay and storage:** an outline overlay with draggable corner nudges, saved in `localStorage` per camera
     (`pianoArcade.x.realKeys.<deviceId>`), with a Reset.
3. **Camera latency:**
   - Press one key 8 times. For each press, find the first frame where that key's quad brightness changes past a
     threshold (frame times from `requestVideoFrameCallback`), against the MIDI note-on's timestamp.
   - The median sets the overlay delay. Show the number and the spread (min–max, in ms and in frames).
4. **The overlay,** in perspective, through the homography:
   - notes fall along each key's lane, beyond the key bed's back edge, and land on its back edge;
   - semi-transparent, in the hand's color;
   - held keys glow in their hand's color, with hit-particles sparks from the key quad;
   - wrong keys get a brief red tint;
   - the HUD stays flat, in screen space;
   - **the skin mask is optional:** only if it holds 60 fps; otherwise it's a logged gap;
   - **reduced motion:** the glow only, no sparks and no falling motion blur.
5. **The game loop:** the chart, the judge, the count-in from `countInBeats`, the results from `judge.finish`, and a
   Retry. The overlay draws presses with the measured camera delay, so a spark meets the video's key.
6. **Performance:** 60 fps at 1920 wide with a 1080p feed. Measure two ways and keep the faster:
   - the video drawn into the canvas each frame (`drawImage`);
   - a `<video>` element under a transparent canvas.

   Report p95 frame work for both from the page's own frame timer.
7. **Clip mode, for the worker:** `/real-keys?clip=1` takes a local video file and its MIDI log through file inputs,
   instead of the camera and the piano. Calibration, latency, the overlay and the perf numbers run on it at the
   video's frame times.
8. **The recorder, for Eric:** `spikes/real-keys/record.html`, a local page opened on purpose and never linked. It
   records a camera clip with `MediaRecorder` and logs each DGX note-on on `performance.now()`, counted from the
   recorder's `start`, as finger-cam's `record.html` did. It saves `clip.webm` and `notes.json`.

## Eric's morning-page asks (about 5 minutes, at the DGX with a camera)
An agent can't press keys in front of a camera, so these are Eric's. Until they're done, the worker builds and tests
everything else on synthetic frames, plus any clip that exists.
1. **A still:** in `/real-keys`, after calibrating, press "Save still". It saves the raw camera frame as a PNG; drop it
   in `spikes/real-keys/local/`.
2. **Latency clips:** with the recorder, three clips of about 10 s each, pressing one key 8 times.
3. **A play clip:** about 10 s of playing anything, for the spark check (b).
4. **(d), optional:** a 20 s capture-mode recording of Twinkle with his own recorder, for video-shots.

## Content and disk
- Clips, stills and labels stay in `spikes/real-keys/local/`, self-ignored (`*`, `!.gitignore`). Code, the recorder,
  `score.mjs` and FINDINGS.md are committed.
- **Camera test clips stay short (about 10 s or less) and few.** The machine has about 6 GiB free.
- **Nothing is deleted by the worker**, clips included (Eric's no-delete rule). Any cleanup is Eric's.
- No committed frame shows a face. The design shots come from clip mode or synthetic frames.
- One dev-server slot (`devserver.1` to `.4`).

## Validation
The bars are the planner's, not measured thresholds.

**(a) The homography:**
- **Unit tests** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/real-keys`):
  - DLT recovers a known synthetic transform: its 4 points map back within 1e-6, and 20 random points within 1e-3 px;
  - the key quads for 21–108 and for a 61-key range tile the bed with no gaps or overlaps between white keys;
  - black keys sit where core's geometry puts them;
  - the latency estimator finds planted brightness steps in synthetic frame series, with the median and spread right.
- **Reprojection:** on Eric's still, the worker marks the visible key edges by hand
  (`spikes/real-keys/local/edges.json`). `node spikes/real-keys/score.mjs edges <still> <calibration>` prints the mean
  error of the predicted edges against the marked ones. The bar is **≤ 3 px at 1080p**.

**(b) Latency and sparks:**
- **Agreement:** the three latency clips' medians agree within ±1 frame (`score.mjs latency` prints each run's median
  and spread).
- **Sparks:** on the play clip in clip mode, with the measured delay, dump side-by-side frames. Each spark's first
  frame is within ±1 frame of its key's quad going down. `score.mjs sparks` prints the offsets, and the PNG pairs go in
  `local/`.

**(c) The design pass** (AGENTS.md, Visible changes):
- invoke `frontend-design` and `design-taste-frontend`;
- shots at 1280×720 and 1920×1080, plus a reduced-motion set (glow only, no sparks), taken from clip mode or
  synthetic frames on your dev server in the in-app browser;
- fix the top three problems a round, at most three rounds;
- **commit the scores, not the video:** scores in the PR's Design section, and stills (no faces) in
  `specs/features/experiments/shots/real-keys/`.

**The perf numbers:** both compositing ways, p95 frame work at 1920 with a 1080p clip, in the PR and FINDINGS.md.
`perf.mjs --params x=real-keys` covers `/play` with the link only. It runs locally only under `verify.lock`; otherwise
"not run locally; main's scheduled run covers it".

**(d) A 20 s capture-mode WebM** of Twinkle on the real keys, as a pick for video-shots (#975). It isn't a gate.
Eric's own recording stays his.

**Eric's URLs:**
- Lab → Real Keys;
- `localhost:3001/play?song=twinkle&x=real-keys` (then "Play on the real keys");
- `localhost:3001/real-keys?song=twinkle`.

## FINDINGS.md (`spikes/real-keys/FINDINGS.md`)
Per decision 004:
- the question;
- the measured answer: (a)'s unit results and reprojection error, (b)'s latency medians and spark offsets, and the
  two compositing ways' p95;
- whether the skin mask made it;
- what worked, what didn't, what to keep;
- **promote**, **iterate** or **kill**.

Without Eric's camera runs: "camera runs pending", the synthetic results, and "iterate: run the 5-minute camera asks"
as the only recommendation.

## Gaps (accepted)
- Calibration is manual: no key detection by vision. A camera that moves needs a new calibration.
- No occlusion, unless the optional skin mask makes it. Notes draw over hands.
- One camera; no lens distortion model (a homography assumes a flat key bed and a pinhole view).
- Latency is measured to the frame the key's brightness changes, which trails the key's real travel by some unknown
  amount.

## Defaults
- The smaller option. Log choices the spec doesn't make in `specs/decisions/real-keys-*.md`: the brightness threshold,
  black-key length, the delay's rounding, and the faster compositing way.
- Never send a frame anywhere. The page makes no network request for the camera picture.
