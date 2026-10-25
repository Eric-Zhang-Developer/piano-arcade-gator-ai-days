---
name: "Highlight reel spike: a take becomes a 15-second broadcast replay video, rendered from the take and saved as WebM"
depends_on: ["experiments", "replay-view", "take-midi", "scenes", "laptop-sound", "duo-tokens"]
owns: ["specs/features/highlight-reel/", "changes/highlight-reel.md", "web/src/app/highlight/", "specs/decisions/highlight-reel-", "spikes/highlight-reel/"]
assignee: "eric"
---

# Highlight reel (spike)

Issue #913, from Eric's overnight wow feeder (relayed by eric-asking-agent-1). Eric: "just build a bunch of cool crap
that has a maximum wow factor ... Some of them can be polished. Some of them can be spikes." This is a prototype spike
(decision 004): it builds on the game's code and mounts as an experiment (#878). It stays out of the main game until
Eric picks it in the Lab.

**The pitch:** after a take, Étude cuts it into a 15-second sports-broadcast replay and saves it as a WebM. The cut
opens cold on the longest PERFECT run, slowed to 0.5× with a speed ramp. It returns to real time for the finish, then
closes on a 1.5 s title card. Everything is rendered from the recorded take, with no new dependency.

## The question
Can the browser turn a recorded take into a 15-second replay WebM that passes the pitch's outside checks? The checks
are below: length, 60 fps, one audio track, sound in sync with the take, and the slow motion showing the best run.
The render must be repeatable, and the stack must be Canvas 2D, `OfflineAudioContext` and `MediaRecorder` only.
- **Yes:** on all three takes in Validation 2, every bar in Validation 2 passes, and two renders of the same take give
  identical frames and identical audio (Validation 2.6).
- **No:** after the time box, a bar still fails on any of the three takes. FINDINGS.md names which bar failed, by how
  much, and why. A likely cause is that `MediaRecorder` can't hold 60 fps or audio sync in real time.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state.

**One known constraint.** The picture and the sound are computed offline from the take: frame n depends only on n,
and the audio is one `OfflineAudioContext` render. But `MediaRecorder` encodes a live stream, so the encode itself
runs in real time, 15 s per reel, paced by an audio clock. Whether that pacing holds 900 frames without drops is part
of the question. The alternative, WebCodecs plus a hand-written WebM muxer, is a finding to report, not a build.

## How it mounts (the experiment contract, #878)
- **Its folder:** `web/src/game/x/highlight-reel/`, plus its one registry line in `web/src/game/x/index.ts`. Both sit
  in experiments' `owns` (`web/src/game/x/`), and the spec lint rejects an overlapping `owns` while experiments is in
  flight, so this spec doesn't list the folder. The `feat(highlight-reel)` PR reaches it through the lane rule, since
  experiments is in the same lane and done before this starts (`depends_on`).
- **Its page:** `/highlight` (`web/src/app/highlight/page.tsx`), a thin client page over the folder. No link to it from
  any screen except the Lab gallery.
- **Registry entry:** group "Wow", line "A take becomes a 15-second broadcast replay video (#913)", URL
  `/highlight?take=last`.
- **On `/play`, only with `?x=highlight-reel` or its Lab toggle:** its `resultsPanel`, passed through the frame's
  plugin, saves the finished take to `sessionStorage` (`pianoArcade.x.highlightReel.last`). It saves the chart as
  played (after every `transformChart`), the take and the results. It also shows a "Highlight reel" link to
  `/highlight?take=last`. With the flag off, none of its code runs on `/play`.
- **Imported, never edited:**
  - core's `makeLayout` and `drawHighway`;
  - replay-view's `highwayAt` and `replaySpan`;
  - `judgeTake` and `noteTimeMs` (`core/judge.ts`);
  - scenes' `botPresses`;
  - laptop-sound's `createSynth`, which gets an `OfflineAudioContext` (a cast at the call, logged; if the synth needs
    something an offline context lacks, log it and stop that path, don't edit laptop-sound);
  - duo-tokens' `drawBrackets`, `drawPanel` and `canvasFonts`.
- **Hit particles are optional.** Use hit-particles only if its layer can run on an explicit clock, so frame n stays
  deterministic. Otherwise leave it out and log it.
- **Nothing else changes:** no edit to `/play`, `layers.ts`, core, or any reused feature.

## What to build
**Takes (`?take=`):**
- `last`: the one saved from `/play`. With none saved, the page says "No take saved yet: showing a scripted take"
  and uses `bot:rank-b` on Twinkle.
- `bot:<name>&song=<id>`: scenes' seeded `botPresses` for that chart, turned into a `Take` and judged with
  `judgeTake`. It's deterministic, so Validation can use it.

**The best run:** the longest stretch of consecutive chart notes, in time order (ties by pitch), all judged
PERFECT. Ties go to the earliest. A take with no PERFECT uses its longest run of hits (PERFECT, GREAT, GOOD). A take
with no hits makes no reel and says so.

**The cut:** a pure `cut(chart, take, results, settings)` returns an edit list. Each segment maps reel time to take
time, and the whole is exactly 900 frames at 60 fps (15.0 s):
1. **Cold open, slow motion:** the best run. Rate 1× ramps to 0.5×, holds at 0.5×, then ramps back to 1×, with eased
   ramps. Its source span stays inside the best run padded by one beat each side. A run too short to fill the segment
   gets more padding; one too long shows its middle.
2. **The finish, real time:** the take's last seconds, up to one beat after the last release. Its source never
   overlaps segment 1's source. If the best run reaches the finish, segment 1 takes the run's earlier part.
3. **Title card:** exactly 90 frames (1.5 s). It shows the song's title and composer, the rank and accuracy from
   `Results`, and the best run's length as "n PERFECT in a row", all read from the take, never typed.

The segment lengths, ramp lengths and easing live in `highlightSettings`, with the worker's starting values logged.

**Picture:** an offscreen 1920×1080 canvas. `drawFrame(n)` is a pure function of n and the edit list: the highway at
that frame's take time via `highwayAt`, plus broadcast overlays in the Duo look. The overlays: a "REPLAY" bug, a
"0.5×" tag while slowed, a lower third with the song, a cut flash between segments, and the title card.

**Sound:** one `OfflineAudioContext` render (48 kHz, stereo, 15.0 s) through `createSynth`. Each take event whose time
falls in a segment's source plays at its warped reel time, with its own velocity. Slow motion stretches timing, not
pitch. All Notes Off sounds at each cut, and the title card adds no new notes.

**Encode:**
- `canvas.captureStream(0)` plus a `MediaStreamAudioDestinationNode` that plays the rendered buffer through a real
  `AudioContext`, into one `MediaRecorder` (WebM, VP8 or VP9 with Opus; the worker logs which).
- Frame n is drawn and `requestFrame()`-ed when the audio clock reaches n/60 s. The page counts frames requested and
  frames late.
- A **Save video** button downloads `<chart id>-highlight.webm`. The page shows a progress bar while it encodes,
  then the video in a `<video>` element.

**Test hook:** `window.__highlightReel = { state, edl, bestRun, expectedOnsetsMs, framesRequested, framesLate, frameHash(n), audioHash, blobBytes }`.
- `expectedOnsetsMs` is the take's event times mapped through the edit list.
- `frameHash(n)` hashes `drawFrame(n)`'s pixels.

## Validation
The bars are the planner's, not measured thresholds, except where the pitch sets them (marked "pitch").

1. `pnpm -C web exec vitest run --passWithNoTests src/game/x/highlight-reel`, on synthetic charts (no notes typed
   from a song):
   - **best run:** the longest PERFECT run, the earliest one on a tie, the fallback to hits, and no reel with no hits;
   - **the cut:** exactly 900 frames, with the title card exactly 90; segment 1's source stays inside the best run ±
     one beat; segment 2's source doesn't overlap segment 1's; the rate is 0.5 in the hold and never below it;
     reel-to-take time is monotonic within a segment;
   - **onsets:** the take's events map to the expected reel times through a hand-built edit list;
   - **the onset detector** that Validation 2 uses (pure, in the folder): on a synthetic signal of clicks at known
     times, every click is found within 1 ms.
2. **Two scripts, one harness** (`web/src/game/x/highlight-reel/reel-check.mjs`). The spike's yes/no bars below can
   fail by design when the answer is "no", and a CI check that fails by design keeps main red forever. So the
   question's bars live outside `web/src/`, where CI doesn't look (planner, 2026-10-25; this replaces the earlier text
   that put every bar in the CI check):
   - `node spikes/highlight-reel/measure.mjs --out <dir>`: every bar below, each labeled PASS or FAIL. It exits 0 once
     it has measured. FINDINGS.md quotes its output.
   - `node web/src/game/x/highlight-reel/verify-highlight.mjs --out <dir>`: the regression check, bars 1, 3, 6 and 7
     only (what works and must keep working), strict. ci-browser's suite picks it up by name.

   Both render three takes:
   - `/highlight?take=bot:rank-b&song=twinkle`;
   - `/highlight?take=bot:sloppy&song=minuet-g`;
   - `/play?song=twinkle&bot=rank-c&x=highlight-reel`, played to the results, then its Highlight reel link (the
     `take=last` path).

   For each, it saves the WebM, takes these measurements and prints `verify-highlight: pass` or each failed bar with
   its number:
   1. **Length (pitch):** 15.0 ± 0.1 s. Chrome's WebM may carry no duration in its header: if ffprobe's
      `format=duration` reads N/A, the script takes the end of the last packet
      (`ffprobe -show_entries packet=pts_time,duration_time`).
   2. **60 fps (pitch):** 900 ± 6 video packets, with a median spacing of 16.7 ± 0.5 ms. It also prints
      `framesRequested` and `framesLate`.
   3. **Tracks (pitch):** exactly one audio stream and one video stream (`ffprobe -show_streams`).
   4. **Sync (pitch):** the script decodes the audio with
      `ffmpeg -i <file> -f f32le -ac 1 -ar 48000 -` and runs the onset detector. Expected onsets within 30 ms of
      each other count as one (chords). At least 90% of expected onsets have a detected onset within 50 ms, and the
      median |error| of those matches is ≤ 10 ms. It prints the median, the p90 and the matched count.
   5. **The slow motion shows the best run (pitch):** the script extracts the frame at segment 1's middle
      (`ffmpeg -ss <t> -frames:v 1 -f rawvideo -pix_fmt rgb24`). That frame's take time, from the edit list, lies
      inside the best run's span. The extracted frame against the page's own `drawFrame` of that frame has a
      PSNR ≥ 30 dB, and against an all-black frame it scores under 20 dB. The PNG goes in `<dir>` for the worker's
      eye.
   6. **Repeatable:** a second render of the first take gives the same `audioHash` and the same `frameHash(n)` for
      every 30th frame. The encoded files' bytes may differ, and that isn't checked.
   7. No console error on any page.

   **ffprobe and ffmpeg:** both are installed on this Mac (`/opt/homebrew/bin/ffprobe`, `/opt/homebrew/bin/ffmpeg`).
   Where they're missing (possibly CI's runner), the script prints `skip: ffprobe missing` for bars 1–5 and runs a
   fallback in the page instead, labeled as the fallback in its output:
   - length from the `<video>` element's duration after seeking to the end;
   - frame count from `requestVideoFrameCallback` over a 1× playback;
   - sync from `decodeAudioData` on the blob, through the same onset detector.

   Bars 6–7 always run. Locally the reel check runs at most twice, under `verify.lock`, with a timeout.
3. **The perf gate** (contract item 4): `node web/src/game/perf-budget/perf.mjs --params x=highlight-reel`, p95 ≤ 6 ms
   at 1920×1080. It covers `/play` with the flag on, where only the results panel is added. Run it locally only under
   `verify.lock`; otherwise the PR says "not run locally; main's scheduled run covers it".
4. **Design pass** (AGENTS.md, Visible changes):
   - invoke `frontend-design` and `design-taste-frontend`;
   - the look loop scores four reel frames at 1920×1080, taken from `drawFrame` (cold open, the 0.5× hold, the finish,
     the title card), plus `/highlight` at 1280×720 and 1920×1080;
   - fix the top three problems, at most three rounds;
   - the scores and our shots go in the PR's Design section, and the shots in
     `specs/features/experiments/shots/highlight-reel/`.
5. **Eric (about 1 minute, not the question):** he watches one reel from the Lab and gives the gallery's verdict:
   kept, cut, or kept with changes. The done note says `not seen by Eric` until he does.

## FINDINGS.md (`web/src/game/x/highlight-reel/FINDINGS.md`)
Per decision 004:
- the question and the measured answer: every bar's number for each of the three takes, as the script printed them;
- frames late, and which codec Chrome picked;
- what worked, what didn't, what to keep;
- whether WebCodecs would beat `MediaRecorder` on the bars that failed;
- **promote**, **iterate** or **kill**.

With no verdict from Eric yet, it says "verdict pending".

## Gaps (accepted)
- The encode takes 15 s of wall time per reel. The page shows progress, and there's no faster path in this spike.
- No upload or share: the file downloads, and nothing is saved to the take store.
- No reel music, crowd sound or commentary: only the take's own notes.
- One cut recipe. No editor, no choice of moments, no vertical (9:16) version.
- Laptop-sound's synth voice, not the DGX or sampled-piano. The reel sounds like the laptop, not the piano.
- MP4 isn't made: Chrome's `MediaRecorder` WebM is what the pitch asks for.

## Defaults
- The smaller option. Log choices the spec doesn't make in `specs/decisions/highlight-reel-*.md`.
- If the frame doesn't pass `resultsPanel` to experiments, `take=last` falls back to the scripted take. Log it and
  tell the planner.
- Our frames only in shots and the PR, never a reference broadcast's.
