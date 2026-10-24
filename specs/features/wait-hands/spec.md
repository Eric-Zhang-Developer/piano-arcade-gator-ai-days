---
name: "Wait hands: learn one hand in wait mode while the other plays itself"
depends_on: ["wait-mode", "hand-mode"]
owns: ["web/src/game/wait-hands/"]
assignee: "eric"
---

# Wait hands

Learning one hand at a time is the usual way to learn a piece, and it's part of Eric's quick practice ask
(2026-10-24). `?mode=wait&hands=R` already holds only on right-hand notes, because hand-mode's `transformChart`
takes the left hand out of the chart that wait mode holds on. But hand-mode's `schedule` (in `draw`) queues the
other hand 300 ms ahead of the held clock, with MIDI timestamps from `zero`, the wall time of chart 0 at
`songStart`. From reading the code, not yet run: a hold doesn't move `zero`, so after the first hold each note-on
and its note-off carry timestamps already past. The note goes out up to 300 ms of chart time early, even mid-hold,
and its note-off can go with it.

Issue: #252

## Plan
Two PRs.
1. **A `fix(hand-mode)` PR**, which first reproduces the bug on `origin/main`: the failing line of step 1 below
   goes in the PR. With `?mode=wait`, read in `transformChart`, `schedule` stops queuing ahead. Each frame it sends
   what the held clock (`frame.nowMs`) has passed since the last frame, with no timestamp: note-offs whose end is
   in `[last, now)` first, then note-ons whose start is, using `playbackBetween`'s notes. The echo guard is stamped
   with `performance.now()` at the send. A pure helper in `hands.ts`, tested in `hands.test.ts`. Without
   `mode=wait`, nothing changes.
2. `feat(wait-hands)`: the headless check `web/src/game/wait-hands/verify-wait-hands.mjs`, then the done note.

## Requirements
- **Holds:** with `mode=wait&hands=R` (or `L`), the clock holds only at the played hand's notes. It never stops at a
  time that has only the other hand's notes. That's true today; this keeps it.
- **The other hand on the held clock:** a note-on goes out on the first frame whose chart time is past the note's
  start, and its note-off on the first frame past its end. Nothing is queued ahead, so a hold never lets a note
  through early. A note held through a hold keeps sounding until the clock reaches its end.
- **Together with your press:** the other hand's note at the held time sounds within two frames of your press
  (about 33 ms at 60 fps: the first frame after it resumes the clock at the held time), never during the hold.
- **Repeated pitches:** in one frame, note-offs go before note-ons, so a pitch that ends as it starts again isn't
  cut by its own earlier note-off.
- **Same outputs as hand-mode:** the DGX ("Portable Grand", channel 1, the chart's velocity or 80), else the laptop
  tone at hand-mode's volume. All Notes Off on `songEnd`, `pause`, `quit` and `pagehide` works as now; after a
  resume the window starts at the resume's time. A tone's length stays the note's chart length, capped at
  `toneMaxS`; a hold doesn't stretch it.

## Validation
- `pnpm -C web test` (`hands.test.ts`): with the clock held at a right-hand note at 1000 ms, a left-hand note at
  1200 ms isn't sent in 3 s of frames at 1000, and a left-hand note at 1000 is sent on the first frame past 1000.
  Each note-off goes out on the first frame past its end. A note ending at 1500 and the same pitch starting at 1500
  go out off, then on. Plain mode's schedule is unchanged.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/wait-hands/verify-wait-hands.mjs --out <dir>`. It starts its own dev server, prints
  `verify-wait-hands: pass` and exits 0, or names each failed step and exits 1. On
  `/play?song=fur-elise&hands=R&mode=wait&midi=sim&input=test`, with the stand-in output's `send` wrapped in the
  page to log the chart clock (`__pianoArcade.now()`) at each call:
  1. Press the first 8 right-hand notes on their holds, then wait 4 s at the 9th (beat 3, A4), where the left
     hand's A2 starts with it and E3 a quarter beat later -> at the end of the wait, neither has been sent.
     `origin/main` has sent both by then, ahead of their time. 4 s is clearly past wait-hint's 3 s
     (`waitHintSettings.afterMs`), so wait-hint's A4 is sent exactly once in the wait, 3–4 s in, and isn't counted
     as a left-hand note. (A 3 s wait raced the hint: #430.)
  2. Then press each right-hand note 1 s after its hold begins, through bar 8 -> each of the 15 left-hand notes in
     bars 1–8 has one note-on, in chart order, logged with the chart clock at or past its start and less than 50 ms
     after it, and one note-off logged at or past its end and less than 50 ms after it.
  3. The clock never sits for more than 200 ms at a time that has only left-hand notes.
  The send log goes in `<dir>/sent.json`.
- `verify-hands.mjs` and `verify.py --slug wait-hands` pass unchanged (plain hand mode).
- On the piano (Eric; mark it in the done note): Für Elise with `?hands=R&mode=wait`. The DGX plays the left hand as
  you go, nothing sounds early during a hold, no left-hand note is clipped, and nothing hangs after the song.

## Defaults
- Sends are at most one frame of chart time late (about 16 ms), the cost of not queuing ahead. If that's audible,
  queue ahead up to the next held note instead, since the clock only stops there.
- `hands=both` in wait mode has nothing to play, so nothing changes.
- Log any choice the spec doesn't make in `specs/decisions/wait-hands-*.md`.
