## What shipped
On the select, an arrow step now reads only the song's title, composer and level, from an sr-only polite line; the
panel and its buttons are no longer live (#1236). The place counter is heard as "Song N of M" (#1237). The nav's
GitHub mark is named "GitHub (opens in a new tab)" (#1238). Nothing looks different.
## Where it lives
`web/src/game/duo-select/Select.tsx`, `main-page/Sections.tsx`, `nav-bar/NavLinks.tsx`, the `.srOnly` class in both
modules, and `duo-select/select-a11y.test.tsx`.
## How to check it
`pnpm -C web exec vitest run src/game/duo-select src/game/main-page src/game/nav-bar`. verify-select, verify-main and
verify-nav: not verified locally; covered by main's scheduled full run.
## Gaps
No screen reader was run: the markup is checked by the unit test and on the live page in the in-app browser.
