## What shipped
The experiment frame: a registry in `web/src/game/x/index.ts`, one `xFrame()` plugin that passes /play's hooks only to experiments its `?x=<name>` flag turns on (off by default, a throw turns off that one alone), an "On trial" gallery on /lab with one button per entry, and a labeled sample (`?x=sample`: a corner tag and a start-screen line).
## Where it lives
`web/src/game/x/` (registry, frame, `Gallery.tsx`, `sample/`), `web/src/game/lab/Lab.tsx`, the mount in `web/src/game/layers.ts`, `specs/decisions/experiments-flags.md`, `specs/decisions/experiments-log.md`, shots in `specs/features/experiments/shots/`.
## How to check it
`pnpm -C web exec vitest run src/game/x src/game/lab` (44 pass). verify-lab: not verified locally; covered by main's scheduled full run. Seen running on a worktree dev server at 1280×720 and 1920×1080, with the gallery, the sample's panel and its tag.
## Gaps
The perf gate with `?x=sample` (`perf.mjs --params x=sample`) was not run locally; main's scheduled run doesn't pass that flag either, so it is unmeasured. No Lab toggle (decision experiments-flags). Not seen by Eric.
