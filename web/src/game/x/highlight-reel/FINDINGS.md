# Highlight reel: findings

Spike #913 (decision 004), spec `specs/features/highlight-reel/spec.md`. eric-agent-7, 2026-10-25, about 1 h 20 of
the 3 h box. Code: `web/src/game/x/highlight-reel/` (the cut, the picture, the sound, the encode, `/highlight`,
verify-highlight.mjs).

## The question
Can the browser turn a recorded take into a 15-second replay WebM that passes the pitch's outside checks (length,
60 fps, one audio track, sound in sync, the slow motion showing the best run), repeatably, with Canvas 2D,
`OfflineAudioContext` and `MediaRecorder` only?

## The answer: no, on the encode; yes on everything before it
Everything computed from the take works and repeats: the cut, frame n's picture, the sound, and their agreement
(the onsets land where the edit list says, to within a constant offset). `MediaRecorder` is where it fails. Encoding
a live stream in real time, it drops frames and offsets the sound by a delay we don't control.

## The numbers
These are the bars of `spikes/highlight-reel/measure.mjs`. CI's `verify-highlight.mjs` checks only bars 1, 3, 6 and 7,
the part that works and must keep working (spec, Validation 2). Two local runs through `verify.py` under `verify.lock`, the spec's three takes each, on a shared machine at load
average 12.7 on 8 cores. "Run 1" is VP9; it stopped at bar 2 on the check's own parse bug (fixed), so bars 2 and 4
for run 1 were measured afterwards on its saved file. "Run 2" is VP8, with frames requested 66 ms later on the audio
clock.

| bar | twinkle rank-b | minuet-g sloppy | twinkle rank-c (`take=last`) |
|---|---|---|---|
| 1 length (15.0 ± 0.1 s) | run 1 14.980 ✓, run 2 14.963 ✓ | run 2 14.979 ✓ | run 2 14.981 ✓ |
| 2 frames (900 ± 6 at 16.7 ms) | run 1 **662**, spacing 6–27 ms ✗; run 2 **38**, median 252 ms ✗ | run 2 **34**, 266 ms ✗ | run 2 **62**, 194 ms ✗ |
| framesRequested / framesLate | run 1 900 / 21; run 2 900 / 31 | 900 / 25 | 900 / 31 |
| drawFrame median / p95 | run 2 8.7 / 15.6 ms (in the app's browser pane: 0.8 / 6.2) | 8.6 / 15.1 | 8.5 / 15.2 |
| 3 tracks | run 2 vp8 + opus ✓ | ✓ | ✓ |
| 4 sync (≥ 90% within 50 ms, median ≤ 10) | run 1: 11/11 found, every one 65–72 ms late ✗; run 2: 0/11 within 50 ms, all 55–71 late ✗ | 0/17 (13 found, 27–34 ms late in the decoded sound plus 38 ms track offset) ✗ | 0/13 (28–34 + 40 ms) ✗ |
| 5 slow motion (in run, PSNR ≥ 30, < 20 vs black) | in run ✓, PSNR 23.6 ✗, 8.0 vs black ✓ | in run ✓, 23.7 ✗, 8.0 ✓ | in run ✓, 29.2 ✗, 8.0 ✓ |
| 6 repeatable | same audioHash, 30/30 frame hashes ✓ | | |
| 7 console errors | none ✓ | | |

Codec: Chrome picked `video/webm;codecs=vp9,opus` when asked first (run 1), and `vp8,opus` when VP8 was first (run 2).

## Why each failed bar failed
- **Frames (bar 2).** The page requested all 900 frames, each on time to within a frame except 21–31. The drops
  happen inside `MediaRecorder`'s encoder, which skips a frame when it is still busy with the last one. VP9 kept
  662. VP8 kept 34–62, which is worse: in that run the drawing also took 8.7 ms a frame against 0.8 ms in run 1's
  pane, so the machine's load, not only the codec, sets how many frames survive. A real-time encode at 1080p60 on a
  loaded laptop can't promise 900.
- **Sync (bar 4).** The sound reaches the file a steady 55–75 ms after the frame it belongs with, the same on every
  onset of a take (spread 2–6 ms). Requesting each frame 66 ms later on the audio clock (run 2) didn't move it. The
  recorder stamps each track with its own capture times, and the delay is in the audio path between the
  `AudioContext` and the recorder. A page can't see that delay, so it can't compensate.
- **Slow motion (bar 5).** The frame at the cold open's middle is in the best run on all three takes, but with 3–7%
  of the frames kept, the encoded frame at that time is a stale one (PSNR 23.6–29.2). It follows from bar 2.

## What worked
- **The cut:** closed-form speed ramps, so take ↔ reel time is exact and the sound, the picture and the expected
  onsets agree. The onsets were found within 1 ms on synthetic clicks, and on every real reel the detected onsets
  are the expected ones plus one constant.
- **Frame n is a pure function of n:** the highway is drawn on a fresh canvas per frame (decision
  highlight-reel-picture). 30 of 30 sampled frame hashes and the audio hash repeated across two page loads.
- **The sound:** laptop-sound's synth runs unmodified on an `OfflineAudioContext` through a cast.
- **`take=last`:** the frame passes `resultsPanel` through, the take is saved on `/play`, and `/highlight` reads it.
- **The look:** the reel's overlays and the `/highlight` edit bay in the Duo kit (the PR's Design section).

## What didn't
- `MediaRecorder` as the encoder: frames and sync, above.
- The page's fallback frame count (`requestVideoFrameCallback` over a playback) reads 62 in a background tab. CI's
  runner has no ffprobe, so its bars 1, 2 and 4 use that fallback and can't be trusted there either.

## What to keep
The cut, the picture, the sound, the take hand-off and verify-highlight's measurements. Only the encode would change.

## WebCodecs instead of MediaRecorder
On the two failed bars, yes, by construction:
- **Frames:** a `VideoEncoder` takes frame n with timestamp n/60 s and waits for the encoder (`encodeQueueSize`).
  Nothing is dropped and nothing runs in real time, so the 15 s wait goes away too.
- **Sync:** an `AudioEncoder` takes the `OfflineAudioContext` buffer with timestamps from 0, so the A/V offset is
  zero by construction.

The cost is a WebM muxer. The spec forbids a new dependency, so it would be hand-written: EBML with Segment, Tracks,
Cluster and SimpleBlock, about 200–300 lines, plus VP8/VP9 and Opus codec-private data. Bar 5 would follow from
bar 2.

## Recommendation: iterate, on the encode only
One more box: WebCodecs plus a hand-written WebM muxer, behind the same `encode()` signature, measured by the same
verify-highlight. Kill the spike if the muxer outgrows the box. MediaRecorder tuning (bitrate, resolution, codec)
isn't worth another box: the drops depend on the machine's load and the sync offset can't be seen from the page.

## Eric's verdict
Pending (`not seen by Eric`): one reel from the Lab, then kept, cut or kept with changes.
