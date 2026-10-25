---
name: "Demo performance: every song's bot playback gets sustain, dynamics and legato, five songs at a time"
depends_on: ["golden-demo"]
owns: ["specs/features/demo-performance/", "changes/demo-performance.md", "specs/decisions/demo-performance-"]
assignee: "eric"
---

# Demo performance

Issue #814. Eric, 2026-10-25: "it seems like it's only playing the wrong MIDI. It's not holding, it's not sustaining.
There are no dynamics there or anything. ... Maybe 5 songs at a time and hand that off into new issues. I'd want to
investigate as well."

golden-demo (#807) built the mechanism and is the pilot: a `songs/<id>/pedal.json` sidecar the bot sends as CC64
(`web/src/game/pedal/`), per-note `velocity` in the chart (already in the contract), and the bot holding each note
its written length (#809). This feature applies it to the library. It changes no code unless a song needs something
the mechanism can't do; then that's a `fix(<slug>)` first.

## Plan
One `fix(<song-pack slug>)` PR per batch issue, under the lane rule (the charts belong to song-pack-1…4; `pedal.json`
files sit next to them in `web/public/songs/<id>/`). The done note lands with the last batch.

| Batch | Issue | Songs |
|---|---|---|
| 1 | #815 | twinkle, ode-to-joy, fur-elise, chopin-prelude-4, moonlight-1 |
| 2 | #816 | gymnopedie-1, clair-de-lune, nocturne-op9-2, maple-leaf-rag, moonlight-3 |
| 3 | #818 | clementi-sonatina-36-1, burgmuller-arabesque, bach-prelude-c, mozart-545-1, minuet-g |
| 4 | #819 | gnossienne-1, entertainer, mountain-king, alla-turca, minute-waltz |
| 5 | #820 | flower-dance and its variants: local, gitignored, data never committed |

## Requirements
- **Findings first, per batch:** before building, comment on the batch's issue, per song: the cited score (the
  Mutopia or IMSLP edition the chart came from, per decision 003), its Ped. marks and dynamic marks, and what the
  demo lacks today. Eric reads this; he wants to investigate too.
- **Sustain:** `pedal.json` from the score's Ped. marks. A score with none gets the per-harmony rule golden-demo
  used, logged as an arrangement choice in `specs/decisions/demo-performance-pedal.md`.
- **Dynamics:** per-note `velocity` from the score's marks (p, mp, mf, f, hairpins), with one mark→velocity mapping
  for the whole library, logged in `specs/decisions/demo-performance-dynamics.md`. A score with no marks stays at the
  default velocity, logged. Never from memory or a recording of someone else's performance.
- **Legato:** already the bot's behavior since #809; check each song's demo holds the written lengths, and fix a
  chart whose written durations are wrong only against the score.
- **Notes stay the score's.** Pitches and beats don't change; `chart.json` gains only `velocity` fields.
- **moonlight-3's tempo** is #821 (eric-agent-5), not this feature.

## Validation
1. The library test (`web/src/game/song-pack-*/` vitest or the repo's library test) passes: every chart still loads,
   every `velocity` is 1–127, every `pedal.json` is in order and inside the song.
2. A vitest per batch: each song's `pedal.json` parses through `web/src/game/pedal/`.
3. No local browser checks (load rule); main's scheduled run covers them.
4. Eric listens to each batch's demos on the DGX. Mark it in the done note. No sound claims from headless runs.

## Defaults
- In `extras`, after play-modes.
