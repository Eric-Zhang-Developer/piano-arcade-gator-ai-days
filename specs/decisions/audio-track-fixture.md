# audio-track: verify-audio writes its test song at run time

**Context.** Validation 2 asks for "a committed test song with a generated click-track WAV and a sidecar." A WAV is a
binary, and the test song has to sit in `songs/local/` for audio-track to play it (recordings are local-only).
`songs/local/`'s own `.gitignore` is `*`, so nothing under it can be committed without changing that rule.

**Options.**
- A. Commit the WAV, chart and sidecar to a new `songs/local/audio-test/` and add an exception to the `.gitignore`.
- B. Commit the generator: `verify-audio.mjs` writes the 120 bpm click track, `audio.json` and `chart.json` into
  `songs/local/audio-test/` before each run.

**Choice: B.** What's committed is the code that makes the test song, all our own work. No binary goes in the repo,
and the local-only rule keeps no exceptions. Each run rebuilds the same 96-beat track, so the check can't drift from
a stale file.

**How to undo.** Add `!audio-test/` to `songs/local/.gitignore`, commit the files the script writes, and drop
`writeFixture()`.
