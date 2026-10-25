# musicbox-polish: one rule for both toggles

**Context.** #1200: the crank showed "Stop" with `aria-pressed="true"` (a label naming the action plus a pressed state
that says the opposite), and the row jumped because "Stop" is narrower than "Turn the crank".

**Options.** (A) Labels name the action, no `aria-pressed`. (B) Fixed labels ("Crank", "Macro") with `aria-pressed`.

**Choice.** A, for both buttons: a screen reader hears what a press will do, which is what the sighted label says.
Each button holds both labels in one grid cell and hides the idle one (`visibility`, so it leaves the accessible name),
so it keeps its longer label's width and the row never moves.

**Audio (#1199).** One `AudioContext`, made on the first crank, reused by every crank, closed when the page unmounts
(`crank-audio.ts`).

**How to undo.** Revert `Toggles` in `web/src/game/x/pinned/Pinned.tsx` and the `.swap` rules in `pinned.module.css`.
