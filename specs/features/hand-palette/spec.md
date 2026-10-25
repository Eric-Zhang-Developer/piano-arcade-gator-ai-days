---
name: "Hand palette: the hand and judgment colors solved with color science, compared in the Lab, plus a shape cue"
depends_on: ["experiments", "hand-colors", "ui-tokens", "duo-tokens", "hud", "fever-gauge", "juice-visual", "scenes"]
owns: ["specs/features/hand-palette/", "changes/hand-palette.md", "specs/decisions/hand-palette-", "web/src/game/x/hand-palette/"]
assignee: "eric"
---

# Hand palette

Issue #1127 (filed by eric-agent-6 from take-graph-pass, #1086), made pitch #14 by eric-planning-agent. It's a
hero-tier polish item (#856), built as a Lab experiment (#878). **This spec changes no token:** Eric picks a
candidate on the morning page, and a follow-up adoption PR changes the tokens.

**The problem (#1127):** the two hand tokens fail dataviz's palette validator on the dark panel. Under deuteranopia
the right and left hands look the same, with a ΔE of about 0.7, and both sit near the same lightness.

**The pitch's measurements** (eric-asking-agent-1's scratchpad `cvd.py`: Machado 2009 at severity 1.0, CIEDE2000;
JND about 2.3). These are the pitch's numbers, not ground truth. The worker re-measures every one in its own test.

| Pair | normal | protan | deutan | tritan |
|---|---|---|---|---|
| handR `#2b9bff` vs handL `#a07cff` | 23.3 | 4.6 | 0.6 | 21.7 |
| GREAT (= handR) vs GOOD `#7cb7ff` | 9.1 | 8.3 | 10.4 | 5.8 |
| handL vs GOOD | | | 9.8 | |
| PERFECT `#ffe27a` vs GOOD | ≥ 39 | ≥ 39 | ≥ 39 | ≥ 39 |

L*: 62.7 vs 60.9.

**One inconsistency on main:** GREAT has no token, and it's two colors today.
- The highway's judgment word uses `handR` (`core/highway.ts:20`).
- The HUD's counter uses a literal mint, `#5ef2c4` (`hud/index.ts:19`).

The candidates give GREAT its own token, and the table measures both of today's GREATs.

## What to build
1. **Two or three candidate palettes, solved together.** Each sets:
   - the 2 hands;
   - the judgments: PERFECT gold, GREAT (its own token), GOOD, MISS grey and WRONG red;
   - fever's amber (`meterSettings.fill`, `juiceSettings.feverColor`, #1150).

   **The method:**
   - work in OKLCH, in the Duo kit's feel (`specs/context/visual-direction.md`);
   - equal hand lightness, and maximum hue separation that survives CVD;
   - Okabe–Ito's blue and orange would collide with gold and amber, which is why all of them are solved together.

   **The candidates:**
   - **A** is today's palette plus the redundant cue only, so Eric can "keep the look, add the shape";
   - **B** and, if one is worth it, **C** are solved palettes;
   - each candidate's values, and how they were solved, go in `specs/decisions/hand-palette-candidates.md`.
2. **A redundant cue** (WCAG 1.4.1): left-hand pills get a subtle shape difference, a notched or hairline end, the
   way the take graph uses circles and squares. Sparks and keys follow.
   - **In this PR,** the experiment draws the cue on the overlay over each left-hand pill's end (a `draw` plugin over
     the notes), so it can be judged live without editing a held file.
   - **In the adoption PR,** it moves into the owning files, each with a one-line hook once its holder frees the
     file. Re-check each holder first. When this spec was written:

     | Piece | File | Held by |
     |---|---|---|
     | Pill shape | `web/src/game/note-pills/index.ts` | #749 (`fix(note-pills)`, 2 px corners) |
     | Pill draw | `web/src/game/core/highway.ts` | #747 and #600 |
     | Sparks | `web/src/game/juice/index.ts` | #761 |
     | Sparks | `web/src/game/hit-particles/` | free |
     | Keys | `web/src/game/key-skin/index.ts` | #600 (stale) |
3. **The Lab comparison:** `?x=hand-palette&p=A|B|C`, an experiment on `/play` through the frame.
   - **Applying a candidate:** the colors are read at draw time from exported settings objects:
     `handColorSettings.colors` (hand-colors), `hudSettings.judgmentColors`, `meterSettings.fill` and
     `juiceSettings.feverColor`. The experiment sets them from the candidate in `transformChart` when it's on. It
     restores the originals on `songEnd`, `quit` and `pagehide`, so a take without the flag sees today's colors.
     A reader that caches a color at take start still picks up the candidate, since the override comes first; one
     that caches at import doesn't, and is logged. That's a runtime override, not an edit, logged in `specs/decisions/hand-palette-override.md`. Two things it
     can't reach without an edit:
     - the highway's judgment word color is a module-private constant (`highway.ts:20`), so it stays today's color
       in the comparison;
     - a client-side navigation away mid-take could carry the override until the next full load.

     Both are logged.
   - **"Simulate":** `&sim=normal|protan|deutan|tritan`. The Machado 2009 matrices (severity 1.0, copied from the
     paper's table with its citation, never typed from memory) go into an SVG `feColorMatrix`. The experiment
     applies it as a CSS filter on `/play`'s canvases while on, and removes it at the same exits. The start panel shows
     the candidate and simulation pickers as kit buttons, which reload with the params.
   - **Registry entry** (`web/src/game/x/index.ts`, its one line, under the lane rule): group "Polish", line "The
     hand and judgment colors, three ways, with a colour-blind simulation (#1127)", href
     `/play?song=fur-elise&bot=perfect&x=hand-palette&p=A`.
4. **Contrast:** in every candidate, note fills are at 3:1 or more against the field (WCAG 1.4.11): against `bg`
   `#030607`, and against highway-field's darkest field pixel if that has landed (#1122).
5. **The LED strip** follows only if it reads ui-tokens (`leds/messages.ts`' `rgb7` of `noteColorFor`), and only in
   the adoption PR. Firmware is Sharan's lane and stays untouched.

## Validation
The bars are the planner's, not measured thresholds.

**(a) The ΔE00 table, before and after:**
- **Pairs:** every hand pair and every judgment pair, plus each against fever's amber.
- **Under:** normal, protan, deutan and tritan (Machado 2009, severity 1.0), for today's colors and each candidate.
- **Targets:**
  - the hands ≥ 10 in all four;
  - judgment pairs ≥ 10 normal and ≥ 8 under CVD;
  - hand L* within ±3.
- **Unit-tested** (`pnpm -C web exec vitest run --passWithNoTests src/game/x/hand-palette`), so a token change can't
  regress it:
  - CIEDE2000 checked against Sharma, Wu and Dalal's published test pairs (2005; confirm the citation, and copy
    the pairs from the paper);
  - the Machado matrices against the paper's table;
  - the table's numbers recomputed from the tokens, with each target asserted per candidate;
  - today's palette's known failures asserted as failures, so the test proves it can fail.
- **A cross-check:** dataviz's `validate_palette.js` on each candidate (`--mode dark --surface "#0a0d15"`), with its
  output in the PR.
- **If no candidate hits every target,** report the best one and say which pair misses, by how much.

**(b) Shots** at 1280×720 and 1920×1080: fur-elise mid-song, two hands, `bot=perfect`, per candidate × simulation
(normal, protan, deutan, tritan), plus reduced motion. They're taken on your own dev server in the in-app browser
(one slot, `devserver.1` to `.4`), and go in `specs/features/experiments/shots/hand-palette/`.

**(c) Taste v2:** the design pass (`frontend-design`, then `design-taste-frontend`, after loading the `dataviz`
skill for the palette method), scored per candidate, up to 3 rounds. Scores go in the PR's Design section.

**(d) The adoption PR** (after Eric's pick, not this one) changes `ui-tokens`, `globals.css`, `hand-colors`, GREAT's
new token, and the readers. It reruns (a) and (b), updates `duo-tokens/verify-duo.mjs`'s pinned values (lines 23–26)
and says why, and moves the cue into the owning files.

**The perf gate** (contract item 4): `perf.mjs --params x=hand-palette`, p95 ≤ 6 ms. It runs locally only under
`verify.lock`; otherwise "not run locally; main's scheduled run covers it".

**Morning page:** "pick A, B or C", with the table and a shot of each under deutan. Open it at
`localhost:3001/play?song=fur-elise&bot=perfect&x=hand-palette&p=A`. The done note says `not picked by Eric` until he
does.

## Gaps (accepted)
- No token changes in this PR: Eric's pick comes first.
- The highway's judgment word keeps today's colors in the comparison (a private constant).
- The cue is previewed on the overlay. Its final home is the adoption PR's.

## Defaults
- **In `extras`,** after fever-arc. fever-arc's plan PR (#1151) isn't on main yet, so this PR places it after
  highway-field, and whichever merges second moves its line under the other.
- Log any choice this spec doesn't make in `specs/decisions/hand-palette-*.md`.
- The smaller option; no new dependency.
