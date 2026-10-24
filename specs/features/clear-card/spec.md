---
name: "Clear card: ALL PERFECT, FULL COMBO or CLEAR before the results"
depends_on: ["juice-visual", "ui-tokens", "scenes"]
owns: ["web/src/game/clear-card/"]
assignee: "eric"
---

# Clear card

The loud moment between the last note and the results: one card that says how the take ended.

## Plan
1. **A `fix(juice-visual)` PR** (`web/src/game/juice/index.ts`): delete `showFullCombo`, its `juice-banner` keyframes
   and the `full-combo` selector, and stop the rank reveal waiting on `fullCombo` (today `rankReveal(fullCombo)` holds
   the rank 2 s for the banner). The card absorbs the banner: one full-combo moment, never two. rank-stamp's own
   `fix(juice-visual)` rewrites the same reveal and comes first in eric-agent-1's queue: whichever merges second
   rebases and keeps the stamp. chord-sync's verify waits for the banner to detach and passes without it.
2. **`feat(clear-card)`:** the plugin in `web/src/game/clear-card/` (pure `clearKind`, the draw, tests,
   `verify-clear.mjs`), one line in `web/src/game/layers.ts` right after `feverGauge()` (over the HUD and the meter;
   every plugin that changes the chart sits above it, so it counts the chart the judge gets), and the done note.
3. Nothing in `results-layout/`, `results-tally/` or `rank-stamp/`: eric-agent-1 is building them.

## Requirements
- `clearKind(counts)` is pure: every note PERFECT and no WRONG → "ALL PERFECT"; no MISS and no WRONG → "FULL COMBO";
  else "CLEAR". Extras that aren't WRONG don't count, as in `Judge.finish` (`fullCombo` iff no MISS and no WRONG).
- The card shows when the last note is judged: `noteHit` plus `noteMiss` reach the note count of the chart its
  `transformChart` saw. A WRONG after that (the judge allows one up to `GOOD_MS` past the last note) turns it to CLEAR.
- **Order against the results ceremony** (t0 = the last note judged): the card eases in over about 200 ms, then holds
  still → `songEnd` at t0 + 1.0–1.4 s (`/play`: `GOOD_MS` 100 + `INPUT_GRACE_MS` 50 + `END_TAIL_MS` 1000 after the
  last note's time, plus a positive latency offset): the card is gone, its canvas cleared, and the results render →
  results-tally's count-up, 0–1.2 s → rank-stamp's stamp, 1.2–1.5 s. The card never shares a frame with the tally or
  the stamp, and nothing gets delayed. It ends at `songEnd` with no timer of its own, so it lasts under 1.5 s.
- **Look:** Saira 900 italic (`--pa-font-display`, resolved as the HUD does), `--pa-gold` for ALL PERFECT and
  FULL COMBO, `--pa-ink` for CLEAR, centered on the playfield and shrunk with `measureText` to fit 90% of the width
  (1024×768 included). The playfield under the HUD band dims; the HUD stays readable. Nothing moves after the ease.
- **Reduced motion:** shown at once with no ease, for the same time.
- Drawn against `Frame.nowMs`, so Esc freezes it. `songStart` and `quit` clear it. No card with `?mode=wait`
  (`isWaitMode(params)` from `web/src/game/wait-mode`, read in `transformChart`): wait-mode takes aren't scored.
- `window.__pianoArcadeClearCard = { kind, shownAtMs }`, or null, for the headless check. `full-combo` never appears.

## Validation
- `pnpm -C web test`:
  - `clearKind` for the three kinds and for an extra that isn't WRONG. Against the real `Judge`'s events: FULL COMBO
    or ALL PERFECT exactly when the judge sends `fullCombo`, and a WRONG after the last hit gives CLEAR.
  - The draw, recorded with a fake context (`hud.test.ts`'s Proxy): at t0 + 300 ms it fills the kind's text in its
    color at full alpha, centered; it draws nothing before t0, after `songEnd`, or with `?mode=wait`.
- `node web/src/game/clear-card/verify-clear.mjs --out <dir>` (verify-fever.mjs is the model), Twinkle, `beat=off`,
  one screenshot each:
  1. `/play?bot=perfect` at 1920×1080, 1280×720 and 1024×768 -> ALL PERFECT after the last hit, gone with the results.
  2. `bot=late` at 1920×1080 -> FULL COMBO (42 GREAT). 3. `bot=rank-c` -> CLEAR.
  4. `bot=perfect` with `reducedMotion: "reduce"` -> the same card, still.
  Each run fails if the kind is wrong, the card never shows, shows for over 1.5 s or after `[data-testid="results"]`
  appears, or `full-combo` is in the DOM.
- `verify.py --slug clear-card` passes.
- Eric's eye (mark it in the done note): does the end of a take land. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with
`design-taste-frontend`'s step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before and after screenshots in
the PR.

## Defaults
- The card fills the tail that already exists: don't lengthen it, and don't delay the results.
- The card is silent. juice-sound's fanfare (`songEnd` + 1.05 s) and fever-stage's ring stay on `fullCombo`.
- No new dependencies. Log a choice the spec doesn't make in `specs/decisions/clear-card-*.md`.

Issue: #255.
