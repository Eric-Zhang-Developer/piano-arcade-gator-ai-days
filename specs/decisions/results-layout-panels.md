# Results layout: where each panel goes

**Context.** The spec sets the featured list (`take-graph`) and puts Retry, Replay on piano and Songs in the first
view, but two panels are buttons, `Results` has no score, and the records panel asks for initials.

**Choices.**
- `actions: ["piano-out", "wait-mode"]` in `resultsLayoutSettings`: panels that are a single button or link join
  Retry and Songs instead of taking a details card. Replay on piano is in the spec's button row; Play it judged is
  wait mode's next step.
- The score comes from the page, which rebuilds it with the HUD's own reducer (as `records` does); the layout shows
  "—" without one rather than recomputing a score.
- Cards are named from the plugin id ("chord-sync" → "Chord sync"), with `names` overriding four ids whose id reads
  badly as a heading (take-midi → MIDI, replay-view → Replay, weak-bars → Phrases, tempo-curve → Tempo).
- `records` (NEW RECORD and initials) stays a details card, as the spec's featured list says. Option: add it to
  `featured` if the initials prompt should be in the first view; at 1280×720 it would push the take graph down.
- The layout paints its own darker backdrop over the page's overlay, so the frozen highway's combo and keys don't
  read as a second layer under the counts.

**How to undo.** Edit `resultsLayoutSettings` in `web/src/game/results-layout/index.tsx`; delete the `.results`
background rule for the page's plain overlay.
