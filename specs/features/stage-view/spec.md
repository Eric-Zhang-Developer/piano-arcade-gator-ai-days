---
name: "Stage view: a NOSTALGIA-style audience highway on a second display that mirrors the live take"
depends_on: ["sheet-view", "flow-mode", "perf-budget"]
owns: ["specs/features/stage-view/", "changes/stage-view.md", "specs/decisions/stage-view-", "web/src/game/stage-view/", "web/src/app/stage/", "specs/context/nostalgia-stage-findings.md"]
assignee: "eric"
---

# Stage view

Issue #875. Eric, 2026-10-25: "I would do flow mode with how it looks in nostalgia. The keys have a much shorter
time, and there's a come-down of a hill, not straight down, but it just makes it feel a lot faster. I would be reading
the sheet music, so it'll be unaffected. It'll be for the audience. That's a big wow factor."

**The ask:** `/stage`, a page for the people watching, on a second display or projector. Notes come down a curved,
sloped lane ("down a hill") with a much shorter approach than `/play`, and hits and milestones read big from across
a room. It mirrors the live take. It changes nothing on `/play` or `/sheet`, which is what Eric reads.

## Plan
1. **Research first, by the worker.** The worker spawns a research subagent. The planner did no research for this
   spec, so every number below is still unknown. Sources (local only):
   - the video `video-references/[ノスタルジア Op.3] FLOWER (BEMANI SYMPHONY NOSTALGIA mix) Real 998kFC [OoY-uM81mWc].mp4`
     in the main checkout;
   - the existing frame notes, `specs/context/reference-notes/nostalgia-flower.md`.

   It measures from the video, with timestamps:
   - **the lane curve:** where the horizon sits, how the lanes arch and narrow from the horizon to the judgment bar,
     as fractions of the frame;
   - **the approach time in ms:** from a note's first appearance to the bar, measured on several notes, with the
     spread;
   - **hit and milestone effects:** what each looks like, how long it lasts, and the timestamps (judgment text,
     starbursts, pillars, the combo milestone swell);
   - **the audio at milestones:** what sounds at combo milestones, the full combo and the end, with timestamps.

   Findings go in `specs/context/nostalgia-stage-findings.md`, in the `feat(stage-view)` PR. **Never commit the video
   or any frame from it**, in the repo, a PR body or an issue. Frames stay in a scratch directory outside the repo.
2. **Heavy? It becomes a spike first.** Eric: "if it's really heavy, it could get its own spike." If the findings show
   the curved lane or the effects are too heavy (for example, it needs WebGL or can't hold the perf gate), the worker
   opens a prototype spike under `specs/decisions/004-spikes.md` before building. That means one question, a time box
   and `FINDINGS.md`. It records why here.
3. **The build: `feat(stage-view)`,** after the findings land.

## Requirements
- **Mirror the live take, reusing what's there.** `/play` already posts the take to `/sheet` on the BroadcastChannel
  `pianoArcade.sheet` (`web/src/game/sheet-view/plugin.tsx`: `take`, `clock` once per frame, `judgment`, `end`). `/stage`
  listens to the same channel, read-only, so a take from `/play` drives `/sheet` and `/stage` at once. `/sim` is the
  other example of a page driven over a channel. Flow mode is mirrored for free: `clock` is the chart clock, which
  already follows the player's tempo.
- **Combo and milestones** are derived on `/stage` from the judgments, with the same rules the judge uses, imported
  and not copied. If `/stage` needs a message the channel doesn't carry (fever, say), add one additively to
  `SheetMessage` in sheet-view's plugin. Sheet-view is done and in this lane, so that change can go in this PR. `/sheet`
  must ignore the new message, and sheet-view's tests must stay green.
- **The look:** the lane curve, the approach time and the effects, taken from the findings, never invented. If the
  findings can't pin a number, the worker picks one, labels it a choice and not a measurement, and logs it in
  `specs/decisions/stage-view-*.md`.
- **Fills any display.** It works at 1280×720 and 1920×1080 and goes full screen on a key or a button. No controls
  show during a take. With no take, `/stage` shows a quiet waiting state, not an error.
- **A way in:** `/play`'s start screen gets a "Stage view ↗" button that opens `/stage` in its own window, as "Sheet
  music ↗" does. Add it with one mount line, under the mount rule in AGENTS.md. Also add a Lab entry once its done
  note lands.
- **Variants** (curve, speed, camera) go to the Lab as experiments under `specs/features/experiments/spec.md`. They
  aren't part of this spec.
- **No invented data.** Every number is measured from the video or logged as a choice.

## Design
The work is visible, so it gets AGENTS.md's design pass ("Visible changes"):
- invoke the `frontend-design` skill before writing the UI, and `design-taste-frontend` for the look loop;
- shots at 1280×720 and 1920×1080, compared with frames of the reference video, fixing the top 3 differences a round,
  at most 3 rounds;
- before/after shots in the PR are ours only, never the reference's frames.

The PR body has a Design section with each round's score.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/stage-view src/game/sheet-view`:
   - a scripted list of channel messages drives `/stage`'s state: notes on screen at a clock, combo, milestones and
     the end;
   - the lane-curve math maps chart time to a point on the curve, at the measured approach time;
   - sheet-view's own tests stay green.
2. **Perf gate:** `node web/src/game/perf-budget/perf.mjs` on `/play`, the main display, p95 frame work ≤ 6 ms at
   1920×1080, before (origin/main) and after (the branch), numbers in the PR. Record `/stage`'s own frame time too.
   Under the interim load rule it runs locally only under `verify.lock` with a timeout. Otherwise the PR and the done
   note say "not run locally; main's scheduled run covers it".
3. Existing checks (sheet-view's, `web/e2e/verify.mjs`) are covered by main's scheduled full run, not run locally.
   The done note says "not verified locally; covered by main's scheduled full run".
4. The design pass above, with the Design section in the PR.
5. Eric looks at it once, on a second display during a take. Mark that in the done note (`not seen by Eric` until he
   does).

## Defaults
- In `extras`, after key-polish.
- Log any choice this spec doesn't make in `specs/decisions/stage-view-*.md`.
