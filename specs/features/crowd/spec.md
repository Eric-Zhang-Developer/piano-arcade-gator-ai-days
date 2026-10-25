---
name: "Crowd Mode: the room claps along, and the laptop mic scores the room's timing apart from the player's"
depends_on: ["experiments", "core-loop", "hud", "laptop-sound", "duo-tokens"]
owns: ["specs/features/crowd/", "changes/crowd.md", "specs/decisions/crowd-", "web/src/game/x/crowd/"]
assignee: "eric"
---

# Crowd Mode

Issue #1345, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878. It
lands on main off by default and stays out of the main game until Eric picks it in the Lab.

**Why `extras`, not `spikes`:**
- The spikes milestone allows no new spike work after Sun Oct 25, 12:00 PM ET (`specs/milestones.toml`'s spikes
  comment).
- harmony-map (#1301) set the precedent: an extras experiment whose outside checks are its Validation, so it ships
  only if they pass.

**The pitch:** while Eric plays the DGX, the room claps along. The laptop mic detects the claps over the piano, and the
screen shows the room's timing.

**The room's score is separate from the player's.** It never changes a judgment, the combo, the score or a take (the
rule #506 is about: AI around the playing loop, never in it).

## How it mounts
- **The flag:** `?x=crowd` on `/play`, the experiments frame's flag (`flagged()` in `web/src/game/x/index.ts` reads
  `x`, comma-separated). It's one registry line, with `href: "/play?song=twinkle&x=crowd"`.
- **The registry file is held:** `web/src/game/x/index.ts` is held by #1309 (`feat(harmony-map)`) when this spec was
  written. #1288, named in the pitch, has merged. Re-check; whichever lands second rebases its one line.
- **The mic:** opened only after a press on the plugin's start panel, through `getUserMedia({ audio })`. The
  constraints are logged: echo cancellation, noise suppression and AGC are set for raw onsets, as
  `x/speaking-piano/Speak.tsx` sets its own.
  - A **mic-on dot** shows whenever the stream is live.
  - The stream stops on songEnd, quit, leaving `/play` and `pagehide`.
- **Note-on times** come from `wrapInput`'s note events, mapped to the AudioContext clock and posted to the worklet for
  the optional raised threshold.
- **The HUD** files are read only: `hudLayout` is imported for placement, and `web/src/game/hud/index.ts` is held by
  #713 and #600.

## The build
1. **Research first,** by the worker (a research subagent is fine):
   - what tells a clap's onset from a piano's in a laptop mic: band energy, flatness, attack time and decay, with
     sources read and cited;
   - the findings go in `specs/decisions/crowd-onsets.md`, and the detector's first design follows them.
2. **The detector,** an AudioWorklet in `x/crowd/`, over a pure DSP module that vitest runs offline:
   - high-band (2–8 kHz) spectral flux onsets, gated by spectral flatness;
   - optionally a threshold raised (never blanked) within about ±30 ms of a MIDI note-on;
   - **every threshold is a named setting** in one `crowdSettings` object, chosen by the sweep in Validation (a), with
     the sweep's table in the decision file.
3. **Scoring:**
   - claps are placed on the chart's beat grid (`bpm`, `beatsPerBar`);
   - the detector tells backbeat from every beat (the grid with the higher on-beat share over the take so far, the rule
     logged);
   - **on beat** means within ±60 ms of the chosen grid;
   - each clap's signed error is kept for the spark.
4. **The screen:**
   - a slim CROWD meter beside the HUD band (the room's running on-beat share), in the Duo kit;
   - a spark on the hit line for each clap, placed left when early and right when late, by its error;
   - a results line through `resultsPanel`: "ROOM <n>% ON BEAT · <k> claps";
   - **reduced motion:** no sparks and no meter motion, just the number.
5. **Privacy:**
   - the mic audio is analyzed in memory and never stored, recorded or sent;
   - only onset times and counts leave the worklet;
   - a test asserts that no network request (`fetch`, `XMLHttpRequest`, `sendBeacon`, WebSocket) carries audio or
     onset data;
   - no take is changed or saved by this experiment.

## The planner's decisions
1. **No downloads.**
   - The pitch suggests freesound CC0 clap samples, but that's a download and needs Eric's yes.
   - The default is **synthesized claps**: shaped noise bursts with a clap-like envelope and band. The generator is
     committed and its parameters are named in one object.
   - The piano bed is the laptop voice (`laptop-sound`), rendered locally from a library chart (twinkle). The method is
     logged: an `OfflineAudioContext` in the in-app browser, or a node port of the voice's synthesis.
   - A DGX capture is Eric's part, not a fixture.
2. **Fixtures:**
   - short WAVs in `web/src/game/x/crowd/fixtures/`, kept out of git by a committed `.gitignore` there (`*` and
     `!.gitignore`, as `songs/local/` does);
   - written by a committed script, never committed themselves, and kept small (a few seconds each), since disk is
     tight;
   - vitest builds the same mixes in memory from the same generator, so CI needs no WAV.
3. **Validation is outside checks, measured by code** (below).
4. **If (a) fails at −6 dB after three real attempts,** the worker writes a findings note in
   `specs/decisions/crowd-findings.md` and files a `blocked` issue, rather than loosening the bar. The experiment
   doesn't ship.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`, at most three rounds, and fix the top three problems each round.
- The PR's Design section has the skills invoked, the scores, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds. These are outside checks: the experiment ships only if (a) and
(b) pass.

**(a) Detection on known-time mixes** (`pnpm -C web exec vitest run src/game/x/crowd`):
- synthesized claps at known times on twinkle's beat grid, with seeded jitter, over the laptop-voice piano bed;
- three levels: 0, −6 and −12 dB clap-to-piano. The level measure is named and logged (for example each clap's RMS
  over its window against the bed's RMS);
- a threshold sweep over `crowdSettings`;
- per level: precision, recall and median |timing error|;
- **pass:** at −6 dB, precision and recall of 90% or more, and a median |error| of 15 ms or less;
- all three levels are reported, whatever they show.

Unit tests also cover:
- the beat-grid scoring: the ±60 ms bound, and backbeat vs every-beat picked right on fixtures of each;
- the raised threshold near a note-on never blanks a clap;
- the room's score never reaches the judge, the HUD's score or a take;
- the privacy assertion.

**(b) CPU:**
- the worklet's work time per 128-sample block is under 30% of the block's budget (128 / sampleRate), measured with
  timing around `process()`;
- 3 runs with spread, on this Mac in the in-app browser;
- if the worklet scope has no timer, the same `process()` runs offline per block, and the PR says which was measured.

**(c) The design pass:** taste v2 at 1280×720 and 1920×1080 with the meter, the sparks and the results line, plus
reduced motion.

**(d) Eric** (the morning page, ranked mid): he plays Twinkle on the DGX for 30 s while one person claps, at
`/play?song=twinkle&x=crowd`, and compares the meter with what he heard. The done note says `not heard by Eric` until
he does.

Browser checks: not verified locally; covered by main's scheduled full run.

## Gaps (accepted)
- Real claps, a real room and the DGX's acoustic sound are tested only by Eric's listen (d). The fixtures are
  synthesized.
- One laptop mic. A room far from it, or very loud, is out of scope.

## Defaults
- **In `extras`,** at the end.
- Log any choice this spec doesn't make in `specs/decisions/crowd-*.md`: the mic constraints, the window and hop, the
  grid-pick rule, the meter's smoothing and the spark's scale.
- The smaller option; no new dependency, and no downloads.
