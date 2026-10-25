# Score follow: findings

Spike #519, spec `specs/features/score-follow-spike/spec.md`, decision 004. eric-agent-7, 2026-10-25, 05:40–06:10 ET:
about half an hour of the 3 h box. Code: `web/src/game/score-follow/` (follow.ts, the plugin, the measurement, verify-follow.mjs).

## The question
Does a band clock that predicts your next note, rather than waiting for it, keep a bass-and-drums band within the
GREAT window (50 ms) of a player whose tempo drifts? **Yes** needs, on Twinkle and Für Elise, for the "drift with
jitter" player: median ≤ 25 ms and p95 ≤ 50 ms of |band send − press|, and both better than the same band on flow
mode's own clock.

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
Pending. On the DGX, about 5 minutes: Twinkle in Flow, `band=follow` then `band=hold`
(`/play?song=twinkle&mode=flow&band=follow`, then `&band=hold`), once steady and once speeding up. One line each:
does the band play with you, and which is better? No claim about sound is made here.

## Recommendation: iterate
One more time box, on the predictor only, with this harness as the bar:
1. A two-state estimator (phase and tempo, a small Kalman or alpha-beta filter) instead of a mean plus a full phase
   jump, so jitter is averaged out and steady acceleration is still tracked. The sweep says neither half alone does it.
2. Start from the player's first two onsets (or `?tempo=`), not the chart's tempo, to remove the first-beat miss.
3. Then Eric's listen. Promote needs both the numbers' yes and his.
