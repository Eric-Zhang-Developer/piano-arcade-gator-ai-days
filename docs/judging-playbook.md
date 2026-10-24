# Judging playbook

How Piano Arcade scores against Gator Hack V's criteria, and what's still missing. The facts (rules, criteria,
prizes, sources) live in `specs/context/event.md` (#46); this file is our reading of them. Everything here is
**[guess]** unless it cites a file in this repo or a source in `event.md`. Feature status is from `main` at
`f027776` (2026-10-24); re-check `changes/` before citing.

## For agents: read this first

1. **Round 1 is judged offline from the Devpost page alone**: title, description, public repo, a video of 3 minutes
   or less. Only the top 10 present live. For round 1, a feature exists only if it shows in the video or the
   write-up.
2. **Plan for five criteria**: impact, technicality, design, novelty, presentation. Novelty includes how new the
   *tools* are (Site prizes). The table below maps each to our work.
3. **The challenge statement needs one recent technology, central to the build** ("Fresh off the frontier"). #10 is
   a one-way door: nothing may claim we meet it until #10 is answered (`mission.md`).
4. **Evidence beats claims.** Use real counts from real takes (`mission.md`), and the before/after in
   `specs/context/findings.md`. Never invent a number to fill a criterion; leave it empty and visible.
5. **No past winner we found was a game** (`event.md`, Past winners). Lead with *it teaches*; the arcade is why people
   keep practicing.
6. When you write a done note, the story (`docs/story.md`) or pitch material, say which criterion it serves and what
   a judge would see.

## Each criterion against Piano Arcade

| Criterion | What a judge needs to see | What we have (done notes in `changes/`) | Gap |
|---|---|---|---|
| **Impact** | A real problem, a real user, and that it helps | The problem: apps grade *which* notes, not *how* (`competitors.md`, four apps). The answer, shipped: timing direction (`timing-feedback`, `take-graph`), evenness, dynamics, rolled chords, a rubato score (`tempo-curve`), the weakest bars with a practice link (`weak-bars`, `bar-loop`), and wait mode to learn first. Playtests: about 10% at first, 71.4% with the beat track (`findings.md`) | Proof that it *teaches*: one player's improvement across takes with real counts. Local `records` keep bests; `take-store` (#61) would keep the history. The coach is still provisional |
| **Technicality** | It works, it's ambitious, it was built this weekend | Millisecond judging on a real DGX-660; the MIDI spike's 3.1 ms key pair and 1 ms clock agreement (`spikes/piano-midi/RESULTS.md`); `piano-sim` tests the MIDI path in CI; a computed difficulty level; ten charts from cited Mutopia scores (`song-pack-1`, `song-pack-2`) | Show it, don't list it: a log line and a green CI run are 5-second shots. Report `[verify].command` results in the write-up |
| **Design** | Intuitive, accessible, good-looking | The Synthesia look plus an arcade layer (decision 001), HUD, juice, hand colors, sheet view, calibration, laptop keys so judges can play | Accessibility has no spec: check that a miss isn't shown by color alone, contrast, and a reduced-motion option |
| **Novelty** | A new idea, *and new tools* | An arcade on a real 88-key piano that judges *how* you played and replays your take (`replay-view`, `ghost`); no app we checked grades early/late or dynamics (`competitors.md`) | "New tools" waits on #10 (candidates below) |
| **Presentation** | Problem, solution, approach, **limitations**, a working demo, in ≤ 3 min | The v4 video plan (two wows, the Twinkle hook, "I can't play this yet"); filmable beats in `docs/story.md`; `/attract` (`operator-replay`) shows the build | A limitations beat (the Chrome MIDI stall, latency, what's provisional). Who did what. The deep dive goes in the write-up (decision 001, row 14) |

## Candidates for #10, with checked dates

Input for #10, not a pick. Sources and read times are in `event.md`'s source list and #10's thread.

| Candidate | First public | Where it would be central | Fit |
|---|---|---|---|
| Claude Opus 5 / 5.5 driving the agent workflow (Eric's direction in #10) | Opus 5: 2026-07-24; Opus 5.5: 2026-09-22 (anthropic.com) | "The arcade that builds its own levels" (#10, catalog G17); `/attract` shows the build | Central only if building levels is in the product, not just how we coded it |
| Lyria 3.5 (Google music generation) | September 2026, in Google AI Studio (Google's September 2026 roundup) | A generated backing track for practice | Audio only: it must never write chart notes (`mission.md`). Also counts for Best Use of Gemini |
| Gemini 3.8 Live (speech to speech) | September 2026, in the Gemini API and AI Studio (same roundup) | A coach you talk to after a take | The coach is provisional; Gemini prize too |
| MuScriptor (open multi-instrument transcription) | arXiv v1 2026-07-09 (arXiv 2607.08168) | `song-rip-spike`: a recording becomes a chart | The riskiest piece; no solo-piano results stated |
| PDMX, Web MIDI, Demucs, Basic Pitch | 2024 or earlier | | Too old |

## Prizes worth a decision

| Prize | What it takes | Our position |
|---|---|---|
| Best Open Source (MLH) | A public repo with a clear open-source license | No `LICENSE` file on `main`. One file once the team picks a license and checks dependencies' licenses |
| Best Use of Gemini (MLH) | The Gemini API or Google AI Studio | Only if the coach (or Lyria) ships on it |
| Vobile Prize | Judged on the challenge statement; Vobile does copyright protection for rights holders | Cited public-domain and openly licensed charts (decision 003) fit; a ripped copyrighted song doesn't |
| Best Use of the Twinly API | Its computer-use, voice-clone calling or iMessage APIs; macOS only | No spec uses it. Not planned |

## What past winners had in common

From the winners listed in `event.md`:
- **A named problem, a named user, a working thing.** AidLink (2024) had a real phone number to call; Plato's Cave
  (2025) made AI output checkable by a person.
- **The year's sponsor technology, used centrally**: AidLink ran on IBM Watson in the IBM year. This year the
  challenge statement asks for a recent technology instead.
- **Trust in AI**: Plato's Cave won on verifying AI claims. Our rule that the coach's claims are checked against the
  results data (`mission.md`) is the same idea; show it if the coach ships.
- **Who did what**: AidLink's teammates each wrote their part on Devpost; 2022–2024 rules required it in the video.

## Submission checklist

- [ ] Devpost title and description: what it does, how it was built.
- [ ] Public repo link; a `LICENSE` if we enter Best Open Source.
- [ ] Video ≤ 3:00: the challenge statement's three asks (what it does, what was hard, why it's recent),
      limitations, who did what.
- [ ] Roster of 2–5, every member registered.
- [ ] Only the sponsor prizes we qualify for.
- [ ] Submitted with buffer before Sun Oct 25, 5:00 PM ET.
- [ ] Monday: at least one member at the Reitz Union by 10:15 AM.
