---
name: "Operator board: the arcade's back office, live, showing how agents build Piano Arcade"
depends_on: ["core-loop"]
owns: ["web/src/operator/", "web/src/app/operator/", "web/src/app/api/operator/", "web/public/operator/"]
assignee: "eric"
---

# Operator board

Real arcade cabinets hide an **operator menu**: bookkeeping screens with coin counts and play time. Ours is
`/operator`, a page of the web app in a **synthwave bookkeeping** style. It shows how the agent-built project is
going, from the repo and GitHub, and answers in order:
1. **What needs a person?**
2. **Who's working?**
3. **The bookkeeping:** features, PRs and time.

`operator-replay` adds the judges' replay at `/attract`.

There are two audiences. **The team** opens it live while agents work. **Judges** see a frozen snapshot of the
same page that works offline and can never show an error.

Inspired by KnightHacks' foreman (`~/code/hackathons/knighthacks-2026`, `specs/features/foreman/spec.md`): take its
ideas, not its code. Its key lesson: the version that called GitHub on every view hit the rate limit and went blank
in production.

## Plan
1. A collector (server-only) that reads repo files from disk and GitHub through `gh`.
2. A board model: pure functions, `status.py`'s rules, unit-tested.
3. Live mode: a route that serves the board, cached. Snapshot mode: a frozen file.
4. The page, in the synthwave style.

## Requirements
**Data** (server-only, in `web/src/operator/`):
- **Repo files, from disk:**
  - every `specs/features/*/spec.md` frontmatter (`name`, `depends_on`, `assignee`, `owns`);
  - `changes/*.md`;
  - `specs/milestones.toml` (a small reader for its own shape; no new dependency);
  - `STOP`.
- **GitHub, through the `gh` CLI** (the user's own login, so no token is handled by the app):
  - PRs, all states, with title, body, number, created, merged, closed, draft, URL and head CI;
  - open issues with labels;
  - main's last completed CI run.

  Keep it to at most 5 `gh` calls per collection.
- **Heartbeats:** the files in `$(git rev-parse --git-common-dir)/agent-heartbeats/`, read by modification time.
  These are local-only and never go into a snapshot.
- **Any failure** (no `gh`, not logged in, rate limit, offline) leaves the board built from files, with a banner
  saying what's missing. It never shows an error page.

**State rules,** exactly `AGENTS.md` and `status.py`:
- **done** = `changes/<slug>.md` on main.
- **in flight** = an open PR titled `feat(<slug>): ...`.
- **ready** = every `depends_on` is done and the feature isn't in flight.
- **blocked** = otherwise.
- **backlog** = in no milestone.
- **cut** = on a milestone's `cut` list.
- **unknown** = without PR data, in flight can't be told from ready or blocked: show `unknown`, never a guess.

**Workers:** the `Worker:` line in a PR body. With no line, a `plan:` or `contract:` PR counts as `planner`, and any
other PR as `unnamed`. Never guess.

**Live mode** (`pnpm dev`):
- `GET /api/operator` returns the board, collecting at most once every 60 s (an in-memory cache). That's at most
  300 `gh` calls an hour, well under the rate limit that the agents share.
- The page re-fetches every 15 s and shows the data's age.
- Heartbeat freshness: "ran in the last 10 min" / "idle".

**Snapshot mode:**
- In development, a "Freeze snapshot" button `POST`s to `/api/operator/snapshot`, which writes
  `web/public/operator/snapshot.json`. It contains the board without heartbeats, the time and main's SHA.
- `/operator?snapshot` reads only that file, makes no network call and works offline.
- A committed snapshot is what judges see. Eric freezes it before judging.

**Screens,** one page, in order, with keys 1–3 to jump:
1. **Needs a person:**
   - open non-draft `plan:` and `contract:` PRs, which agents don't merge;
   - open `needs-human` and `blocked` issues;
   - draft PRs with no push for 45 min (the watchdog's number);
   - main CI red;
   - a `STOP` file.

   Each item links to GitHub. An empty list says "nothing waiting".
2. **Crew:** each worker, with their open PRs (title, CI dot) and, in live mode only, heartbeat freshness.
3. **Bookkeeping:**
   - features done of planned, per milestone;
   - PRs merged, by type;
   - the median time from a PR's open to its merge;
   - the 3 longest builds;
   - the first PR's time.

**The header:** "OPERATOR MODE", a link "ATTRACT MODE ▶" to `/attract` (keeping `?snapshot`; it 404s until
`operator-replay` ships), the mode (LIVE or SNAPSHOT), the data's time and main's SHA, and the `gh` status
(`gh: ok · N calls`, `gh: not logged in`, `gh: failed`).

**The synthwave style:**
- a dark purple-to-black sky, neon magenta and cyan, a perspective grid at the bottom;
- a monospace font with CRT scanlines;
- numbers in a bookkeeping table layout.

Fonts come from `next/font` (no new dependency). The rules:
- Text contrast is at least 4.5:1.
- State is never shown by color alone; each state also has a label or glyph.
- With reduced motion, nothing animates.
- It works on a laptop screen. Mobile is out of scope.

**Safety:** `noindex`, linked from nowhere in the game. No game code changes. The `/api/operator` routes only work
in development (`NODE_ENV !== "production"`); in a production build they return 404 and the page uses the snapshot.

## Validation
- `pnpm -C web test`, Vitest, no network:
  - The state rules on fixed inputs: done, in flight, ready, blocked, backlog, cut, and `unknown` without PR data.
  - The milestones reader on the real `specs/milestones.toml`, and the feature count equals the spec folders on disk
    (not counting `_template`).
  - Workers: a `Worker:` line, a `plan:` PR without one (`planner`), a `feat` PR without one (`unnamed`).
  - Needs a person on fixed inputs, including a stale draft at 46 min and not at 44.
  - The collector with `gh` failing -> a board from files plus the banner, no throw.
  - The collector against a fake `gh` -> no more than 5 calls.
  - A snapshot has no heartbeat data, and a snapshot round-trips into the same board.
- In Chrome, each step `action -> what you should see`:
  1. `pnpm -C web dev`, open `/operator` -> LIVE, the gh status, all three screens. Every open `plan:`/`contract:`
     PR and `needs-human` issue on GitHub at that moment is listed.
  2. Wait 15 s -> the age resets after a re-fetch, and no more than one `gh` collection happens per 60 s (server log).
  3. Click "Freeze snapshot", then open `/operator?snapshot` with the network off -> SNAPSHOT, the same numbers,
     no heartbeats, no error.
  4. Press 1, 2, 3 -> each screen in turn.

  Keep a screenshot of LIVE and one of SNAPSHOT.

## Defaults
- Prefer the smaller option. No new dependencies. Charts, if any, are plain SVG.
- Anything the data can't answer shows `unknown`.
- Don't commit a snapshot from this feature: Eric freezes one when he wants.
