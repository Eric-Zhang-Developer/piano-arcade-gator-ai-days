---
name: "The Harmony Map: chords light triangles on Euler's Tonnetz, and every song becomes a constellation"
depends_on: ["experiments", "core-loop", "golden-demo", "song-select", "ui-tokens", "duo-tokens", "jam-mode-spike"]
owns: ["specs/features/harmony-map/", "changes/harmony-map.md", "specs/decisions/harmony-map-", "web/src/game/x/harmony-map/", "web/src/app/harmony/"]
assignee: "eric"
---

# The Harmony Map

Issue #1299, from Eric's overnight wow feeder (relayed by eric-planning-agent). It's an experiment under #878. It
lands on main off by default and stays out of the main game until Eric picks it in the Lab.

**The pitch:**
- chords light triangles on Euler's Tonnetz as you play, and a take becomes a constellation;
- a wall shows every library song's constellation.

**Lineage:** Euler (1739), Riemann, and the neo-Riemannian P, L and R. The done note and the page cite each from a
source the worker reads (URL or citation). Nothing is quoted from memory, and a claim no source supports is left out.

**The library's size, counted on origin/main when this spec was written:**
- 40 songs, by song-select's own rule: every `chart.json` under `web/public/songs/` except the `LAB_ONLY` folders
  `rounds` and `x` (`song-select/load.ts:12`). `songs/local/` is gitignored and isn't on main.
- The page prints the count it loads, never a number from this spec.

## How it mounts
- **`/harmony?song=<id>`** (`web/src/app/harmony/page.tsx`, over `web/src/game/x/harmony-map/`) has:
  - the song's constellation;
  - the live panel, driven by the page's own MIDI access or laptop keys.
- **`/harmony/all`** (`web/src/app/harmony/all/page.tsx`) is the wall.
  - It loads the library with song-select's loader and the same `LAB_ONLY` rule, so it lists exactly the select's
    songs.
  - It draws every constellation as pure SVG from the charts, on the server where the loader runs there.
- **One registry line** in `web/src/game/x/index.ts`, with `href: "/harmony?song=moonlight-1"`. Its `?x=harmony-map`
  plugin draws the live panel on `/play` in a corner of the overlay, beside the highway, never over the lanes. The
  highway itself is untouched.
- **stage-view's second display** (`/stage`) hosts the panel only if stage-view offers a place without editing its
  files. Otherwise the corner panel is the placement, logged.
- **Live pedal:**
  - **On `/harmony`:** `core/input.ts`'s `midiDevice` drops every CC (`:24`), so the page reads note-on, note-off and
    CC64 itself, as `/inside` does (`x/inside/Inside.tsx:119`, `cmd === 0xb0 && d[1] === 64`).
  - **On `/play`:** the plugin sees only `wrapInput`'s notes. A live player's pedal isn't visible there, and the
    Gaps say so. A bot take's pedal comes from `pedal.json` through `loadPedal(song)` (golden-demo).
  - **For a chart's constellation:** the notes' lengths plus `pedal.json`'s down and up pairs, in beats.

## The build
1. **The lattice:**
   - pc(x, y) = (7x + 4y) mod 12: fifths along x, major thirds along y, minor thirds along the (1, −1) diagonal;
   - the triangles are the major and minor triads;
   - the patch is sized to the song's path, with the torus wrap marked where the path crosses it;
   - the patch size and the wrap rule are logged.
2. **Chord detection:**
   - **the sounding set:** the pitch classes sounding in a window (its length logged), held or pedal-sustained;
   - **the namer:** jam-mode's `nameChord` (`spikes/jam-mode/jam.mjs:25`) is in `spikes/`, outside `web/`, so it's
     ported into `x/harmony-map/` with a comment crediting the spike. Its score (matches − missing − extra) is the
     confidence;
   - **a triangle lights only when one major or minor triad is fully present** with confidence over a threshold
     (logged);
   - **ambiguous sets light nodes only, never a guessed triangle:** augmented chords, clusters, dyads, or two full
     triads at once (a major seventh holds two);
   - **jam-mode's rename rule** (decision `jam-mode-spike-rename`: only a struck key renames) is followed, so a
     release doesn't fake a chord change.
3. **The live panel:**
   - glowing nodes in the ui-tokens hand colors (`handColor`, so hand-palette's pick carries);
   - filled triads;
   - a fading edge trail on chord changes, labeled P, L or R where the move is one of them;
   - under reduced motion, no trail animation: the current triangle and the last edge show as a still.
4. **The constellation,** pure SVG from the chart, with no playing needed:
   - each triangle visit sized by its time, and each edge's weight by its traversals;
   - chord names;
   - the home triangle marked (the most-visited one, or the final chord's; the rule logged);
   - downloads as SVG, and as PNG through the browser's canvas (`drawImage` of the SVG, then `toBlob`), with no
     dependency.
5. **The wall** at `/harmony/all`: small multiples of all the library songs at one consistent scale, each labeled with
   its title, in the Duo kit.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`, at most three rounds, and fix the top three problems each round.
- The PR's Design section has the skills invoked, the scores, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Unit tests** (`pnpm -C web exec vitest run src/game/x/harmony-map`):
- **the lattice:** pc(x, y) = (7x + 4y) mod 12, all 12 pitch classes present in the patch, and the fifth, major-third
  and minor-third directions;
- **triad fixtures:**
  - C E G gives C;
  - A C E gives Am;
  - C E G♯ (augmented) gives nodes and no triangle;
  - a note released under a held pedal still counts toward the triad;
- **I–IV–V–I in C** draws exactly the expected triangles (C, F, G, C) and edges, with the traversal counts;
- **P, L and R:** C→Cm is P, C→Em is L, and C→Am is R;
- **the wall** lists exactly song-select's songs.

**(b) Perf:** live at 1920×1080 with 10-note chords and the pedal down, 60 fps.
- Measured as per-frame work time (`performance.now()` around update and render), not rAF intervals.
- p95 ≤ 16.7 ms, 3 runs with spread, on the worker's own dev server in the in-app browser.

**(c) The design pass:** taste v2 at 1280×720 and 1920×1080 on the live panel, a constellation and the wall, plus
reduced motion.

**(d) A read test:**
- three unlabeled constellations: moonlight-1, twinkle and maple-leaf-rag;
- the truth, which one is in a minor key and which is the simplest, is taken from the charts' sources and the
  traversal counts, and written down first;
- a fresh subagent sees the three alone, unlabeled and in a shuffled order, and names the minor-key piece and the
  simplest one;
- **pass:** 2 of 2 answers right. Never show the subagent the truth, the titles or the spec.

**(e) Eric** (the morning page, ranked low): `/harmony/all` as a README or video image. The done note says `not seen
by Eric` until he does.

Browser checks: not verified locally; covered by main's scheduled full run.

## Gaps (accepted)
- On `/play`, a live player's pedal doesn't reach the panel, because core input drops CC. `/harmony`'s own MIDI
  access has it.
- Triads only: sevenths and other chords light their nodes, and a triangle only when one triad is unambiguous.

## Defaults
- **In `extras`,** at the end, after learn-a11y.
- Log any choice this spec doesn't make in `specs/decisions/harmony-map-*.md`: the window, the confidence threshold,
  the patch and the wrap, the home rule, the sizing scales and the panel's corner.
- The smaller option; no new dependency.
