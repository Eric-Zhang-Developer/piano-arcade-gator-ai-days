# duo-results: how the panels reach the bands

**Context.** The spec's Plan restyles results-layout first (part 2), then adds the panels (part 3). The panels need the
take and the chart, which only a plugin's results panel receives, and the tutor sits in a different band from the strip
and histogram. The spec doesn't say what NEXT SONG opens.

**Options.**
- Order: layout first, so main shows an empty middle band until the panels land; or panels first, as cards in Details,
  then the layout moves them up.
- Panels: one plugin rendering all three; or two, `duo-results` (BY BAR and TIMING) and `duo-tutor`.
- NEXT SONG: the select (`/`); or the next song in the library's order.

**Choice.**
- Panels first (#710), then `fix(results-layout)`, then this part. Main never lost the take graph from its first view
  before something replaced it.
- Two plugins: one results panel can't be in two bands. results-layout lists `duo-results` as featured and `duo-tutor`
  beside the buttons.
- NEXT SONG opens `/`. The library has no "next" order a player would expect, and the select is one keypress from any
  song.
- The layout draws every action button as the kit's secondary button. score-card, sheet-review and piano-out each
  brought their own look, so the row read as three styles.

**How to undo.** Remove `duo-results`/`duo-tutor` from results-layout's `featured` and `tutor` settings (the panels drop
to Details), or change `href` in `duoTake` for NEXT SONG.
