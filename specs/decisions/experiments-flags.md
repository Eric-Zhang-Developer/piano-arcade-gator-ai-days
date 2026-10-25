# Experiments: how one turns on, and what the frame passes it

**Context.** The spec lets an experiment turn on with a URL flag (`?x=<name>`) or a Lab toggle, with the toggle's
storage the worker's choice. It also says one frame plugin passes `/play`'s hooks to the experiments that are on.

**Options.** (A) the URL flag alone; (B) the flag plus a stored toggle (localStorage) per experiment.

**Choice: A.** Each gallery button is a link whose URL carries its flag, so a review needs nothing more. A stored
toggle would keep an experiment on in ordinary play after the review, and the demo path must stay unchanged.

**Also decided here:**
- The frame passes `transformChart`, `wrapInput`, `draw`, `onEvent`, `startPanel` and `resultsPanel`. It passes no
  `background`: `/play` takes the first plugin that has one, so a frame with that hook would take the stage from
  fever-stage. An experiment that needs the stage is heavy and gets a spike (contract rule 6).
- An experiment's module runs no code when imported: its plugin is made only when its flag is on.
- A throw from an experiment turns off that one experiment for the rest of the take (crash-guard's guard). The other
  experiments keep running.
- Shots in `specs/features/experiments/shots/<name>/`: at most 4 files and 400 KB per experiment, JPEG or PNG, from
  our own pages.

**How to undo.** For B, add a stored set to `flagged()` in `web/src/game/x/index.ts`, and add the toggles to the
gallery.
