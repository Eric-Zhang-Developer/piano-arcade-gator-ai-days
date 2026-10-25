# count-in: one clock for the pictures and the click

- **Context:** the spec asks the worker to read how /play applies `latencyOffsetMs` to the drawn clock and to
  beat-track's sends, and to log it.
- **What /play does (origin/main):** `latencyOffsetMs` only moves *input*: a key's judged time is its arrival minus the
  offset (`app/play/page.tsx`, the input handler), and the judge's advance allows for it. The drawn clock
  (`frame.nowMs`) is the raw chart clock. Beat-track schedules each click at `zero + atMs`, where `zero` is the
  performance time of chart time 0 taken at `songStart` (and again at `resume`). So the drawn clock and the clicks are
  the same clock, and neither is shifted by the latency setting.
- **Choice:** count-in takes its beat times from `beatHits` (the list beat-track clicks from) and draws them on
  `frame.nowMs`, with no latency term. Stepped at 60 fps in the dev server, every beat's first frame was 0–16.7 ms
  after its time, and each click was scheduled at its beat's exact chart time.
- **The old digit:** `core/highway.ts` still draws it when `countInBeat` is set, and #747 holds that file. /play now
  leaves `hw.countInBeat` null, so the digit doesn't draw. Its lines in `highway.ts` come out in a follow-up
  `fix(count-in)` once #747 merges.
- **How to undo:** put `hw.countInBeat = beat > 0 ? beat : null` back in `app/play/page.tsx` and drop `countIn()`
  from `layers.ts`.
