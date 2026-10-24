# Local stack: play a real take and watch it land in Postgres

No Docker needed. Proves the whole path: laptop keys in Chrome, the save plugin, `POST /api/takes` re-judging,
`save_take`, RLS, and `/progress`, against a throwaway Postgres.

1. Postgres 16 on port 5498 with its socket in `$PGHOST`; run `setup.sql`, then both files in `../../migrations/`.
2. PostgREST 12 on :3001: `db-uri = "postgres://authenticator@localhost:5498/postgres"`, `db-anon-role = "anon"`,
   `jwt-secret = "test-secret-test-secret-test-secret-1234"`.
3. `node gateway.mjs` (port 54321).
4. In `web/`: build and start with `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test`, `SUPABASE_SECRET_KEY=sb_secret_test`, `pnpm start -p 3100`.
5. `node play-and-save.cjs`: plays Twinkle on laptop keys with one note skipped. Expect rank S with 1 MISS, one
   `takes` row, 42 `note_judgments`, the missed note's bar first on `/progress`, and no duplicate after a reload.
6. `node attacks.mjs`: 14 abuse checks (no or forged token, test takes, path tricks, oversized bodies, a spoofed Host,
   client-sent scores, a take id reused by another player, cross-player reads, direct writes). Every line must say ok.

For the real project, `node supabase/tests/live-smoke.mjs` from the repo root checks grants, RLS and anonymous sign-in
using the keys in `web/.env.local`, and cleans up after itself.
