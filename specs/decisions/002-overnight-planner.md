# 002: An overnight planner for the game lane, and issue-first promotions

- Date: 2026-10-24   Decided by: Eric (game lane)   Feature: project-wide
- **Context:** Eric goes to bed soon. Every `plan:` PR waits for a person (`AGENTS.md`, The loop, step 6), so once
  the game lane's queue drains, its agents stop until morning. Ideas live in scattered places (the v4 plan, the
  writeup, the reference studies), and issues were created per spec after the fact, which let one race create a
  duplicate issue for every spec.
- **Options:** A: agents idle until Eric wakes. B: a planner that promotes only ideas Eric already wrote down or
  approved, within fixed limits, and self-merges only safe `plan:` PRs. C: a planner free to invent scope.
- **Choice:** B. It keeps work flowing without inventing scope, every promotion is one small PR, and Eric can stop it
  with one comment. The rules:
  - **Who:** the planner worker `eric-planning-agent`, game lane only.
  - **When:** while Eric is away. Each pass first counts the game lane's ready and claimed features
    (`assignee: eric`). At or above 2 × `[agents].max_parallel` (3, so 6), the pass does nothing.
  - **What it may do:** promote at most 3 items per pass. Items come from `specs/context/catalog.md` ("In" before
    "Maybe", ranked by what the 3-minute video and the stage demo show first, then rubric fit), or from open issues
    Eric himself opened with the `idea` label (those count as approved ideas). For each promoted item:
    1. Open its issue first, labeled `feature` and `proposal`, whose body ends with the hidden marker
       `<!-- spec: <slug> -->`, so `sync_issues.py` adopts it instead of creating a duplicate.
    2. Write `specs/features/<slug>/spec.md` with `assignee: "eric"`, `owns` overlapping nothing in flight and no
       frozen path, lint clean (`check_ownership.py --lint-specs`).
    3. Add the slug to a milestone in `specs/milestones.toml`.

    Then open one PR titled `plan: <date> batch of N` with three sections: **Signal** (why now), **Changes** (feature
    → rubric criterion → source → `Refs #n`), and **Not chosen** (with reasons).
  - **Self-merge, only if all of these hold:** the PR changes only `specs/features/`, `specs/milestones.toml` and
    `specs/roadmap.md`; every new spec is `assignee: "eric"` and not provisional; nothing touches the learning lane,
    `specs/context/`, contracts or anything on `mission.md`'s Not doing list; CI is green;
    `python3 .agents/scripts/pr_ready.py` passes. Otherwise the PR waits for Eric.
  - **Its own ideas** never self-merge. They go into `catalog.md` through a `contract:` PR that Eric merges.
  - **When it ends:** when Eric comments "planner: stop" on the Status issue (#2), or at 10:00 AM ET on 2026-10-24,
    whichever comes first. Eric can extend it in a later decision.
  - **Issue lifecycle, for all feature work:** one issue per idea, from proposal to spec to build to done. The issue
    links to the spec and never copies it. `contract:`, `docs:` and `fix:` PRs don't need an issue; bugs use the
    `bug` flow.
- **How to undo:** delete the decision-002 exception in `AGENTS.md` (The loop, step 6), or revert this PR.
