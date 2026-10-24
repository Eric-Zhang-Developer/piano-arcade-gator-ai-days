# The database (Supabase Postgres)

Everything the game remembers about players lives here. The game itself never waits on it: judging, sound and LEDs
run locally, and a take that can't be saved waits in the browser's outbox. Owner: Sharan (`take-store`).

## What's in it
| Thing | Kind | What it holds | Who can read it |
|---|---|---|---|
| `songs` | table | one row per `web/public/songs/<id>/chart.json`, with its SHA-256 | anyone (public key) |
| `players` | table | one row per Supabase Auth user (anonymous first, Google later); optional `handle` | that player |
| `takes` | table | one finished take: counts, accuracy, rank, drill bars, versions, the raw `Take` and `Results` JSON | that player |
| `note_judgments` | table | one row per chart note per take: pitch, hand, bar, beat, judgment, signed offset, velocity | that player |
| `coach_feedback` | table | what the coach said and the exact numbers it was checked against | that player |
| `bar_trends` | view | per bar over a player's last 5 takes of a song: notes, misses, mean offset, spread | that player |
| `take_history` | view | one row per take, for the progress chart | that player |
| `session_history` | view | every take with its song title, when and how long it was played: the profile page | that player |
| `hand_stats` | view | per song and hand: notes by judgment, mean timing, spread, velocity: the profile's hands panel | that player |
| `save_take(take, notes)` | function | saves a take and its notes in one transaction; answers `saved`, `duplicate` or `conflict` | server only |
| `merge_player(from, to)` | function | moves an anonymous device's takes and coach notes into a Google account (`/auth/merge`) | server only |
| `rls_auto_enable` | Supabase's own | turns RLS on for new tables automatically; not ours, leave it | nobody |

Only Next.js server routes write, with `SUPABASE_SECRET_KEY`. The browser holds the publishable key and the player's
own session, so it can read that player's rows and nothing else. Auth: anonymous sign-ins on; Google for "Keep my progress" and "Sign in with Google" (setup below).

## Keys (all in `web/.env.local`, which git ignores)
| Variable | Where it's used | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project Settings > API: Project URL (`https://<ref>.supabase.co`, not a dashboard link) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Project Settings > API Keys: `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | server only | Project Settings > API Keys: `sb_secret_...`. Never in a `NEXT_PUBLIC_` variable. |
| `SUPABASE_DB_URL` | `supabase/push.sh` only | Connect > Direct > Session pooler URI, with the database password filled in: `postgresql://postgres.umswmcehegvggcfcjdfy:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres`. Not the direct `db.<ref>.supabase.co` one: it's IPv6-only and refused on most networks. |

## Adding a song
Nothing to do in the database: a song's row in `songs` is written (or updated, with the chart's new SHA-256) the first
time anyone saves a take of it. Put the chart at `web/public/songs/<id>/chart.json`, then prove every song still saves,
with the app running locally: `node supabase/tests/every-song.mjs`. It plays a perfect and a messy take of each song
through `/api/takes`, checks the stored rows and `/api/progress`, and deletes what it made. Charts under
`songs/local/` are never stored (decision 003).

## What gets saved
A finished take of a committed song, played by a person, on the chart as committed. Not saved: test input, bots
(`?bot=`), the fake piano (`?midi=sim`), versus, wait mode, local songs, and any take whose chart a plugin changed
(bar-loop, one hand, chunk practice, another tempo): the server re-judges against the committed chart, so those scores
would be wrong. The rule lives in `web/src/data/save-plugin.ts` (`unsavableReason`, `sameChart`). The results screen says which it was:
"Saved to your account ✓", "Saved as a guest ✓", "Not saved yet: …" (kept, sent later) or "Not saved: …" (`SaveStatus.tsx`).

## Adding something (a column, a table, a view, seed rows)
1. **Make the file:** `npx -y supabase@2.122.0 migration new <what_it_does>` creates
   `supabase/migrations/<timestamp>_<what_it_does>.sql`. Never edit a migration that's already live: add a new one.
2. **Write the SQL, following the house rules** (the test enforces the first four):
   - `alter table ... enable row level security` on every new table.
   - No `insert`/`update`/`delete` grants to `anon` or `authenticated`: the server writes.
   - Views get `with (security_invoker = true)`.
   - `revoke execute on function ... from public, anon, authenticated` on every new function.
   - Grant what the server needs to `service_role` (new tables aren't exposed automatically on this project), and
     add a `... for select to authenticated using (player_id = (select auth.uid()))` policy for player-owned rows.
   - CHECKs guard shape and sanity, not game rules: the game's contracts change (decision `take-store-contract-tolerant`).
   - Reference data (like songs) goes in as `insert ... on conflict do update`, so running it twice is harmless.
3. **Test it with no database:** `npm --prefix supabase/tests ci && node supabase/tests/migrations.mjs`. It applies every
   migration to an in-memory Postgres and fails on a table without RLS, a browser write grant, an unsafe view or an
   open function. Add a check there for what you added.
4. **Teach the code:** row types in `web/src/data/mapping.ts`, reads in `web/src/data/progress.ts`, and a check in
   `supabase/tests/live-smoke.mjs` if the live project should prove it.
5. **Ship it:** open the PR. Once it's merged, run `supabase/push.sh`. It runs step 3, lists what the live project would
   run, asks, applies with the Supabase CLI (which records it in `supabase_migrations.schema_migrations`), then runs
   the live smoke test. `supabase/push.sh --status` shows what's live.

No `SUPABASE_DB_URL` yet? Paste the new file into the dashboard's SQL Editor instead, then mark it as applied so the
CLI doesn't run it again: `npx -y supabase@2.122.0 migration repair --status applied <timestamp> --db-url "$SUPABASE_DB_URL"`.

## One-time setup (already done unless noted)
- [x] Migrations 0001–0003 applied by hand in the SQL Editor (Oct 24 2026).
- [x] Anonymous sign-ins on (Authentication > Sign In / Providers).
- [x] "Automatically expose new tables" off; RLS auto-enable on.
- [x] `SUPABASE_DB_URL` in Sharan's `web/.env.local`, and 0001–0003 recorded as applied in the CLI's history
      (`migration repair`, Oct 24 2026). `supabase/push.sh --status` shows local and remote matching.
- [ ] CAPTCHA (Turnstile or hCaptcha) on anonymous sign-ins: Supabase's advice, since every visitor becomes a user row.
- [ ] Email sign-up is on but unused: turn it off unless the coach lane needs it.
- [x] Google sign-in (provider on, manual linking on, redirect URL set; Oct 24 2026):
  1. Google Cloud console: OAuth consent screen (External, Testing; add every player's Gmail as a test user), then
     a **Web application** OAuth client with origin `http://localhost:3000` and redirect URI
     `https://umswmcehegvggcfcjdfy.supabase.co/auth/v1/callback`.
  2. Supabase > Authentication > Sign In / Providers > Google: on, with that client's ID and secret (never in git).
  3. Same page: **Allow manual linking** on (needed to link Google to an anonymous player).
  4. Authentication > URL Configuration: Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/auth/callback`
     (add the deployed URL's `/auth/callback` when there is one).
  5. `merge_player` (0004) is live and recorded (Oct 24 2026).

## Things to know about the free plan
- A project with no traffic for 7 days is paused; restoring takes a minute from the dashboard. Open the app (or the
  dashboard) in the days before a demo.
- No automatic backups. Before anything risky: `npx -y supabase@2.122.0 db dump --data-only --db-url "$SUPABASE_DB_URL" -f backup.sql`
  (keep it out of git: it holds player data).
