---
name: "The Record Waits for You: the real recording time-stretches to follow the player and freezes when they stop"
depends_on: ["experiments", "score-follow-spike", "audio-track", "wait-mode", "flow-mode", "play-modes", "duo-tokens"]
owns: ["specs/features/record-follows/", "changes/record-follows.md", "specs/decisions/record-follows-", "web/src/game/x/record-follows/"]
assignee: "eric"
---

# The Record Waits for You

Issue #1261, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878. It
lands on main off by default and stays out of the main game until Eric picks it in the Lab.

**The pitch:**
- the real recording time-stretches, with pitch preserved, to follow the player;
- it freezes when they stop (Learn) and resumes on the next correct note;
- it builds on score-follow's phase and tempo estimator (#927, the spike's second box) and audio-track's recording
  playback.

**Lineage:** Antescofo and SmartMusic. The done note cites each by URL and quotes nothing from memory.

## Two hard limits
1. **No new dependency.**
   - `web/package.json` is frozen (`.agents/config.toml`), so the stretch engine is hand-written in this folder: a
     phase vocoder with phase locking, the Laroche–Dolson method, cited by the worker from a source they read, in an
     AudioWorklet.
   - No npm or wasm library (Signalsmith or any other), and no GPL code. This spec opens no `contract:` PR to add one.
2. **No download without Eric's yes.**
   - **Golden's recording stays local** (decision 003). It's `web/public/songs/local/golden-hard/golden.mp3`, read
     through that folder's `audio.json` (`{ "src", "offsetMs" }`; golden-easy and golden-medium point at the same
     file). `songs/local/.gitignore` is `*`, so nothing there is committed.
   - **The committed, tested input is a synthetic recording** rendered from a library chart: moonlight-1 through a
     simple additive piano voice (a few decaying partials per note), on a known tempo curve.
     - It's rendered in code at test time and at page load, as audio-track's fixture decision did
       (`specs/decisions/audio-track-fixture.md`, option B).
     - No audio binary is committed, and the true beat map is known exactly, so checks (a)–(c) are reproducible with
       no download.
   - **The worker files a `needs-human` issue** asking Eric to approve one named CC0 or public-domain recording of a
     library piece: its source URL, license, size and length, as #966 did for samples. Downloading and committing it,
     with its `CREDITS.md` line through a `docs:` PR, waits on his yes.

## How it mounts
- **The plugin:** `?x=record-follows`, the frame's plugin from `web/src/game/x/record-follows/`, plus one registry line in
  `web/src/game/x/index.ts`.
- **It only plays in Learn (`mode=wait`) and Flow (`mode=flow`).** audio-track already plays nothing there
  (`audio-track/index.ts` `skipReason`: "the record can't"), so the two never play at once. In Perform, audio-track
  plays as today, and this experiment stays silent and says so on its start panel.
- **The source:**
  - a local song's `audio.json`, through audio-track's `parseSidecar`, decoded with `decodeAudioData`;
  - or the synthetic recording with `&record=synthetic`, which is the demo's default when no sidecar exists.
- **The estimator:** `kalmanFollower` (`score-follow/follow.ts`), fed the player's correct onsets from `onEvent`.
- **The scripted players** ("drift", "drift+jitter", seed 519) live inside `score-follow/follow.test.ts` today.
  Lift them into an exported module in `score-follow/` under the lane rule (score-follow-spike is done, and no open
  PR touched `score-follow/` when this spec was written; re-check), or import nothing and say why.
- **The highway's clock** is the mode's: wait mode holds at each note, and the flow judge follows the player. A plugin
  has no hook to set it (`app/play/page.tsx` owns the clock, held by #600). So:
  - the record follows the player's estimate;
  - the record-to-highway gap is measured from the frame's time each beat and logged;
  - running the highway on the record's mapped clock is named in the Gaps as a follow-up, not done here.

## The build
1. **The beat map:** recording time to chart beats.
   - Detect onsets in the decoded audio (spectral flux, its parameters logged).
   - Align them to the chart's onsets by DTW, on inter-onset ratios, so tempo drift lives in the map and not in one
     `offsetMs`.
   - composers-hands' `dtw` aligns pitch sequences. The worker reuses it only if it fits onsets, and says which.
   - `audio.json`'s `offsetMs` seeds the alignment's start. The map is a monotonic piecewise-linear function, cached
     per take.
2. **The stretch:**
   - a phase vocoder with phase locking (peak-locked, after Laroche–Dolson) in an AudioWorklet, over 0.5–1.5×, with
     pitch preserved;
   - the DSP is a pure module that the worklet wraps, so vitest runs the same code offline;
   - log the parameters: window, hop, peak picking and transient handling;
   - the worklet loads from this folder (a `new URL(..., import.meta.url)` asset or a Blob URL, the worker's pick,
     logged).
3. **The follow loop,** each block:
   - steer the ratio so the record's mapped beat converges on the estimator's predicted player beat;
   - at most about 3% rate change per beat, clamped to 0.5–1.5×;
   - it locks to 1.0 when the player is steady (the threshold logged).
4. **A stop (Learn):**
   - when the clock holds at a note, crossfade into a spectral freeze (the last frame's magnitudes with advancing
     phase);
   - on the next correct note, resume from that note's mapped position with a short crossfade;
   - **Flow** has no freeze: it only follows the tempo.
5. **The screen:**
   - a kit chip (`kitChip`), "FOLLOWING · 0.82×", the ratio to two decimals;
   - "HELD" while frozen;
   - the trim is `audio.json`'s `offsetMs`. There's no on-screen offset control today; the pitch's "existing
     recording-offset control" doesn't exist, so the sidecar is the trim, logged;
   - under reduced motion, the chip doesn't animate.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`, at most three rounds, and fix the top three problems each round.
- The PR's Design section has the skills invoked, the scores, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Following, offline** (`pnpm -C web exec vitest run src/game/x/record-follows src/game/score-follow`):
- score-follow's scripted "drift+jitter" player (seed 519) plays moonlight-1 against the synthetic recording;
- the record-vs-player beat error, converted to ms at the chart's bpm, has a median of 40 ms or less and a p95 of
  80 ms or less;
- the table is reported beside score-follow's own numbers (its done note: Twinkle 15/63, Für Elise 15/33, second
  box).

**(b) Smoothness** (a unit test on a synthetic map):
- the largest per-beat rate change is about 3% or less;
- no output sample exceeds ±1.0;
- after a hold, playback restarts within one beat of the mapped position of the note that resumed it;
- with the pitch preserved, the stretched synthetic tone's fundamental stays within a few cents (the tolerance
  logged).

**(c) CPU:**
- the worklet's render time per 128-sample block stays under 30% of the block's budget (128 / sampleRate), on this Mac,
  3 runs with spread;
- if the worklet scope offers no timer, the same `process()` runs offline under node per block, and the PR says which
  was measured.

**(d) The design pass:** taste v2 at 1280×720 and 1920×1080 on `/play` with the chip following and held, plus
reduced motion.

**(e) Eric** (the morning page, ranked mid):
- at `/play?song=local/golden-hard&mode=wait&x=record-follows`, play Golden badly for 1 minute and listen for warble;
- plus the `needs-human` recording approval.

The done note says `not heard by Eric` until he does.

Browser checks: not verified locally; covered by main's scheduled full run.

## Gaps (accepted)
- The highway runs on the mode's clock, not the record's mapped clock, until a clock hook in `/play` exists.
- The demo's sound is synthetic until Eric approves a real recording. Golden is local to his machine.
- A phase vocoder warbles on dense transients at extreme ratios. That's what (e) listens for.

## Defaults
- **In `extras`,** at the end, after results-polish.
- Log any choice this spec doesn't make in `specs/decisions/record-follows-*.md`: the onset detector, the DTW cost,
  the vocoder parameters, the steering gain, the lock threshold, the freeze and resume crossfades, and the worklet's
  loading.
- The smaller option; no new dependency, and no downloads.
