# duo-results: the weakest run, the run's number and the scoring rule

**Context.** The spec asks for "the weakest run of 1–4 consecutive bars" without saying how. Taking the run with the
lowest mean would always pick a single bar, since a bar is never stronger than the run around it. It also asks
for "N% of notes right" and for skipping practice and demo takes when saving "next for you".

**Options.** A: grow from the weakest bar. B: find the 4-bar window with the lowest mean. C: any run whose mean is
below a threshold.

**Choice.** A. The run starts at the weakest bar (earliest on a tie) and grows over neighbouring weak bars, the weaker
side first, up to 4 bars. A weak bar is below `cleanAccuracy` (95%, the spec's "every bar at least 95%" threshold for
a clean take). An empty bar ends the run. With bars 9–12 missed in Für Elise this gives 9–12, where B could slide onto
clean bars.
- **N% of notes right:** the run's accuracy by the judge's formula. That's the same number the strip shows for those
  bars, so the line and the bracket agree. Using a hit share instead could print "100% of notes right" for a run of
  GOODs.
- **Scored take:** records' `practiceReason` (loop, tempo, mode, bot, versus, one hand), plus `demo` and `practice`.
- **Per-bar scoring:** `rangeScore` re-states weak-bars' rule for any span, so weak-bars isn't touched. A test holds it
  equal to `scorePhrases` on paired cells, WRONG presses included.

**How to undo.** Change `weakestRun` in `web/src/game/duo-results/scores.ts`; its tests pin today's rule.
