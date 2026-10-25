---
name: Golden's autoplay on the DGX sounds like a performance, with pedal, dynamics, legato and a recording in time
depends_on: ["scenes", "laptop-sound", "audio-track", "beat-track", "options-panel", "calibration"]
owns: ["specs/features/golden-demo/", "changes/golden-demo.md", "specs/decisions/golden-demo-", "web/src/game/pedal/", "specs/context/findings.md"]
assignee: "eric-agent-3"
---

# Golden demo

Issue #807. Eric, 2026-10-25: "can we get agent 3 working on turning this play into a proper like demo like rn its
all staccato with no dynamics etc etc its so crrappy". Assignee eric-agent-3, Eric's pick.

**The demo.** Eric plays Golden as an autoplay on the DGX, with the recording playing from the MacBook:
`/play?song=local/golden-hard&bot=perfect&audible=1&demo=1&beat=off` on :3001. Today it sounds like a sequencer. The
check for this feature is whether it sounds like a performance.

**What stays local (decision 003, amended for local play by audio-track).** Golden's charts, recording and pedal data
are Eric's, all rights reserved. They live in `web/public/songs/local/golden-{easy,medium,hard}/`, a folder whose own
`.gitignore` is `*` then `!.gitignore`. The sheet scans are in `video-references/golden-sheet/` in Eric's main
checkout. Only code, tests, synthetic fixtures and decision files are committed. No Golden note, velocity, pedal
time or audio goes into git, a PR body or a test.

## What exists (origin/main b7da78d, measured by eric-agent-3)
- **The bot** is `web/src/game/scenes/index.ts` (scenes, done). `botPresses()` holds every key for
  `min(holdMs = 100 ms, 0.6 × time to the next onset)` (line 83). Every press goes out at `KEYS_VELOCITY` (line 131),
  though `ChartNote.velocity?: number` (1–127) is already in the frozen contract, so dynamics need no contract change.
  It sends only note on/off to the "Portable Grand" output (`out.send([0x90, …])`), and `cancel()` runs on pause,
  quit and songEnd.
- **golden-hard is legato on the chart:** 775 of 808 right-hand notes and 569 of 578 left-hand notes end at the next
  onset in their hand, and the median written length is 488 ms. So the "staccato" is the bot's 100 ms hold, not the
  chart.
- **Two clocks.** The bot sends at `perfOf(chartMs) = zeroPerf + latency + chartMs` (line 127), where `latency` is the
  player's calibration offset. The recording plays at file time `offsetMs + chartMs`, started one `outputLatency`
  early (`web/src/game/audio-track/index.ts`), with no calibration term. Any nonzero calibration splits them by exactly
  that amount. Eric moved Golden's `offsetMs` from 3934 to 3784 by ear, so the piano was about 150 ms late.
- **The recording needs a gesture.** audio-track resumes its AudioContext only at songStart (line 274). In a bot or
  demo run nothing may have clicked first, so the recording can stay silent.
- **The beat plays under the recording** unless `beat=off` (#789, `web/src/game/beat/`).
- **The laptop voice already sustains:** `web/src/game/laptop-sound/synth.ts` handles CC64 and CC123, so pedal works
  on the laptop and on the DGX alike.

## Plan
Under the lane rule, a `feat(golden-demo)` PR may change eric's other features' folders (scenes, audio-track,
options-panel) as long as no other lane's in-flight feature holds them. Parts that fix an existing feature go as that
feature's `fix(<slug>)`. Merge each PR as it lands. Order of value: parts 1–2, then 3–4, then 5, then 6.
1. **`fix(scenes)` (part 5), in progress by eric-agent-3:** the bot holds each note's written duration and cuts it
   only for a same-pitch re-strike. Its PR carries the gap numbers below.
2. **`feat(golden-demo)` (parts 1 and 2), they share the bot's queue:** `web/src/game/pedal/` (sidecar parse and the
   CC64 events), the bot sending CC64 and `note.velocity ?? KEYS_VELOCITY`, and `specs/decisions/golden-demo-dynamics.md`.
   Golden's `pedal.json` files and chart velocities are edited locally, outside git.
3. **`fix(audio-track)` (part 3):** resume on the first pointerdown or keydown.
4. **`fix(beat-track)` (part 4), #789, eric-agent-3's.**
5. **`feat(golden-demo)` (part 6):** one clock rule for the bot's MIDI and the recording, and the "Recording offset"
   row in Options, with the design pass. Then `changes/golden-demo.md`, last.

## Requirements
1. **Pedal.**
   - A sidecar `web/public/songs/local/<id>/pedal.json`, next to `audio.json`: `{ "pedal": [[down, up], …] }`, each
     pair in beats on the chart clock, `down < up`, pairs in order and not overlapping. A missing or invalid file means
     no pedal; an invalid one logs one console warning. Only `local/` songs look for it.
   - The bot's output sends CC64 127 at each down and CC64 0 at each up (`[0xb0, 64, v]`), on the same queue and clock
     as its notes, so a re-pedal at a chord change lands with the new chord. A resume sends only what is still ahead,
     and if the resume time is inside a pair it sends that pair's down first.
   - `cancel()` sends CC64 0, so pause, quit and songEnd always end with the pedal up, even mid-pair.
   - Golden's marks come from the scans' Ped. markings. Where the sheet has none, the rule is per harmony: down just
     after each new left-hand harmony's onset, up just before the next. That rule is an arrangement choice, logged
     dated in `specs/context/findings.md` with which bars use it.
2. **Dynamics.**
   - The bot plays `note.velocity ?? KEYS_VELOCITY`. Charts without velocities sound as today.
   - All three local Golden charts get velocities from the sheet's marks: p, mp, mf, f and the hairpins. The
     mark→velocity mapping, including how a hairpin ramps and what applies before the first mark, goes in
     `specs/decisions/golden-demo-dynamics.md`. Notes and marks come only from the scans, never from memory; a bar
     whose marks can't be read keeps the previous level and is listed in that file.
3. **The recording plays without a click.** audio-track resumes its AudioContext on the first `pointerdown` or
   `keydown` on the page, not only at songStart. A context that is already running is left alone.
4. **No beat under a recording (#789).** beat-track is off by default when an `audio.json` sidecar loads for the song.
   `?beat=<style>` still forces it on, and `?beat=off` stays off.
5. **"Staccato."** Measure first, on the chart and from the bot: per hand, the gap from each note's end to the next
   note's start, and whether the bot releases before the written end. Fix it at the cause (the 100 ms hold); pedal may
   cover the rest. The numbers (counts and medians, no notes) go in the PR.
6. **Recording offset.**
   - **One rule:** the judge still reads each bot press at `perfOf` (calibrated), but MIDI out is sent on the chart's
     clock, `zeroPerf + chartMs`, the clock the recording follows. Scheduled sends use Web MIDI's timestamp so a
     positive calibration doesn't make them late, and a negative one doesn't make them early. A unit test covers
     calibration 0, positive and negative.
   - A "Recording offset" row in Options, ± ms, saved per browser (localStorage, the way "Recording volume" is), shown
     only when the song has a recording. It shifts the recording only: file time `offsetMs + recordingOffset + chartMs`.
   - After the rule lands, Golden's `offsetMs` may need to go back toward 3934. That is Eric's local edit, by ear.

## Validation
- vitest: the pedal sidecar parse (valid, missing, invalid, unordered); CC64 down and up in time order with the notes;
  pedal-up on pause, quit and songEnd, also mid-pair; resume inside a pair; the bot's velocity from the chart; the
  first-gesture resume; the beat default with and without a sidecar and with `?beat=<style>`; the offset rule at
  calibration 0, positive and negative. Fixtures are synthetic charts, never Golden.
- The existing browser checks stay green. They are covered by main's scheduled full run: no local `verify.py` or
  `node verify-*.mjs` (AGENTS.md, Visible changes). Done notes say "not verified locally; covered by main's scheduled
  full run".
- Options gets the design pass for its new row (AGENTS.md, Visible changes), with the Design section in that PR.
- **The ready check is Eric listening on the DGX** with the demo URL above, and saying whether it sounds like a
  performance. No headless claim about sound. Until he does, the done note's How to check says "not verified: Eric's
  DGX listen".

## Defaults
- A Golden bar the scans don't make clear: leave it as the chart has it and list it in the decision file.
- Under the per-harmony rule, a pair that would hold through a rest of a bar or more lifts at the rest.
- Anything else the spec doesn't say: the smaller, reversible choice, logged in `specs/decisions/golden-demo-<topic>.md`.
