---
name: "Count-in: the 8 beats before the first note, in the Duo look and on one clock with the click"
depends_on: ["core-loop", "beat-track", "duo-tokens", "difficulty", "perf-budget", "stage-card"]
owns: ["specs/features/count-in/", "changes/count-in.md", "specs/decisions/count-in-", "web/src/game/count-in/"]
assignee: "eric"
---

# Count-in

Issue #1006. Eric, 2026-10-25, asked for polish pitches with hit-particles' depth on one moment. In #856's terms, this
is a **hero-moment** item: one moment, researched and tuned until it's finished. It's a normal game-lane change with
the design pass, not an experiment, so there's no flag.

**The moment:** the 8 beats before the first note of every take. Today it's a bold `system-ui` digit at 85% white
(`web/src/game/core/highway.ts:345-349`), the last default-font spot in the game.

**What it sits among (origin/main):**
- `countInBeats: 8` (`core/settings.ts:15`), with "time to get hands on the keys after Start" from the playtest.
- /play sets `countInBeat` from the chart clock and emits `countInBeat` events (`app/play/page.tsx:363-365`).
- beat-track clicks a side stick (note 37) on each count-in beat (`beatHits`, `beat/index.ts:84-99`), with the accent
  on each bar's beat 1. It's off in wait and flow modes, and when a song has a recording.
- The difficulty WARNING card shows in the count-in's first bar on songs at level 13 and up (`difficulty/index.ts`).
- The stage card shows the song's title and composer before Start, and the HUD band's song card shows them during
  play.

## The count-in
The count-in's 8 beats split into two halves of 4, and `countInBeats` stays 8. In 4/4 each half is a bar. Accents
follow beat-track's rule (each bar's beat 1, by `beatsPerBar`), so the eye and the ear stress the same beats. In 3/4
or 3/8 the halves aren't bars; that's logged, not changed.

1. **The listen half (beats 1–4):** a hairline ruler across the hit line with 4 ticks, filling one per beat. The tick
   on an accented beat is heavier. If the LED count-in bar (#720, led-strip) is on main, mirror its look: the fill
   direction and the step per beat. Never depend on it: with #720 open or gone, this ships the same.
2. **The count half (beats 5–8):** numerals 4, 3, 2, 1 in the Duo kit's display type (`canvasFonts`, Saira
   condensed, tabular figures). Each numeral:
   - fades in over 40 ms on its beat;
   - settles from 1.04 to 1.0 over 120 ms, on a real easing curve;
   - fades out over the last 30% of its beat.
3. **The hit line breathes:**
   - a brightness pulse on each of the 8 beats, peaking on the accented ones;
   - one white-hot frame on beat 0, the first note's beat;
   - no "GO" text.
4. **AV sync:** every visual beat and beat-track's click come from one source.
   - The ticks, numerals and pulses are drawn at the beat times `beatHits(chart, ...)` returns, the same list the
     click is scheduled from, on the chart clock after the latency setting.
   - The worker reads how /play applies `latencyOffsetMs` to the drawn clock and to beat-track's sends, and logs it.
   - Each visual beat's first frame and its click's scheduled time are within one frame (16.7 ms) of each other.
   - Where beat-track is off (wait mode, flow mode, a song with a recording), the visuals keep the same beat times
     with no click.
5. **The title slate:** the song's title and composer, small, at the highway's top left, under the HUD band, in the
   listen half, fading by the count half.
   - **Not video-shots' title card.** That one (#975, PR #983) is `/shots?card=title`: Étude and the tagline, before
     any song. This slate is per take.
   - The slate must not cover the WARNING card on level 13+ songs (check `maple-leaf-rag`, level 14).
   - It's the third place the song's name shows, after the stage card and before the HUD's song card. The worker
     scores it in the look loop. If it reads as a repeat, it goes, logged in `specs/decisions/count-in-slate.md`.
6. **Edge cases:**
   - pause or retry during the count-in restarts the half cleanly: the state is a function of the chart clock, so
     nothing is left half-drawn;
   - `/learn` (another lane) is never touched. Wait and flow modes share `/play`'s count-in, so they get it;
   - **reduced motion:** numerals cut on the beat with no scale or fade, ticks fill without animation, and the pulse
     becomes a tint change;
   - 60 fps under perf-budget.

## How it's built
- **A plugin, not a highway rewrite.** `web/src/game/count-in/` has a pure `countInAt(chart, nowMs)`, which returns
  the ruler's fill, the numeral with its alpha and scale, the pulse, and the slate's alpha. A `draw` plugin paints
  it, mounted in `web/src/game/layers.ts` under the mount rule (at most 4 lines added).
- **Highway changes:** `highway.ts` loses lines 345-349, the old digit. The hit line's pulse is drawn by the plugin
  over the line, so `highway.ts` changes by those lines only.
- **Test hook:** `window.__pianoArcadeCountIn = { frames }`, with each frame's `performance.now()`, chart time and the
  visible numeral, filled ticks and pulse. beat-track gets a matching read-only hook with each scheduled count-in
  click's time, through a `fix(beat-track)` change in the same PR under the lane rule.
- **Lane rule:** it reaches `core/highway.ts`, `app/play/page.tsx` (only if needed), `beat/` and `layers.ts`. Check
  open PRs on each file first (`gh pr list`, then each PR's files). When this spec was written:
  - #747 (`fix(core-loop)`, the hit line and judgment word in the Duo look) held `core/highway.ts`. Rebase on it
    when it merges, and draw the pulse over its new hit line. While it's open, `highway.ts` is closed to this PR,
    so take the old digit out in a follow-up `fix(count-in)`, or wait for it.
  - #978 (results-landing) and #1001 held `app/play/page.tsx`.
  - #600 (abbasi2010) held `highway.ts`, `settings.ts`, `beat/` and `difficulty/`. The planner reads it as stale, so
    it doesn't block. Keep the diffs on its files narrow.

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`).
- Score each round against `references/critique.md` and fix the top three problems. A hero moment gets up to 5
  rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Shots:** before and after at 1280×720 and 1920×1080, at beat 1, beat 5, beat 8 and the first note, plus the
same set under reduced motion. Use `/play?song=twinkle&bot=perfect` (4/4, beat-track on) and
`/play?song=maple-leaf-rag&bot=perfect` (the WARNING card with the slate). They go in
`specs/features/count-in/shots/`.

**(b) Taste v2:** the score for each round in the PR, up to 5 rounds.

**(c) The 60 fps frame check:**
- **The rule:** each numeral's first frame, and each tick's fill, is the first frame at or after its beat, and no
  more than one frame (16.7 ms) late. Each click's scheduled time is within one frame of its visual beat.
- **Unit tests,** `pnpm -C web exec vitest run --passWithNoTests src/game/count-in src/game/beat`:
  - `countInAt` at each beat ±1 ms gives the right numeral, ticks and pulse;
  - the settle goes 1.04 → 1.0 in 120 ms and the fade-out takes the beat's last 30%;
  - reduced motion has no scale or fade;
  - the beat times equal `beatHits`' count-in times at 60, 100 and 180 BPM, and in 3/4;
  - beat-track's existing tests stay green.
- **In the worker's dev server, through the in-app browser** (the load rule), on Twinkle: read the frame log and
  report each beat's frame offset and click offset.
- **`node web/src/game/count-in/verify-count-in.mjs --out <dir>`, for CI's browser suite:**
  - `/play?song=twinkle&bot=perfect`: the rule above, from the frame log;
  - a pause on beat 3 and a resume restart the half with no stray numeral;
  - reduced motion is emulated: each numeral appears whole on its first frame;
  - no console error.

  It prints `verify-count-in: pass` or each failed check. It doesn't run locally. The done note says "not verified
  locally; covered by main's scheduled full run".
- **perf-budget:** `perf.mjs` p95 ≤ 6 ms at 1920×1080 through the count-in. It runs locally only under `verify.lock`;
  otherwise "not run locally; main's scheduled run covers it".

**(d) A WebM with sound for Eric** (low rank):
- the count-in of Twinkle, before and after;
- frames stepped from `countInAt` at 60 fps from your dev server, encoded with ffmpeg (installed:
  `/opt/homebrew/bin/ffmpeg`);
- the click synthesized at the same `beatHits` times from beat-track's laptop click settings;
- labeled "stepped frames, click from the same beat times, not a live capture";
- in `specs/features/count-in/shots/`, a few MB at most.

Then Eric tries it live on his dev server: `localhost:3001/play?song=twinkle&bot=perfect` (then Start) and
`localhost:3001/play?song=moonlight-1&bot=perfect`. Moonlight may have no click if it plays a recording. The done
note says `not seen by Eric` until he does.

## Gaps (accepted)
- `countInBeats` stays 8. In 3/4 and 3/8 the two halves aren't bars.
- No new sound: beat-track's side stick is the count.
- The WebM is stepped, not a live capture, and it isn't the DGX's own click.

## Defaults
- **In `extras`,** after results-landing.
- Log any choice this spec doesn't make in `specs/decisions/count-in-*.md`: easing curves, tick weights, the pulse's
  peak, and the slate's fate.
- The smaller option; no new dependency; the song's title and composer come from the chart, never typed.
