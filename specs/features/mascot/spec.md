---
name: "Mascot: one chibi gator, incredibly minimal, in the Duo look, for every screen"
depends_on: ["duo-results", "duo-select", "duo-tokens", "ui-tokens", "mascot-spike"]
owns: ["specs/features/mascot/", "changes/mascot.md", "specs/decisions/mascot-", "web/public/mascot/", "web/public/learning/companion-gator.svg"]
assignee: "eric"
---

# Mascot

Issue #1371, from Eric directly. It closes #1048 (two different gators).

**Eric's words, the requirement** (#1371, 2026-10-25, about 13:55 ET):
- "I want a chibi gator, but I want to be incredibly minimalistic."
- It has to fit the theme: the Duo look.

**What the Duo look means here** (from `web/src/app/globals.css` on main):
- the dark field;
- hairline frames (`--pa-line`) and corner brackets;
- `--pa-primary` (#2b9bff) and `--pa-secondary` (#a07cff);
- Saira as the display face.

The issue body calls `--pa-secondary` yellow, but the token on main is #a07cff, a violet. The gator uses the tokens as
they are on main.

**Out:** both mascot-spike sheets, sheet-06 and sheet-01 (#903, #908), which Eric rejected. No storybook shading, no bow
tie and no cream belly.

## The rule for a person's pick
This applies the incident rule from #1370: **no spec holds a merge or a start for a person's pick.**
- The worker's best default merges on green.
- Eric's taste check goes on the morning page after the merge.
- A revert, or a swap of the SVG, is the undo.

## What it replaces (checked on main)
- **The results tutor:** `web/src/game/duo-results/index.tsx:27`, `duoPanelSettings.gator =
  "/learning/mentor-gator-avatar.png"`, drawn at `:208` as an `<img>`.
- **The select's "Next for you" row:** `web/src/game/duo-select/Select.tsx:64`,
  `<img src="/learning/companion-gator.svg">`.
- **/learn,** which loads the same file by path:
  - `web/src/learn/frontend/TheoryWorkspace.tsx:75` (`guide.imageSrc ?? "/learning/companion-gator.svg"`);
  - `graph/GraphCompanion.tsx:20`;
  - `graph/GuidedEntry.tsx:77`.

## The build
1. **The form (the planner's choice, after eric-asking-agent-3's suggestion on #1371; not Eric's words):**
   - a hand-built SVG from the kit's tokens: flat shapes, or a single line weight;
   - no shading, gradient or texture;
   - chibi proportions: a big head and a small body;
   - it holds up at 48 px and in one color;
   - **colors:** an `<img>` SVG can't read the page's CSS variables, so the file holds the tokens' literal values
     (`--pa-primary`, `--pa-secondary`, `--pa-ink`, the field's black). A test pins every fill and stroke to that
     palette;
   - no image generation and no downloads.
2. **Poses,** only where a screen already uses the gator, and at most a few, made by swapping a shape or two:
   - idle for the select row and /learn;
   - a pointing or talking pose for the results tutor, if the worker judges it earns its place.

   The pose files live in `web/public/mascot/`.
3. **The swap:**
   - **the select and /learn:** replace `web/public/learning/companion-gator.svg` in place with the new gator (its
     idle pose). Both load it by path, so there's no code change in `duo-select/` or `web/src/learn/`. The file keeps
     its name, and its `<title>` becomes a plain description of the new gator;
   - **the results tutor:** `duoPanelSettings.gator` in `duo-results/index.tsx` points at the new gator: the tutor
     pose in `/mascot/`, or the same `companion-gator.svg`. That's one line;
   - **the old art:** `mentor-gator-avatar.png` and `mentor-gator.png` (the latter still used by
     `learn/frontend/brand-preview/BrandPreview.tsx:15`) stay in place, untouched. Nothing is deleted: removing an
     unused file is Eric's call.

## The lanes and held files
Checked when this spec was written; re-check each before any edit.

| File | Owner | Holder | This pass |
|---|---|---|---|
| `web/public/learning/companion-gator.svg` | learning-ui (done, no assignee) | free | replaced in place; owned here explicitly, since learning-ui has no lane to widen into |
| `web/src/learn/` (TheoryWorkspace, GraphCompanion, GuidedEntry) | learning-ui | **#1367**, **#1263** (seeko-codes) | **no edit**: the asset swap covers them |
| `web/src/game/duo-results/index.tsx` | duo-results (done) | free | the one-line `gator` path |
| `web/src/game/duo-select/Select.tsx`, `select.module.css` | duo-select (done) | **#1252** (`feat(select-motion)`) | **no edit**: the asset swap covers the row. If the new art needs a size change there, it's a one-line switch after #1252 lands |
| `web/public/mascot/` (new) | this feature | | the pose SVGs |

- **The learning lane:** seeko-codes is active in `web/src/learn/` (#1367, #1263), and the swap changes how /learn
  looks without touching its code. The worker comments on #1048 and #1371 with the before and after of /learn, so the
  learning lane sees it. No needs-human is filed, since nothing in `learn/` is edited.
- **Lab variants are cut** (the issue's "several variants side by side as Lab entries"). They're a follow-up in the
  Gaps.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before drawing, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`, at most three rounds, and fix the top three problems each round.
- Shoot at 1280×720 and 1920×1080 on:
  - the results tutor;
  - the select's "Next for you" row;
  - /learn, since the asset swap covers it.
- Before and after shots go in `specs/features/mascot/shots/`.
- The PR's Design section has the skills invoked, each round's score, the fixes, and the shots.

## Validation
The bars are the planner's, not measured thresholds.
- **Unit tests** (`pnpm -C web exec vitest run src/game/duo-results src/game/duo-select src/game/mascot`, with the
  mascot's test in `web/src/game/duo-results/` or a `mascot` test folder the worker logs):
  - every fill and stroke in each mascot SVG is one of the token values;
  - no `<linearGradient>`, `<radialGradient>`, `<filter>` or `<image>`;
  - the files are small, with the cap logged;
  - `duoPanelSettings.gator` points at a file that exists;
  - the existing duo-results and duo-select tests stay green.
- **A 48 px check:** the gator rendered at 48 px and in one color (a single fill) still reads as a gator. Shown in
  the PR beside the full-size one.
- **Shots:** as in the design pass.
- **Browser checks** (`verify-results`, `verify-select`, the learn checks): not verified locally; covered by main's
  scheduled full run.

**Eric** (the morning page, after the merge): one line, "the new gator on results and select; keep, tweak or revert?"
The done note says `not seen by Eric` until he does.

## Gaps (accepted)
- **Lab variants** for Eric to pick among are a follow-up (#878 pattern). The default ships first.
- **The old PNGs** stay in `web/public/learning/` until Eric decides.
- **/learn's own layout** around the gator (GuidedEntry's CSS motion, sizes) is the learning lane's. If the new art
  fits it badly, that's a note for its owner, not an edit here.

## Defaults
- **In `extras`,** right after touch-visible, the last feature with an open PR when this spec was written.
- Log any choice this spec doesn't make in `specs/decisions/mascot-*.md`: the shapes, the line weight, the palette
  mapping, the poses and the tutor's pick.
- The smaller option; no new dependency.
