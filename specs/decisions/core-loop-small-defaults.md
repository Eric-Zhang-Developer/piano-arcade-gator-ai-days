# core-loop: small choices the spec left open

- Date: 2026-10-24   Decided by: eric-agent-1   Feature: core-loop
- **Context:** Gaps found while building; each takes the smaller option (decision 000).
- **Options / Choice:**
  - Black laptop keys: the row above sits between whites (W after A, E after S, … P after L), and a letter maps only
    where a black key exists. From C this is exactly the spec's `W E T Y U O P`; R and I appear only for other
    starting keys.
  - Combo order: hits and misses count in the order they're judged (a miss is judged 50 ms after its note).
  - MISS timing: the play screen calls a note MISS only after its window closes plus the latency offset plus a 50 ms
    input grace, so a late-arriving MIDI message can still land.
  - `Results.counts` includes `extra`, so the results screen and the learning lane don't recount.
  - `Take.inputDevice` is the device of the first key-on (MIDI or laptop keys both stay live).
  - The home page redirects to `/play` until `song-select` owns it.
- **How to undo:** each is one line in `web/src/game/core/` or `web/src/app/`.
