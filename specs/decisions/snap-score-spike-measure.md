# snap-score-spike: how the reads are made and measured

**Context.** The spec fixes the reader (claude-opus-5-5 over the Messages API, prompt in `prompt.md`), the diff
(`forge diff`) and one alignment shift. A few choices it leaves open change the numbers, so they're logged here.

**Choices.**
- **Render size:** `sips -s format png -Z 2200` on each Mutopia letter PDF (page 1, 1700×2200). Plain `sips -s format
  png` rasterizes a PDF at 72 dpi (612×792), where an eighth's flag is a few pixels; `-Z` is still macOS's own tool.
- **Structured output:** the request carries a JSON schema (`output_config.format`), so every finished reply parses.
  A wrong chart is then a misreading, not a formatting slip. Effort `high`: reading notes is precision work.
- **No fallback model.** A refusal is recorded as a failure for that image (at most 2 attempts), as the spec asks. A
  server-side fallback would score another model under claude-opus-5-5's name.
- **Pickups:** the prompt asks for negative beats before bar 1; the reader moves them by whole bars, so the pickup
  pads a full bar 0 as the committed charts do (sheet-pickups). The one allowed shift still covers a different count.
- **Written-out repeats are cut from the committed chart.** The committed charts play each repeat in full; the page
  prints the repeat sign once, and the prompt asks the reader not to expand it. So past the first repeat the same
  notes sit at different beats, and an exact read scores near 50%. `CUTS` in `score.mjs` takes each written-out copy
  out of the committed chart before the diff (minuet-g: beats 48–96, the second pass of bars 1–16; fur-elise: beats
  13.5–24, the second pass of bars 1–7, and beats 45 to the end, the second pass of bars 16–30). Each cut must be an
  exact copy of the notes at its `copyOf` beat, or the scorer stops, so a cut can only remove music the chart already
  has. The cut chart is written to `local/<id>.committed-unrepeated.json`.
- **ode-to-joy's extra voices:** the page is an SATB setting on a grand staff; the committed chart keeps the soprano
  (R) and bass (L). The reader returns alto and tenor too. They count as forged unmatched notes; the share counts
  committed notes, so they don't lower it.

**How to undo.** Each is one line: the `sips` call in FINDINGS.md's recipe, `output_config` and the attempt count in
`snap.mjs`, `CUTS` in `score.mjs`.
