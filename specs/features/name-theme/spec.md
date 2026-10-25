---
name: "Your Name, in Music: a judge's name becomes a theme the DGX plays and a level they can play"
depends_on: ["experiments", "core-loop", "scenes", "golden-demo", "demo-performance", "chart-lint", "play-modes", "duo-tokens"]
owns: ["specs/features/name-theme/", "changes/name-theme.md", "specs/decisions/name-theme-", "web/src/game/x/name-theme/", "web/src/app/name/", "web/public/songs/x/name-theme/"]
assignee: "eric"
---

# Your Name, in Music

Issue #1190, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878. It
lands on main off by default and stays out of the main game until Eric picks it in the Lab.

**The pitch:**
- A judge types their name, and the DGX plays the theme it spells as a musical cryptogram.
- Then comes a short theme and one variation, about 20 s, which becomes a playable level.

**Lineage, as the pitch gives it and not checked here:** Bach's B-A-C-H, Schumann's ABEGG, and the 1909 Haydn
centenary pieces (Ravel, Debussy). The worker checks each claim against a cited source before any of it reaches the
page, a decision file or the done note. Nothing historical, no note table and no quote is written from memory. A
claim no source supports is left out.

## How it mounts
Checked on origin/main when this spec was written:
- **`/play` only loads committed charts.** It fetches `/songs/<song>/chart.json`, validates it, then runs the
  plugins' `transformChart` in `layers.ts` order (`app/play/page.tsx:92-103`).
- **The frame comes too late.** scenes' bot keeps the chart it is handed (`scenes/index.ts`, `chart = ... c`), and
  scenes runs before the frame (`layers.ts:74` vs `:125`). A swap in the experiment's own `transformChart` would be
  judged, but the bot would still play the placeholder.
- **The pedal comes from a file.** scenes asks `loadPedal(song)`, which fetches `songs/<song>/pedal.json` only for a
  `local/` song or one in `pedal/library.json` (`pedal/index.ts:28`).

**The route, so that nothing is written per name:**
1. **One placeholder chart, committed once:** `web/public/songs/x/name-theme/chart.json`.
   - It's the generator's output for HAYDN, the anchor below.
   - It's what `/play` fetches, so a reload, or a visit with no name typed, still plays something real.
   - songs/x/ stays off the select (#1176), and the library test lints it like any chart.
   - No `pedal.json`: the pedal comes from memory (step 3).
2. **An early swap, mounted in `layers.ts` under the mount rule** (an import and an entry, at most 4 added lines):
   - `nameThemeSwap()`, first in the list, before handMode and scenes;
   - when `song=x/name-theme` and a theme is held in memory, its `transformChart` returns the held chart instead;
   - otherwise it returns the chart unchanged, and it has no other hooks;
   - so the bot, the judge, Learn's wait mode, ghost and note-labels all see the name's chart.
3. **The pedal from memory,** a few lines in `web/src/game/pedal/index.ts`:
   - `holdPedal(song, pedal)`;
   - `loadPedal` returns the held pedal first, before its file rules;
   - pedal/ is golden-demo's (done) and in the eric lane, so the lane rule allows it while no open PR touches the
     file (none did when this spec was written; re-check).
   - If it's held when the worker gets there, Listen plays without pedal and the Gaps say so.
4. **The experiment,** one line in the registry (`web/src/game/x/index.ts`), with `href: "/name"`.
   - Its `?x=name-theme` plugin draws on the frame:
     - each motif note's letter beside it;
     - the name's letters above the highway in the kit's display type (`canvasFonts.display`), each lighting as its
       note is hit or played;
     - under reduced motion, the letters appear without the sweep.
   - #1173 (pinned, draft) also adds a registry line now. Rebase on whichever lands first.

**`/name`** (`web/src/app/name/page.tsx`, over `web/src/game/x/name-theme/`), in the kit:
- a name field;
- a cipher switch, only if a second system is sourced;
- the motif as letters over note names;
- a static roll of the theme;
- two links:
  - **Listen** on the DGX: `/play?song=x/name-theme&bot=perfect&audible=1&demo=1&x=name-theme`;
  - **Play your name** in Learn: `/play?song=x/name-theme&mode=wait&x=name-theme`.
- Both navigate client-side (Next `Link` or `router.push`), so the module's memory survives into `/play`.
- A theme that fails chart-lint isn't offered: the page says why, and neither link shows.

## The build
1. **The cipher:**
   - **The 1909 French system,** from a cited source: its rule and full letter table go in
     `specs/decisions/name-theme-cipher.md` with the source (URL or citation, and the page).
   - **The German letter-name system** (H as B♮, B as B♭, and whatever else the source gives) is offered too, only if
     sourced. It's labeled on the page, with a switch.
   - **Input:**
     - accents fold to their base letter (Unicode NFD, combining marks dropped);
     - anything that isn't A–Z after folding is ignored;
     - the input is capped at a length, which is logged;
     - a name with no letters left gets a line saying so, and no theme.
2. **Composition, rule-based and deterministic** (no LLM, no randomness; the same name gives the same chart):
   - **the motif** in a right-hand register, with its rhythm from the name's syllables or letter count. The rule is
     logged in `specs/decisions/name-theme-composition.md`;
   - **the harmony:**
     - diatonic chords in one key, each containing its motif note;
     - smooth voice leading: common tones held, and a stepwise bass where the chords allow;
     - a cadence at the end;
   - **one variation:** an inversion of the motif or a waltz rhythm (the worker picks one and logs it);
   - **the length:** about 20 s at the chart's bpm, theme and variation together;
   - **the form:** a normal `Chart` (`web/src/contracts`), hands marked, with a `velocity` per note in
     demo-performance's ladder style;
   - **the metadata:** `title` and `composer` never carry the typed name. The page shows the name from memory, not
     from the chart.
3. **Playback:** the bot plays the held chart on the DGX through scenes, with the held pedal (one press per chord,
   in golden-demo's per-harmony style) and the chart's dynamics. Nothing new goes into scenes.
4. **"Play your name":** Learn (`mode=wait`), judged as usual. The chart passes chart-lint (`songs/rules.ts`
   `chartProblems`) and `validateChart` before either link is offered.
5. **Privacy:**
   - The name lives only in a module variable in `x/name-theme/`, while the tab is open. It never goes to
     localStorage, sessionStorage, IndexedDB, a cookie or a URL, and it's never in a request body or header.
   - It's cleared on the page's Clear button, when the take's results leave `/play`, on reload, and on navigating to
     any page other than `/name` and `/play`.
   - No take is saved: the save plugin already skips any song with a `/` in its id (`data/save-plugin.ts:48`). The
     test pins that for `x/name-theme`.
   - Nothing is logged with the name.
6. **Reduced motion:** the letters appear without the sweep, and the page's roll doesn't animate.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`, at most three rounds, and fix the top three problems each round.
- The PR's Design section has the skills invoked, the scores, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Unit tests** (`pnpm -C web exec vitest run src/game/x/name-theme src/game/pedal src/game/songs`):
- the French table matches the cited source letter for letter, with the source written next to the table in the test;
- **the anchor:** HAYDN gives the 1909 motif exactly as the source prints it, in the source's own notes;
- BACH gives B♭–A–C–B♮ in the German system, only if that system is sourced and shipped;
- accent folding works, and other characters are ignored;
- the same name gives the same chart twice;
- every generated chart passes `chartProblems` and `validateChart`;
- every chord contains its motif note;
- the theme and variation run 20 s ± 4 at the chart's bpm;
- the committed placeholder equals the generator's HAYDN output;
- the swap returns the held chart only for `song=x/name-theme`, and the chart unchanged otherwise;
- `loadPedal("x/name-theme")` returns the held pedal, and other songs behave as before (pedal's tests stay green);
- **privacy:**
  - with `fetch`, `XMLHttpRequest` and `navigator.sendBeacon` stubbed and storage spied, generating, holding,
    swapping and clearing a theme sends no request and writes no storage carrying the name;
  - the chart's `title` and `composer` don't contain it;
  - `unsavableReason` skips `x/name-theme`.

**(b) A batch of 20 sample names,** made up and never real people, across several languages and scripts with accents
(the list goes in the test, with the language noted):
- all 20 pass `chartProblems`;
- the outer voices' parallel fifths and octaves are counted and logged as a rate, if the harmonizer checks them.

**(c) The design pass:** taste v2 at 1280×720 and 1920×1080, on `/name` with a name typed and on `/play` mid-theme
with the letters lit, plus reduced motion.

**(d) Eric** (the morning page, ranked low): at `localhost:3001/name`, type "Eric", press Listen, and listen for 20 s
on the DGX. The done note says `not heard by Eric` until he does.

Browser checks: not verified locally; covered by main's scheduled full run.

## Gaps (accepted)
- The theme holds only while the tab is open. A reload falls back to the HAYDN placeholder, with a start-panel line
  linking to `/name`.
- One variation, not a set.
- A name whose letters the cipher maps to repeated notes may sound plain. Logged, not fixed.

## Defaults
- **In `extras`,** at the end, after the polish bundle.
- Log any choice this spec doesn't make in `specs/decisions/name-theme-*.md`: the key, the register, the rhythm
  rule, the variation, the length cap and the pedal rule.
- The smaller option; no new dependency.
