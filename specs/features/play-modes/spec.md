---
name: "Play modes: Learn, Flow and Perform as a ladder, and practice keeps your mode"
depends_on: ["wait-mode", "flow-mode", "duo-results", "learn-from-select", "chunk-practice", "adaptive-chunks", "bar-loop", "duo-start", "help-overlay", "lab", "mouse-first", "results-layout", "duo-select", "select-layout", "song-preview", "weak-bars", "difficulty"]
owns: ["web/src/game/play-modes/", "specs/features/play-modes/", "changes/play-modes.md", "specs/decisions/play-modes-"]
assignee: "eric"
---

# Play modes

Issue #835. Eric, 2026-10-25, on making Flow the default: "from a learning perspective, this would reward people for
having terrible tempo, like me." On the ladder below: "Let's do that."

The three timing modes become one ladder per song, Learn → Flow → Perform, and practice stops being a place you go
and becomes something you do in whichever mode you're in. Flow stays the forgiving mode, but it says what tempo you
held, and it can't hand out an S for playing at half speed.

## What exists (origin/main, 2026-10-25)
- **Modes are one URL param.** `mode=wait` (`wait-mode/index.ts:6` `isWaitMode`), `mode=flow` (`flow-mode/clock.ts:8`
  `isFlowMode`), and no `mode` for the timed take. Other readers: `beat/index.ts:60`, `hand-mode/index.ts:31`,
  `records/store.ts:66`, `chunk-practice/chunks.ts:37,60`, `chunk-practice/index.tsx:112`,
  `adaptive-chunks/next.ts:83` (deletes `mode`), and `data/save-plugin.ts:52` (sharan's lane).
- **Links that rebuild a `/play` URL** and drop or force the mode (#832): `duo-results/scores.ts:127`
  `practiceBarsUrl` (keeps only `song` and `hands`), `duo-select/next-for.ts:21` `nextForUrl` (through it),
  `weak-bars/index.ts:53` `practiceUrl`, `adaptive-chunks/next.ts:77` `adaptUrl` (deletes `mode`),
  `song-preview/opening.ts:37` `practiceUrl`, and `select-layout/index.tsx:66` `practiceHref` (PRACTICE, through
  `adaptUrl`). The mode switches: `wait-mode/plugin.tsx:7` `modeUrl`, `flow-mode/index.tsx:42` `flowUrl`.
- **Flow's results:** `flow-mode/steady.ts:19` `headline` reads "98% right notes · steady · 2 slips", with no tempo.
  The ♩ readout during play shows `tempo × clock.rate` (`flow-mode/index.tsx:85`). `flow-mode/judge.ts:15` ranks on
  accuracy alone.
- **Hard songs:** `difficulty/difficulty.ts:13` `warnFrom: 13` shows the WARNING card. `records` knows whether a song
  has a best.
- **/learn** (`web/src/app/learn/`, `web/src/learn/`, the learning lane, no person yet) has no link into `/play` today
  (grep for `/play` there finds none).

## Plan
**One PR: `feat(play-modes)`**, under AGENTS.md's "Ownership is open within a lane" rule. The new code lives in
`web/src/game/play-modes/` (the ladder, the mode reader, the URL helper, held tempo), and it changes these eric-lane
features' files. Owner per file (the spec whose `owns` holds it):

| File | Owner |
|---|---|
| `web/src/game/wait-mode/plugin.tsx`, `wait-mode/index.ts` | wait-mode |
| `web/src/game/flow-mode/index.tsx`, `steady.ts`, `judge.ts`, `clock.ts` | flow-mode |
| `web/src/game/duo-results/scores.ts`, `duo-results/index.tsx` | duo-results |
| `web/src/game/duo-select/Select.tsx`, `next-for.ts` | duo-select |
| `web/src/game/duo-start/StartScreen.tsx` | duo-start |
| `web/src/game/results-layout/index.tsx` | results-layout |
| `web/src/game/select-layout/index.tsx` | select-layout |
| `web/src/game/song-preview/index.tsx`, `opening.ts` | song-preview |
| `web/src/game/weak-bars/index.ts` | weak-bars |
| `web/src/game/adaptive-chunks/next.ts`, `chunk-practice/chunks.ts`, `chunk-practice/index.tsx` | adaptive-chunks, chunk-practice |
| `web/src/game/help-overlay/keys.ts` | help-overlay |
| `web/src/game/lab/entries.ts` | lab |
| `web/src/game/layers.ts` | no owner: a mount, within the ride-along limit |

Each of those features' own vitest and browser checks move with it. Before you start, check no open PR is working on
those files (`gh pr list`, then its files). On 2026-10-25 these overlap: #810 (`fix(duo-results)`,
`verify-results.mjs`), #778 (`fix(flow-mode)`, `flow-mode/index.tsx`), and #600 (`fix:`, `select-layout`,
`song-preview`, `results-layout`, `app/play/page.tsx`). If one is still open, build anyway and ask the planner to hold
the PR until it merges or closes.

**#832 folds in:** this PR is its fix (`Closes #832` too). If a `fix(duo-results)` for #832 lands first, rebase onto it
and keep its test.

**Sharan's lane:** `data/save-plugin.ts:52` says "wait mode: nothing is judged in time". This PR doesn't touch it; file
a `needs-human` issue for `sharan` to say "Learn mode" instead.

## Requirements
1. **Three timing modes, renamed in the UI.** The URLs don't change: `mode=wait` is **Learn**, `mode=flow` is
   **Flow**, and no `mode` is **Perform**, so every old link works and nothing new needs an alias. One reader,
   `playMode(params): "learn" | "flow" | "perform"` in `play-modes/`, and one writer, `withMode(params, mode)`, which
   keeps every other param. `modeUrl` and `flowUrl` call it.
   - **Learn** stops on each note and gives no score (today's wait mode).
   - **Flow** follows your tempo, scored on right notes, slips and steadiness.
   - **Perform** is on the beat and ranked. It stays the song list's default.
   - **Strings, before → after.** The `data-testid`s stay.

     | Where | Before | After |
     |---|---|---|
     | Start screen, wait-mode panel (`wait-mode/plugin.tsx:19`) | Wait mode: the song waits for each note. Not scored. | Learn: the song waits for each note. Not scored. |
     | Start screen link (`:22`, `learn-first`) | Learn it first | the ladder's **Learn** step |
     | Start screen link (`flow-mode/index.tsx:99`, `play-flow`) | Play in Flow | the ladder's **Flow** step |
     | Start screen, flow panel (`flow-mode/index.tsx:96`) | Flow: the song waits for you and follows your tempo. | unchanged |
     | Results link (`wait-mode/plugin.tsx:28`, `play-judged`) | Play it judged | the ladder's next step: **Flow** after Learn |
     | Results heading (`results-layout/index.tsx:152`, `unscored`) | Wait mode: not scored | Learn: not scored |
     | Help card, L (`help-overlay/keys.ts:48`) | learn it: the song waits for each note | Learn: the song waits for each note |
     | Help card, P (`:49`) | practice it: narrows onto the bars you miss | practice it in Flow: narrows onto the bars you miss |
     | Help card, Enter (`:47`) | play it | Perform: on the beat, ranked |
     | Lab (`lab/entries.ts:24,31`) | Wait mode · Twinkle, wait mode / Flow mode · Twinkle, flow mode | Learn mode · Twinkle, Learn / Flow mode · Twinkle, Flow |
     | Lab, Rewind's link (`lab/entries.ts:64`) | Twinkle, wait mode | Twinkle, Learn (its description stays: lab's test copies it from rewind's done note) |
     | Flow's tutor line and weak-bars' link (`duo-results/scores.ts`, `weak-bars/index.ts`) | … at 70% / Practice bars 3–4 at 80% | … in Flow / Practice bars 3–4 in Flow, on a Flow take only |
     | Chunk practice's play-step line (`chunk-practice/index.tsx`) | Chunk 1 of 3 · play at 70% | Chunk 1 of 3 · play in Flow, on a Flow step only |
     | Select's LEARN title (`duo-select/Select.tsx:74`) | Learn: the song waits for each note (L) | unchanged |

     The canvas LEARN badge (`wait-hud`) and the ♩ readout already match. Any string the build finds that this table
     misses gets added to it in the PR.
2. **Practice is a verb, not a mode.** PRACTICE BARS X–Y (`practiceBarsUrl`), Next for you (`nextForUrl`), weak-bars'
   practice link, adaptive and chunk steps, and Retry keep the take's mode through `withMode`. Under Flow they drop
   `tempo`, since Flow follows the player's own tempo; under Learn and Perform they keep today's `tempo`. Chunk
   practice's learn and play steps become Learn and the take's mode (Flow from PRACTICE). This fixes #832.
3. **The ladder shows** as `LEARN → FLOW → PERFORM` for each song, one component in `play-modes/`:
   - on `/play`'s start screen and results: the current mode lit, the next step a link to the same song and bars, the
     others plain links;
   - on the select's panel (`duo-select/Select.tsx`): the furthest step reached on that song, from a per-song
     localStorage key `pianoArcade.ladder.<song>`, written when a Learn take finishes, a Flow take graduates (4 below),
     or a Perform take sets a record. An empty key lights nothing.
4. **Flow is honest about tempo.**
   - `heldTempo`: the median of `tempo × clock.rate` at each hit, as a whole percent of the song's own BPM. Flow's
     results headline leads with it: "Steady at 72% of tempo · 98% right notes · 2 slips" (the steadiness word from
     `steadiness`, capitalized).
   - **Graduation:** a Flow take whose steadiness is "steady" and whose held tempo is 85% or more gets the tutor line
     "Try it in Perform", linked to the same bars (`withMode(params, "perform")`).
   - **Rank cap (the planner's call, reversible; `specs/decisions/play-modes-flow-rank.md`):** below 90% held tempo a
     Flow take ranks B at best. The held tempo always shows next to the rank in Flow. To undo: remove the cap, keep the
     tempo shown. The feat PR writes that decision file (a `plan:` PR can't).
5. **Defaults.** Practice paths open in Flow; PLAY opens Perform.
   - The select's PRACTICE and the P key open Flow.
   - First time on a hard song (level ≥ `warnFrom`, no record): `/play`'s start screen focuses the ladder's Flow
     step, and Perform stays one click. PLAY still lands on that start screen in Perform, as today.
   - /learn: any link from /learn into `/play` opens Flow. It has none today and is another lane's folder, so this PR
     adds none; the learning lane's person follows this when they link in.
   - Enter, click and PLAY on the song list open Perform, unchanged.

**Not in scope:** changing Flow's judging (its windows, slips or clock), and the scoring-windows work, which is
eric-agent-2's.

## Design
AGENTS.md's "Visible changes" pass. Invoke the `frontend-design` skill before writing the UI and
`design-taste-frontend` (taste v2) for the look loop. Between iterations, screenshot from the running dev server
through the in-app browser at 1280×720 and 1920×1080: the select's panel with the ladder, `/play`'s start screen in
each mode, and the results of a Learn, a Flow (graduated and capped) and a Perform take. Score against taste v2's
`references/critique.md` and fix the top three problems; at most three rounds. The ladder uses the Duo kit
(`duo-tokens`), as the rest of those screens do. The PR body gets a **Design** section: the skills invoked, each
round's score, the fixes, and before/after shots.

## Validation
1. `pnpm -C web exec vitest run src/game/play-modes` plus every touched feature's own vitest:
   - `playMode` maps `mode=wait` to learn, `mode=flow` to flow, and no `mode` (or any other value) to perform;
     `withMode` round-trips and keeps `song`, `hands`, `from`, `to`;
   - a Flow take's `practiceBarsUrl`, `nextForUrl`, weak-bars link and adaptive step keep `mode=flow` and drop
     `tempo`; a Learn take's keep `mode=wait`; a Perform take's carry no `mode`;
   - the graduation line shows at 85% held tempo and steady, and not at 84% or when "a bit uneven";
   - a 98% Flow take at 89% held tempo ranks B, at 90% ranks S; a Perform take's rank is unchanged.
2. The existing browser checks that assert the old strings or links get updated to the new ones, not weakened:
   `web/src/game/wait-mode/verify-wait.mjs` ("Play it judged" and "Learn it first" links, the `unscored` heading),
   `web/src/game/learn-from-select/verify-learn.mjs:92` (the "Wait mode: …" line),
   `web/src/game/chunk-practice/verify-chunks.mjs:94,111` (the play-step link and its URL), and
   `web/src/game/flow-mode/verify-flow.mjs:127` (its headline check looks for lowercase "steady"; it becomes
   case-insensitive and keeps the "a bit" exclusion). Found with
   `grep -rln -E "Learn it first|Play in Flow|Play it judged|Wait mode|not scored" web/src web/e2e --include='verify-*.mjs'`.
   They run in main's scheduled full suite, per the no-local-checks rule; the done note says "not verified locally;
   covered by main's scheduled full run".
3. The design pass above, with the Design section in the PR.
4. Eric looks at it once. Mark that in the done note.

## Defaults
- **In `extras`, after duo-details** (#835).
- Log any choice this spec doesn't make in `specs/decisions/play-modes-*.md`.
