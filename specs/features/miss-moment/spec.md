---
name: "Miss moment: a miss shows where, then gets out of the way, and is never louder than a hit"
depends_on: ["core-loop", "judging-tiers", "hud", "juice-visual", "juice-sound", "fever-stage", "key-skin", "ui-tokens", "laptop-sound"]
owns: ["specs/features/miss-moment/", "changes/miss-moment.md", "specs/decisions/miss-moment-", "web/src/game/miss-moment/"]
assignee: "eric"
---

# Miss moment

Issue #1038. Eric, 2026-10-25, asked for polish pitches with hit-particles' depth on one moment. In #856's terms, this
is a **hero-moment** item. It's a normal game-lane change with the design pass, and it has no flag.

**Today (origin/main):**
- a missed note turns `missColor` and keeps falling full size, with its pill shape, through the line
  (`core/highway.ts:222-251`);
- juice-visual flashes grey on the line at that key (`juice/index.ts:115`);
- the word says MISS;
- the HUD's combo snaps to 0, and the HUD hides any combo under `comboFrom` (5);
- juice-sound plays an optional miss cue at `missLevel: 0.15` (`sound/index.ts:17,78`), on by default.

Failure is just the success drawing in grey.

**The principle:** failure is quiet, readable and never shaming. Show *where*, then get out of the way. A miss is
never louder than a hit. There's no coaching text: that's the learning lane's tutor.

## The moment
1. **The missed note:** as it crosses the line unplayed, it:
   - desaturates over about 120 ms and loses its glow;
   - thins to about 60% width and drops to about 40% opacity;
   - slides through and is gone within 300 ms.

   A hairline outline lights its key for about 400 ms in the miss token (`miss` in ui-tokens, `--pa-miss`).
2. **The wrong key:** one short pulse in the wrong token (`wrong`) on that key's cap only. No screen-wide red and no
   highway tint.
3. **The combo break:**
   - **at 10 or more:** the old digits drop about 6 px and fade over about 200 ms. The HUD's own rule for what shows
     after the break stays: it hides a combo under 5, so no "0" is drawn;
   - **at 50 or more:** the fever stage also dips about 15% saturation for about 100 ms;
   - **under 10:** a plain cut;
   - no shake: screen-shake (#1011) is for milestones only.
4. **Sound:** measure juice-sound's miss cue against the piano (Validation d) and set `missLevel` so it sits at least
   18 dB under the piano. One cue per miss, and at most one per 120 ms in a run of misses.
5. **Reduced motion:** opacity cuts only: no slide, thinning, drop or dip.

The durations and amounts are starting values, logged and tuned by the worker. A miss's motion must end by 300 ms
(the key outline by about 400 ms), so it's gone before the next note needs the eye.

## How it's built
**A draw plugin plus small hooks, not a highway rewrite.** `web/src/game/miss-moment/` has pure functions that give a
miss's look at t ms after it (alpha, width, saturation, offset), the key outline, the wrong-key pulse and the combo
break. A `draw` plugin paints them, mounted in `web/src/game/layers.ts` after `hud()` under the mount rule (at most 4
lines added). Mounted there, it draws over the band, so the combo break needs no HUD edit.

**Who holds which file (check again before each edit):** `gh pr list`, then each open PR's files. A held file is
closed to this PR. When this spec was written:
- **`core/highway.ts`:** #747 (the hit line and judgment word in the Duo look, waiting on Eric) and #600. The new
  missed note is drawn by the plugin. The old grey draw switches off with **one line in `highway.ts`**: skip a MISS
  note once its key's outline starts, so the plugin's version is the only one. That line goes in once #747 has
  merged, rebased on it. count-in (#1013) took the same route for the same reason. Until then, the plugin, its tests
  and the shots of what it draws can be built, but the look loop's after shots aren't final. If #747 is still open
  when the rest is done, tell the planner instead of waiting.
- **`hud/index.ts`:** #713 and #707 (duo-hud) and #600. The combo break doesn't edit the HUD:
  - a pure `comboBreakAt(msSinceBreak, oldCombo)` gives the falling digits' offset and alpha;
  - the plugin draws them at `hudLayout(width, judgmentLineY).combo` (exported) in the HUD's display font;
  - `drawCombo` isn't exported, so the plugin draws the digits itself with the same font and size.

  duo-hud can call `comboBreakAt` from its own renderer once it lands (log it in
  `specs/decisions/miss-moment-combo.md`, and file nothing: it's the same lane).
- **`juice/index.ts`:** #761. Juice's grey line flash stays until it frees. Then a one-line change drops it, since the
  key outline replaces it. Log which state shipped.
- **`stage/index.ts` (fever-stage):** no open PR when this was written. The saturation dip is a small hook there:
  a `dip(atMs)` the plugin calls on a break at 50 or more. Three.js stays fever-stage's own.
- **`sound/index.ts`:** only #600, which the planner reads as stale, so it doesn't block. Keep the diff narrow:
  `missLevel` and a 120 ms gate in `soundsFor`.
- **`laptop-sound/`:** #806 (sampled-piano) is open, so the piano voice may change under the measurement. Measure
  whatever voice is on main when you run (d), and log which.

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`).
- Score each round against `references/critique.md` and fix the top three problems. A hero moment gets up to 5
  rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Shots:** before and after, at 1280×720 and 1920×1080:
- a miss at +0, +150 and +300 ms;
- a combo break at 50;
- a wrong key;
- the same set under reduced motion.

Use `/play?song=twinkle&bot=rank-c` for misses and `bot=sloppy` for wrong notes (both exist in scenes' `BOTS`). A
break at 50 needs 50 or more notes in a row, then a miss. Use `input=test` on a chart with 51 or more notes (Für Elise):
press the first 50 through core's test device and skip the 51st. Log the URL. They
go in `specs/features/miss-moment/shots/`.

**(b) Taste v2:** the score for each round in the PR, up to 5.

**(c) A miss is quieter than a hit, by measurement:**
- **The test hook:** `window.__pianoArcadeMiss = { frames }` logs, each frame, the mean luminance of the playfield,
  read from the highway and overlay canvases, above the keyboard.
- **The run:** on your own dev server through the in-app browser, at 60 fps. For each event, take the mean
  luminance change over the 300 ms after it against the 100 ms before. Average a miss's over every miss in a
  rank-c Twinkle take, and a GOOD hit's over every GOOD.
- **The bar:** a miss's change is below a GOOD hit's. Report both numbers, before (origin/main) and after.

**(d) The miss cue against the piano:**
- **The recording:** render through their real code in an `OfflineAudioContext`:
  - laptop-sound's voice playing a mid-range note (C4, velocity 80) at the default piano volume;
  - juice-sound's miss cue at the default effects volume.
- **The bar:** the cue's RMS over its length is at least 18 dB under the piano note's RMS over the same span.
  Print both, in dB, before and after.
- On the DGX the piano is louder still, so the laptop is the strict case.
- **Unit tests,** `pnpm -C web exec vitest run --passWithNoTests src/game/miss-moment src/game/sound src/game/stage`:
  - a run of misses 50 ms apart gives at most one cue per 120 ms;
  - the miss-cue setting still gates it;
  - juice-sound's existing tests stay green.

**(e) A WebM** of a rank-C bot take, before and after, for Eric (low rank): frames stepped from the plugin's pure look
functions over a recorded rank-c take, encoded with ffmpeg (installed: `/opt/homebrew/bin/ffmpeg`), labeled "stepped
frames, not a live capture", in `specs/features/miss-moment/shots/`, a few MB at most.

**Unit tests for the look** (`src/game/miss-moment`):
- a miss's alpha reaches about 40%, its width about 60%, and it's gone by 300 ms;
- the outline ends by about 400 ms;
- the combo break: 10 or more drops and fades in about 200 ms, under 10 cuts, and 50 or more calls the stage dip
  once;
- the wrong-key pulse touches only that key's cap rect;
- reduced motion gives opacity steps only.

**`node web/src/game/miss-moment/verify-miss.mjs --out <dir>`, for CI's browser suite:**
- on `/play?song=twinkle&bot=rank-c`, every miss's note is gone from the frame log within 300 ms;
- no frame's luminance after a miss jumps more than after a GOOD;
- reduced motion is emulated: only opacity changes;
- no console error.

It prints `verify-miss: pass` or each failed check. It doesn't run locally. The done note says "not verified locally;
covered by main's scheduled full run".

**perf-budget:** `perf.mjs` p95 ≤ 6 ms at 1920×1080 on a rank-c take. It runs locally only under `verify.lock`;
otherwise "not run locally; main's scheduled run covers it".

**Eric** (the morning page): `localhost:3001/play?song=twinkle&bot=rank-c`, and Für Elise played cold
(`localhost:3001/play?song=fur-elise`). Does a miss show where, then get out of the way? The done note says
`not seen by Eric` until he does.

## Gaps (accepted)
- The MISS word and the WRONG word stay core's and judging-tiers'. This pass doesn't restyle them (#747 is restyling
  the judgment word).
- Until #747, #761 and #713 free their files, the old grey note, juice's grey flash and today's HUD sit under the new
  look. The done note says which of the three one-line switch-offs shipped.
- No coaching text and no per-miss counts beyond the HUD's.

## Defaults
- **In `extras`,** after count-in.
- Log any choice this spec doesn't make in `specs/decisions/miss-moment-*.md`: the curves, amounts, the outline's
  weight, the new `missLevel` and the measured dB.
- The smaller option; no new dependency; no new sound.
