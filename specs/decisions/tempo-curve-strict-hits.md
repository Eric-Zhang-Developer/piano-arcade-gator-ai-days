# Tempo curve: strict hits are kept only when they sit near the curve

**Context.** The spec says the fit starts from the strict results' hits. Once a take drifts by about the gap between
two same-pitch notes (Twinkle's C C, G G, …), the strict judge pairs a note with its neighbour's press: speeding up,
with the next note's earlier press. Taking those hits as given leaves the neighbour without its press and pulls the
curve off: a steady 100%→125% speed-up scored 14 of 42 PERFECT that way.

**Options.** (A) Take every strict hit as given. (B) Walk forward in time; keep a note's strict press only when it is
within `matchMs` of the curve fitted so far, else match the note like any unmatched one. (C) Ignore the strict hits.

**Choice.** B. Strict hits still come first, so a take with no drift pairs exactly as strict does; only pairings the
curve contradicts are dropped. With B the speed-up scores 42 of 42, and a test pins it.

**How to undo.** In `rubato()` (`web/src/game/tempo-curve/index.ts`), take `strictPress` without the `near` check.
