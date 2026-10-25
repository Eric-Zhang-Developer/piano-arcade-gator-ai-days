# help-overlay: the drift test also reads `.toLowerCase()` comparisons

**Context.** The spec's literal pattern, `/(key|code|\bk)\s*[!=]==\s*"([^"]+)"/`, misses handlers written as
`e.key.toLowerCase() !== "f"`. On main that's first-run's F, options-panel's O and easy-charts' E on the select, so a
new key added that way would never fail the test.

**Options.** A: allow an optional `.toLowerCase()` before the comparison, and compare keys case-insensitively. B: keep
the spec's pattern and list those three by hand.

**Choice.** A. It's stricter than the spec, never looser, and the three keys get their lines either way.

**How to undo.** Drop `(?:\.toLowerCase\(\))?` from `LITERAL` in `help-overlay.test.ts`.
