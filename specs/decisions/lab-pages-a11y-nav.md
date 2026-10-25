# lab-pages-a11y: the experiments' pages are a list in slots.ts, not an import

**Context.** #1130: Lab should be the current slot on `/conduct`, `/highlight` and every later experiment page. The
spec's first choice is for `LAB_PAGES` (`web/src/game/nav-bar/slots.ts`) to read `experiments[].href` from
`web/src/game/x/index.ts`, unless that puts experiment code in the nav bar, which runs on every page.

**Measured.** I bundled the nav's slots with rolldown 1.2.15 (the one vite already installs), minified, with React,
Next and three left external and CSS modules stubbed, once as today and once with the registry imported:
- today: 4,457 bytes, 3 modules;
- with `experiments` imported: 206,506 bytes, 69 modules.

The registry imports every experiment's module (panels, color math, the round's charts), and the hrefs are read off
those objects, so tree-shaking can't drop them.

**Options.** A: import the registry (simplest, 202 KB more on every page). B: a list in `slots.ts` that
`nav-bar.test.ts` pins against `experiments[].href`. C: move each experiment's href into a data-only file the registry
and the nav both read (an edit to `x/index.ts` and every experiment's file, which open PRs hold).

**Choice.** B, as the spec says to. `EXPERIMENT_PAGES` lists the pathnames; the test fails, naming the difference,
when an experiment is added or moved without it.

**How to undo.** Replace `EXPERIMENT_PAGES` with
`experiments.map((x) => new URL(x.href, "http://lab").pathname)` and drop the pin, or do C once `x/index.ts` is free.
