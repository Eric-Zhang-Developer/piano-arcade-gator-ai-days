---
name: "Restyle spike: a local agent session rewrites a library chart as ragtime, waltz, trap or lullaby with its melody pitches locked"
depends_on: ["chart-lint", "beat-track", "hand-mode"]
owns: ["specs/features/restyle-spike/", "changes/restyle-spike.md", "spikes/restyle/", "web/src/game/restyle/", "specs/decisions/restyle-spike-"]
assignee: "eric"
---

# Restyle (spike)

Issue #517. Eric, 2026-10-24: take a library chart and play it as ragtime, a waltz, trap or a lullaby. The agent is a
worker's own Claude Code session, as in level-forge's phase 1: no API key, no spend. The melody's pitches are locked
and checked by code; rhythm, meter, swing and accompaniment are free. A spike (decision 004, #493): one question,
findings at the end.

## The question
Can a local agent session restyle a library chart so that code confirms the melody's pitches, the chart passes the
library's checks, and a listener hears both the source and the style?
- **Yes:** all four runs below pass the melody lock and the library test inside the time box, and on Eric's listen he
  names the source and the style for at least 3 of the 4.
- **No:** fewer than 3 pass the checks, or Eric names fewer than 3. FINDINGS.md says which check failed and how often.
- **Time box:** about 3 hours of agent time. Then FINDINGS.md, whatever the state; if Eric hasn't listened yet, it
  says "listen pending". No new spike work after Sun 2026-10-25 12:00 ET.

## The melody rule
- **Melody:** a chart's right-hand notes, the highest pitch at each onset (notes with the same `beat`), in beat order.
  In code, `melody(chart)`. It groups onsets the way `library.test.ts` does for hand span.
- **The lock:** the restyle's right hand has exactly one note per onset, and its pitch sequence equals the source's
  melody, in order. No note added, dropped, repeated, swapped or moved by an octave.
- **Free:** each melody note's `beat`, `duration` and `velocity`, the chart's `bpm` and `beatsPerBar`, swing (it's
  just beats), and the whole left hand. Left-hand notes still pass chart-lint (span ≤ 16, no same-pitch overlap).
- **Why this rule:** the four sources have no right-hand chords (measured at e9950a7), so the top note is their whole
  right hand. One note per right-hand onset in the restyle means that with `?hands=R` every judged pitch is a cited
  one. The cost: no right-hand octaves, chords or fills, so stride ragtime's right hand is out of phase 1.

## Plan
1. Draft PR `feat(restyle-spike): melody lock and four restyles`. `web/src/game/restyle/index.ts`: `melody(chart)`
   and `lockProblems(source, restyled)`, a list of problems naming the first differing note, empty when locked.
   `restyle.test.ts` tests both on synthetic charts, then checks every restyled chart under `web/public/songs/`
   (`local/` included) against its source. That test is the deterministic check. Nothing imports the module.
2. **A separate `fix(beat-track)` PR** for the drum patterns (below): `web/src/game/beat/` is beat-track's.
3. `spikes/restyle/prompt.md` (committed): the brief every run starts from, this page's rules and label.
4. **The runs**, one at a time, from a worker's session: read the source chart, write the restyle to
   `web/public/songs/local/<id>/chart.json`, run the checks, fix, repeat. Per run: pass or fail, minutes, attempts
   until the lock passed, and the session's tokens (from its own usage).
5. `spikes/restyle/FINDINGS.md`, then `changes/restyle-spike.md` last.

| Source | Style | Restyle id | Source's license, as its chart cites it |
|---|---|---|---|
| `twinkle` | trap | `twinkle-trap` | traditional melody, public domain (page text CC BY-SA 4.0) |
| `ode-to-joy` | waltz | `ode-to-joy-waltz` | Mutopia 528, Public Domain |
| `minuet-g` | ragtime | `minuet-g-ragtime` | Mutopia 75, Public Domain |
| `fur-elise` | lullaby | `fur-elise-lullaby` | Mutopia 931, Public Domain |

Für Elise is the long one (186 melody notes). Eric may swap a row; log it in a `restyle-spike-` decision.

## The chart
- `id` is `<source id>-<style>`, in a folder of that name (the library test checks folder = id). The lock test finds
  the source by that prefix, and fails a chart labeled "restyled from" whose source it can't find.
- `title`: `<source title> (<Style>)`. `composer`: the source's. `catalog`: `restyled from <source title>`; the song
  card shows `catalog` after the composer, so the label reaches song select with no code change.
- `source`: `Restyled as <style> by a Claude Code session from library chart <source id>. Melody pitches locked to
  it (restyle-spike); rhythm, meter and left hand are the session's. Melody source: <the source chart's source>`.
- Play it: `/play?song=local/<id>&hands=R&beat=<style>`. `hands=R` judges only the locked melody; the DGX plays the
  left hand (hand-mode; a laptop tone without the piano).
- The prompt forbids recalling a published arrangement: the left hand is written fresh, over the source's harmony.

## Drum patterns (`fix(beat-track)`)
- `?beat=ragtime|waltz|trap|lullaby` picks a pattern; no `beat` and `?beat=off` behave as today. The default's hits
  stay exactly as `beat.test.ts` pins them for Twinkle.
- Same scheduler, channel 10, the count-in's side sticks, and the laptop fallback clicking beats only, as today.
- Each pattern is one bar of hits at beat offsets, as named settings, for one `beatsPerBar`. On another meter it plays
  the default and the status line says so. Starting points, tuned by ear and logged: ragtime (2 or 4) kick on 1,
  snare (38) on the backbeat, hi-hat eighths; waltz (3) kick on 1, hi-hat on 2 and 3; trap (4) hi-hat sixteenths,
  kick on 1, clap (39) on 3; lullaby (any) a soft side stick on 1.
- The full band waits for backing-track's gate: Eric hearing its arrangements on the DGX. Phase 1 is piano and drums.

## Where restyles live
- **During the spike, all of them stay local**, in the worker worktree's `web/public/songs/local/` (self-ignored),
  whatever the license. A chart committed under `web/public/songs/` shows in song select, which is the demo path, and
  a spike never ships by itself (decision 004, principle 5). Decision 003 says `web/public/songs-local/`; the folder
  the code uses is `web/public/songs/local/`.
- **On promotion, per the source's license** (decision 003's table):
  - public domain or CC0: may be committed to `web/public/songs/<id>/` in the promoting spec's PR;
  - CC BY or CC BY-SA (`moonlight-3`, `nocturne-op9-2`): committed only under the same license, named in `source`,
    with a `CREDITS.md` line through a `docs:` PR (a restyle is an adaptation, so share-alike holds);
  - all rights reserved (a `local/` source): local forever, credited "© owner, all rights reserved, local use only".
  All four sources here are public domain, so all four could be committed on promotion.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/restyle`. Synthetic: a restyle with new beats, durations,
   bpm, `beatsPerBar` and left hand passes; one pitch changed, an octave moved, a note dropped, one added, two
   swapped, and a right-hand chord each fail with a problem naming the note; a source's right-hand chord gives its
   top note. Then each restyled chart present against its source (CI has none: the synthetic cases only).
2. `pnpm -C web exec vitest run --passWithNoTests src/game/songs/library.test.ts`: chart-lint's rules and the
   Perfect player over every chart, the local restyles included.
3. The `fix(beat-track)` PR: `pnpm -C web exec vitest run --passWithNoTests src/game/beat` (Twinkle's default list
   unchanged; each style's hits for one bar, exactly), and `verify.py --slug beat-track` once, under the verify lock.
4. **Listen (Eric, on the DGX):** each restyle from its play link. He names the source and the style. If not done by
   the time box, FINDINGS.md says "listen pending".

## Gaps (accepted)
- **Question for Eric, #506:** its line says AI "never writes the notes a player is judged on: those come from a
  cited source through the converter", and today's mission says chart notes come from a cited score or Eric. A
  restyle is judged, and the session wrote every note's timing and all of the left hand. What holds: with `hands=R`
  every judged pitch is cited and in order, checked by code, and the chart says "restyled". What doesn't: the judged
  rhythm is the model's, and `hands=both` judges model-written pitches. #506's wording needs to cover restyles, or
  restyles stay `hands=R` only. The decision 003 "our own work" row covering a model's notes is the same question.
- No check catches a recalled arrangement; FINDINGS.md says what the prompt asked and what came out.
- The lock checks pitch order, not that it still sounds like the source: that's the listen.
- The pattern is picked by URL, not by the chart: a chart field is a `contract:` change, not a spike's.
- Restyles exist only in the worker's worktree. Eric copies one into his checkout to listen.

## Defaults
- Until Eric rules on #506: restyles are played and judged with `hands=R` only. Planner default, 2026-10-24; the
  smaller, reversible option.
- The smaller option; log choices the spec doesn't make in `specs/decisions/restyle-spike-*.md`.
