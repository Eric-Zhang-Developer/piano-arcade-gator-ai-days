# wait-hands: the order of a frame's sends

**Context.** The spec says each frame sends note-offs whose end falls in `[last, now)` first, then note-ons whose start does. That protects a repeated pitch: a note ending at 1500 and the same pitch starting at 1500 go off, then on.

**Problem.** Taken literally, a note that starts and ends inside one frame (a short note, or a long frame after a stall) would go off before its own on and hang.

**Options.**
- A: offs first, then ons, as written.
- B: every send in time order, with a note-off first at equal times.

**Choice: B,** in `waitSends` (`web/src/game/hand-mode/hands.ts`). It keeps the spec's repeated-pitch case and lets no note hang. `hands.test.ts` pins both cases.

**How to undo:** sort by type before time in `waitSends`.
