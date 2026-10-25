---
name: "Duo details: the results screen's Details grid in the Duo look, empty panels hidden, settings in Options"
depends_on: ["duo-results", "duo-tokens", "duo-start", "results-layout", "core-loop", "timing-feedback", "records", "dynamics", "evenness", "tempo-curve", "take-graph", "replay-view", "take-midi", "bar-loop", "weak-bars", "chord-sync", "juice-sound", "options-panel"]
owns: ["specs/features/duo-details/", "changes/duo-details.md", "specs/decisions/duo-details-"]
assignee: "eric"
---

# Duo details

Issue #833. Eric, 2026-10-25, with a screenshot of the results screen's DETAILS grid after a practice take: "This
looks like complete dogshit." duo-results (#710) restyled the top of the results screen and left the grid below in
the old look ("The Details grid stays below for everything else"). This finishes the screen.

## What exists (origin/main, 2026-10-25)
- **The grid** is `ResultsLayout`'s `#results-details` (`web/src/game/results-layout/index.tsx`): a `Details`
  heading, the Timing card, then every plugin panel that isn't featured, an action or the tutor (`rest`), each as a
  `card` with the plugin's name. A panel that returns `null` already gets no card.
- **Under the grid,** `settings` is /play's `controls` (`web/src/app/play/page.tsx`): a raw latency `<input
  type="range">`, `SfxControls` (Effects slider, Mute and Miss sound checkboxes) and the MIDI status line, all
  `data-capture-hide`.
- **Passes** (`web/src/game/bar-loop/index.ts`, `showPasses`) is an `<ol data-testid="bar-loop-passes">` appended to
  `document.body`, `position: fixed` at the top right, with an 8 px radius, outside the layout.
- **Empty states printed as panels:** records' "Practice takes aren't recorded" and "Records can't be saved in this
  browser" (`records/panel.tsx`), dynamics' `NO_DYNAMICS` and `NO_VELOCITY` (`dynamics/index.ts`), evenness' "No runs
  to score in this song" and "Not enough of a run played to score evenness" (`evenness/index.ts`).
- **Browser-default buttons:** the Timing card's "Set latency offset to N ms" (`page.tsx` `TimingPanel`, a `#ddd`
  fill), Watch replay (`replay-view/overlay.tsx`) and Download MIDI (`take-midi/button.tsx`), with their own
  `buttonStyle`.

### The panels and their owners
Every one is in Eric's lane (`assignee` `eric` or `eric-agent-1`), so one PR may change them all under the lane rule
(AGENTS.md, "Ownership is open within a lane").

| Panel | File | Feature (`owns`) |
|---|---|---|
| The grid, cards, `settings` slot | `web/src/game/results-layout/index.tsx`, `results-layout.module.css`, `results-layout.test.tsx` | results-layout |
| Timing card, latency button, `controls` | `web/src/app/play/page.tsx` | core-loop (also timing-feedback, judging-tiers) |
| Timing text | `web/src/game/timing/index.ts` (`describeTiming`) | timing-feedback |
| Records | `web/src/game/records/panel.tsx`, `index.ts`, `verify-records.mjs` | records |
| Dynamics | `web/src/game/dynamics/index.ts` and its panel | dynamics |
| Evenness | `web/src/game/evenness/index.ts` | evenness |
| Tempo | `web/src/game/tempo-curve/index.ts` | tempo-curve |
| Phrases | `web/src/game/weak-bars/index.ts` | weak-bars |
| Chord sync | `web/src/game/chord-sync/index.ts` | chord-sync |
| Take graph | `web/src/game/take-graph/TakeGraph.tsx` | take-graph |
| Replay (Watch replay) | `web/src/game/replay-view/overlay.tsx` | replay-view |
| MIDI (Download MIDI) | `web/src/game/take-midi/button.tsx` | take-midi |
| Passes | `web/src/game/bar-loop/index.ts` | bar-loop |
| Effects, Mute, Miss sound | `web/src/game/sound/SfxControls.tsx` | juice-sound |
| The Options drawer | `web/src/game/options-panel/index.tsx` | options-panel |
| Panel, Brackets, Button, MonoLabel | `web/src/game/duo-tokens/` | duo-tokens |

**Open PRs on these files** (2026-10-25): #796 `feat(mouse-first)` (`page.tsx`, `options-panel`) and #600 `fix:
improve piano timing…` (`page.tsx`, `results-layout`, `records`, `replay-view`, `take-graph`, `take-midi`,
`tempo-curve`, `timing`, `sound`). The lane rule opens a file only while no open PR is working on it: check
`gh pr list` and their files when you start. If #796 is still open, build anyway on top of origin/main and ask the
planner to hold the PR until it merges, then rebase. #600 is a no-scope `fix:` from another author; if it's still open,
note the overlap on both PRs and rebase on whichever lands first.

## Plan
**One PR: `feat(duo-details)`,** touching the features in the table above under the lane rule. Don't split it by owner.
Up to about 1000 changed lines; split only at a real seam and say why. Suggested worker: **eric-agent-2**, who built
duo-results.

## Requirements
- **The kit look,** matching duo-results' top band (`web/src/game/duo-tokens/`, `specs/context/visual-direction.md`):
  zero radius, Saira condensed for labels and headings, mono (`--pa-font-data`) for data, each panel a bracketed
  `Panel`, and every button the kit's `Button` (or `kitButton` for links). No browser-default buttons, sliders or
  checkboxes left on the results screen. Gold, red and grey only on judgment numbers. If the kit lacks a piece, add it
  through the kit (`duo-tokens`), not locally.
- **An empty panel is hidden.** A panel with nothing to say returns `null`, so it gets no card: records on a practice,
  bot or blocked take; dynamics with `NO_DYNAMICS` or `NO_VELOCITY`; evenness with either `empty` line; and any other
  panel whose only content is a "nothing here" line. The information isn't lost: a take that isn't recorded still
  isn't stored.
- **Grouped by what a player wants,** in this order:
  1. **How I played:** Timing, Tempo, Evenness, Dynamics, Take graph, then Passes, Phrases, Chord sync and Records.
  2. **Do something:** Watch replay and Download MIDI, as kit Buttons in one row.

  A panel in neither list goes at the end of the first group (as `StartScreen` does with a panel in no group). The
  grouping lives in `resultsLayoutSettings`, like `featured` and `actions`. Log the exact order in
  `specs/decisions/duo-details-groups.md`.
- **Passes goes inside the layout.** bar-loop renders its list as its own results panel (a card in the first group)
  instead of appending a fixed `<ol>` to `document.body`. It keeps `data-testid="bar-loop-passes"`, the same
  accuracies and the same rules: none in wait mode, none for a single whole-song pass.
- **Settings move into the Options drawer,** the way duo-start does it (#763, `specs/decisions/duo-start-settings.md`):
  - the results screen gets `options-panel`'s `OptionsDrawer` with `keys={false}` and /play's own `onLatency`, and
    the MIDI status as a child (not in `?input=test`);
  - the drawer's own rows cover the latency slider (with Calibrate), Effects, Mute and Miss sound;
  - `ResultsLayout`'s `settings` prop and the inline `controls` on the results screen go. `controls` stays for the
    error phase only, as now.
  - The Options button is `data-capture-hide` already (capture-mode).
- **Nothing is lost.** Every control still exists and does the same thing, with the same handler. List them in the PR,
  before and after:

  | Control | Before | After |
  |---|---|---|
  | Set latency offset to N ms | Timing card, gray `<button>` | Timing card, kit `Button`, same `onLatency(suggested)` |
  | "Latency offset set to N ms. Press Retry to use it." | Timing card | Timing card |
  | Records initials entry and top 5 | Records card | Records card (recorded takes only) |
  | Phrases practice link | Phrases card | Phrases card, kit link |
  | Watch replay | Replay card, own style | Do-something row, kit `Button`, same overlay |
  | Download MIDI | MIDI card, own style | Do-something row, kit `Button`, same file |
  | Passes list | fixed box, top right | Passes card |
  | Latency offset slider | under the grid | Options drawer's latency row, /play's `onLatency` |
  | Effects slider, Mute, Miss sound | under the grid | Options drawer rows, same prefs store |
  | MIDI status | under the grid | Options drawer child |
  | Details ↓ cue | top band | top band |

  The worker checks this list against the code and adds anything it missed.
- **It fits** at 1280×720 and 1920×1080: the grid's cards line up with no horizontal scroll, and the first view (the
  top bands) is unchanged.
- **Mouse first** (#772): every control is clickable; no key hints on screen.
- **Not in scope:** no new panels, no change to what a panel computes or says when it has something to say, no
  change to the top bands (duo-results).

## Design
AGENTS.md's "Visible changes" pass. Invoke the `frontend-design` skill before writing the UI and
`design-taste-frontend` (taste v2) for the look loop. Between iterations, screenshot the results screen from the
running dev server through the in-app browser at 1280×720 and 1920×1080 (a scored take, a practice take and a bar-loop
take), score against taste v2's `references/critique.md`, and fix the top three problems; at most three rounds. The
PR body gets a **Design** section: the skills invoked, each round's score, the fixes, and before/after shots.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/results-layout src/game/records src/game/dynamics
   src/game/evenness src/game/bar-loop src/game/replay-view src/game/take-midi` plus any other touched feature's own
   vitest:
   - every control in the table renders and calls the same handler as before (latency button → `onLatency`, Watch
     replay opens the overlay, Download MIDI saves, the drawer's rows write the same prefs and latency);
   - empty panels are hidden: records on a practice take, dynamics with `NO_DYNAMICS`, evenness with no runs return
     no card;
   - the groups come out in the order above, and bar-loop's Passes panel lists one accuracy per pass.
2. The existing browser checks on the results screen stay green. They run in main's scheduled full suite, per the
   no-local-checks rule; the done note says "not verified locally; covered by main's scheduled full run". Found with a
   grep of `web/src` and `web/e2e` for the results and Details selectors: `web/e2e/verify.mjs`,
   `duo-results/verify-results.mjs`, `records/verify-records.mjs`, `dynamics/verify-dynamics.mjs`,
   `take-graph/verify-take-graph.mjs`, `replay-view/verify-replay.mjs`, `chord-sync/verify-chords.mjs`,
   `tempo-curve/check-rubato.mjs`, `wait-mode/verify-wait.mjs`, `wait-hud/verify-wait-hud.mjs`,
   `record-moment/verify-moment.mjs`, `hero-replay/verify-hero.mjs`, `sheet-review/verify-review.mjs`,
   `capture-mode/verify-capture.mjs`, `song-options/verify-options.mjs`.
   **`verify-records.mjs` step 3 must change:** it waits for the `records` panel on a bot take and expects "Practice
   takes aren't recorded", which this spec hides. It becomes: the results show no `records` panel, and the bot take is
   still not stored (`top.length` unchanged). That keeps what it proves; say so in the PR.
3. The design pass above, with the Design section in the PR.
4. Eric looks at it once. Mark that in the done note.

## Defaults
- **In `extras`, after golden-demo** (#833).
- Log any choice this spec doesn't make in `specs/decisions/duo-details-*.md`.
