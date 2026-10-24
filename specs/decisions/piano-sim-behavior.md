# piano-sim: choices the spec left open

Context: the spec says what the fake must do, not how each fault or hook behaves. Eric approved these in a review
of the plan (2026-10-24). Each is small and undone by editing `web/src/game/sim/`.

| Topic | Choice | Rejected |
|---|---|---|
| Shipping | Two PRs: the fake, tests and hook first; the `/sim` page and done note second | One PR of 800+ lines |
| Hook | The plugin's `transformChart` installs the fake (when `?midi=sim`) and opens the channel at chart load | `wrapInput`: runs only at Start, so the bot and `/sim` couldn't reach the game before it, and it can't see the chart |
| Bot start | "Watch the bot" clicks the game's Start/Retry button; the bot plays from the game's `songStart` | Timing from the `/sim` page: the iframe's clock differs |
| Headless check | `web/src/game/sim/verify-sim.mjs` drives the bot through the MIDI path | Editing `web/e2e/verify.mjs` (core-loop's): a later `fix(core-loop)` |
| Fixture | One segment per run header; each run restarts the log's clock | One flat list (time would go backwards 4 times) |
| Replay gaps | `/sim` caps gaps over 2 s at 2 s and labels them; tests use exact times | Verbatim silences up to 100 s |
| Stall | Messages due during a stall are dropped | Delayed: the spike saw keys never arrive |
| Unplug | Port stays listed, `state: "disconnected"`, messages dropped until replug; labeled unmeasured | Removing the port |
| Jitter | Seeded ±, never reorders; `/sim` toggle is ±10 ms, a test setting, not a measurement | Reordering |
| Timestamps | Floored to 1 ms (R3: about one USB frame) | Exact |
| Tabs | Every channel message carries the `/sim` page's `simId` | Fixed channel only: two `/sim` tabs would cross |
| Pedal | No pedal button; CC 64 only from the replayed fixture | A pedal ramp generator |
