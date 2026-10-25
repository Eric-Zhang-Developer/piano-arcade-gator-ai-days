## What shipped
Every finished take is saved to Supabase in the background (re-judged on the server, never blocking play), players are
anonymous Supabase users with an optional Google link, and `/progress` shows each take plus the bars to practice.

## Where it lives
`supabase/` (migrations, `README.md` for adding anything, `push.sh`, tests, local end-to-end stack); `/progress` is the
player's profile: every session across songs (when, how long, rank, hits), totals, and per song the bars to practice, `web/src/data/`, `web/src/app/api/takes/`,
`web/src/app/api/progress/`, `web/src/app/progress/`, `web/src/app/auth/callback/`, one line in `web/src/game/layers.ts`.

## How to check it
verify: `pnpm -C /Users/sharan/.worktrees/pa/take-store/web verify --out /Users/sharan/Documents/GitHub/piano-arcade-gator-ai-days/.git/agent-evidence/take-store/20261024T152537Z && node /Users/sharan/.worktrees/pa/take-store/web/src/game/sim/verify-sim.mjs --out /Users/sharan/Documents/GitHub/piano-arcade-gator-ai-days/.git/agent-evidence/take-store/20261024T152537Z/sim` pass at c16236f (evidence: /Users/sharan/Documents/GitHub/piano-arcade-gator-ai-days/.git/agent-evidence/take-store/20261024T152537Z)
42/42 PERFECT with test input and through the piano-sim MIDI path (test takes are never sent). Local stack: Chrome laptop-keys take, rank S with 1 MISS, one
`takes` row and 42 `note_judgments`, missed bar first on `/progress`, no duplicate after reload. 14/14 abuse checks
(`supabase/tests/local-stack/attacks.mjs`: forged tokens, lying scores, id hijack, cross-player reads). Vitest 588 passed, 1 skipped (whole app). `node supabase/tests/migrations.mjs`: pass, 3 migrations apply and keep the rules (18 checks).
Every song: `node supabase/tests/every-song.mjs` → `pass: all 10 songs save and read back` (Oct 24, live, after 0005;
before it, Fur Elise and Clair de Lune were refused). Whole journey: `node supabase/tests/login-e2e.mjs` pass, 10/10, twice (Oct 25). Live project: `node supabase/tests/live-smoke.mjs` pass, 8/8 (anonymous sign-in, save_take, a later GOOD, own-row reads, RLS).

## Gaps
CAPTCHA on anonymous sign-ins not set up. (Migrations 0001–0003 ran by hand and are recorded in the CLI's history;
`supabase/push.sh --status` matches and a dry run says the live database is up to date.)
Google sign-in (link, sign in on another device, merge that device's takes, sign out) is built and unit-tested
(`merge.test.ts`, 5/5) and `merge_player` is live (checked with two throwaway players), and Sharan signed in with Google on `/progress`
(Oct 24 2026: one Google user in Auth). Linking an anonymous player and the second-device merge not yet tried by a person. Drills, Easy, one-hand, chunk, versus, wait-mode, bot and fake-piano takes aren't saved (the server can't re-judge them
yet); the results screen says so, in the Details section (where /play puts plugin panels), not next to the score. Charts must live at `public/songs/<id>/chart.json`, read from disk: on Vercel that needs file tracing for
`public/songs` (local demo is fine). Saves are limited to 20 new takes per player in 5 minutes (kept and resent, never dropped); guests idle 30 days are
deleted nightly (`cleanup_stale_guests`).
