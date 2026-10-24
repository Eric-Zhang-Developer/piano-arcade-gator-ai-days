# Take store: design notes

Measured on Oct 24 2026 against Postgres 16 in a 4-core Linux container, with the migrations in `supabase/migrations/`.

## Layers
1. **Real time (browser, no network):** input, judging, highway, sound, LEDs. Unchanged by this feature.
2. **Collection (browser):** a `GamePlugin` (`web/src/data/save-plugin.ts`) rebuilds the `Take` from `transformChart`,
   `wrapInput` and `songStart`, and at `songEnd` queues it in a `localStorage` outbox under a browser-made UUID.
3. **Persistence (server):** `POST /api/takes` checks the session with Supabase Auth, reads the chart from the app's own
   files, re-runs `judgeTake`, and calls `save_take` (one transaction) with the secret key.
4. **Reads:** `GET /api/progress` and `/progress` read the `take_history` and `bar_trends` views as the signed-in
   player, so RLS limits them to that player's rows.

## Store, derive, discard
| Data | Decision | Why |
|---|---|---|
| `Take` (all key events) | stored verbatim, `jsonb` | 482 bytes on disk per 42-note take (TOAST-compressed). Lets every take be re-judged if the rule changes. |
| `Results` | stored verbatim, `jsonb` | 598 bytes on disk per take. The exact object the server computed. |
| one row per chart note | `note_judgments` | What the progress and coach queries group by (bar, pitch, signed offset, velocity). |
| counts, accuracy, rank | columns on `takes` | Read by every history query. |
| trends, history | views, not tables | Can't drift from the takes they summarize. |
| `GameEvent` stream, clock bytes, LED bytes, `?input=test` takes | not stored | Re-derivable from `Take` + chart, or no learning value. A CHECK rejects `test`. |

## Size and speed
1,005 takes of Twinkle (42 notes each) for one player: `takes` 2.1 MB, `note_judgments` 6.8 MB (42,210 rows), whole
database 17 MB, against the free tier's 500 MB. `bar_trends` for that player answers in 6–11 ms and `take_history`
(newest 100) in 6–7 ms, three runs each, warm cache. `bar_trends` ranks every take before filtering, so its cost grows
with the total number of takes; a materialized view or a per-player function is the next step if it gets slow.

## Trust boundaries
- The browser never writes to the database. The publishable key reads `songs` only; a signed-in player reads only
  their own rows; `save_take` is callable by the server's role only.
- The server ignores every score the client sends and re-judges the raw events. The chart comes from disk, never from a
  URL built from the request (a client controls the Host header).
- Take ids are idempotency keys: a retry returns `duplicate`, an id owned by another player returns 409.
- Bodies over 512 KB, takes over 5,000 events and fields outside the `Take` contract are rejected or stripped.
- Checked by `supabase/tests/take_store.sql`, `supabase/tests/local-stack/attacks.mjs` (14 checks) and, on the real
  project, `supabase/tests/live-smoke.mjs`.

## Known limits
- Anonymous identity lives in one browser: clearing it loses the history unless the player linked Google.
- Supabase limits anonymous sign-ins to 30 per hour per IP by default; a shared venue network needs that raised.
- No per-player limit on saves yet. Drills (`bar-loop`) aren't saved until the server can rebuild their chart.
- Charts are read from `public/songs/<id>/chart.json` on disk; a Vercel deploy needs those files traced into the route.
