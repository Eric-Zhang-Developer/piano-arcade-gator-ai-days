---
name: "Experiments: a gallery in the Lab and a contract that keeps many variations on main safe and cheap to prune"
depends_on: ["lab", "perf-budget"]
owns: ["specs/features/experiments/", "changes/experiments.md", "specs/decisions/experiments-", "web/src/game/x/"]
assignee: "eric"
---

# Experiments

Issue #878. Eric, 2026-10-25, approving it: "these experimental ideas can go to main, and then we can prune a lot of
them later. Again, agent hours are cheap." And: "this lab would just be a giant fucking amount of buttons that would
go to the various experimental features ... It would take like an hour ... if it's really heavy, it could get its own
spike."

**The ask:** agents land many experimental variations on `main`. Eric reviews them all in the Lab in about an hour,
then prunes. **This spec builds the frame only:** the Lab gallery and the experiment contract. The experiments come
later, each with its own small spec or issue.

## Plan
**One PR: `feat(experiments)`.** It adds:
- the registry and frame in `web/src/game/x/`;
- the gallery group in the Lab (`web/src/game/lab/`, which is done and in this lane, so ownership is open);
- one mount line in `web/src/game/layers.ts` (the mount rule in AGENTS.md);
- one sample experiment, the smallest that proves the contract end to end. It's labeled a sample, and pruning it is
  the first use of the prune rule.

## The experiment contract
Every experiment is boxed in:
1. **Its own folder:** `web/src/game/x/<name>/`. Nothing outside it changes, except its one registry line.
2. **Off by default.** It turns on with a URL flag (`?x=<name>`, comma-separated for several) or a Lab toggle. The
   worker picks the toggle's storage and logs it. With no flag and no toggle, no experiment's code runs on `/play`,
   and the demo path is unchanged.
3. **One mount line:** one line in the registry (`web/src/game/x/index.ts`). The frame's single plugin in `layers.ts`
   passes `/play`'s hooks to the experiments that are on.
4. **The perf gate when on:** `node web/src/game/perf-budget/perf.mjs --params x=<name>`, p95 frame work ≤ 6 ms at
   1920×1080, numbers in its PR. It runs locally only under `verify.lock`; otherwise the PR says "not run locally;
   main's scheduled run covers it".
5. **Reviewable:**
   - its registry entry gives a name, a group, one line and a URL that opens it ready to see, with the song and flags
     preset;
   - its done note carries a clip or screenshots of ours (never a reference's frames), at
     `specs/features/experiments/shots/<name>/`, with a size cap the worker logs.
6. **Heavy ones get their own spike** (`specs/decisions/004-spikes.md`), for example new rendering tech or a heavy
   run. The spike reports back here only if it's promoted.
7. **Pruning after Eric's verdict:** delete the folder and its registry line. Log the verdict (kept, cut, or kept with
   changes) in `specs/decisions/experiments-log.md`. A kept one gets a real spec before it leaves the Lab.
   Nothing is deleted before Eric's verdict.

**How an experiment lands later:** with its own spec (`feat(x-<name>)` owning `web/src/game/x/<name>/`), or a small
one through an issue as a `fix(experiments): x/<name> ...` PR once this frame is done. Either way the contract above
holds.

## The gallery
- A group (or groups) on `/lab`, one button per registry entry: "a giant amount of buttons", grouped so an hour's
  review flows top to bottom. Each button is a real link with its line and its issue number.
- The Lab's existing entries and their test rules don't change.
- The gallery reads the registry, so adding an experiment never edits the Lab.

## Design
The gallery is visible, so it gets AGENTS.md's design pass ("Visible changes"):
- invoke `frontend-design` before writing the UI, and `design-taste-frontend` for the look loop;
- shots at 1280×720 and 1920×1080 with a long registry: the real one plus a test fixture of about 40 entries, fixing
  the top 3 problems a round, at most 3 rounds.

The PR body has a Design section. Each experiment's own PR does its own design pass.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/x src/game/lab`:
   - every registry entry has a folder, a name, a group, a line and a URL to a page under `web/src/app/`;
   - **off by default:** with no flag and no toggle, the frame plugin calls no experiment's hooks, and `?x=<name>`
     turns on exactly that one;
   - the gallery renders one link per entry;
   - the Lab's existing tests stay green.
2. The perf gate with the sample on, as in the contract. Existing checks (`verify-lab.mjs`) are covered by main's
   scheduled full run, not run locally. The done note says "not verified locally; covered by main's scheduled full
   run".
3. The design pass above, with the Design section in the PR.
4. Eric looks at the gallery once. Mark that in the done note (`not seen by Eric` until he does).

**No invented data:** lines, counts and perf numbers are measured or copied, never written to look good.

## Defaults
- In `extras`, after milestone-sfx.
- Log any choice this spec doesn't make in `specs/decisions/experiments-*.md`.
