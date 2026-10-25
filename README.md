# Étude

An arcade rhythm game played on a real 88-key piano (a Yamaha DGX-660) in Chrome. Notes fall toward the keys,
every note you play is judged against the chart's clock to the millisecond, and the results screen shows how you
played it: PERFECT, GREAT, GOOD, MISS and WRONG, how early or late, combo and rank. A learning side will read your takes
and tell you what to practice next; today it runs on a sample learner.

**Judging this project?** Start with [`docs/judges.md`](docs/judges.md), then [Run it for judging](#run-it-for-judging).

Built at Gator Hack V (UF AI Days, Oct 23 to 25, 2026). Why we're building it and what's out of scope:
[`specs/mission.md`](specs/mission.md). Product, UI and code decisions start with the frozen
[Product philosophy](PRODUCT_PHILOSOPHY.md).

## Run it

Needs Node.js 24 (what CI runs), pnpm 10.32.1 (pinned in `web/package.json`; run `corepack enable` once) and Chrome
for the piano.

```bash
cd web
pnpm install
pnpm dev            # http://localhost:3000: the song select
```

| Route | What it is |
|---|---|
| `/` | Song select: every chart under `web/public/songs/`, easiest first, or sorted by composer or recently played. Find filters by title, composer or catalog. Click a song, or ↑/↓ and Enter, then PLAY, PRACTICE, LEARN or WATCH. |
| `/play?song=<id>` | The game. Plug a MIDI piano in over USB and Chrome asks for MIDI access. With no piano, the home row plays the white keys (`A` through `;`), the row above plays the black keys between them, and Z / X move them an octave. |
| `/play?midi=sim` | The game on a virtual DGX-660 instead of real MIDI. |
| `/sim` | The piano simulator: the game, a virtual keyboard, a raw MIDI log, fault buttons (stall, unplug, jitter, stuck note) and a bot that plays the song perfectly. `/sim?record` records a real piano into a test fixture. |
| `/learn` | The learning side (the nav's **Learn**) and its activities. It runs on an authored sample learner and isn't connected to your takes or an account yet ([#874](https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/874)). Its activities: `/learn/understand` (explore a musical idea), `/learn/practice` (a short passage with guidance), `/learn/review/theory` (recall the idea) and `/learn/play-through` (the whole melody, feedback after the last bar); `/learn/brand-preview` is a brand direction review, and `/learn/explore` and `/learn/review` redirect to `/learn`. |
| `/sheet?song=<id>` | The chart's score as sheet music, following the take while `/play` runs. |
| `/stage` | The live take on NOSTALGIA's hill, for people watching on a second display. `/play`'s start screen opens it. |
| `/calibrate` | Tap along to 12 clicks to measure your latency offset. |
| `/progress` | Your saved takes over time. |
| `/lab` | Experimental and hidden features, each with one link. The experiment and spike pages, and the video cards, follow. |
| `/real-keys` | Spike: calibrate a camera on the key bed, then play with the highway's notes falling onto the live picture of the real keys. |
| `/highlight` | Spike: renders a take into a 15 s broadcast replay WebM. |
| `/composers-hands` | Spike: plays a composer's own piano roll, or his left hand while you play the right, and draws his tempo against yours. |
| `/paint` | Spike: free play where each note blooms as paint in Scriabin's colors, wet while the pedal is down. |
| `/speak` | Spike: plays a preset phrase or your voice on the DGX, the voice's spectrum struck on 88 keys. |
| `/musicbox` | Your take as a brass music-box cylinder over a steel comb, with an STL export (Lab: Pinned). |
| `/sonata` | The Build Sonata: the night the agents built Étude as 90 s of music, one note per merged PR. |
| `/shots?card=title\|end` | The video's title and end cards. |
| `/veritas` | The judge on trial: test players plant known mistakes in real songs, and the game's judge has to find exactly those. |

The nav bar links `/`, `/learn`, `/lab` and `/progress` (and `/operator` on the dev server). The other pages in
`web/src/app/` are spikes (`/simon`, `/wrong-note`, `/conduct`), the kiosk loop (`/cabinet`, `/attract`), sign-in
(`/auth/login`, and `/auth/callback` it returns to) and `/operator`, the agents' status board.

Web MIDI works in Chrome only. Laptop keys always work, so the game is playable with the piano unplugged. Contributors
editing the learning frontend: [`PRODUCT_AND_DESIGN.md`](PRODUCT_AND_DESIGN.md) has the run-and-edit map.

## Run it for judging

A production build, which also runs with the wifi off ([`changes/offline-ready.md`](changes/offline-ready.md)):

```bash
corepack enable
cd web
pnpm install
pnpm build          # needs the network once: it downloads the Saira font
pnpm start          # http://localhost:3000, works offline from here on
```

`pnpm dev` with no network falls back to system fonts, so build before going offline.

No keys are needed to play. With no `web/.env.local`, every song, the results screen, `/sheet`, `/sim` and `/veritas`
work, and takes save in the browser's localStorage. These features read keys from `web/.env.local`:

| Variable | Used by | Without it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sign-in, the account chip, server-saved takes, `/progress` from the server (`web/src/data/config.ts`) | No sign-in; takes stay in localStorage |
| `SUPABASE_SECRET_KEY` | The server routes that save and read takes (`web/src/data/server.ts`) | Takes aren't saved on the server |
| `ANTHROPIC_API_KEY` | The learning side's theory chat (`web/src/app/learn/api/chat/route.ts`) | The chat shows it isn't configured, never a reply |

Never commit `web/.env.local`, and never put a secret in a `NEXT_PUBLIC_` name.

## How it works

```
 piano (USB MIDI) ─┐
 laptop keys ──────┼─> one input interface ─> judge (pure, per note) ─> results screen
 virtual piano ────┘          │                       │
                              └── chart clock <───────┘
                                     │
               canvas highway (one lane per key)   drum beat out to the piano (MIDI out)
```

- **Charts** are JSON files in `web/public/songs/<id>/chart.json`, each citing its source score: 40 songs (`git ls-files 'web/public/songs/*/chart.json' | wc -l`).
- **Judging** (`web/src/game/core/judge.ts`) is a pure function of the chart and the key presses, after the
  latency offset: PERFECT within 40 ms, GREAT within 80 ms, GOOD within 120 ms (`web/src/game/core/settings.ts`),
  MISS when no key of the same pitch arrives in time. A key press that matches no note is an extra, never a MISS;
  an extra is a WRONG note unless it's part of a nearby note's timing. A MISS or a WRONG note breaks the combo. The
  full rules are in [`specs/mission.md`](specs/mission.md). The same judge runs in tests with synthetic players.
- **Rendering** is one 2D canvas per layer on `requestAnimationFrame`. Per-frame game state lives in refs, not React
  state. React draws menus and the results screen only.
- **Sound** is scheduled ahead on the chart clock. The beat track (`web/src/game/beat/`) sends a drum beat to the
  piano's own drum kit over MIDI out from the count-in to the end, and falls back to laptop clicks with no piano.
- **Plug-in layers.** Each game feature registers itself with one line in `web/src/game/layers.ts`, so features
  land in parallel without touching each other's code.
- **Shared formats** (`Chart`, `Take`, `Results`, game events, input) live in `web/src/contracts/` and are frozen.
  Both lanes build on them.

Stack: Next.js (App Router) and TypeScript, pnpm, Vitest, Playwright. Details: [`specs/tech-stack.md`](specs/tech-stack.md).

## Repo map

| Path | What's there |
|---|---|
| `web/src/game/` | Game lane: clock, input, judging, highway (`core/`), beat track, timing feedback, piano simulator |
| `web/src/contracts/` | Frozen shared formats |
| `web/src/app/` | Next.js routes, listed under [Run it](#run-it) |
| `web/public/songs/` | One folder per chart |
| `web/e2e/verify.mjs` | Starts the app, plays Twinkle headless as the perfect player, fails unless every note is PERFECT |
| `specs/` | The source of truth: mission, tech stack, roadmap, milestones, one folder per feature, decisions, playtest findings |
| `changes/<feature>.md` | What each finished feature shipped and how to check it |
| `spikes/` | Feasibility evidence (the piano MIDI test, an agent-written Mozart variation). Never imported. |
| `docs/judges.md` | The project against the judging criteria, each claim linked to its evidence |
| `docs/devpost.md` | The Devpost submission draft, with its open items marked |
| `docs/story.md` | How it got built, one chapter per milestone |
| [`CREDITS.md`](CREDITS.md) | Every committed third-party file whose license asks for credit: its source, license and what we changed |

## Checks

```bash
pnpm -C web lint && pnpm -C web typecheck && pnpm -C web test && pnpm -C web build
pnpm -C web exec playwright install chromium            # once per clone: verify drives Playwright's Chromium
pnpm -C web verify --out /tmp/piano-arcade-evidence     # headless end-to-end run, saves a results screenshot
```

Web MIDI can't run headless, so anything that needs the real piano is checked by hand on the DGX-660, and each
feature's `changes/` note says so.

## How we work

Specs first, then code. Every feature has a spec in `specs/features/<slug>/spec.md`, ships in a PR titled
`feat(<slug>): ...`, and counts as done when `changes/<slug>.md` lands on `main`. Milestone order lives in
`specs/milestones.toml`. The rules every contributor and coding agent follows are in [`AGENTS.md`](AGENTS.md).
