---
name: "Operator replay: watch the build in 3D, one merge per note of Twinkle, on the piano"
depends_on: ["operator-board"]
owns: ["web/src/app/attract/", "web/src/replay/"]
assignee: "eric"
---

# Operator replay

**Attract mode** for `/operator`, and the judges' view of how agents built Piano Arcade. The feature dependency
graph fills in **one merged PR per note of Twinkle**, at the chart's own rhythm, while the DGX plays the melody.
The game gets built while the piano plays the song it teaches. Below it is a **crew timeline**: every PR, per
worker, over time.

It lives at `/attract` (arcades call the self-running demo "attract mode"), its own page beside `/operator`, so the
two features never touch each other's files. It reads `operator-board`'s board (import its functions, don't edit
them): live from `/api/operator`, or from the snapshot with `/attract?snapshot`.
Inspired by KnightHacks' foreman tour (`specs/features/foreman/spec.md` there): take its ideas, not its code.

## Requirements
**The graph** is a three.js scene (amended 2026-10-24, #72; `three` is in `web/package.json`):
- A synthwave stage: a neon grid floor running to a horizon, a low sun, a dark sky. The camera orbits slowly.
- One **pillar** per feature spec, standing on the grid, with a glowing line on the floor per `depends_on`.
- Layered by depth: roots at the front, each layer of dependents a row further back. The layout is a pure function
  (slug -> grid position), a few lines of layering, not a library.
- Each pillar carries its slug as a label that faces the camera.
- Pillars are colored by state in `operator-board`'s states, plus a glyph on the label, never color alone. A
  pillar that isn't done yet is a low, dim outline on the grid.
- Clicking a pillar (a raycast) opens its spec, its PR and its done note on GitHub.
- No WebGL: the same graph as a flat list of features with their states and links, and the replay still steps,
  counts and plays.

**The replay:**
- **Order:** it steps through merged PRs in merge order.
- **Rhythm:** it uses ordinal time, not wall-clock time. Step N happens at note N of
  `web/public/songs/twinkle/chart.json`, spaced by that note's `beat` and `duration` at the chart's `bpm`. If there
  are more merges than notes, the melody starts again.

  That way the melody comes out in rhythm. Wall-clock spacing would scatter it.
- **What a step shows:**
  - a `feat(<slug>)` merge **raises its pillar out of the grid** to full height, with a flash and a ring of light on
    the floor, and the camera eases toward it;
  - floor lines to the features it unblocks draw outward;
  - any merge bumps the counters and slides into a 3-line ticker (number, type, title).
- **Counters,** large, for the current step:
  - features done of planned;
  - PRs merged;
  - agents at work (named workers with a PR open at that moment).

  At the last step they equal the board's numbers.
- **Chapters,** computed from the data, never written by hand, shown as a caption as they pass:
  - the first PR;
  - each milestone whose live features are all done (at the merge of its last one);
  - the peak of PRs open at once.
- **Controls:** Space plays and pauses, and a scrubber moves through the steps. A toggle switches to wall-clock time,
  which doesn't play notes.

**The piano:**
- With MIDI output available, each step sends the chart note's pitch to the output whose name contains
  "Portable Grand", using `MIDIOutput.send(data, timestamp)`. Note-on velocity is 80, and note-off is sent after the
  note's duration.
- Otherwise it plays a short Web Audio tone at that pitch.
- Stopping, pausing or leaving sends All Notes Off (CC 123) on all 16 channels.
- Write this output here, in about 30 lines. Don't edit `beat-track`'s files.

**The crew timeline:**
- One row per worker, ordered by their first PR.
- One bar per PR, from opened to merged, closed (hollow, dashed) or now (still open: outlined).
- Bars are colored by PR type, with a legend: `feat`; `fix`, `refactor`, `perf` and `test`; `plan` and `contract`;
  anything else.
- Overlapping PRs stack into sub-rows.
- A strip above the rows counts the PRs open at each moment, and the heading states the peak.
- Hovering shows the number, title, worker and times; clicking opens the PR.
- It's plain SVG, with a `<details>` table version for screen readers.

**The style:** `operator-board`'s synthwave look. Done pillars glow neon. Counters, ticker, chapters and the
controls are HTML over the scene; the crew timeline stays SVG below it. With reduced motion the camera doesn't orbit,
pillars appear at full height, and no flash, ring, bump or slide animates; the replay still steps and plays notes.
The renderer caps its pixel ratio at 2 and frees its WebGL resources when you leave the page.

## Validation
- `pnpm -C web test`, Vitest, no network, on fixed inputs:
  - The layout: every spec gets one position; a feature sits a row behind everything in its `depends_on`; no two
    pillars share a position.
  - The steps: N merged PRs give N steps in merge order. Step times follow the chart's beats and durations at its
    BPM. The merge after the chart's last note wraps to its first.
  - The counters at the last step equal the board's.
  - The chapters: the first PR; a milestone built at its last live feature's merge; none for an unbuilt milestone;
    the peak equal to the timeline's.
  - The timeline rows: one per worker; open bars end at now; overlaps go to sub-rows.
  - The piano output: it picks "Portable Grand" over another output, and stopping sends CC 123 on 16 channels. Use a
    fake `MIDIAccess`; `piano-sim`'s is fine to import.
- In Chrome, `action -> what you should see`:
  1. Open `/attract`, press Space -> pillars rise out of the grid step by step, the counters climb, chapters
     caption, and Twinkle plays in rhythm from the laptop.
  2. With the piano on USB TO HOST, play it again -> the DGX plays the melody. Pause mid-way -> silence, no stuck
     note.
  3. Click a done pillar -> its spec, PR and done note open.
  4. Hover a timeline bar -> its tooltip.
  5. `/attract?snapshot` with the network off -> the replay plays from the snapshot.
  6. Disable WebGL (`--disable-webgl`, or DevTools rendering) -> the flat list shows and the replay still plays.

  Keep a screenshot mid-replay and one of the timeline.
- On the piano (Eric; mark it in the done note): step 2, and whether Twinkle is recognizable. Don't count this as
  passed by hand-waving.

## Defaults
- Prefer the smaller option. `three` is the only dependency this uses: plain meshes, lines and built-in materials,
  labels as sprites or HTML, no postprocessing library and no graph-layout library.
- Notes come from the committed Twinkle chart, never typed from memory.
