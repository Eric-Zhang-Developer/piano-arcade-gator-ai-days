# Tech stack

New dependencies only through a `contract:` PR (`web/package.json` and `web/pnpm-lock.yaml` are frozen paths).

| Layer | Choice |
|---|---|
| Language / framework | Next.js (App Router) with TypeScript, in `web/`. Pin the exact versions the bootstrap installs in `web/package.json`. |
| Package manager | pnpm, pinned with the `packageManager` field; teammates run `corepack enable` once. |
| Rendering | One 2D canvas per layer, driven by `requestAnimationFrame`. Game state per frame lives in refs, never React state; React renders menus and the results screen only. One exception: at most one WebGL background under the highway, through `GamePlugin.background` (`fever-stage`). |
| 3D | three.js (`three`, pinned), for the fever stage and the attract mode. It never draws notes, keys or the judgment line, which stay 2D. |
| Sheet music | OpenSheetMusicDisplay (`opensheetmusicdisplay`, pinned), only in the sheet-music window (`/sheet`); never on the arcade screen (decision 001, row 13). |
| Input | Chrome Web MIDI (`navigator.requestMIDIAccess`) and laptop keys, behind one input interface. Client components only. |
| Sound | Web Audio API, scheduled on the audio clock. No audio libraries unless a `contract:` PR adds one. |
| Data / database | Supabase Postgres (free tier) for take history only (`take-store`). Written only by Next.js server routes with the secret key; migrations in `supabase/migrations/`. Charts stay JSON files in `web/public/songs/`; settings (latency offset) stay in `localStorage`. The game is fully playable with the database unreachable: nothing in the playing loop touches the network. |
| Accounts | Supabase Auth. A player becomes an anonymous user on their first save, with no sign-in screen. Linking Google (`linkIdentity`) is optional and keeps the same user id. |
| Hosting | Local only for now (`pnpm dev`). A Vercel deploy is a later, deliberate step. |
| Tests | Vitest for pure functions, with synthetic players; Playwright for `[verify].command`. Database: `supabase/tests/migrations.mjs` on PGlite (its own `supabase/tests/package.json`, not part of `web/`) and `supabase/tests/live-smoke.mjs` for the live project. |
| Learning lane | Provisional: decided by its person. The coach is expected to run on Gemini behind one Next.js route. |

## Environment
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser), `SUPABASE_SECRET_KEY` (server only,
never `NEXT_PUBLIC_`), and `SUPABASE_DB_URL` (only for `supabase/push.sh`, which applies migrations). They live in
`web/.env.local`, which is never committed. Without the first three, the take store falls back to `localStorage`.
No Supabase SDK: Auth and PostgREST are called over `fetch` (decision `take-store-rest-client`). Migrations are applied
with the Supabase CLI through `npx`, pinned to one version, never added to `web/package.json`.

## Layout
Created by the bootstrap feature (`core-loop`).
```
web/
  package.json, pnpm-lock.yaml        frozen: dependency changes need a contract: PR
  src/
    contracts/                        frozen: chart, take, results, game events, input (shared by both lanes)
    app/                              Next.js routes: play/ (core-loop), page.tsx (song-select)
    game/                             game lane (eric)
      core/                           clock, input, judging, highway (core-loop)
      layers.ts                       open: each game feature registers its layer or hook here, one line
      hud/  juice/  sound/  piano-out/  midi-watchdog/  bar-loop/  stage/
    learn/                            learning lane (provisional)
  public/songs/<id>/chart.json        one folder per piece
  e2e/                                Playwright verify script
tools/                                learning lane: offline chart compiler and song ripping (Python)
spikes/piano-midi/                    evidence from the feasibility spike; never imported
```

## Checks (run before marking a PR ready)
```bash
python3 .agents/scripts/check_ownership.py --lint-specs
python3 .agents/scripts/check_ownership.py --title "<PR title>" --base origin/main
python3 .agents/scripts/check_gates.py --title "<PR title>" --base origin/main
python3 .agents/scripts/check_markers.py --base origin/main
pnpm -C web lint && pnpm -C web typecheck && pnpm -C web test && pnpm -C web build
npm --prefix supabase/tests ci && node supabase/tests/migrations.mjs   # when supabase/ changed
```
The bootstrap feature adds the `pnpm` scripts and replaces CI's placeholder "Project checks" step with that last line.

## Verify (see your change running)
The bootstrap feature sets `[verify].command` in `.agents/config.toml` to a Playwright script that starts the app,
opens `/play` headless, plays the Twinkle chart with simulated laptop keys as the Perfect player, and fails unless
the results screen shows every note PERFECT. It saves a screenshot of the results screen to the evidence folder.
Web MIDI can't be driven headless: anything that depends on the real piano is checked by Eric, and its done note
says so.
