---
name: "How it works: a /how page explaining how the agents built Piano Arcade, from real data"
depends_on: ["operator-board", "operator-replay", "ui-tokens"]
owns: ["specs/features/how-it-works/", "changes/how-it-works.md", "web/src/app/how/", "web/src/how/", "specs/decisions/how-it-works-"]
assignee: "eric-foreman-agent"
---

# How it works

A teammate called the text explainer of how Eric's agents build Piano Arcade "incredibly helpful". Judges have no
such page: `/operator` is a back office for the team and `/attract` is a replay, and neither explains how the process
works. `/how` explains it in a judge's first two minutes: short text, four diagrams drawn from real data, and what
went wrong. It's built by eric-foreman-agent, whose lane (`/operator`, `/attract`) already collects the data.

The criteria it serves are **[unverified]**. #46 (open, not on main) quotes the Site's criteria, which include
"Technicality" and "Presentation". "Best AI Hack" isn't in #46: it says the Site's AI category prize is gone. The
page names no criterion and no prize.

Issue: #437

## Plan
1. **`feat(how-it-works)`:** `web/src/how/`: the data functions, which are pure and get their inputs passed in, with
   `how.test.ts`; the server-side reader that loads the snapshot, git and repo files; the four SVG components; and
   `verify-how.mjs`. Also `web/src/app/how/page.tsx`. If it's past ~400 changed lines, split it into data plus tests
   first, then page plus verify.
2. **`feat(how-it-works)`:** screenshots in `specs/features/how-it-works/` and `changes/how-it-works.md`.
3. **Not in this feature:** links to `/how`. A "HOW IT WORKS" link in `/operator`'s header would be a
   `fix(operator-board)` PR, and a link from `/` would be a `fix(song-select)` PR. Each is Eric's call (Open
   questions). Until then the page is reached by URL.

`web/package.json` is frozen: no new dependency. This feature never touches `/about`, `web/src/app/about/` or #82's
files.

## Where every value comes from
The page is a server component. Under `next build` it reads its inputs once, at build time. Under `next dev` it
reads them on every request. Nothing is fetched in the browser. **Every number on the page, and every name except
the role copy below, comes from these inputs.** A value that can't be read renders as `unknown` in `--pa-ink-dim`.
It's never a guess, and the page never shows an error.

**`web/public/operator/snapshot.json`**, operator-board's `Board` type (`web/src/operator/board.ts`), read with `fs`:
- `at` and `mainSha`: "data as of" in the header.
- `prs[]`: `number`, `title`, `state`, `createdAt`, `mergedAt`, `url`, `worker`. These give merges per hour, merged
  PRs per worker, and the incident times.
- `features[]`: `slug`, `state`, `milestone`. These give the stage counts in diagram 2, and the state of
  build-stamp and ci-browser in the incident section.
- `books.mergedByType`, `books.medianMergeMin`, `books.firstPrAt`.
- The PR type uses operator-board's `titleType` and operator-replay's `kindOf`, imported, not copied.

**Refreshing the snapshot:** operator-board's "Freeze snapshot" button on `/operator` under `pnpm -C web dev`.
`POST /api/operator/snapshot` (`web/src/app/api/operator/snapshot/route.ts`) writes the file. It needs a `gh` login.
No snapshot is committed on main as of `dcbc4b1`, so until Eric freezes and commits one, everything from it reads
`unknown`. This feature never commits a snapshot: `web/public/operator/` is operator-board's.

**Git, from `web/`** (`execFileSync`, timeout 5 s, stderr ignored, as build-stamp does):
- `git ls-files web/src`, and the lines of each listed file, read from disk. Lines are counted as `\n` characters
  plus one if the file doesn't end in one. These give diagram 3.
- The ci-browser first-run count: the commit whose subject ends in `(#433)` (`git log -1 --format=%H
  --grep='(#433)$'`). In that commit's `web/e2e/run-checks.mjs` (`git show <sha>:web/e2e/run-checks.mjs`), count the
  `KNOWN_RED` entries. Also count the entries in today's file: the list only shrinks.
- No git, or a failing command: those values are `unknown`.

**Repo files** (`fs`, from the repo root): `AGENTS.md`'s Lanes table (the Person, GitHub, Lane and Folder columns)
and `.github/CODEOWNERS` (path and owner on each non-comment line). These give the people and lanes in diagrams 1
and 3.

**Role copy** is the one exception, a single `ROLES` constant in `web/src/how/`. It holds the role boxes of diagrams
1 and 2 and their one-line jobs, from AGENTS.md and the team's setup: Eric decides and plays; eric-asking-agent is
Eric's main contact and read-only; eric-planning-agent writes specs and orders milestones; the workers `eric-agent-N`
build, with eric-agent-6 on standby; eric-foreman-agent owns `/operator` and `/attract`. These are process
descriptions, not measurements, so they carry no numbers. Any worker in `prs[].worker` that `ROLES` doesn't name
still appears, under "other".

## Requirements
**Page:** `/how`, metadata title "How it works · Piano Arcade". From top to bottom:
1. **Header:** "HOW IT WORKS" and one line saying this page is about how Piano Arcade was built (the process), not
   the game. Below it: data as of `at` · main `mainSha`, or `unknown`.
2. **Intro**, at most 3 short paragraphs, adapted from the explainer. Everything runs on one laptop as separate
   Claude Code sessions. GitHub is the shared memory: specs, milestones and rules are files on `origin/main`, and work
   moves through issues and PRs. No agent trusts chat or its own memory.
3. **Four visuals**, each a `<figure data-visual="...">` holding an SVG, a one-line caption and a `<details>` text
   version (a table or list) for screen readers:
   1. `who`, **who does what:** Eric → eric-asking-agent → eric-planning-agent → the workers (eric-agent-1 to
      eric-agent-6, with 6 marked standby) and eric-foreman-agent, which sits beside the workers and manages no one.
      Each agent box shows its merged-PR count from `prs[]` (`unknown` without a snapshot), so the asking agent shows
      0. The teammates' lanes come from the Lanes table and CODEOWNERS, as people boxes with their folders. A Lanes
      row whose person is "not set yet" shows exactly that.
   2. `life`, **a feature's life:** idea → issue → spec → ready → draft-PR claim → checks (`ci` and `browser`) →
      done note → merge. The stage counts from `features[].state` sit under their stages: backlog under spec, then
      ready, blocked, in flight under the claim, and done. The median open-to-merge time from
      `books.medianMergeMin` sits along the claim-to-merge arrow.
   3. `lanes`, **the repo's architecture:** one bar per folder directly under `web/src/` (one per route folder for
      `web/src/app/`, which CODEOWNERS splits that way), sorted by lines of code. Each bar is labeled with the folder,
      its lines and its owner. The owner is the longest CODEOWNERS prefix that covers it, else the Lanes table's
      Folder column, else "no owner listed". This is bar rows, not a treemap: `web/src/contracts/` is under 1% of
      the lines today, and a bar keeps it readable. A treemap is fine instead if it labels every folder.
   4. `time`, **the build over time:** merges per hour (stacked bars) by `kindOf`'s four kinds, with a legend: feat;
      fix, refactor, perf and test; plan and contract; other. The total merged and the busiest hour are stated in
      text. Below it is a link "Watch the build replayed: ATTRACT MODE ▶" to `/attract?snapshot`.
4. **What went wrong and what we changed**, `<section data-incidents>`, three short items. The prose is copy. Every
   number in it is computed from the inputs, and every PR or issue number is a link to GitHub:
   - **Parallel merges turned main red:** #387 and #391 merged N s apart (the gap between their `mergedAt`), so
     neither PR's CI ran with the other in place, and main stayed red until #397 merged M min later. The
     incident issue is #396. What we changed: #397 fixed the test. Any rule change the page claims must link
     the file or PR on main that made it. As of `dcbc4b1` none does, so the page claims none.
   - **A stale playtest:** a long-running dev server served an old build, and nothing on screen said so. What we
     changed: the build stamp (#422, with build-stamp's state from `features[]`) and the rule that agents read state
     from a fresh `origin/main` (#425). The 9 h and 233-commit figures are in no input, so the page doesn't state
     them.
   - **The browser checks moved to GitHub (#407):** the first run found K checks already red on main (the #433
     count above). They run but don't gate, each with its issue; today N remain.
5. **Footer:** "Data: web/public/operator/snapshot.json, git and the repo's own files, read when this page was
   built." Plus a link to the source on GitHub.

**Diagrams:** inline SVG rendered on the server from the data. Diagrams 1 and 2 have a hand-laid layout, with boxes
from `ROLES` and AGENTS.md. Diagrams 3 and 4 are laid out by computation. No client-side Mermaid or chart library,
no new dependency. No AI-generated images for diagrams: a generated diagram invents boxes, arrows and text. At most
one decorative illustration, and only if Eric approves it (Open questions). None until then.

**Honesty:** no sentence says or implies that the build process meets the challenge statement (#10 is open), or
that it serves a judging criterion or prize. The page is about the process. If it mentions the game, the line says
so ("the game:"), so process and product stay apart.

**Look** (`specs/context/visual-direction.md`):
- Cabinet chrome on `--pa-sky`: magenta and cyan for frames, arrows and focus rings; `--pa-ink` / `--pa-ink-dim` for
  text. Tokens come from `web/src/game/ui-tokens/`, imported.
- No mint or azure: those are the hands' colors, never chrome. No red except `--pa-wrong`, and the incident section
  doesn't need it.
- Saira (`--pa-font-display`, already loaded in `layout.tsx`) for titles and numbers, in italic; `system-ui` for
  body text.
- **Size:** anything a viewer reads, including the diagram labels, is at least 24 px at 1920×1080 and 16 px at
  1280×720. Mark it `data-read`. The page scrolls; diagrams scale to the column width and never need a horizontal
  scroll at 1280.
- Nothing animates, so reduced motion has nothing to stop.
- State is never shown by color alone: every bar kind has a legend label, and every stage has its word.
- **Keyboard:** every link is reachable with Tab in reading order and has a visible magenta focus ring. The
  `<details>` text versions open with Enter.

**Offline:** no request off localhost. Fonts come from `next/font`, which serves them locally, and no image or
script loads from elsewhere. offline-ready stays true.

## The CI tab (`/how/ci`), added 2026-10-25
Eric asked for it, relayed by eric-planning-agent: the night the browser checks jammed, told for the video's "how it
was built" beat and the live demo. The incident is `docs/incidents/2026-10-25-ci-gridlock.md`.

- **Tabs:** `/how` and `/how/ci` share a tab row ("The build", "CI"), plain links in the Duo kit's monospace caps.
- **Data:** `web/src/how/ci-freeze.mjs` asks GitHub (`gh api`) for every workflow run since `--since`, each run's
  jobs (queued, started and completed times), the PRs merged in that window, and when the marked fixes landed
  (#673 opened; #674, #679, #692 and #687 merged). It writes `web/src/how/ci-snapshot.json`, which this feature
  commits; times are seconds after `since`. The page reads only that file. No number is typed by hand.
- **Three panels,** each with one sentence per beat (what broke, what we measured, what we changed, what changed as a
  result) and an SVG:
  1. **Runners:** browser jobs running and waiting across the night, in 5-minute steps, main's waiting jobs as a
     line, the most running at once as a dashed rule, and the fixes marked.
  2. **Push to green:** each green PR run's minutes from push to green, before and after #687.
  3. **Merges per hour,** New York time, the fixes marked.
- **"After" waits for data.** Everything after #687 reads "measuring" until #687 has merged, 3 hours have passed and
  at least 3 green PR runs have finished since. Refreeze then (around midday) and commit the snapshot.
- **Look:** Duo (`visual-direction.md`, the kit in `web/src/game/duo-tokens/`): hairline panels, sharp corners, blue
  for running work, violet for waiting, no pink. It reads at 1920×1080.
- **No new browser check:** `verify-how.mjs` gains a step for `/how/ci`.

## Validation
- `pnpm -C web exec vitest run src/how`, with no network and fixtures passed in:
  - **Merges per hour,** the bucketing function:
    - an unmerged PR (`mergedAt` null) isn't counted;
    - 13:59:59Z and 14:00:00Z land in different buckets;
    - an hour with no merge between two busy ones is present with zeros;
    - kinds follow `kindOf` (a `refactor` counts as fix, a `contract` as plan);
    - buckets are UTC hours, labeled in `America/New_York`;
    - an empty or null PR list gives an empty result, which the page shows as `unknown`.
  - The CODEOWNERS owner is the longest matching prefix (`web/src/app/api/takes/` beats a shorter one), and a folder
    with no line takes the Lanes Folder column, else "no owner listed".
  - A null snapshot gives `unknown` for every value read from the snapshot, and none from git.
  - The incident gap is computed from two `mergedAt` values. A missing PR gives `unknown`.
- `pnpm -C web exec vitest run src/how` also runs `ci.test.ts`: jobs running and waiting at each step (a job cancelled
  while queued stops waiting; one still queued at the freeze waits to the end), the peak, main's longest wait, the
  median and slowest push-to-green, "after" staying null until 3 hours and 3 green runs past #687, and merges per New
  York hour.
- `verify-how.mjs`'s `/how/ci` step: the three `section[data-visual]` (`flight`, `green`, `merges`) each hold an SVG
  and four beats; the tab row links both pages; the numbers on the page match `ci.ts` run on the committed snapshot;
  and with no smoke-only data yet, every "after" value reads `measuring`.
- `node web/src/how/verify-how.mjs --out <dir>`, one run, with its own `next dev` like the other `verify*.mjs`
  checks. ci-browser's runner picks it up by its name.
  - `/how` shows the four `figure[data-visual]` (`who`, `life`, `lanes`, `time`), each with an SVG and a
    `<details>`, plus `section[data-incidents]` with its three items.
  - **The numbers, computed independently.** The check reads the snapshot itself, runs its own `git ls-files` and
    line count, and its own `git show` of #433's `run-checks.mjs`. It compares merges per hour by kind, the total, the
    busiest hour, merged PRs per worker, the stage counts, the 387/391 gap and the time to #397, the lines and owner
    per folder, and the known-red counts with the values on the page. Each value is rendered in a `data-value`
    attribute. It does this twice:
    - **(a)** with whatever snapshot file is there. With no file, every snapshot value must read `unknown`.
    - **(b)** with a fixture snapshot from `web/src/how/` written in place. The check puts back whatever was there
      before, as `verify-operator.mjs` does.
  - **The network:** every request is recorded, and one to a host other than localhost or 127.0.0.1 fails the run.
  - **Screenshots:** `/how` at 1280×720 and 1920×1080, plus 1920×1080 with `reducedMotion: "reduce"`, kept in
    `specs/features/how-it-works/`.
  - **Size:** at 1920×1080, every `[data-read]` element's computed font size is at least 24 px.
  - **Keyboard:** Tab reaches every link on the page, in reading order.
- **Once, by hand,** with a real frozen snapshot (freeze it on `/operator`, but don't commit it from this feature):
  load `/how` and check three numbers against `/operator?snapshot`'s bookkeeping (PRs merged, by type, the median).
  Record them in the done note.
- `verify.py --slug how-it-works` passes.
- Review per `visual-direction.md` (taste v2's "Look" only), on the screenshots at both sizes.

## Open questions (`needs-human`, file each when the build starts)
1. **For Eric and Sharan: should `/how` and `/about` (#82) link to each other, or merge later?** #82 (`feat(landing)`,
   Sharan, draft) has a "Build progress" section. It reads `specs/milestones.toml` and `changes/*.md` at build time
   (`web/src/app/about/progress.ts`) and shows "N of M planned features are done" with each milestone's features, done
   or not. Its "Under the hood" list also has an "Agents from specs" line. Default: keep them separate with no shared
   files, and add no link until they answer. Undo: a link is a one-line PR either way.
2. **For Eric: a decorative illustration?** At most one, and never a diagram. Default: none.
3. **For Eric: link `/how` from `/operator`'s header or from `/`?** Default: neither. It's reached by URL.
4. **For Eric: commit a frozen snapshot before judging?** Without one, the deployed page shows `unknown` for every
   snapshot value. This is operator-board's existing step ("Eric freezes it before judging"), not new work.

## Gaps (accepted)
- The production deploy may have no git at build time. Then diagram 3 and the known-red counts read `unknown`. Check
  the deployed `/how` once and record what it shows.
- The snapshot is a frozen moment, so the page is as current as its last freeze. The header says when that was.
- The role copy (`ROLES`) is typed. It's the team's setup, not data. If the crew changes, edit it.
- The stale playtest's 9 h and 233-commit figures stay off the page: no input holds them.

## Defaults
- Bar rows over a treemap for diagram 3 (above).
- Log choices the spec doesn't make in `specs/decisions/how-it-works-*.md`.
