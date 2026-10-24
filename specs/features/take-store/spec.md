---
name: Take store: every take saved to Supabase, with per-bar progress for the coach
depends_on: ["core-loop"]
owns: ["supabase/", "web/src/data/", "web/src/app/api/takes/", "web/src/app/api/progress/", "web/src/app/progress/", "web/src/app/auth/"]
assignee: "sharan"
---

# Take store

Gives the coach a memory. Every finished take is saved, so the coach can say "bar 3 went from 38 ms late to 12 ms late
over your last 4 takes" and a progress page can show it. Needs the `contract:` PR that changes the Data row in
`specs/tech-stack.md` (and, for Google sign-in, `specs/mission.md` Not doing) merged first. Design notes, measured
sizes and trust boundaries: `design.md` next to this spec.

The game never waits on any of this. Judging, rendering, sound and LEDs stay local and work with the network down.

## Plan
1. `supabase/migrations/`: the schema (5 tables, 2 views, `save_take`, RLS) and a SQL test that runs on plain Postgres.
2. `web/src/data/`: one `TakeStore` interface with a Supabase version and a `localStorage` version, an outbox, and a
   pure mapping from `Take` + `Results` to rows.
3. `POST /api/takes`: re-judge, save. `GET /api/progress`: history and per-bar trends.
4. Anonymous Supabase Auth on first save; "Keep my progress" links Google to the same user.
5. `/progress`: the player's profile: every session across songs (when, how long, rank, accuracy, hits), totals, and
   for one song the weakest bars. The account chip's name opens it. Headline numbers (sessions, time, notes and hit
   rate, best rank and combo, day streak), accuracy over time, a 12-week practice calendar, every note's judgment, and
   each hand's hit rate and timing (`hand_stats`). Real counts only: a panel with no data says so.

## Requirements
**Data** (`supabase/migrations/`, Postgres on the Supabase free tier):
- `players` (id = the Supabase Auth user id, optional handle), `songs` (one row per `chart.json`, with its SHA-256),
  `takes` (one row per finished take: counts, accuracy, max combo, rank, `bar_from`/`bar_to`/`tempo_pct` for
  `bar-loop` drills, `judge_version`, `contract_version`, `chart_sha256`, and the `Take` and `Results` JSON verbatim),
  `note_judgments` (one row per chart note per take: pitch, hand, bar, beat, judgment, signed `offset_ms`, velocity),
  `coach_feedback` (the coach's report, the exact summary it was checked against, whether the check passed).
- Views, never stored copies: `bar_trends` (per bar over a player's last 5 takes of a song: notes, misses, mean
  signed offset, spread, mean velocity) and `take_history` (one row per take).
- CHECK constraints guard shape and sanity, not the judging rule (the server re-judges with the game's judge): a
  MISS has no offset, pitch 21–108, `input_device` is `midi` or `keys` (test takes are never stored), `offset_ms`
  within ±1000. Judgment and rank are any upper-case name, so a judgment or rank the contract adds later saves with
  no migration. A take the database still refuses is kept in the outbox and resent later, never dropped.
- `save_take(take, notes)` writes a take and its notes in one transaction and does nothing on a retry of the same id.
- Only takes the server can re-judge are saved: a person playing a committed song on the chart as committed. Not test
  input, bots, the fake piano, versus, wait mode, local songs (decision 003), or a chart a plugin changed (loops, one
  hand, chunks, tempo), checked by comparing the played chart with the committed file.
- Every committed chart saves: `beats_per_bar` is numeric (compound meters like 3/8 = 1.5), and `takes` keeps the
  GOOD and WRONG counts the judging tiers added.

**Access:**
- RLS on every table. The publishable key (`anon`) reads `songs` only. A signed-in player (anonymous or Google) reads
  only their own rows. Nobody writes from the browser: only server routes, with the secret key.
- The secret key lives only in server env (`SUPABASE_SECRET_KEY`), never in a `NEXT_PUBLIC_` variable, never
  committed. The browser gets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

**Saving a take:**
- A `GamePlugin` registered in `web/src/game/layers.ts` rebuilds the `Take` from `transformChart`, `wrapInput` and
  `songStart`, so the play screen needs no change. Drills (`from`/`to`/`tempo` in the URL) aren't saved yet.
- The results screen renders from local `Results` first. Saving runs after, in the background, and never blocks.
- The take goes into a `localStorage` outbox under a browser-made UUID, then `POST /api/takes` with the user's
  session token. Failed sends retry on the next page load. A retry never creates a duplicate.
- The server verifies the session, loads the chart from `web/public/songs/`, re-runs the game's own judging on the
  `Take`, and stores what it computed. Scores sent by the browser are ignored.
- `?input=test` takes are never sent.

**Accounts:**
- On the first save, the browser signs up anonymously (Auth `POST /signup`). Nobody has to sign in: the player just plays.
- An optional front door, `/auth/login`: "Sign in with Google" or "Play as guest", then the menu (or `?next=`, a path on
  this site only). `AccountChip` (`web/src/app/auth/AccountChip.tsx`) shows who's playing, for the menu to mount.
- A "Keep my progress" button links Google (Auth `/user/identities/authorize`): same user id, history kept. Optional for
  the demo; the game is complete without it.
- "Sign in with Google" on another device returns to that account. If the device had played anonymously, its takes
  move into the account (`merge_player`, via `/auth/merge`, which only ever merges an anonymous user into a Google
  one) and the anonymous user is deleted. "Keep my progress" with a Google account that's already linked falls back
  to this. "Sign out" forgets the session on this device only.
- Anonymous sign-ins are limited per IP (30 an hour by default). The venue shares one IP, so raise it in the dashboard
  before the demo.

**Progress** (`GET /api/progress?song=<id>`, `/progress?song=<id>`):
- Returns and shows `take_history` and `bar_trends` for the signed-in player. Every number is a real count from a
  stored take; with no takes, the page says so instead of drawing an empty chart.
- The coach (`web/src/app/api/coach/`, learning lane) reads the same summary. Its shape is agreed with the coach's
  owner before step 4 merges.

## Validation
- SQL test (`psql -f supabase/tests/take_store.sql` from the repo root on a fresh Postgres 16): a saved take shows in both views; a
  retry is a no-op; `anon` can't read players, takes, notes or views and can't write; player A can't see player B's rows.
- Vitest: the mapping turns the Twinkle Perfect player's `Take` + `Results` into the exact rows; the outbox keeps a
  take after a failed send and sends it once after a success.
- `verify.py`: the verify run plays Twinkle with `?input=test` and still passes 42/42 PERFECT; test takes are never sent.
- End to end (`supabase/tests/local-stack/`): a scripted laptop-keys take in Chrome against Postgres + PostgREST and a
  local Auth stand-in shows one new `takes` row, its `note_judgments`, the missed bar first on `/progress`, and no
  duplicate after a reload.
- Live project: `node supabase/tests/live-smoke.mjs` passes (grants, RLS, anonymous sign-in, `save_take`).
- By hand (Sharan): play with Wi-Fi off, see the results screen at once; turn Wi-Fi on, reload, see the take on `/progress`.

## Defaults
- Prefer the `localStorage` store if Supabase is unreachable or not configured; the game must not care which one runs.
- Store raw, derive on read. Add a stored aggregate only with a measured slow query.
- No ORM, no `@supabase/ssr`, one optional sign-in screen, and no new dependency: Auth and PostgREST are called over
  `fetch` (decision `take-store-rest-client`). Swap in `@supabase/supabase-js` later through a `contract:` PR if needed.
