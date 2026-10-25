---
name: "Conductor spike: wave a hand at the laptop camera and the DGX plays the song at your tempo"
depends_on: ["experiments", "piano-out", "laptop-sound", "golden-demo", "demo-performance", "core-loop"]
owns: ["specs/features/conductor/", "changes/conductor.md", "specs/decisions/conductor-", "web/src/game/x/conductor/", "web/src/app/conduct/", "spikes/conductor/"]
assignee: "eric"
---

# Conductor (spike)

Issue #985, from Eric's overnight wow feeder (relayed by eric-planning-agent). Eric: "just build a bunch of cool crap
that has a maximum wow factor ... Some of them can be polished. Some of them can be spikes." This is a prototype spike
(decision 004), mounted as an experiment (#878). It stays out of the main game until Eric picks it.

**The pitch:** someone who can't play waves a hand at the laptop's front camera, and the DGX plays Moonlight at their
tempo. It holds when they hold and swells when they swing big.
- **Why:** most booth visitors can't play, and the mascot carries a conductor's baton
  (`specs/context/raw/piano-arcade-writeup.md`, line 189).
- **The name:** idea 60 in `specs/context/naming.md` is "Conductor: you lead, the song follows".
- **Not finger-cam-spike (#339):** that one asks which finger pressed a key, from an overhead camera.

## The question
Can in-browser hand tracking on the laptop's front camera find conducting beats reliably enough, and can a
phase-locked clock follow them closely enough, that a non-player leads the DGX through a song?
- **Yes:**
  - beat detection reaches precision and recall ≥ 90% on the labeled clip (Validation b);
  - beat to note-on is a median of ≤ 80 ms (Validation c);
  - the clock tests pass (Validation a).
- **No:** after the time box, either detection or latency misses its bar. FINDINGS.md says by how much, and whether
  the camera's frame rate or the tracker is the limit.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state. Without Eric's clip it says
  "clip pending" and reports (a) and the build's state.

Every bar here is the planner's, not a measured threshold.

## The dependency decision
**What freezes `web/package.json`:**
- `.agents/config.toml` lists it, with `web/pnpm-lock.yaml`, under `[ownership].frozen`;
- `specs/tech-stack.md` (line 3) allows new dependencies only through a `contract:` PR;
- decision 004 (principle 4) allows no new `web/` dependency without a spec.

So `@mediapipe/tasks-vision` could go in through a `contract:` PR. **This spike doesn't do that.** It loads the
library at runtime from a pinned CDN URL instead, with nothing committed:
- **Library:** `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs`. 1.1.1 is npm's
  `latest` (published 2026-10-14, Apache-2.0). Its `vision.d.ts` declares `HandLandmarker.createFromOptions`,
  `detectForVideo` and `FilesetResolver.forVisionTasks`.
- **WASM:** `FilesetResolver.forVisionTasks` pointed at the same version's `wasm/` folder on jsDelivr (about 13.5 MB).
- **Model:** `hand_landmarker.task` (float16, version 1), from the URL MediaPipe's Hand Landmarker guide gives. The
  planner checked `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`:
  it answers 200, 7,819,105 bytes. The worker confirms it against the guide and logs it.
- **The import** is a dynamic `import()` that the bundler is told to leave alone (the worker logs the comment or
  setting that does it).

**Why the CDN:**
- An experiment is pruned by deleting its folder (experiments contract, item 7). A `package.json` entry would outlive
  the prune, and a lockfile change would touch every worker's install.
- The WASM and model are fetched at runtime or committed either way.
- finger-cam-spike set this precedent (an exact-version CDN URL).

**The counterargument:** it needs the network, so a booth with bad Wi-Fi breaks it. Promotion would vendor the
library, WASM and model through a `contract:` PR.

## How it mounts
- **`/conduct`** (`web/src/app/conduct/page.tsx`, a client page over `web/src/game/x/conductor/`). It owns its own
  clock, because the experiments frame passes /play's hooks (`transformChart`, `wrapInput`, `draw`, `onEvent`,
  panels) but none of them can drive the take's clock.
- **Registry entry** (`web/src/game/x/index.ts`): group "Wow", line "Wave a hand at the camera and the piano follows
  your tempo (#985)", href `/conduct?song=moonlight-1`.
- **On `/play` with `?x=conductor`:** its plugin adds only a start-panel link, "Conduct this song", to
  `/conduct?song=<id>`. So `/play?song=moonlight-1&x=conductor` leads there. Nothing else changes on `/play`.
- **Imported, never edited:**
  - core's `makeLayout` and `drawHighway`;
  - `noteTimeMs` and `msPerBeat`;
  - piano-out's `allNotesOff` and `Message`;
  - `parsePedal` and `loadPedal` (`web/src/game/pedal/`);
  - laptop-sound's "Portable Grand", which sounds when no DGX is plugged in.

## What to build
1. **Hand tracking:** Hand Landmarker in `VIDEO` mode on the front camera, one hand, `detectForVideo` per frame, timed
   by `requestVideoFrameCallback`'s frame times.
   - **Privacy:**
     - frames never leave the browser, and nothing is recorded or stored;
     - the camera is asked for only on `/conduct`, after a click on "Start camera";
     - a visible "camera on" dot shows while it runs;
     - Stop and `pagehide` end the stream's tracks.
2. **Beat detection** (pure, `beats.ts`):
   - a beat is the first low point of the wrist's height after a fast downward stroke above a threshold (speed in
     hand sizes per second, so distance from the camera doesn't matter);
   - beats are at least 250 ms apart;
   - two preparatory beats set the start tempo, and the song starts on the next one.
3. **Clock** (pure, `clock.ts`): a phase-locked loop on chart beats.
   - Each beat pulls the rate toward the conductor's interval and corrects the phase over about half a beat.
   - No jumps, and never backward: the position only moves forward, and its rate stays above 0.
   - The rate, corrections included, is clamped to 0.5–1.6× the chart's bpm. A correction that needs more is spread
     over more beats.
   - One conducted beat is one chart beat, unless a per-song `beatUnit` in `conductorSettings` says otherwise
     (logged for each song).
4. **Holds and cutoffs:**
   - a hand still for 2 beats (at the current tempo) holds a fermata: playback waits and the sustain stays down;
   - the next downbeat resumes;
   - a fist (from the landmarks: fingertips folded to the palm) cuts off: All Notes Off, pedal up, and the clock
     holds;
   - two preparatory beats restart from there.
5. **Dynamics:** stroke size divided by hand size maps to a factor on each note's own chart `velocity`, so the score's
   shape stays and a big swing swells it. Clamped to 1–127, with the mapping logged.
6. **Note scheduling:** through the "Portable Grand" output (the DGX, or laptop-sound's virtual one), with
   `MIDIOutput.send(data, timestamp)` and a lookahead scheduler ("a tale of two clocks"):
   - a short timer wakes and schedules every note-on, note-off and pedal event (`pedal.json`, by beat) that falls
     inside the next lookahead window of conducted time;
   - the window is short (about 100 ms, logged), so a tempo change or a hold takes effect within it;
   - notes hold their written length in conducted time, as the bot does since golden-demo.
7. **On screen:**
   - the highway follows the conducted clock (`drawHighway` at the conducted chart time);
   - the hit line pulses on each beat;
   - a camera thumbnail shows the hand with a baton trail (the wrist's last second);
   - a tempo readout shows BPM and the rate against the chart;
   - under reduced motion there's no trail, and the pulse becomes a tint.
8. **Songs:**
   - `moonlight-1` (60 BPM, 4/4), `fur-elise` (66, 3/8) and `minute-waltz` (116, 3/4), the fast one. All three
     have `pedal.json` and a velocity on every note on main (demo-performance);
   - `?song=` picks one, and the page links all three;
   - Golden (`local/golden-hard`) is local and optional: listed only when its chart loads.
9. **The log, for (c):** every beat (camera frame time, interval, stroke size) and every scheduled note-on (send
   timestamp, chart beat), in memory, with a Copy button. Nothing is saved.
10. **Clip mode, for (b):** `/conduct?clip=1` takes a local video file through a file input, instead of the camera,
    and runs the same detector at the video's frame times. Its beat list can be copied too.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Clock unit tests** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/conductor`), with synthetic beats:
- 60 → 90 BPM settles within 2 beats. "Settled" means a rate within 5% of 90 and a phase error under 30 ms (the
  planner's reading of "settles").
- It never goes backward: the position is monotonic over a jittery beat list, including a beat far early and one far
  late.
- A hold freezes the position and resumes on the next downbeat, without a jump.
- The clamp holds: beats at 20 and 300 BPM keep the rate within 0.5–1.6× the chart.

Also tested:
- the detector on synthetic wrist tracks: strokes at known times are found, beats under 250 ms apart are dropped, and
  a slow drift makes no beat;
- the fist test on synthetic landmarks;
- the scheduler: given a clock and a chart, it sends each note once, inside the window, never in the past.

**(b) Beat detection, precision and recall ≥ 90%:**
- **The clip:** Eric records about 2 minutes of conducting to a click at 60, 90 and 120 BPM, a fermata and a fist.
  He uses `spikes/conductor/record.html`, a local page opened on purpose and never linked. The clip stays in
  `spikes/conductor/local/`, self-ignored (`*`, `!.gitignore`), as in snap-score.
- **The labels:** the worker labels the beats by hand, stepping the clip frame by frame and marking each stroke's
  lowest point, in `spikes/conductor/local/labels.json`, local too. The click times are a cross-check, and the
  worker counts where the labels differ from them.
- **The run:** clip mode on the worker's dev server, in the in-app browser.
  `node spikes/conductor/score.mjs <labels> <detected>` prints precision, recall and the median timing error, with a
  match tolerance of ±100 ms.
- This is a conductor-only page, so there's no local headless suite.

**(c) Beat to note-on, median ≤ 80 ms**, from the page's log:
- for each beat that falls on a chart beat with a note, |note-on send timestamp − beat frame time|;
- from the clip run through laptop-sound's virtual output, and from Eric's try at the DGX;
- `score.mjs --latency <log>` prints the median and p90.

**(d) The design pass** (AGENTS.md, Visible changes):
- invoke `frontend-design` and `design-taste-frontend`;
- shots of `/conduct` at 1280×720 and 1920×1080, plus reduced motion, from your own dev server in the in-app browser
  (one slot, `devserver.1` to `.4`);
- fix the top three problems, at most three rounds;
- scores and our shots go in the PR's Design section, and the shots in `specs/features/experiments/shots/conductor/`.
  No shot shows a person's face: use clip mode with a hand-only clip, or the camera covered.

**The perf gate** (contract item 4): `perf.mjs --params x=conductor` on `/play`, where only the link is added. It runs
locally only under `verify.lock`; otherwise "not run locally; main's scheduled run covers it".

**(e) Eric's 2-minute try at the DGX** (low rank, not the question): `/conduct?song=moonlight-1`. Does it follow, hold
and swell? Mark it in the done note (`not tried by Eric` until he does).

**Eric's URLs:**
- Lab → Conductor;
- `localhost:3001/play?song=moonlight-1&x=conductor` (then "Conduct this song");
- `localhost:3001/conduct?song=moonlight-1`.

## FINDINGS.md (`spikes/conductor/FINDINGS.md`)
Per decision 004:
- the question;
- the measured answer: (a)'s results, (b)'s precision, recall and timing error, (c)'s median and p90, and the
  camera's measured frame rate;
- what worked, what didn't, what to keep;
- whether the CDN load was a problem;
- **promote**, **iterate** or **kill**.

With no clip yet: "clip pending", and "iterate: record the clip" as the only recommendation.

## Gaps (accepted)
- It needs the network, for the library, the WASM and the model.
- One hand. No beat patterns (it counts strokes, not 4/4 shapes), no left-hand cueing, no tempo from the score's own
  rubato.
- No take is judged, recorded or saved. The page is a performance, not a game.
- Latency is measured to the MIDI send timestamp, not to sound out of the DGX.
- Lighting and background clutter are untested beyond Eric's clip.

## Defaults
- The smaller option. Log choices the spec doesn't make in `specs/decisions/conductor-*.md`: thresholds, the
  lookahead, the velocity map and each song's `beatUnit`.
- If version 1.1.1 lacks something the build needs, try 0.10.35 (the last 0.10 release), and log which version
  worked and why.
- Never send a frame, a landmark or Eric's email anywhere. The only network requests are for the pinned library, WASM and model.
