# lab-state-keys: the choices the spec left open

Context: `specs/features/lab-state-keys/spec.md` fixes #1323–#1330 and asks for anything it doesn't settle to be logged.

| Choice | Taken | Why, and the alternative | How to undo |
|---|---|---|---|
| #1324 leave path | A 250 ms pathname poll inside hand-palette while its palette is on | Self-contained, as audio-track's poll is. The guard route (name-theme's `Guard.tsx`) needs a mount in the root layout for one experiment; the `/play` teardown route touches `app/play/page.tsx`, held by #600. | Swap the poll for a layout guard calling the plugin's `off`. |
| #1323 / #1328 "a control" | `a, button, input, select, textarea, [contenteditable]`, an inline one-liner in each page | No shared helper exists; one line twice beats a cross-experiment import (experiments are pruned one folder at a time). | Replace with a shared helper if a third page needs it. |
| #1328 a Space press that moves focus | A press that began as the pedal still lets it up on keyup, wherever focus went | Otherwise the pedal sticks down when focus lands on a button mid-press. | Drop `spaceRef` in `WetPaint.tsx`. |
| #1329 error copy and colour | "The demo song didn't load. Reload the page to try again." in the data face, full ink, a 2 px kit-blue rule; cells read "—" | The kit has no alert style; judgment colours (the login page's `--pa-wrong`) stay off chrome. "…" says loading, so it goes once nothing is coming. | `.failed` in `pinned.module.css`; the copy in `take.ts`. |
| #1329 disabled buttons | 0.4 opacity, default cursor (round 1) | They looked live while off; composers-hands and speak dim theirs the same way. | Remove `.actions button:disabled`. |
| #1330 the fix | `buildSonata` cuts the soonest-ending sounding note at a fifth note's start; the chart is regenerated from the committed snapshot (40 notes end sooner) | Every note has its own onset per hand, so at most 4 sounding means sheet-xml's first-fit voicing fits in 4. Hiding the Sheet music link needs `sheet-view/plugin.tsx` (held by #600) and hides a page that can work. A fresh `make-sonata.mjs` run would also refresh the data, which is the freeze's job. | Revert the `VOICES` block in `sonata.ts` and regenerate. |
