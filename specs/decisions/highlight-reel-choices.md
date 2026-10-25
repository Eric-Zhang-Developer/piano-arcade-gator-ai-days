# Highlight reel: choices the spec didn't make

- **Cut lengths** (`highlightSettings`): cold open 540 frames (9.0 s) with 90-frame smoothstep ramps around a 0.5×
  hold, so it shows 5.25 s of take; the finish 270 frames (4.5 s); the title card 90. Starting values, not tuned.
- **A short best run** is padded evenly past its beat each side ("gets more padding"), but the cold open never
  starts more than a beat before the first press. The first run of rank-b on Twinkle opened on 2 s of empty highway
  without this.
- **The picture** (`decision highlight-reel-picture`): `drawHighway` keeps per-context key-release fades, so frame n
  would depend on the frame before. Each frame's highway is drawn on a fresh OffscreenCanvas and copied over. The
  reel has no 140 ms key-release fades. Hit particles are left out: they don't run on an explicit clock.
- **The sound** (`decision highlight-reel-audio`): laptop-sound's `createSynth` gets the OfflineAudioContext through
  a cast (`as unknown as AudioContext`). Every node it makes exists offline. Not edited.
- **The registry URL** is `/highlight?take=last&x=highlight-reel`: the experiments test requires every entry's URL to
  carry its own flag. The page ignores `x`.
- **The encode:** VP8 first, after VP9 kept 662/900 frames. A 66 ms A/V offset was measured in run 1 and applied
  in run 2; it didn't help, and FINDINGS says why. Both stay in `encodeSettings` for the next box to replace.
- **Shots** follow decision experiments-flags' cap (4 files, 400 KB).

How to undo: each is a setting or a few lines in `web/src/game/x/highlight-reel/`.
