## What shipped
The library test (`web/src/game/songs/library.test.ts`) now fails any chart where one hand's notes at one onset span more than a major 10th (over 16 semitones). Each rule now has a synthetic chart that breaks only it, plus a clean chart that gets none: same-pitch overlap, pitch range, duplicate id, time order and hand span. `CHART_LINT_TABLE=1 pnpm -C web test library` prints a Markdown row per chart: notes, bars, lowest and highest pitch, and the widest one-hand span.
## Where it lives
`web/src/game/songs/library.test.ts` · `specs/decisions/chart-lint-table-output.md`
## How to check it
`pnpm -C web test library`: 17 passed, plus the table test, which is skipped without the variable. Today's widest span is 14 (gymnopedie-1, left hand), so every chart passes. `verify.py --slug chart-lint`: pass at fb47310.
## Gaps
- **No chart was edited.** The table prints with `process.stdout.write`, because vitest hides a passing test's console output.
