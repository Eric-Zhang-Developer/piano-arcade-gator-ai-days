---
name: "Hitch-free takes: no long frame from Start to results on Eric's setup, measured first and fixed where measured"
depends_on: ["perf-budget", "fever-stage", "hit-particles", "audio-track", "milestone-sfx", "ui-tokens", "count-in", "full-run-reds"]
owns: ["specs/features/hitch-free/", "changes/hitch-free.md", "specs/decisions/hitch-free-", "web/src/game/hitch-free/"]
assignee: "eric"
---

# Hitch-free takes

Issue #1362. It's a hero-tier polish item (#856), and a perf change.

**The goal:** no hitches from Start to the results on Eric's real setup: headed Chrome, a Retina display at DPR 2, and
every layer on. First-use costs move before Start, and allocation stays out of the frame loop.

**The code PR's title:** `feat(hitch-free): ...`.
- `check_ownership.py` accepts both `feat(hitch-free)` and `perf(hitch-free)` for a slug whose spec is on main and
  isn't done. `perf` maps to the fix kind (`lib.py` `KINDS`), which allows an in-flight scope.
- But AGENTS.md's claim rule is "no open PR titled `feat(<slug>)`", so only a `feat` draft claims the feature.
- AGENTS.md's perf rule still applies in full: a baseline number, with runs and spread, before and after.

## The planner's decisions
1. **Measure first, fix what's measured.** There's no blanket rewrite.
   - The worker records the baseline, then finds the actual hitch sources: long tasks, intervals over 25 ms, and what
     runs inside them, from a Performance trace or the probe.
   - Then it fixes the top ones. Each fix in the PR names the measured cost it removed.
   - **The pitch's list is suspects, not required changes:**
     - three.js `renderer.compile()` on the stage (`web/src/game/stage/`, fever-stage's; nothing on main calls
       `compile` today);
     - font glyph warmup, by extending `whenDisplayFontReady` (`ui-tokens/index.ts:37`, which loads only the 800
       weight at 1em today);
     - decoding the recording and SFX buffers before Start (`decodeAudioData` in `audio-track/index.ts`; the SFX in
       `sound/` and `milestone-sfx/`);
     - pre-filling the hit-particles pool (`hit-particles/pool.ts`, `gl.ts`);
     - plugins' heavy state and first draws;
     - per-frame allocations.
   - **A measured lead already exists.** full-run-reds' diagnosis of #1177 (its last comment, eric-agent-4) found that
     on frame 0 the layers drew for the first time and cost hud 25.4 ms, juice-visual 11.6 ms, note-labels 1.7 ms and
     laptop-octaves 1.0 ms, against under 1 ms on later frames. First draws are a likely top source.
2. **Metrics.** Presented-frame intervals are vsync-bound: perf-budget's spec records a p95 of 17.6 ms on an empty page.
   So interval p95 is **not** a pass bar. The bars are:
   - the count of intervals over 25 ms, from Start to the last note;
   - long tasks over 50 ms, from a `PerformanceObserver` for `"longtask"`, with a target of 0;
   - count-in beat 1's first-frame lateness, within one frame;
   - perf-budget's work-time p95 (`__perfProbe.report()`) not regressing past the before runs' spread.

   Interval p50 and p99 are reported as context.
3. **#1177 (count-in beat 1 late, ci-red):**
   - It has no open PR. full-run-reds (#1300, merged) took it and diagnosed it without fixing it. Both causes sit in
     held files:
     - the clock's zero is fixed before the first frame (`app/play/page.tsx:183`, held by #600);
     - the first-draw costs above (`hud/index.ts`, held by #713 and #600).
   - The issue stays open until #600 frees `page.tsx`.
   - So this spec doesn't touch count-in's code. The worker comments on #1177 with what hitch-free changes for
     frame 0.
   - If hitch-free's first-draw warmup makes `verify-count-in` pass, that can close #1177, but only with
     `verify-count-in` passing (a repro under `verify.lock`, the one local check allowed) and said so on the issue.
4. **Measurement validity:**
   - **where:** headed, in the in-app browser, at DPR 2 (`devicePixelRatio` recorded; a run at another DPR is
     rejected). No local headless run, under the interim load rule;
   - **the pane is visible:** a hidden pane throttles rAF, so each run records `document.visibilityState` and rejects
     a hidden run;
   - **the load average** (`sysctl -n vm.loadavg`) is recorded with each run, and a loaded run is rerun. This 8-core
     Mac read 6.25 / 6.90 / 7.03 when this spec was written. The threshold is logged. A loaded or hidden run is never
     reported as a pass;
   - **the runs:** 3 each at 1280×720 and 1920×1080, on maple-leaf-rag with `bot=fever` and on Golden
     (`local/golden-hard`, `bot=perfect`, with its recording). Golden is on this machine:
     `web/public/songs/local/golden-hard/` has `chart.json`, `audio.json` and `golden.mp3`, gitignored;
   - **if no valid runs are possible,** the numbers go to Eric's morning page as a probe he runs
     (`__perfProbe.report()` plus the extension's report), ranked low.
5. **Held files:** checked when this spec was written; re-check each before any edit.

   | File | Owner | Holder | Switch |
   |---|---|---|---|
   | `web/src/game/sound/index.ts` | juice-sound | **#600** | SFX decode warmup waits, or uses a hook outside it |
   | `web/src/game/scenes/index.ts`, `web/src/app/play/page.tsx`, `web/src/game/core/settings.ts` | scenes, core-loop | **#600** | no pre-Start hook in `page.tsx`; a warmup runs from a plugin's `transformChart` (before Start) |
   | `web/src/game/core/highway.ts` | core-loop | **#747**, #600 | nothing |
   | `web/src/game/juice/index.ts` | juice-visual | **#761** (stale draft) | its first-draw cost waits, or warms through the plugin's own entry |
   | `web/src/game/hud/index.ts` | hud | **#713**, #600 | its 25.4 ms first draw waits for them |
   | `web/src/game/laptop-sound/index.ts` | laptop-sound | **#806** | nothing |
   | `web/src/game/stage/` | fever-stage (done) | free | `renderer.compile()` before Start, if measured |
   | `web/src/game/ui-tokens/index.ts` | ui-tokens (done; assignee eric-agent-1, the eric lane) | free | the font warmup, if measured |
   | `web/src/game/hit-particles/` | hit-particles (done) | free | the pool pre-fill, if measured |
   | `web/src/game/audio-track/`, `web/src/game/milestone-sfx/` | done | free | decode before Start, if measured |
   | `web/src/game/perf-budget/` | perf-budget (done) | free | read only; the extension is a new file here |

   - A warmup that needs a held file waits, with a switch line (`ponytail:`) at the call, or goes through a hook
     outside it, such as a plugin mounted in `layers.ts` under the mount rule.
   - **With touch-visible** (#1351, a merged plan; its feat may change hit-particles' spawn counts): whichever touches
     `hit-particles/` second rebases.
6. **No behavior change:**
   - The tests that pin current behavior are each touched feature's own vitest, named in the PR. For example:
     `pnpm -C web exec vitest run src/game/perf-budget src/game/hit-particles src/game/audio-track src/game/milestone-sfx src/game/ui-tokens src/game/count-in`,
     plus `stage/`'s if it has tests. All stay green, unchanged.
   - Browser checks (`verify-count-in`, `verify-audio`, perf's `perf.mjs`): not verified locally, covered by main's
     scheduled full run, except the #1177 repro under decision 3.
   - The taste score doesn't apply: nothing a person sees should change. The PR says so in its Design section.
   - Frame-time graphs (PNG) go in the PR body, not in the repo.
   - **The only new code file is the probe extension,** `web/src/game/hitch-free/probe.js`: one plain script like
     perf-budget's `probe.js`, pasted or injected. From Start to the last note it reports:
     - the count of intervals over 25 ms;
     - the long tasks over 50 ms and what ran in them (attribution where Chrome gives it);
     - beat 1's first-frame lateness;
     - `visibilityState`, `devicePixelRatio` and interval p50 and p99.
   - One dev-server slot.

## Validation
The bars are the planner's, not measured thresholds.
- **Before (origin/main) and after,** under decision 4's validity rules, 3 valid runs each per size per song:
  - intervals over 25 ms, Start to the last note: down from the baseline, with the target 0 on maple-leaf-rag fever at
    1920;
  - long tasks over 50 ms: 0;
  - count-in beat 1's first-frame lateness: within one frame (about 16.7 ms);
  - perf-budget's work-time p95: within the before runs' spread;
  - interval p50 and p99, as context;
  - the load average, DPR and visibility of each run.
- **Each fix** is listed with the measured cost it removed (ms, and where).
- **The unit tests** named in decision 6 pass unchanged.
- **Eric** (the morning page, ranked low, only if no valid runs were possible): `__perfProbe.report()` and the
  extension's report on his setup.

## Gaps (accepted)
- The first draws of the HUD (#713, #600) and juice (#761), and the clock's zero (#600), are measured but wait for
  their holders.
- Eric's own Chrome profile may differ from the in-app browser.

## Defaults
- **In `extras`,** at the end, after well-tempered.
- Log any choice this spec doesn't make in `specs/decisions/hitch-free-*.md`: the load threshold, which suspects were
  measured and their costs, and each warmup's hook.
- The smaller option; no new dependency.
