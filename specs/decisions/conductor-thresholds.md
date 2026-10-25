# Conductor: the thresholds the spec leaves open

None of these is measured yet; Eric's clip (Validation b) is what tunes them. Each lives in its module's settings object.

| Setting | Value | Where | Why |
|---|---|---|---|
| `minSpeed` | 2.5 hand sizes/s down | `beats.ts` | a beat stroke at 60 BPM covers ~2 hand sizes in ~0.3 s (≈ 6/s); a drift is well under 1/s |
| `riseHands` | 0.15 | `beats.ts` | confirms the low point a few frames after it; smaller fires on jitter |
| `minGapMs` | 250 | `beats.ts` | the spec's bar (240 BPM) |
| `foldedRatio` | 1.0 | `beats.ts` | a fingertip nearer the wrist than its own knuckle is folded |
| `ratePull` | 0.9 | `clock.ts` | the lowest that meets the 60 → 90 bar: 0.85 leaves 34 ms, 0.75 leaves 57 ms |
| `phaseBeats` | 0.5 | `clock.ts` | the spec's "about half a beat" |
| `lookaheadMs` | 100 | `schedule.ts` | the spec's "about 100 ms" |
| `tickMs` | 25 | `session.ts` | four wakes per window, so a late timer still fills it |
| `fistFrames` | 4 | `session.ts` | ~130 ms at 30 fps: a curl passing through a stroke doesn't cut |
| `holdSlackMs` | 150 | `session.ts` | the detector confirms a beat ~100 ms after its low point |
| `refStroke` | 2 hand sizes | `schedule.ts` | the stroke that plays the chart's velocities as written |
| velocity factor | 0.5–1.6 × | `schedule.ts` | then clamped to 1–127 per note |

**The settle bar and the clamp.** On a 60 BPM chart, 90 is 1.5× the chart. The 1.6× clamp then leaves 0.1× to make
up the third of a beat lost in the first faster interval, about 0.13 beats over two. So the bar can't hold there.
The test runs the bar on a 75 BPM chart (60 and 90 are 0.8× and 1.2×). A second test shows that on a 60 BPM chart
the clamp spreads the same correction over more beats (under 30 ms by the sixth). Moonlight is 60 BPM, so speeding
it up past 1.5× catches up slowly. That's the clamp doing what the spec asks.

**Hold:** "a hand still for 2 beats" is read as no beat for 2 beats at the current rate, plus `holdSlackMs`. Wrist
speed isn't checked: a hand that waves without striking also holds.

**Golden:** nothing lists local songs, so the page sends a HEAD for `local/golden-hard/chart.json` and lists Golden
only when it answers.
- Without Golden, that's one 404 in the console per visit.
- No browser check runs on /conduct, so it fails nothing.
- Promotion would want a listing instead.

**How to undo:** change the value in its settings object. The tests name the bars, not the values, except the clamp
test above.
