# chart-lint: where the library table prints

**Context.** The spec asks `CHART_LINT_TABLE=1 pnpm -C web test library` to print a Markdown table. Vitest 5 hides a
passing test's `console.log` output, so a `console.log` table printed nothing.

**Options.** (a) `console.log` plus a `--silent=false` flag in the command; (b) `process.stdout.write`, which vitest
passes through.

**Choice.** (b): the spec's command works as written. Without the variable the test is skipped and prints nothing.

**How to undo.** Swap back to `console.log` and document the extra flag.
