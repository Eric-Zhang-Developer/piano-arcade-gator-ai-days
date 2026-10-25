# how-it-works: choices the spec left open

**Context:** the spec fixes the data, the four figures and the checks. It is silent on the smaller choices below,
so each takes the smaller, reversible option.

| Choice | Options | Taken | How to undo |
|---|---|---|---|
| How the PRs split | one PR / data then page | Data plus tests (#443), then page plus verify (#460) stacked on its branch, then screenshots and the done note: the spec's own split past ~400 lines | Squash the stack into one PR |
| A diagram with no data | a `<p>` / an SVG saying so | An SVG with an `unknown` label: the spec says each figure holds an SVG, and the no-snapshot run of `verify-how.mjs` caught the `<p>` | Swap the `Unknown` component for text |
| Where PR and issue links point | the snapshot's PR URLs / git's `origin` remote | The remote first, then the snapshot: links work with no snapshot too | Drop `githubUrl` and read `prs[0].url` only |
| How the check reads values | page text / attributes | `data-value` (a key) and `data-n` (the value, or `unknown`) on each value, so the check compares numbers, not wording | Match on text in `verify-how.mjs` |
| The check's fixture | the real snapshot / a small fixture | `web/src/how/fixture-snapshot.json`: slugs and repo named `fixture`, with an empty hour and the #387/#391/#397 incident. Only the check writes it in place, and the check puts back what was there | Delete the file and run (a) only |
| Hour labels on the time axis | every hour / every Nth | Every Nth hour, keeping at least 130 units per label so "Sat 11 AM" never overlaps; the table in `<details>` has every hour | Change `every` in `Time` |
