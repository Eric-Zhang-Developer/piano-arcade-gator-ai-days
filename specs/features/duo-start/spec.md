---
name: "Duo start: /play's start screen in the Duo look, as one PR"
depends_on: ["duo-tokens", "duo-select"]
owns: ["specs/features/duo-start/", "changes/duo-start.md", "web/src/game/duo-start/", "specs/decisions/duo-start-"]
assignee: "eric"
---

# Duo start

Issue #733. Eric, 2026-10-25, with a screenshot of `/play`'s start screen: "To redesign this page entirely should just
be one pull request." Then: "Yes, duo-start before Monday." It's the screen right after the select in the video.

Today the start screen is the pre-Duo stage card (`web/src/game/stage-card/`: the "ARE YOU READY?" band, the old
jacket, title and level) above browser-default buttons and controls. Those come from several features' start panels:
Start, PRACTICE IN CHUNKS, Labels, Learn it first, Play in Flow, Sheet music ↗, Connect lights, the latency and
effects sliders, Mute and Miss sound.

## Plan
**One PR: `feat(duo-start)`.** It may change the start panels of other features in Eric's lane: stage-card,
chunk-practice, flow-mode, note-labels, sheet-view, leds, laptop-octaves, hand-mode, wait-mode and the rest. That's
allowed by the lane-ownership rule in the pending `contract:` PR (Eric's: "one PR per screen, up to ~1000 lines,
ownership open within my lane"). **If that contract hasn't merged when the worker starts,** build the PR anyway and
ask the planner to hold it until it does. Don't split it by owner. Up to about 1000 changed lines; split only at a
real seam (a component other screens share), and say why.

## Requirements
- **It matches the new select (#714):** a bracketed `Panel`, and the song's **piano roll** (`PianoRoll` and `roll()`
  from `web/src/game/duo-select/`) in place of the old jacket, with the title, composer and level in the
  kit's type roles. "ARE YOU READY" and the count-in stay; they move into the Duo look.
- **One primary action:** Start, the kit's `Button` in its strongest style. The play modes (practice in chunks, Learn it first,
  Play in Flow, Sheet music ↗) are secondary buttons in one row. The settings (labels, hands, latency and effects
  sliders, Mute, Miss sound, Connect lights) sit in one quiet, grouped settings panel that doesn't compete with Start.
- **Nothing is lost:** every control on today's start screen is still there and still does the same thing, with the
  same keys. List them in the PR, before and after.
- **The Duo kit only** (`web/src/game/duo-tokens/`): zero radius, Saira condensed for labels, mono for data. No
  browser-default controls left: style the sliders and checkboxes too. No hype pink, no sun or grid (#728).
- **It fits** at 1280×720 and 1920×1080 with no page scroll, and works with the keyboard alone.
- **Not in scope:** no new controls or modes, no change to what any control does, and no change to `/play`'s highway.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/duo-start` plus the touched features' own vitest: every
   control from today's list renders, and its handler is the same one as before.
2. Every existing browser check that covers the start screen keeps passing. It runs in main's scheduled full suite,
   per the no-local-checks rule. The done note names those checks: "not verified locally; covered by main's
   scheduled full run".
3. AGENTS.md's "Visible changes" design pass: both skills, up to 3 rounds of shots from the dev server at 1280 and
   1920, and the Design section with scores and before/after shots.
4. Eric looks at it once. Mark that in the done note.

## Defaults
- **Before Monday,** in `extras` after nav-bar. Cut it if it isn't merged by the freeze.
- Log any choice this spec doesn't make in `specs/decisions/duo-start-*.md`.
