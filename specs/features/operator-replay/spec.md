---
name: "Operator replay: watch the build, one merge per note of Twinkle, on the piano"
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
**The graph:**
- One node per feature spec, with an edge per `depends_on`.
- Layered by depth (roots on the left). Nodes are labelled by slug.
- Nodes are colored by state in `operator-board`'s states, plus a label or glyph, never color alone.
- Clicking a node opens its spec, its PR and its done note on GitHub.

**The replay:**
- **Order:** it steps through merged PRs in merge order.
- **Rhythm:** it uses ordinal time, not wall-clock time. Step N happens at note N of
  `web/public/songs/twinkle/chart.json`, spaced by that note's `beat` and `duration` at the chart's `bpm`. If there
  are more merges than notes, the melody starts again.

  That way the melody comes out in rhythm. Wall-clock spacing would scatter it.
- **What a step shows:**
  - a `feat(<slug>)` merge turns its node to done with a flash and a ring;
  - edges to the features it unblocks draw outward;
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

**The style:** `operator-board`'s synthwave look. Done nodes glow neon. With reduced motion the replay still steps
and plays notes, but no flash, ring, bump or slide animates.

## Validation
- `pnpm -C web test`, Vitest, no network, on fixed inputs:
  - The steps: N merged PRs give N steps in merge order. Step times follow the chart's beats and durations at its
    BPM. The merge after the chart's last note wraps to its first.
  - The counters at the last step equal the board's.
  - The chapters: the first PR; a milestone built at its last live feature's merge; none for an unbuilt milestone;
    the peak equal to the timeline's.
  - The timeline rows: one per worker; open bars end at now; overlaps go to sub-rows.
  - The piano output: it picks "Portable Grand" over another output, and stopping sends CC 123 on 16 channels. Use a
    fake `MIDIAccess`; `piano-sim`'s is fine to import.
- In Chrome, `action -> what you should see`:
  1. Open `/attract`, press Space -> the graph fills in step by step, the counters climb, chapters caption, and
     Twinkle plays in rhythm from the laptop.
  2. With the piano on USB TO HOST, play it again -> the DGX plays the melody. Pause mid-way -> silence, no stuck
     note.
  3. Click a done node -> its spec, PR and done note open.
  4. Hover a timeline bar -> its tooltip.
  5. `/attract?snapshot` with the network off -> the replay plays from the snapshot.

  Keep a screenshot mid-replay and one of the timeline.
- On the piano (Eric; mark it in the done note): step 2, and whether Twinkle is recognizable. Don't count this as
  passed by hand-waving.

## Defaults
- Prefer the smaller option. No new dependencies; the graph layout is a few lines of layering, not a library.
- Notes come from the committed Twinkle chart, never typed from memory.
