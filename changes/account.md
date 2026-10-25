## What shipped
`/auth/login` as a split screen (form, select stage, cited typewriter quotes): guests get a handle and "Keep my progress"; Google players see name, email, avatar, handle, Sign out. `POST /auth/handle` writes only the caller's `players.handle`.
## Where it lives
`web/src/app/auth/` (`login/`, `handle/route.ts`, `AccountChip.tsx`), `web/src/data/account.ts` (+ test), `web/src/data/server.ts`.
## How to check it
verify: `pnpm -C web verify && node web/src/game/sim/verify-sim.mjs` pass at d7c91bc (uncommitted changes). Handle route on a PGlite stand-in: 200 `Sharan_1`; 422 `<script>`; 401 no/forged token; 400 another player's id; other rows unchanged.
## Gaps
Real Google sign-in not tried (needs a person). Not run on `supabase/tests/local-stack/` (no Postgres/PostgREST here); route attacks not in `attacks.mjs` (`supabase/` is outside `owns`). Reduced-motion quote and the chip on the menu (Eric's lane) not seen.
