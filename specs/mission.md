# Mission

## Why
Practicing piano is lonely and quiet. The four leading learning apps we checked (Simply Piano, Flowkey, Yousician,
Playground Sessions) grade *which* notes you hit, not *how* you played them: timing direction, evenness and dynamics
go ungraded, and none lets you bring your own song (`specs/context/raw/competitors.md`). Arcade rhythm games are the
opposite (loud, instant, addictive), but they don't teach a real instrument.

## Who
A person at a real piano keyboard who wants to get better and have fun doing it. At the event, that includes the
judges: they can play the browser version on laptop keys.

## What
*Named Étude on 2026-10-25; the working name was Piano Arcade (`specs/context/naming.md`).*

Étude: a Japanese-style arcade rhythm game played on a real 88-key piano (a Yamaha DGX-660) in Chrome. Notes
fall toward the keys, every note you play is judged to the millisecond, and the game answers with combo, bursts and
sound. A learning side reads your takes and tells you what to fix. At the end a player can play a real piece on a
real piano, see exactly how they played it, and be told what to practice next.

The project answers the event's challenge statement, "Fresh off the frontier": a technology, dataset or discovery
first made public in the past 12 months, central to the project. **Which one is still open**; the learning lane
decides (see the `needs-human` issue). Until then, nothing may claim to meet it.

## Non-negotiables
- Never invent data. Unknown stays empty and visible. Any number shown to a user is a real count from a real take.
- Chart notes come from a cited score (cite the source in the chart) or from Eric. Never from an agent's memory.
  Which sources may be committed, and what stays local, is decision 003 (loose on purpose).
- Judging is against the chart's clock, after the latency offset: PERFECT when |offset| ≤ 40 ms, GREAT when
  40 ms < |offset| ≤ 80 ms, GOOD when 80 ms < |offset| ≤ the GOOD window (120 ms, a named setting), MISS when no
  matching key arrives within the GOOD window. Each bound counts as the better judgment (exactly 40 ms is PERFECT).
  Punish what a listener hears as wrong: PERFECT, GREAT and GOOD keep the combo; a MISS breaks it, and so does a
  WRONG note (decision `judging-tiers-punish-what-sounds-wrong.md`). A full combo (no MISS, no WRONG) ranks at
  least B, whatever its accuracy (decision `judging-windows-wider.md`).
- A key press that matches no chart note is an extra: counted, never a MISS. An extra is a WRONG note unless a note
  of the same pitch is within 150 ms of it (part of that note's timing) or it falls before the first note's window
  opens or after the last one's closes.
- A note matches a key press only if they're the same pitch. Each key press matches at most one chart note, and
  each chart note at most one key press.
- MIDI input runs on Chrome's Web MIDI only. Laptop keys always work as a fallback, so the game is playable with the
  piano unplugged.
- Only code written during the hacking period (Fri Oct 23 5:00 PM to Sun Oct 25 5:00 PM ET). Code from
  `spikes/piano-midi/` is evidence, not a dependency: rebuild what you need.
- Anything an LLM says about a take must be checked against the results data before it's shown. If a cited bar or
  number doesn't exist in the results, show the plain summary instead.

## Not doing
- A sound on every hit. Besides the piano, sounds are an accompaniment track that keeps time from the count-in to
  the end (`beat-track`; decision `beat-track-accompaniment.md`) and event sounds (milestones, fever, full combo,
  rank, a quiet miss cue).
- Pixel art as the medium. The look is Synthesia's (dark, glowing notes aligned to the keys) plus an arcade layer.
- Strong perspective on the highway: far notes shrink to slivers on 88 keys. At most mild depth, with the judgment
  line aligned to the keys.
- AI in the core playing loop. AI lives in the learning lane.
- Sheet music on the arcade screen (deferred to practice mode).
- Required accounts: a player is an anonymous user, and linking Google is optional. An optional sign-in screen is
  allowed only with "Play as guest" on it, so nobody has to sign in to play. Also not doing: an online leaderboard,
  mobile apps, live transcription on stage.
