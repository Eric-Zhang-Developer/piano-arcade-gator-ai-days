## What shipped
Every finished take is saved to Supabase in the background (re-judged on the server, never blocking play), players are
anonymous Supabase users with an optional Google link, and `/progress` shows each take plus the bars to practice.

## Where it lives
`supabase/` (migrations, SQL test, local end-to-end stack), `web/src/data/`, `web/src/app/api/takes/`,
`web/src/app/api/progress/`, `web/src/app/progress/`, `web/src/app/auth/callback/`, one line in `web/src/game/layers.ts`.

## How to check it
`verify.py`: pass, 42/42 PERFECT (test takes not sent). Local stack: Chrome laptop-keys take, rank S with 1 MISS, one
`takes` row and 42 `note_judgments`, missed bar first on `/progress`, no duplicate after reload. 14/14 abuse checks
(`supabase/tests/local-stack/attacks.mjs`: forged tokens, lying scores, id hijack, cross-player reads). Vitest 47/47.
Live project: `node supabase/tests/live-smoke.mjs` pass, 7/7 (anonymous sign-in, save_take, own-row reads, RLS).

## Gaps
Google linking untested (needs the
Google provider set up). Drills aren't saved. Charts must live at `public/songs/<id>/chart.json`, read from disk: on Vercel that needs file tracing for
`public/songs` (local demo is fine). No per-player rate limit on saves.
