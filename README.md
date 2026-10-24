# Piano Arcade

An arcade rhythm game played on a real 88-key piano (a Yamaha DGX-660) in Chrome. Notes fall toward the keys,
every note you play is judged against the chart's clock to the millisecond, and the results screen shows how you
played it: PERFECT, GREAT, MISS and extras, how early or late, combo and rank. A learning lane will read your takes
and tell you what to practice next.

Built at Gator Hack V (UF AI Days, Oct 23 to 25, 2026). Why we're building it and what's out of scope:
[`specs/mission.md`](specs/mission.md).

## Run it

Needs Node.js, pnpm (pinned in `web/package.json`; run `corepack enable` once) and Chrome for the piano.

```bash
cd web
pnpm install
pnpm dev            # http://localhost:3000 redirects to /play
```

| Route | What it is |
|---|---|
| `/play` | The game. Plug a MIDI piano in over USB and Chrome asks for MIDI access. With no piano, the home row plays the white keys (`A` through `;`) and the row above plays the black keys between them. |
| `/play?midi=sim` | The game on a virtual DGX-660 instead of real MIDI. |
| `/sim` | The piano simulator: the game, a virtual keyboard, a raw MIDI log, fault buttons (stall, unplug, jitter, stuck note) and a bot that plays the song perfectly. `/sim?record` records a real piano into a test fixture. |

Web MIDI works in Chrome only. Laptop keys always work, so the game is playable with the piano unplugged.

## How it works

```
 piano (USB MIDI) ─┐
 laptop keys ──────┼─> one input interface ─> judge (pure, per note) ─> results screen
 virtual piano ────┘          │                       │
                              └── chart clock <───────┘
                                     │
               canvas highway (one lane per key)   drum beat out to the piano (MIDI out)
```

- **Charts** are JSON files in `web/public/songs/<id>/chart.json`, each citing its source score. Twinkle is the
  first one.
- **Judging** (`web/src/game/core/judge.ts`) is a pure function of the chart and the key presses, after the
  latency offset: PERFECT within 25 ms, GREAT within 50 ms, MISS when no key of the same pitch arrives in time. A
  key press that matches no note is an extra, never a MISS. The same judge runs in tests with synthetic players.
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
| `web/src/app/` | Next.js routes (`/play`, `/sim`) |
| `web/public/songs/` | One folder per chart |
| `web/e2e/verify.mjs` | Starts the app, plays Twinkle headless as the perfect player, fails unless every note is PERFECT |
| `specs/` | The source of truth: mission, tech stack, roadmap, milestones, one folder per feature, decisions, playtest findings |
| `changes/<feature>.md` | What each finished feature shipped and how to check it |
| `spikes/` | Feasibility evidence (the piano MIDI test, an agent-written Mozart variation). Never imported. |
| `docs/story.md` | How it got built, one chapter per milestone |

## Checks

```bash
pnpm -C web lint && pnpm -C web typecheck && pnpm -C web test && pnpm -C web build
pnpm -C web verify --out /tmp/piano-arcade-evidence     # headless end-to-end run, saves a results screenshot
```

Web MIDI can't run headless, so anything that needs the real piano is checked by hand on the DGX-660, and each
feature's `changes/` note says so.

## How we work

Specs first, then code. Every feature has a spec in `specs/features/<slug>/spec.md`, ships in a PR titled
`feat(<slug>): ...`, and counts as done when `changes/<slug>.md` lands on `main`. Milestone order lives in
`specs/milestones.toml`. The rules every contributor and coding agent follows are in [`AGENTS.md`](AGENTS.md).
