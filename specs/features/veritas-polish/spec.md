---
name: "Veritas polish: /veritas restyled for the video, CSS only"
depends_on: ["veritas"]
owns: ["specs/features/veritas-polish/", "changes/veritas-polish.md"]
assignee: "eric-agent-1"
---

# Veritas polish

Issue #515. Eric, 2026-10-24: `/veritas` is a shot in the demo video and should be "really, really pretty". One or
two polish passes in `specs/context/visual-direction.md`'s look, judged on screenshots. No new data, no new behavior.

## Plan
1. **`style(veritas)`, pass 1:** the hero and the dashboard in the direction's look.
2. **`style(veritas)`, pass 2, if pass 1's review leaves a top-three problem.** At most two passes.
3. **`feat(veritas-polish)`:** before and after screenshots in `specs/features/veritas-polish/`, then
   `changes/veritas-polish.md`.

The code changes go in `style(veritas)` PRs, as hud-skin went through `fix(hud)`: veritas owns
`web/src/app/veritas/`, and while both specs are in flight `check_ownership.py --lint-specs` rejects two owners of
one path. Decisions go in `specs/decisions/veritas-polish-*.md`, which this feature's title allows; listing that
prefix in `owns` would overlap veritas's `specs/decisions/veritas-`.

## Requirements
- **Only veritas's style files:** the `*.module.css` files under `web/src/app/veritas/`. The one other edit allowed
  is a `className` on an existing element. No text, data, markup order or logic changes.
- The direction's tokens and rules: black base, `--pa-sky` and the cabinet chrome (`--pa-magenta`, `--pa-cyan`) at
  the edges, Saira italic for every number, red only on WRONG marks, every state with a word or glyph. Mint and
  azure stay off chrome.
- The hero is the loud thing; the dashboard stays calm and reads as a scoreboard.
- Motion within the direction: interface 150–250 ms, ease-out; the hero's 4 s sweep unchanged; reduced motion shows
  the end state at once.
- Text the viewer must read: at least 24 px at 1920×1080, 16 px at 1280×720. Contrast 4.5:1.

## Validation
- `pnpm -C web exec vitest run --passWithNoTests src/veritas` and `node web/src/veritas/verify-veritas.mjs --out
  <dir>` pass unchanged.
- `git diff origin/main --stat` per `style(veritas)` PR: only `.module.css` files, plus `className` lines.
- Screenshots of `/veritas` at 1280×720 and 1920×1080, plus reduced motion, before and after each pass, in the PR.
  Scored with taste v2's step 8, "Look" (`references/critique.md`); fix the top three problems.
- Eric's eye (mark it in the done note): `not verified by Eric` until he's seen it.

## Defaults
- `visual-direction.md` wins over any skill default. Build with `frontend-design`. No new dependency, no images.
- A change that needs markup beyond a `className`: file an issue for eric-foreman-agent, don't make it.
