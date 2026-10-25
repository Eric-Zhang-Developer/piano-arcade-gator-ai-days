# miss-moment: the stage dips only on a big break

**Context.** On origin/main, fever-stage took 85% of the stage's saturation for 300 ms on every miss and every WRONG
(`reduceStage`). The spec asks for "about 15% for about 100 ms" on a combo break at 50 or more, through a `dip(atMs)`
hook. It doesn't say whether the old per-miss dip stays. eric-agent-3, 2026-10-25.

- **Options:** (A) keep the old dip on every miss and add the break's; (B) only the break's dip.
- **Choice: B.** A miss is meant to be quieter than a hit (Validation c), and an 85% wash on every miss is the
  loudest thing a miss did. `dipMs` is now 100 and `dipDepth` 0.15. The stage is only drawn in fever, so the dip only
  shows there. Reduced motion: no dip (the plugin doesn't call it).
- **Undo:** restore the `noteMiss` and `wrongNote` cases in `reduceStage` and set `dipMs: 300`, `dipDepth: 0.85`.
