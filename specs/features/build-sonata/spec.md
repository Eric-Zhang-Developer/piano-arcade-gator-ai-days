---
name: "The Build Sonata: the DGX performs the night the agents built Étude, one note per merged PR"
depends_on: ["experiments", "core-loop", "scenes", "golden-demo", "demo-performance", "capture-mode", "easy-charts", "duo-tokens"]
owns: ["specs/features/build-sonata/", "changes/build-sonata.md", "specs/decisions/build-sonata-", "web/src/game/x/build-sonata/", "web/src/app/sonata/", "web/public/songs/x/build-sonata/"]
assignee: "eric"
---

# The Build Sonata

Issue #1162, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878. It
lands on main off by default and stays out of the main game until Eric picks it in the Lab.

**The pitch:** the DGX performs the night the agents built Étude. Each merged PR is a note, and a red main turns the
music minor until its fix lands. It plays in about 90 s, and it's also playable as a level.

**Lineage:** Hatnote's Listen to Wikipedia and NASA's data sonifications. The done note cites each by URL and quotes
nothing from memory.

**The size, measured on origin/main when this spec was written:**
- 697 first-parent commits, from 2026-10-23T20:39 to 2026-10-25T09:36 (ET);
- 684 of them end in a PR number.

The pitch's "1,100" isn't a number to print. The page prints the snapshot's own count.

## How it mounts
- **The chart has to live under `web/public/songs/`.** `/play` loads a song from its folder there
  (`app/play/page.tsx:38`). The bot demo also needs the chart as loaded: scenes' bot plays the chart it was handed,
  and the frame's `transformChart` runs last. So the generated chart goes in `web/public/songs/x/build-sonata/`
  (`chart.json` and its `pedal.json`).
- **That puts it in the song select.** The select lists every chart under `web/public/songs/` at any depth
  (`song-select/load.ts`), so the sonata appears there as a normal song. Logged; the planner decides whether that's
  fine.
- **`/sonata`** (`web/src/app/sonata/page.tsx`, over `web/src/game/x/build-sonata/`), on the #914 pattern:
  - the night as a static roll, with hover showing each note's hash, lane and short subject;
  - the real count and the time span;
  - three links:
    - **Listen** (the DGX bot demo): `/play?song=x/build-sonata&bot=perfect&audible=1&demo=1&x=build-sonata`;
    - **Play it** (Easy, through easy-charts): `/play?song=x/build-sonata&level=easy&x=build-sonata`;
    - **Play it** (full).
- **On `/play` with `?x=build-sonata`,** through the frame:
  - a `draw` plugin puts the merged-PR counter and the real-time clock in the HUD band, and each note's short subject
    riding with it in the kit's mono at low contrast;
  - a `resultsPanel` links back to `/sonata`.

  Without the flag, it's a plain song.
- **Registry entry** (`web/src/game/x/index.ts`, its one line, under the lane rule): group "Wow", line "The night
  the agents built Étude, as music (#1162)", href `/sonata`.
- **It reads only git, plus `gh` for issue times.** It never reads the operator board's files (`/operator`'s replay is
  the foreman's).

## What to build
1. **The snapshot** (`web/src/game/x/build-sonata/make-sonata.mjs`, a re-runnable Node script):
   - **What it reads:** `git log --first-parent origin/main`.
   - **Per commit:**
     - the hash and commit time;
     - the Conventional Commits type and scope;
     - the PR number;
     - the lines changed (`--numstat`, summed);
     - the lane.
   - **Red-main intervals:** the open and close times of `main-red` and `ci-red` issues, from
     `gh issue list --label <l> --state all --json number,createdAt,closedAt`. Both labels exist. If `gh` can't read
     them, leave them out, and the page says "red-main data unavailable". Log which label counts as red: by default
     `main-red` is the minor, and `ci-red` a lighter shade or nothing.
   - **Lanes only, never personal names or emails:**
     - no author field is read or stored;
     - the lane comes from the scope's spec `assignee` (its person, then the Lanes table in AGENTS.md: game, backend,
       learning), or, for an unscoped commit, from the paths it changed;
     - `plan`, `contract` and `docs` commits form their own group;
     - other people's commits count only as their lane;
     - **subjects are scrubbed:** any name or handle from AGENTS.md's Lanes table, and anything shaped like an email,
       becomes the lane's name;
     - a test asserts that the snapshot holds none.
   - **Output:** the snapshot is committed as `snapshot.json` in the folder, and the chart and pedal are generated
     from it.
   - **The refresh:** at the freeze, re-run the script and commit the new snapshot and chart.
2. **The mapping** (pure, `sonata.ts`), musical by construction:
   - **Time:** an activity-weighted warp to about 90 s, so busy hours get more room than idle ones. The clock label
     shows the real time (ET).
   - **Harmony:** a fixed progression, by default I–V–vi–IV in C, logged. Every note is a chord tone of the active
     chord. Fixes are short passing tones, labeled as such in the chart's note ids.
   - **Register by lane:**
     - game: the upper right hand;
     - backend: the bass;
     - learning: a middle voice;
     - plan, contract and docs: a soft high bell.

     Hands for the chart: game and the bell group as R, backend and learning as L (logged). Every pitch stays within
     21–108.
   - **Velocity:** from log(lines changed), capped (logged).
   - **Shapes:** `feat` is a long tone, `fix` a short passing tone, and `revert` a falling figure.
   - **Red main:** a red-main stretch moves the harmony to the minor (vi), and the fix's merge resolves it.
   - **The freeze:** a final V–I with the pedal down (in `pedal.json`).
3. **A normal chart:**
   - it passes `validateChart` and song-pack-1's library test;
   - the DGX plays it as a bot demo with demo-performance's pedal and dynamics (golden-demo's `pedal.json` and
     per-note `velocity`), and a player can play it too;
   - each note's id carries its commit's short hash, so a replay or a hover maps back to it.
4. **Capture:** `?capture=1` (capture-mode) gives a clean 90 s take. Eric records the WebM with his own recorder, per
   capture-mode's `recording.md`, for video-shots (#975) to consider as an end-card bed.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Traceability** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/build-sonata`), on a fixture log:
- note count = merged commits in range, and every note maps to exactly one hash;
- the counter's value at the end equals the snapshot's count;
- the lane mapping: scoped commits by their spec's assignee, unscoped ones by path, and plan, contract and docs to
  the bell;
- no name, handle or email from the scrub list appears in the snapshot or the chart.

**(b) Musicality,** on the fixture:
- 100% of notes are chord tones of the active chord, or labeled passing tones;
- every red stretch is in the minor, and resolves at its fix;
- the last two chords are V–I, with the pedal down;
- every pitch is in 21–108, and every velocity ≤ the cap.

On the real snapshot, the chart passes the library test.

**(c) The design pass** (AGENTS.md, Visible changes):
- invoke `frontend-design` and `design-taste-frontend`;
- score with taste v2 at 1280×720 and 1920×1080, for `/sonata` and `/play` with the flag, plus reduced motion (no
  riding labels, the counter only), from your own dev server in the in-app browser (one slot, `devserver.1` to
  `.4`);
- fix the top three problems a round, at most three rounds;
- scores and our shots go in the PR's Design section, and the shots in
  `specs/features/experiments/shots/build-sonata/`.

**The perf gate** (contract item 4): `perf.mjs --song x/build-sonata --params x=build-sonata`, p95 ≤ 6 ms. It runs
locally only under `verify.lock`; otherwise "not run locally; main's scheduled run covers it".

**(d) Morning page, ranked low:** a 90 s listen on the DGX (Listen on `/sonata`), flagged as a video end-card
candidate. The done note says `not heard by Eric` until he does.

**Eric's URLs:** Lab → The Build Sonata, or `localhost:3001/sonata`.

## Gaps (accepted)
- It appears in the song select (the loader lists every chart).
- At about 700 notes in 90 s, the full level is a bot's tempo. Easy (easy-charts) is the playable one.
- The snapshot is a point in time until it's re-run at the freeze.

## Defaults
- **In `extras`,** after hand-palette.
- Log any choice this spec doesn't make in `specs/decisions/build-sonata-*.md`: the progression and key, the warp,
  the lane registers, the velocity cap, and how `ci-red` counts.
- The smaller option; no new dependency; no personal data.
