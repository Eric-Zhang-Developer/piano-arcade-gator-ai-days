---
name: "The Composer's Hands spike: the DGX plays a composer's own piano roll, then you duet with his left hand"
depends_on: ["experiments", "core-loop", "piano-out", "hand-mode", "tempo-curve", "piano-sim", "laptop-sound"]
owns: ["specs/features/composers-hands/", "changes/composers-hands.md", "specs/decisions/composers-hands-", "web/src/game/x/composers-hands/", "web/src/app/composers-hands/", "web/public/rolls/", "spikes/composers-hands/"]
assignee: "eric"
---

# The Composer's Hands (spike)

Issue #1069, from Eric's overnight wow feeder (relayed by eric-planning-agent). Eric: "just build a bunch of cool crap
that has a maximum wow factor ... Some of them can be polished. Some of them can be spikes." This is a prototype spike
(decision 004), mounted as an experiment (#878). It stays out of the main game until Eric picks it.

**The pitch:** the DGX plays a composer's own piano-roll performance, for example Joplin's Maple Leaf Rag, or
Rachmaninoff's C-sharp minor Prelude on Ampico. Then "the composer plays the left hand, you play the right", judged
against his real timing.

**What exists:**
- The library has `maple-leaf-rag` and `entertainer` (Joplin, Mutopia 23 and 263, public domain) and
  `rachmaninoff-prelude-cs` (Mutopia 2033, CC BY-SA 4.0).
- Nothing in `specs/` mentions rolls, Welte, Ampico, Duo-Art or pianola. A grep on origin/main finds only "piano-roll"
  as the select's thumbnail style.

## The question
Can a composer's own roll, from an open archive, be turned into a performance the DGX plays that matches our chart's
notes and keeps his timing to the millisecond, and that a player can duet with?
- **Yes:** for at least one piece:
  - a verified, usable roll (Validation a);
  - a pitch match of ≥ 90% on matched sections (b);
  - note-on timing within a median of ≤ 5 ms of the roll file (c);
  - the duet runs, judged.
- **No:** no usable roll is found, or no piece reaches (b) or (c) after the time box. FINDINGS.md says which.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state.

Every bar here is the planner's, not a measured threshold.

## Step 1: research, a hard gate
Before any code, the worker finds and verifies each roll, and writes the source table
(`spikes/composers-hands/sources.md`).
- **Where to look:** archives such as Stanford's SUPRA (Stanford University Piano Roll Archive), the Pianola
  Institute and Terry Smythe's scans, plus any other archive the worker finds.
- **Pieces:** Maple Leaf Rag and The Entertainer (Joplin), and the Prelude in C-sharp minor (Rachmaninoff), each
  played by its composer.
- **One row per roll:**
  - the archive's URL for the roll's own page;
  - the roll's maker and number;
  - the year and the performer;
  - the roll's type (reproducing: Ampico, Welte-Mignon, Duo-Art; or a non-reproducing roll);
  - the file's format (expression MIDI, raw hole MIDI, or a scan only);
  - the license as the archive states it;
  - decision 003's verdict: committed or local.
- **Every year, number and performer comes only from the archive's page, quoted with its URL. Never from memory.**
  The years the pitch believes (Joplin 1916) are unverified, and a roll whose page doesn't give a field leaves it
  empty and visible.
- **Licenses, under decision 003:**
  - an open license (public domain, CC0, CC BY, CC BY-SA) is committed under `web/public/rolls/<song id>/`, and
    credited in `CREDITS.md` through a separate `docs:` PR (the song-pack append rule covers only `feat(song-pack-<n>)`
    PRs);
  - an unclear or all-rights-reserved license stays local in `web/public/rolls/local/`, self-ignored (`*`,
    `!.gitignore`), with "© owner, all rights reserved, local use only" next to the file.
- **No usable roll** for any piece: the spike ends in findings, with the search written up, and no code.
- **Requests:** downloads are the small MIDI files only, never scans, audio or archives. The User-Agent in any HTTP
  request is the repo URL (`github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days`), never an email.

## How it mounts
- **`/composers-hands`** (`web/src/app/composers-hands/page.tsx`, over `web/src/game/x/composers-hands/`) holds
  Listen, Duet and Compare. The experiments frame can't host the duet on `/play`. The frame's `transformChart` runs
  last, after the plugins that keep the chart they were first handed: hand-mode, scenes, ghost, key preview, note
  labels, bar lines and beat-track. So a seconds-as-beats chart swapped in there would put them out of step.
- **The page reuses, imported and never edited:**
  - core's `Judge`, `midiDevice`, `keysDevice`, `makeLayout` and `drawHighway`;
  - `hud()`'s `draw` and `onEvent`;
  - hand-mode's pure split, schedule and echo guard (`hand-mode/hands.ts`), so a note-on the DGX echoes back within
    30 ms is never judged;
  - piano-out's `allNotesOff`;
  - tempo-curve's `fitCurve` and `rubato`.
- **Registry entry** (`web/src/game/x/index.ts`, its one line, under the lane rule): group "Wow", line "The DGX plays
  the composer's own roll, then you duet with his left hand (#1069)", href `/composers-hands?song=maple-leaf-rag`.
- **On `/play` with `?x=composers-hands`:** its plugin adds only a start-panel link, "Hear the composer play it", to
  `/composers-hands?song=<id>`, and only for songs with a roll. So `/play?song=maple-leaf-rag&x=composers-hands`
  leads there.

## What to build
1. **Roll physics** (`roll.ts`, pure):
   - prefer the archive's expression-emulated MIDI for reproducing rolls;
   - a non-reproducing roll plays at one fixed velocity (logged), and the screen says "This roll records no dynamics";
   - **take-up spool acceleration:** a roll speeds up as the spool fills. Check whether the file already corrects it
     (the archive's notes, or the tempo drift of a steady passage). If it doesn't, correct it with the archive's
     stated method or a fit on a steady passage, and record the correction and the evidence in FINDINGS.md.
2. **Listen:**
   - the roll plays through the "Portable Grand" output (the DGX, or laptop-sound's), with its sustain (CC64 from
     the roll where it has one), on `MIDIOutput.send(data, timestamp)`;
   - a slate shows the piece, the performer, the roll's maker and number, and the **verified** year from the source
     table, or nothing where the table is empty;
   - the keyboard shows his hands: keys light as the roll plays them, colored by the hand split.
3. **Duet:**
   - **The hand split:** per-passage gap clustering on pitch (for each passage, the widest pitch gap between
     simultaneous notes splits L from R). Eric can nudge a passage's split point on the page. Saved per song in
     `localStorage` and exportable as JSON for a commit.
   - **The DGX plays his left hand** through hand-mode's schedule, and you play the right.
   - **The judge is core's `Judge`,** against his timing: a chart built from the roll at `bpm: 60`, so beats are
     seconds, with `beatsPerBar` set to the roll's length so no bar lines draw (logged). The frozen chart format
     doesn't change, and a tempo map (#831) can replace this later.
   - The take writes no record and saves nothing to the take store under the song's id. Use records' and the take
     store's existing exclusions; check which, and log it.
4. **Compare:** on the results, his tempo curve, the score's metronome (our chart's `bpm`) and yours, drawn together
   from tempo-curve's `fitCurve` over the aligned sections.
5. **Alignment** (`align.ts`, pure): DTW on pitch sequences, roll against our chart, labeling sections as matched
   (with the chart's bar numbers) or unmatched (a repeat taken or skipped, an added ending). It also gives the
   chart-beat to roll-time map that Compare uses.

## Validation
The bars are the planner's, not measured thresholds.

**(a) The source table** (`spikes/composers-hands/sources.md`): one row per roll, every field quoted from its archive
page with the URL, empty where the page is silent, and decision 003's verdict.

**(b) The pitch match**, per piece: `node spikes/composers-hands/match.mjs <roll.mid> <chart.json>` prints each
section's label and pitch match. Matched sections reach **≥ 90%**. Unit tests
(`pnpm -C web exec vitest run --passWithNoTests src/game/x/composers-hands`) cover:
- **DTW:** it aligns a synthetic chart with planted insertions, deletions and a repeated section, and labels the
  repeat;
- **the hand split:** two clustered pitch bands split at their gap, and a nudge moves the split;
- **the spool correction:** it removes a planted linear speed-up from a synthetic steady passage;
- **the seconds chart:** it passes `validateChart`, and a note at roll time t ms has `noteTimeMs` = t;
- **the duet:** his left hand's schedule from hand-mode's functions is sent on channel 1 at roll times, and an echo
  within 30 ms isn't judged.

**(c) Timing, median ≤ 5 ms:** in Listen on `/sim`'s fake piano, as replay-view's check reads its sent messages,
compare each sent note-on's timestamp (from the page's zero) with the roll file's note time. Report the median and
p90. The run is on the worker's dev server through the in-app browser; there's no local headless suite.

**(d) The design pass** (AGENTS.md, Visible changes):
- invoke `frontend-design` and `design-taste-frontend`;
- shots of Listen, Duet and Compare at 1280×720 and 1920×1080, plus reduced motion, from your own dev server in the
  in-app browser (one slot, `devserver.1` to `.4`);
- fix the top three problems a round, at most three rounds;
- scores and our shots go in the PR's Design section, and the shots in
  `specs/features/experiments/shots/composers-hands/`.

**The perf gate:** `perf.mjs --params x=composers-hands` on `/play`, where only the link is added. It runs locally
only under `verify.lock`; otherwise "not run locally; main's scheduled run covers it".

**(e) Eric's 1-minute listen** (low rank): Listen on the DGX. "Does it sound like a person?" Mark it in the done note
(`not heard by Eric` until he does).

**Eric's URLs:**
- Lab → The Composer's Hands;
- `localhost:3001/play?song=maple-leaf-rag&x=composers-hands` (then "Hear the composer play it");
- `localhost:3001/composers-hands?song=maple-leaf-rag`.

## FINDINGS.md (`spikes/composers-hands/FINDINGS.md`)
Per decision 004:
- the question;
- the measured answer: the source table, (b) per section, (c)'s median and p90, and the spool finding;
- what worked, what didn't, what to keep;
- **promote**, **iterate** or **kill**.

With no usable roll: the search (each archive, what it had, why it didn't serve) and **kill** or **iterate** with a
named archive to try.

## Content and disk
- About 5 GiB is free. Downloads stay small MIDI files only.
- **Nothing is deleted by the worker** (Eric's no-delete rule). Any cleanup is Eric's.
- Committed rolls are only openly licensed ones, each credited through a `docs:` PR. Everything else stays in the
  self-ignored `web/public/rolls/local/`. That folder works only on Eric's machine, so the vitest and `/sim` checks
  use a committed roll or synthetic data.

## Gaps (accepted)
- The hand split is inferred from pitch, not known: rolls don't record hands. Eric's nudges are the fix.
- An emulated reproducing roll is an emulation: its dynamics are the archive's reading of the expression holes, not
  the composer's exact touch.
- The duet judges only the right hand, on a seconds chart. Bar-based features (bar loop, weak bars, bar lines)
  don't apply.
- No change to the frozen chart format: a tempo map is #831's.

## Defaults
- The smaller option. Log choices the spec doesn't make in `specs/decisions/composers-hands-*.md`: the fixed velocity,
  the split's gap rule, the spool correction, and the DTW cost.
- One piece done well beats three half done. Start with the piece whose roll the research verifies first.
