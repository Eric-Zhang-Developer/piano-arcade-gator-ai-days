# Score follow: findings

Spike #519, spec `specs/features/score-follow-spike/spec.md`, decision 004. eric-agent-7, 2026-10-25, 05:40–06:10 ET:
about half an hour of the 3 h box. Code: `web/src/game/score-follow/` (follow.ts, the plugin, the measurement, verify-follow.mjs).

## The question
Does a band clock that predicts your next note, rather than waiting for it, keep a bass-and-drums band within the
GREAT window (50 ms) of a player whose tempo drifts? **Yes** needs, on Twinkle and Für Elise, for the "drift with
jitter" player: median ≤ 25 ms and p95 ≤ 50 ms of |band send − press|, and both better than the same band on flow
mode's own clock.

## Second box: a Kalman follower (2026-10-25, eric-agent-7)
The first box's recommendation, measured with the same harness, the same seed (519) and the same runs, against the
same bar (median ≤ 25 ms, p95 ≤ 50 ms on the drift-with-jitter player), with flow's clock as the baseline.
`kalmanFollower` in `follow.ts` is a Kalman filter whose state is the wall time of the last onset, the ms per beat
and (order 3) its change per beat. Wall time is linear in that state between onsets, so the filter is exact: predict
the next onset's wall time, measure the press. The first press fixes the phase, and a wide start variance on the
tempo lets the second press set it. `band=follow` now runs it.

**The answer: yes on Für Elise, half yes on Twinkle.**
- **Für Elise, drift with jitter: median 15, p95 33.** Both clear the bar (it was 18 / 58).
- **Twinkle, drift with jitter: median 15, p95 63.** The median clears the bar; p95 misses by 13 ms (it was 30 / 72).
- Clean drift: Twinkle 5 / 21 (was 23 / 68), Für Elise 1 / 4 (was 4 / 6). Steady and stop are unchanged.
- Flow's clock on the same runs is 147–363 ms behind, as before.

| song | player | clock | n | median |ms| | p95 |ms| | max |ms| | signed median ms | hat spread (sd/mean) | past the stop |
|---|---|---|---|---|---|---|---|---|---|
| twinkle | steady | kalman | 66 | 0 | 1 | 150 | 0 | 0.039 | – |
| twinkle | steady | follow | 66 | 0 | 0 | 150 | 0 | 0.040 | – |
| twinkle | steady | hold | 66 | 147 | 159 | 160 | 147 | 0.013 | – |
| twinkle | drift | kalman | 66 | 5 | 21 | 251 | -4 | 0.187 | – |
| twinkle | drift | follow | 66 | 23 | 68 | 251 | 22 | 0.186 | – |
| twinkle | drift | hold | 66 | 291 | 356 | 366 | 291 | 0.183 | – |
| twinkle | drift+jitter | kalman | 66 | 15 | 63 | 224 | -7 | 0.187 | – |
| twinkle | drift+jitter | follow | 66 | 30 | 72 | 224 | 16 | 0.188 | – |
| twinkle | drift+jitter | hold | 66 | 284 | 354 | 356 | 284 | 0.184 | – |
| twinkle | stop | kalman | 66 | 0 | 150 | 2250 | 0 | 0.395 | 0 |
| twinkle | stop | follow | 66 | 0 | 150 | 2250 | 0 | 0.395 | 0 |
| twinkle | stop | hold | 66 | 147 | 292 | 1914 | 143 | 0.348 | 0 |
| fur-elise | steady | kalman | 132 | 0 | 0 | 114 | 0 | 0.001 | – |
| fur-elise | steady | follow | 132 | 0 | 0 | 114 | 0 | 0.001 | – |
| fur-elise | steady | hold | 132 | 267 | 271 | 271 | 267 | 0.011 | – |
| fur-elise | drift | kalman | 132 | 1 | 4 | 193 | -1 | 0.157 | – |
| fur-elise | drift | follow | 132 | 4 | 6 | 193 | 4 | 0.157 | – |
| fur-elise | drift | hold | 132 | 363 | 391 | 393 | 363 | 0.165 | – |
| fur-elise | drift+jitter | kalman | 132 | 15 | 33 | 167 | 3 | 0.157 | – |
| fur-elise | drift+jitter | follow | 132 | 18 | 58 | 167 | 5 | 0.161 | – |
| fur-elise | drift+jitter | hold | 132 | 212 | 274 | 285 | 212 | 0.163 | – |
| fur-elise | stop | kalman | 132 | 0 | 0 | 3409 | 0 | 0.351 | 1 |
| fur-elise | stop | follow | 132 | 0 | 0 | 3409 | 0 | 0.351 | 1 |
| fur-elise | stop | hold | 132 | 259 | 267 | 2855 | 259 | 0.314 | 0 |

(kalman: order 3, R = 17² ms², the sd of the scripted ±30 ms uniform jitter; q = 1. follow: the first box's mean
follower. hold: flow's clock.)

### Why order 3, not the planned two states
`SF_SWEEP=1` prints the grid. Only q / R matters (R 10 with q 6 prints the same as R 25 with q 15). Median / p95 ms:

| tune | twinkle drift | twinkle drift+jitter | fur-elise drift | fur-elise drift+jitter |
|---|---|---|---|---|
| order 2, R 10, q 15 | 13 / 43 | 25 / 70 | 5 / 7 | 19 / 48 |
| order 2, R 10, q 30 | 10 / 35 | 34 / 73 | 3 / 5 | 21 / 51 |
| order 2, R 17, q 30 | 12 / 41 | 26 / 68 | 5 / 7 | 19 / 48 |
| order 3, R 17, q 0.5 | 8 / 21 | 16 / 66 | 3 / 6 | 14 / 32 |
| **order 3, R 17, q 1** | **5 / 21** | **15 / 63** | **1 / 4** | **15 / 33** |
| order 3, R 17, q 2 | 3 / 21 | 19 / 60 | 1 / 3 | 16 / 36 |
| order 3, R 17, q 4 | 2 / 20 | 23 / 68 | 0 / 3 | 16 / 39 |

Two states still trade one failure for the other. A q that tracks the accelerating player lets every press's jitter
through, and a q that filters the jitter lags the drift. The third state carries the acceleration, so a low q
filters jitter without the lag. Order 3 at q 1 is the best on Twinkle's jittered median and close to the best p95
(60 at q 2, which costs Twinkle's median and Für Elise's p95).

Letting the band enter only after two presses (so it never plays the second onset on the chart's tempo) was also
tried. It made every jittered p95 worse: the band's first beats then went out late, as a burst. It is not kept.

### Where Twinkle's p95 comes from
From a per-onset dump (not committed), there is no one bad spot: errors of 40–75 ms are spread over the song. The
second onset (−224 ms, before any tempo is known) is the largest. Twinkle gives one press per beat. Each press is
±30 ms off the player's intended beat, and the scripted tempo moves about 1.2% a beat, so a filter has few samples
to average before the tempo moves on. Für Elise's eighth notes give it twice the samples, and it clears the bar.
For scale: a band exactly on the intended beat would measure p95 about 28 ms against this jitter (first box). The
filter's own prediction error adds the rest.

### Browser check
`verify-follow.mjs` through `verify.py`, once, at a5b12c0 with the Kalman follower: "pass, 74 band notes on channels
2 and 10, hi-hat asynchrony median 11.4 ms over 42 presses (max 203.7; 42 on script), All Notes Off on both after
the song". It's a steady 80% player, so this checks the plumbing in the browser, not the drift result. The first
box's run measured 28.6 ms, but 5 of its 42 presses were off script, so the two medians aren't a like-for-like
comparison. (A plain `verify.py` without `--cmd` ran the core check first, which passed 42/42 PERFECT. That is
not verify-follow.)

### Recommendation: promote to Eric's listen; no more estimator boxes
- The estimator question is answered as far as scripted players can answer it. It is better than the first box on
  every drifting run and never worse. Für Elise clears the bar. Twinkle misses p95 by 13 ms, on a player who moves
  ±30 ms on every press and 50% in tempo over 42 notes.
- Whether 63 ms at p95 on that player is audible is a question for the piano, not the harness. The next step is
  Eric's listen below, with `band=follow` (now the Kalman follower) against `band=hold`.
- Kill it if he hears the band pulling him or lagging. Promote it to a feature spec if he hears it play with him.

## The first box (05:40–06:10 ET)

## The answer: no, by the bar; yes against the baseline
- **Twinkle, drift with jitter: median 30, p95 72.** Both miss (25 and 50).
- **Für Elise, drift with jitter: median 18, p95 58.** The median passes; p95 misses.
- **Against flow's clock it's an order of magnitude better** on every drifting and steady run: medians 0–30 ms
  against 147–363 ms. Flow's clock eases to a stop before each unplayed note and then catches up, so the band on it
  lands a median 147–363 ms after the player (the signed median is positive on every run). That's the spec's premise,
  measured.

## The table
As printed by `pnpm -C web exec vitest run src/game/score-follow -t "prints the table" --silent=false` (seed 519,
16 ms frames, 300 ms lookahead). |ms| is |band note-on send − the onset's first press|, at every band note-on on a
beat where the player has an onset. Signed median: positive means the band is late. Hat spread: stdev ÷ mean of
the hi-hat intervals. Past the stop: band note-ons after the unplayed onset, before the player plays it.

| song | player | clock | n | median |ms| | p95 |ms| | max |ms| | signed median ms | hat spread (sd/mean) | past the stop |
|---|---|---|---|---|---|---|---|---|---|
| twinkle | steady | follow | 66 | 0 | 0 | 150 | 0 | 0.040 | – |
| twinkle | steady | hold | 66 | 147 | 159 | 160 | 147 | 0.013 | – |
| twinkle | drift | follow | 66 | 23 | 68 | 251 | 22 | 0.186 | – |
| twinkle | drift | hold | 66 | 291 | 356 | 366 | 291 | 0.183 | – |
| twinkle | drift+jitter | follow | 66 | 30 | 72 | 224 | 16 | 0.188 | – |
| twinkle | drift+jitter | hold | 66 | 284 | 354 | 356 | 284 | 0.184 | – |
| twinkle | stop | follow | 66 | 0 | 150 | 2250 | 0 | 0.395 | 0 |
| twinkle | stop | hold | 66 | 147 | 292 | 1914 | 143 | 0.348 | 0 |
| fur-elise | steady | follow | 132 | 0 | 0 | 114 | 0 | 0.001 | – |
| fur-elise | steady | hold | 132 | 267 | 271 | 271 | 267 | 0.011 | – |
| fur-elise | drift | follow | 132 | 4 | 6 | 193 | 4 | 0.157 | – |
| fur-elise | drift | hold | 132 | 363 | 391 | 393 | 363 | 0.165 | – |
| fur-elise | drift+jitter | follow | 132 | 18 | 58 | 167 | 5 | 0.161 | – |
| fur-elise | drift+jitter | hold | 132 | 212 | 274 | 285 | 212 | 0.163 | – |
| fur-elise | stop | follow | 132 | 0 | 0 | 3409 | 0 | 0.351 | 1 |
| fur-elise | stop | hold | 132 | 259 | 267 | 2855 | 259 | 0.314 | 0 |

## Where the errors are (from a per-event dump, not committed)
- **The start:** the second onset, before any tempo sample exists (the band starts at the chart's tempo, the player
  at 70–80%), is 150–250 ms early. That one event is each follow run's max on steady and drift.
- **After a long note (Twinkle):** each phrase ends on a half note, and the onset after it is the run's worst: 68,
  55, 45, 38, 32 ms late across the song's five phrases. The 4-onset mean lags a player who keeps speeding up, and a
  two-beat note extrapolates that lag twice as far. Für Elise, all short notes, has no such gaps (drift p95 6).
- **Jitter:** the follower corrects 100% of each onset's phase error over the next beat, so it chases every ±30 ms
  press. For scale: a band exactly on the player's intended beat would measure median 15, p95 about 28 against
  ±30 ms uniform jitter, which leaves the predictor only about 20 ms of the 50.
- **The stop:** the band plays on to half a beat past the unplayed onset, by design, so the onset's own band events
  (3 beats before the late press) are the stop runs' max: 2250 and 3409 ms. Past the stop: 0 on Twinkle (its beats
  are whole, half a beat holds none), 1 on Für Elise. After the press it resumes on the beat (median 0).

## Two variants, one more knob each (`SF_SWEEP=1`, follow clock only)
| variant | twinkle drift | twinkle drift+jitter | fur-elise drift | fur-elise drift+jitter |
|---|---|---|---|---|
| the spec's (gain 1, mean) | 23 / 68 | 30 / 72 | 4 / 6 | 18 / 58 |
| trend (gain 1) | 2 / 11 | 31 / 86 | 0 / 2 | 42 / 116 |
| gain 0.5 (mean) | 38 / 84 | 27 / 82 | 7 / 10 | 18 / 61 |
| gain 0.5, trend | 8 / 17 | 30 / 87 | 2 / 5 | 46 / 120 |

(median / p95 |ms|.) Extrapolating the tempo trend fixes clean drift (Twinkle p95 68 → 11) and makes jitter worse:
a straight-line fit through four noisy samples amplifies the noise. Correcting only part of the phase error doesn't
filter jitter enough to pay for the lag it adds. Neither knob alone clears the bar.

## What worked
- A separate band clock with a 300 ms lookahead and `send(data, timestamp)`: steady players get a band exactly on
  their beat (median 0, hat spread 0.001–0.04), where flow's clock is 147–267 ms behind.
- Waiting at half a beat past the unplayed note, then resuming from it: the band never runs on through a stop and
  comes back on the beat.
- The plugin is silent unless `?mode=flow&band=follow|hold`; nothing changed in /play, flow-mode or beat-track.

## What didn't
- The bar on jittered drift, on both songs (p95 72 and 58).
- Tempo after long notes on an accelerating player.
- The first beats, before a tempo is known.

## What to keep
- `bandEvents`, `scheduler` and the band's silence: generic, chart-generated, no restricted content.
- The measurement harness (scripted players, both clocks through the real FlowJudge): it's the yardstick for any
  next follower.
- Not flow's clock for anything scheduled ahead: the table settles that.

## Browser check
`verify-follow.mjs` (Twinkle, `mode=flow&band=follow&midi=sim&input=test`, every onset pressed with `pressNow` at 80%),
locally through `verify.py`, twice:
- **Run 1 failed:** median 72.1 ms. The check pressed during the count-in, before `songStart`, so the plugin never heard
  the first seven onsets and then sent the skipped beats in one burst. That was the check's bug; it now waits for flow's
  clock to hold at the first note (as verify-flow does). The second run, past the spec's "at most once", was to test
  that fix.
- **Run 2 passed:** "74 band notes on channels 2 and 10, hi-hat asynchrony median 28.6 ms over 42 presses (max 353.6;
  37 on script), All Notes Off on both after the song". On a loaded machine the page's own press loop drifted: 5 of
  42 presses landed more than 10% off their scripted gap (up to ±400 ms), and the band followed those. We read the
  browser's 28.6, against the scripted steady player's 0, as that timer noise rather than a scheduling error (in run
  1's dump the presses that kept time were within ±40 ms of their hi-hats), but that reading isn't proven.

## Eric's listen
Pending. `band=follow` is the Kalman follower since the second box. On the DGX, about 5 minutes: Twinkle in Flow, `band=follow` then `band=hold`
(`/play?song=twinkle&mode=flow&band=follow`, then `&band=hold`), once steady and once speeding up. One line each:
does the band play with you, and which is better? No claim about sound is made here.

## Recommendation (first box): iterate
One more time box, on the predictor only, with this harness as the bar:
1. A two-state estimator (phase and tempo, a small Kalman or alpha-beta filter) instead of a mean plus a full phase
   jump, so jitter is averaged out and steady acceleration is still tracked. The sweep says neither half alone does it.
2. Start from the player's first two onsets (or `?tempo=`), not the chart's tempo, to remove the first-beat miss.
3. Then Eric's listen. Promote needs both the numbers' yes and his.
