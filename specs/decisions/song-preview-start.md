# Song preview: the opening starts on its first note

**Context:** the spec says the preview plays "the chart's first 2 bars". Some charts open on rests: the Chopin prelude's
first note is on beat 3, the nocturne's on beat 5.5. Played from beat 0, their previews start with seconds of silence
after the 400 ms highlight delay.
**Options:** A, play bars 1–2 from beat 0, rests included. B, the same notes (those starting in bars 1–2), timed from
the first of them.
**Choice:** B. It's the same notes, and the preview sounds as soon as it starts.
**How to undo:** in `web/src/game/song-preview/opening.ts`, set `zero` to 0.
