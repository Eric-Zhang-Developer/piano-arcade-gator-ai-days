## What shipped
Every finished take is saved to Supabase in the background (re-judged on the server, never blocking play), players are
anonymous Supabase users with an optional Google link, and `/progress` shows each take plus the bars to practice.

## Where it lives
`supabase/` (migrations, `README.md` for adding anything, `push.sh`, tests, local end-to-end stack), `web/src/data/`, `web/src/app/api/takes/`,
`web/src/app/api/progress/`, `web/src/app/progress/`, `web/src/app/auth/callback/`, one line in `web/src/game/layers.ts`.

## How to check it
`verify: ... pass at 08b3ecb` (now with the piano-sim MIDI path) (42/42 PERFECT; test takes not sent). Local stack: Chrome laptop-keys take, rank S with 1 MISS, one
`takes` row and 42 `note_judgments`, missed bar first on `/progress`, no duplicate after reload. 14/14 abuse checks
(`supabase/tests/local-stack/attacks.mjs`: forged tokens, lying scores, id hijack, cross-player reads). Vitest 49/49. `node supabase/tests/migrations.mjs`: pass, 3 migrations apply and keep the rules (18 checks).
Live project: `node supabase/tests/live-smoke.mjs` pass, 8/8 (anonymous sign-in, save_take, a later GOOD, own-row reads, RLS).

## Gaps
CAPTCHA on anonymous sign-ins not set up. (Migrations 0001–0003 ran by hand and are recorded in the CLI's history;
`supabase/push.sh --status` matches and a dry run says the live database is up to date.)
Google sign-in (link, sign in on another device, merge that device's takes, sign out) is built and unit-tested
(`merge.test.ts`, 5/5) and `merge_player` is live (checked with two throwaway players), but the Google click-through itself hasn't been
tried by a person yet. Drills aren't saved. Charts must live at `public/songs/<id>/chart.json`, read from disk: on Vercel that needs file tracing for
`public/songs` (local demo is fine). No per-player rate limit on saves.
