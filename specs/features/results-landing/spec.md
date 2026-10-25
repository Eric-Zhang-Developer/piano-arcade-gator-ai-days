---
name: "Results landing: the 3 s from the last note to the rank, cut like a film instead of a page swap"
depends_on: ["duo-results", "results-tally", "rank-stamp", "juice-visual", "hit-particles", "clear-card", "record-moment", "duo-tokens"]
owns: ["specs/features/results-landing/", "changes/results-landing.md", "specs/decisions/results-landing-", "web/src/game/results-landing/"]
assignee: "eric"
---

# Results landing

Issue #959. Eric, 2026-10-25, 06:10, asked for "a pitch that really focuses on polishing one aspect of the demo. Like a
deep focus, just like the graphics, like the particle effects were for the keys". This is one deep pass on one moment,
as hit-particles (#750) was for the keys. It isn't #856's sweep of separate problems.

**The moment:** the time from the last note to the rank, which every take on the demo ends with. Today it's a page
swap:
- `/play` waits `END_TAIL_MS` (1000 ms) after the last note's window closes, while clear-card's card fills it
  (`web/src/app/play/page.tsx:41,379`);
- then the results mount, the tally runs for 1.2 s (`tallySettings.totalMs`);
- then the stamp drops from 1.6× in 300 ms (`stampSettings`), and NEW RECORD follows the stamp
  (`record-moment/timing.ts`).

This pass choreographs that moment as one cut.

## The cut
Every time below runs on one timeline, starting at **T0**: the later of the last chart note's judgment and the last
key release. A key held past today's finish time doesn't hold the cut back. The durations are starting values, logged
and tuned by the worker. The pitch sets the ones it names.

1. **The out (about 400 ms):**
   - after the last release, the highway's drawn clock eases to a stop (a time ramp, never a jump);
   - the keyboard dims;
   - the HUD's numbers slide to their places in the results layout: the score to its line, and the combo to the
     MAX COMBO cell.

   A number keeps its value while it moves. If the combo isn't the max combo, the cell ticks to the max combo after
   the number lands, so a label never shows another value. The HUD's live PERFECT, GREAT, GOOD and MISS counters fade
   as the four count cells take over and tally from 0 (step 2). That way the pitch's slide and tally don't show the
   same counts twice; log it as a decision. ACC arrives with the tally's last count.

   The slide starts from `hudLayout`'s slots (`web/src/game/hud/`, imported, never edited: duo-hud is in flight
   there) and ends at the cells' rects, as a FLIP move. clear-card's card keeps its place in the out (ALL PERFECT,
   FULL COMBO or CLEAR); the worker logs how it shares the dim.
2. **The tally:** PERFECT, GREAT, GOOD, then MISS tick up, each starting on the chart's beat
   (`msPerBeat(chart.bpm)`), so the counts land in the song's time. If four beats don't fit in **1.2 s in all**
   (pitch), the grid halves (½ beat, ¼ beat ...) until it fits. `tally(t, target)` keeps its rules: eased, never
   decreasing, exactly on target at the end.
3. **The stamp (about 180 ms):**
   - the rank letter scales **1.08 → 0.97 → 1.0** (pitch) on a real easing curve (spring-like, not linear segments);
   - a one-frame tint flash at impact;
   - a 2 px settle shake;
   - the bracket corners (`drawBrackets` or the kit's `Brackets`) snap in.

   Tune it by stepping frames at 60 fps (below). `stampImpactMs()` stays the one source of the impact time, so
   juice-sound's rank hit, its drumroll and record-moment's timing follow the new stamp without edits of their own.
4. **The after (about 250 ms after the stamp, pitch):** NEW RECORD (record-moment) and the tutor panel (duo-results)
   arrive. The rest of the results bands are already in place by then.

**Planned total:** T0 to the end state is **≤ 2.8 s**.

**Skip:** from the results' mount, any key or click jumps to the end state.
- The skipping input does nothing else: it doesn't trigger Retry and doesn't press a button. The one exception is a
  letter key, which record-moment keeps for the initials, as it does today.
- During the out, keys are still play input, as today, so the take is judged exactly as before.

**Reduced motion:** the first frame after the results' mount is the end state. No ramp, slide, tick, shake or flash.

**Look:**
- the Duo kit only (`web/src/game/duo-tokens/`);
- hype pink (`--pa-hype`) only where #663 allows it: the rank reveal, NEW RECORD and full combo, never on
  panels, buttons or judgment numbers;
- gold, grey and the judgment colors stay on the judgment numbers, as duo-results set them.

**Sound:**
- no new sound;
- if milestone-sfx (#877) has landed, its stingers land on the cut's beats through `stampImpactMs()` and the moment's
  cue times;
- otherwise the timeline exports its cue times (out start, each tally tick, stamp impact, the after) for it to
  schedule from later.

## How it's built
- **The timeline is pure:** `landingAt(tMs, plan)` in `web/src/game/results-landing/` returns every element's state at
  t: highway clock rate, keyboard dim, each number's position, each count's value, the rank's scale, offset and tint,
  and the after's opacity. The page and the tests use the same function, so a frame is a function of t.
- **Test hook:** `window.__pianoArcadeLanding = { plan, t, seek(ms), pause(), endState }`. With it, the check and the
  worker step the moment frame by frame at 60 fps.
- **Behind a flag until Eric checks it:** `?x=results-landing`, read by this feature (the same syntax as the
  experiments contract, #878, though it isn't a registry entry). Without it, `/play`'s end-of-song clock, the tally
  and the stamp are today's, so the demo path doesn't change. After Eric's yes, a `fix(results-landing)` PR flips the
  default and deletes the old path.
- **Files it reaches through the lane rule:**
  - `web/src/app/play/page.tsx` (the end clock and the highway ramp);
  - `web/src/game/rank-stamp/`, `results-tally/`, `results-layout/`, `duo-results/`, `juice/` (it draws the stamp
    today) and `clear-card/`.

  **Check open PRs on each file first** (`gh pr list`, then each PR's files). An open PR's file is closed to this one.
  When this spec was written:
  - #761 held `juice/index.ts`;
  - #713 and #707 (duo-hud) held `hud/` and `duo-hud/`;
  - #600 (abbasi2010) held `results-layout/index.tsx`, `app/play/page.tsx`, `hud/index.ts` and `sound/index.ts`.

  The planner reads #600 as stale (last commit 00:24Z), so it doesn't block. Keep the diffs on #600's files narrow.
  If a file you need stays held, put the change in `web/src/game/results-landing/`, behind the flag, and log it.
- **PR size:** one PR per thing a person sees, so one PR, up to about 1000 lines. Split only at a real seam, for
  example the pure timeline and its tests first.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- **Shots:** before and after at 1280×720 and 1920×1080, plus reduced motion. Take key frames from the seek hook:
  the out's middle, the tally's middle, the stamp's impact and settle, and the end state. Score against taste v2's
  `references/critique.md`, fix the top three problems, at most three rounds.
- Take them from your own dev server in the in-app browser, with a dev-server slot (`devserver.1` to `.4`).
- **The PR body's Design section** has the skills invoked, each round's score, the fixes, and the before and after
  shots.
- **Before and after WebMs of the moment, for Eric's morning page:**
  - made from your dev server by stepping the seek hook at 60 fps and encoding the frames with ffmpeg (installed:
    `/opt/homebrew/bin/ffmpeg`);
  - labeled "stepped frames, not a live capture";
  - stored in `specs/features/results-landing/shots/`, a few MB at most, with the size logged.

## Validation
The bars are the pitch's where marked; the rest are the planner's, not measured thresholds.

1. `pnpm -C web exec vitest run --passWithNoTests src/game/results-landing src/game/rank-stamp src/game/results-tally src/game/record-moment src/game/sound`:
   - **the timeline:** T0 to the end state is ≤ 2.8 s at 60, 100 and 180 BPM, and the out ramps the highway clock
     from rate 1 to 0 without a jump;
   - **the tally:** the ticks start on the beat grid, the grid halves until it fits, and the whole is ≤ 1.2 s;
   - **the stamp:** the scale passes 1.08, then 0.97, then rests at exactly 1.0, within about 180 ms; the tint lasts
     one 60 fps frame; the shake is at most 2 px and ends at 0;
   - **the after:** it starts 250 ms after the stamp;
   - **reduced motion:** `landingAt(0)` equals the end state;
   - **sound follows:** `stampImpactMs()` equals the timeline's impact, and juice-sound's and record-moment's existing
     tests stay green.
2. `node web/src/game/results-landing/verify-landing.mjs --out <dir>` runs `/play?song=twinkle&bot=perfect&x=results-landing`
   and `&bot=rank-c` (the bot exists in scenes' `BOTS`). It prints `verify-landing: pass`, or each failed check:
   1. **The stamp settles on its planned frame:** stepping the seek hook at 60 fps, the rank's computed scale is
      1.0 from the planned settle frame ± 1 onward, and the shake offset is 0.
   2. **Total ≤ 2.8 s:** in a real run, not seeking, T0 to `endState` measures ≤ 2.8 s (pitch).
   3. **Input is never blocked over 300 ms:** a `PerformanceObserver` sees no long task over 300 ms from T0 to the
      end state. A click at five points after the results mount reaches the end state within 300 ms, without
      triggering Retry (pitch).
   4. **Reduced motion:** with `prefers-reduced-motion: reduce` emulated, the first frame after the results mount is
      the end state (pitch).
   5. **Without the flag, nothing changes:** the results show after today's tail, and the stamp keeps today's curve.
   6. No console error.

   Per AGENTS.md, this runs in CI's browser suite (it picks the script up by name), not locally. The done note says
   "not verified locally; covered by main's scheduled full run".
3. The design pass above, with its Design section and the before and after WebMs.
4. **Eric (about 2 minutes, the morning page):** he watches the WebMs, then plays it himself at these URLs on his dev
   server:
   - `localhost:3001/play?song=twinkle&bot=perfect&x=results-landing`;
   - `localhost:3001/play?song=twinkle&bot=rank-c&x=results-landing`;
   - `localhost:3001/play?song=local/golden-hard&bot=perfect&audible=1&demo=1&x=results-landing`.

   `local/golden-hard` is a local, gitignored chart (decision 003), so only Eric's machine has it, and CI never uses
   it. With `demo=1`, watch-demo returns to `/` after the results, so the end state has to be on screen before it
   leaves. The done note says `not seen by Eric` until he does.

## Gaps (accepted)
- No new sound. The cue times are exported for milestone-sfx.
- The HUD's numbers slide from wherever `hudLayout` puts them. When duo-hud moves them, the slide follows, and a new
  look round may be needed.
- The WebMs are stepped frames, not a live screen capture.
- Practice and wait takes keep today's results ("not scored"). The landing runs only on scored takes.

## Defaults
- **In `extras`,** after demo-performance (Eric's 2026-10-25 priority block).
- Log any choice this spec doesn't make in `specs/decisions/results-landing-*.md`, including the final durations and
  easing curves.
- The smaller option; no new dependency; every number on screen comes from the take.
