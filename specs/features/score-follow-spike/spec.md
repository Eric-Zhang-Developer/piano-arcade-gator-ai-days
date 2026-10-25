---
name: "Score-follow spike: a bass-and-drums band that keeps your tempo in Flow, instead of stopping at every note"
depends_on: ["flow-mode", "beat-track", "laptop-sound"]
owns: ["specs/features/score-follow-spike/", "changes/score-follow-spike.md", "web/src/game/score-follow/", "spikes/score-follow/", "specs/decisions/score-follow-spike-"]
assignee: "eric"
---

# Score follow (spike)

Issue #519. Eric, 2026-10-25, on spikes: "We have a lot of agent hours ... Treat it as near-infinite. But the problem
is the humans." So this spike's answer is measured by code, and Eric's part is a 5-minute listen. A prototype spike
on the game's code (decision 004): one question, findings at the end.

Flow mode (`web/src/game/flow-mode/`, done) already follows your tempo, but its clock eases to a stop before every
note you haven't played. That's right for the highway and wrong for a band: anything scheduled on that clock slows
to a crawl before each of your notes. So the beat is off in Flow (`beatOn` in `web/src/game/beat/index.ts`), and
flow-mode's spec leaves "the whole band following you" to this issue.

## The question
Does a band clock that predicts your next note, rather than waiting for it, keep a bass-and-drums band within the
GREAT window (50 ms) of a player whose tempo drifts?
- **Yes:** on Twinkle and Für Elise (committed charts), for the scripted "drift with jitter" player below, the band's
  asynchrony is median ≤ 25 ms and p95 ≤ 50 ms (the PERFECT and GREAT bounds), and both numbers beat the baseline
  (the same band scheduled on the flow clock itself).
- **No:** either song misses either bound, or the baseline does as well. FINDINGS.md says which player and which
  number failed.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state. Start by 09:00 ET: no new spike
  work after Sun 2026-10-25 12:00 ET (the `spikes` milestone).

The bounds are the planner's bar, borrowed from the mission's judging windows; nobody has measured what a listener
tolerates from a band. Eric's listen checks that.

## The band
Generated from the chart at load, so it's our own work and no note comes from memory:
- **Bass**, channel 2, GM program 33 (Acoustic Bass): each bar's first chart note two octaves down, held for the
  bar. That's backing-track's recipe for its Twinkle fixture (`specs/features/backing-track/spec.md`, Songs).
- **Drums**, channel 10: beat-track's default (kick 36 on each bar's beat 1, closed hi-hat 42 on every beat), with
  `beatSettings`' velocities imported from `web/src/game/beat/`.
- **Never channel 1**: the player's keys, piano-voice and hand-mode use it.

## The follower (`web/src/game/score-follow/follow.ts`, pure)
- The band has its own clock: `beatAt(wallMs)` from an anchor (beat, wall time) and a tempo.
- **Start:** at songStart the tempo is the chart's bpm × flow's starting rate.
- **On each played onset** of the judged hand (its first hit, at the press's wall time): the tempo becomes the mean
  of the last 4 onsets' chart-beats ÷ wall-ms, clamped to 0.5–1.3 of the chart's (`flowSettings.tempoOnsets`,
  `minRate`, `maxRate`, imported). The phase error is corrected over the next beat, never as a jump.
- **When you stop:** the band plays on until it's `waitBeats` (0.5, a named setting) past the next unplayed onset,
  then goes silent there and resumes from that onset, at the last tempo, when you play it.
- **The baseline:** the same band events, each sent when the flow clock's `now()` passes its beat. Driven through
  flow-mode's own `flowClock` and judge, as flow-mode's tests do. Not reimplemented.

## How it mounts
- A `GamePlugin` in `web/src/game/score-follow/index.ts`, one line in `layers.ts` (an open path). It does anything
  only with `?mode=flow&band=follow`. Every other URL sends nothing, so it's off the demo path until a spec promotes
  it. No change to `/play`, flow-mode or beat-track.
- **Press times:** `wrapInput` records each "on" event's `timeMs` by pitch. A `noteHit` takes the latest press of its
  pitch as that onset's wall time, and `transformChart` gives the chart for the note's beat.
- **Sending:** to the output named "Portable Grand" (laptop-sound makes one when no piano is connected), with
  `MIDIOutput.send(data, timestamp)` and a 300 ms lookahead filled on each `draw`, as beat-track does. Never timers.
- **Silence:** CC 123 and CC 64 = 0 on channels 2 and 10 on `pause`, `quit`, `songEnd` and `pagehide`.
- `?band=hold` plays the baseline in the browser, for Eric's A/B.

## The measurement (`web/src/game/score-follow/follow.test.ts`)
Scripted players (a function from the chart to timed presses in wall time), on the committed `twinkle` and
`fur-elise` charts read from disk:
1. **steady:** every onset at 80% tempo;
2. **drift:** tempo moving linearly from 70% to 120% across the song;
3. **drift with jitter:** the drift, plus each press shifted by a seeded uniform ±30 ms (the seed is in the test);
4. **a stop:** steady 80%, with one 3-beat stop mid-song.

For each player and both clocks: the asynchrony at every band event that falls on a beat where the player has an
onset (band send time minus the press time): median, p95 and max |ms|; the band's inter-beat spread (stdev ÷ mean of
the hi-hat intervals); and, for the stop, how many band events sound past the unplayed onset. The test prints one
table and asserts only the plumbing (no channel-1 message, every note-on has its note-off, silence on stop), so a
"no" still runs green. The table goes into FINDINGS.md as printed.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/score-follow`: the plumbing above, plus "without
   `band=follow` the plugin sends nothing".
2. `web/src/game/score-follow/verify-follow.mjs --out <dir>`: `/play?song=twinkle&mode=flow&band=follow&midi=sim&input=test&stage=off`,
   pressing with `pressNow` at 80% tempo. `?midi=sim` records what's sent (the pattern of
   `hand-mode/verify-hands.mjs`). Pass: band notes on channels 2 and 10 only, median asynchrony within 50 ms of the
   presses, and CC 123 on both after Esc → Quit. ci-browser's suite picks it up by name; locally, at most once, under
   the verify lock (the interim load rule).
3. **On the DGX (Eric, about 5 minutes):** Twinkle in Flow, `band=follow` then `band=hold`, once steady and once
   speeding up. One line each: does the band play with you, and which one is better? If he hasn't by the time box,
   FINDINGS.md says "listen pending".

## FINDINGS.md (`spikes/score-follow/FINDINGS.md`)
Per decision 004: the question, the measured table, what worked, what didn't, what to keep, and **promote**,
**iterate** or **kill**. Promote needs the numbers' yes and Eric's listen; numbers' yes with the listen pending is
"iterate: Eric's listen". Then `changes/score-follow-spike.md` last.

## Gaps (accepted)
- The scripted players are our model of drift, not a person; Eric's listen is the only human check.
- Bass and drums only. backing-track's band files (not on `main`) following you is promotion work.
- The wall time of a hit is its press's `timeMs`; the DGX's own latency isn't modelled (calibration covers presses).
- No laptop-key sound change: laptop-sound already plays the band's channels.

## Defaults
- The smaller option; log choices the spec doesn't make in `specs/decisions/score-follow-spike-*.md`.
