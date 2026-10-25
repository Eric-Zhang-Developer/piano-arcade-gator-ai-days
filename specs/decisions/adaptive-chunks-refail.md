# adaptive-chunks: a fail at a length that already passed

**Context.** The spec's fail rules cover two cases. Before anything passed (`ok` 0), the window halves. After a grow (the window longer than `ok`), it goes back to length `ok`. It doesn't cover a fail at a length `ok` or shorter: the "back" window itself, failed again on a bad take. Applied literally, "back to length `ok`" returns the same window, and the student loops on it with nothing changing.

**Options.**
- A: treat it as a fresh fail. `ok` goes to 0, `ko` to this length, and the window halves onto the half with more misses, or stays at one phrase at the floor.
- B: keep `ok` and retry the same window.
- C: step back one phrase at a time.

**Choice.** A. It's the spec's own "nothing passed" rule, and the binary search starts again from what the student can play today. B never ends for a student who regressed. C is a third rule the spec doesn't have. In `next.ts`, the `back` step needs `ok > 0 && length > ok`; every other fail falls through to the halving.

**How to undo.** In `next()`, change the `back` condition to `s.ok > 0` alone. That's option B.
