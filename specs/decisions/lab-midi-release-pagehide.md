# lab-midi-release: the bot demo's pedal on leaving (#1313)

**Context.** A bot demo (`scenes/index.ts`) sends the score's pedal-downs. Leaving mid-pedal, by a reload, a link or
demo-reset's Shift+Esc, left the DGX's sustain held. The spec offers two routes: `scenes/index.ts` registers `pagehide`
-> `cancel()`, or pedal-up joins demo-reset's silence. #600 (draft) holds `scenes/index.ts`.

**Options.** A: wait for #600. B: demo-reset's `reset()` sends pedal up beside its All Notes Off, now and after the
repeat, through composers-hands' `silence()`. C: both.

**Choice.** B now. Shift+Esc, the demo's own escape hatch, and the 60 s idle return both go through `reset()`, so they
let the pedal go. A plain reload or a link away from a bot demo still leaves it down: that path is `scenes/index.ts`'s
`pagehide`, and it waits for #600 to free the file.

**How to undo.** Revert the `reset()` change; the old All Notes Off pair comes back.
