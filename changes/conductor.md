## What shipped
The Conductor spike (#985):
- **`/conduct`:** a hand at the laptop camera leads the piano. MediaPipe Hand Landmarker loads from a pinned CDN URL.
  A beat detector feeds a clamped phase-locked clock, which sends the score through "Portable Grand" in 100 ms
  windows. A still hand holds, a fist cuts off, and stroke size swells the velocities.
- **Clip mode:** `?clip=1`.
- **Spike tooling:** `record.html` and `score.mjs`.
- **Entries:** "Conductor" in the Lab's Wow group, and "Conduct this song" on `/play?x=conductor`.
## Where it lives
- `web/src/game/x/conductor/` and `web/src/app/conduct/page.tsx`.
- `spikes/conductor/`, `specs/decisions/conductor-*.md`, and the shots in
  `specs/features/experiments/shots/conductor/`.
## How to check it
- **(a):** `pnpm -C web exec vitest run src/game/x/conductor`: 17 of 17 pass.
- **(b) and (c):** clip pending. No clip has been recorded, so detection precision and recall and the latency are
  unmeasured.
- **In the in-app browser:** the CDN load reached a working landmarker in 8.2 s; Turbopack left the import alone; the
  /play link and the Lab entry are there.
- **The perf gate:** not run locally; main's scheduled run covers it.
- **(e) Eric's try at the DGX:** not tried by Eric.
## Gaps
- **Camera:** never turned on in a check, so the trail, the pulse, holds and cutoffs have run only in unit tests, not
  live.
- **Settle bar:** it holds on a 75 BPM chart. On Moonlight (60) a jump to 90 settles by the sixth beat, because the
  1.6× clamp limits catch-up (decision log).
- **Network:** needed for the library, the WASM and the model.
