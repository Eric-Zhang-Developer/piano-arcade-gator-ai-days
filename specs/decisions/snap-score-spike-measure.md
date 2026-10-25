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
- **minuet-g's window:** its committed chart writes the A section's repeat out (bars 1–16 twice, per its source line),
  but the page prints the repeat sign and continues to bar 32. Bars 17–32 aren't the same music as the second pass,
  so minuet-g is scored on the committed chart's first 16 bars (beats 0–48). Scoring the whole chart would cap the
  photo near 50% for reading correctly.
- **ode-to-joy's extra voices:** the page is an SATB setting on a grand staff; the committed chart keeps the soprano
  (R) and bass (L). The reader returns alto and tenor too. They count as forged unmatched notes; the share counts
  committed notes, so they don't lower it.

**How to undo.** Each is one line: the `sips` call in FINDINGS.md's recipe, `output_config` and the attempt count in
`snap.mjs`, `WINDOW` in `score.mjs`.
