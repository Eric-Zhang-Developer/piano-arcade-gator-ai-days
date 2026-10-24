---
name: "Wait HUD: LEARN and note n / N instead of the score in wait mode"
depends_on: ["wait-mode", "hud", "fever-gauge"]
owns: ["web/src/game/wait-hud/"]
assignee: "eric"
---

# Wait HUD

wait-mode's done note names this gap: "The HUD still counts PERFECTs and score during a wait-mode take, and FULL
COMBO still fires (hud and juice don't read `mode`)." Every wait-mode press is judged at the held time, so a take
that isn't scored looks perfect. It's part of Eric's quick practice ask (2026-10-24).

Issue: #251

## Plan
Two PRs.
1. **One `fix:` PR with no scope** ("wait mode shows no score moments"), as #205 did: every file is a done
   feature's and no in-flight feature owns one. Land it first.
   - **At the root,** `web/src/game/core/judge.ts`: `new Judge(chart, onEvent, { scored: false })` never emits
     `comboMilestone`, `feverStart`, `feverEnd` or `fullCombo`; `web/src/app/play/page.tsx` passes it with
     `?mode=wait`. That silences juice-visual's FULL COMBO, fever-stage, and juice-sound's stinger, sweep and
     fanfare. What it can't reach reads `isWaitMode(params)` in its own `transformChart` (in `web/src/game/`):
     `hud/` draws the band and song card only; `fever-gauge/` draws no meter (it runs its own reducer over
     `noteHit`); `sound/` plays no drumroll or rank hit on `songEnd`; `bar-loop/` shows no Passes list.
2. `feat(wait-hud)`: a plugin in `web/src/game/wait-hud/`, one line in `layers.ts` right after `hud()`. It draws
   LEARN and `note n / N` into the HUD band when `mode=wait`, and nothing otherwise. Then the done note.

## Requirements
- **The panel in wait mode:** the song card on the left, as now; `note n / N` where the counters were; a LEARN
  badge where the score and multiplier were; the band's bottom rule in x1's color. Positions come from `hudLayout`
  and `hudSettings`. Plain mode draws exactly what it draws today.
- **n / N:** N is the number of notes in the chart the judge gets (after hand-mode and bar-loop). n is the note
  you're on: `min(N, notes hit + 1)`. So it reads `note 1 / N` at the first hold and `note N / N` after the last
  note. A chord's notes count one each; a WRONG press changes nothing; `songStart` resets it.
- **No score moments in wait mode:** no FULL COMBO, no fever (edges, stage, sound or meter), no combo milestone
  (sound or the HUD's ghost), no drumroll or rank hit at the end, no Passes list (a learn step's "100.0%").
- **Test hook:** `window.__pianoArcadeWaitHud = { n, N }`, as `__pianoArcadeHud` is.
- **Look:** LEARN in `--pa-cyan` (cabinet chrome), Saira italic 900 at the multiplier's size; `note n / N` in the
  score's face and size. Both are at least 24 px at 1920×1080.

## Validation
- `pnpm -C web test`: all-PERFECT Twinkle (42 notes) emits `comboMilestone`, `feverStart` and `fullCombo` from the
  default `Judge` and none from `{ scored: false }`; a WRONG during fever emits `feverEnd` from the default only.
  In wait mode, hud's draw (the Proxy context its panel test uses) fills no `PERFECT`, `SCORE` or `x1` text,
  fever-gauge's draw fills nothing, and juice-sound schedules nothing on `songEnd`. Wait-hud's reducer gives 1 / 42
  at the start and 42 / 42 after 42 hits.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/wait-hud/verify-wait-hud.mjs --out <dir>`. It starts its own dev server, prints
  `verify-wait-hud: pass` and exits 0, or names each failed step and exits 1. On
  `/play?song=twinkle&mode=wait&input=test`:
  1. At the first hold -> `__pianoArcadeWaitHud` is `{ n: 1, N: 42 }`. Screenshots at 1280×720 and 1920×1080.
  2. Press every note -> `{ n: 42, N: 42 }`; `__pianoArcadeHud.milestone` is still `null` (count 25 if the judge
     had sent it); `[data-testid="full-combo"]` was never attached (a MutationObserver from load).
  3. `&from=1&to=4&tempo=70&passes=1` added, every note pressed -> results with no `[data-testid="bar-loop-passes"]`.
- `verify-hud.mjs`, `verify-fever.mjs` and `verify.py --slug wait-hud` pass unchanged (plain mode).
- On the piano (Eric; mark it in the done note): Für Elise in wait mode shows LEARN and the note count, never a
  score, and the end is silent but for the piano.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2's step 8,
"Look" (`design-taste-frontend`): 1280×720 and 1920×1080, plus reduced motion. Before and after shots in both PRs.

## Defaults
- **songEnd's drumroll and rank hit** go silent through juice-sound, not the judge: `songEnd` must still fire
  (records, piano-out, hand-mode's All Notes Off, beat-track and cabinet need it), and `Results` is frozen, so it
  can't say "unscored".
- The giant combo hides in wait mode too. Beat-track's gutter stays. The judgment word under the line still shows
  (PERFECT on a held press, WRONG on a wrong key).
- combo-hud and score-rollup also edit `drawHud`: the later one rebases and keeps wait mode's band to the song
  card. clear-card already skips wait mode.
- Log any choice the spec doesn't make in `specs/decisions/wait-hud-*.md`.
