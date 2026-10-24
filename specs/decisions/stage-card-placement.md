# Stage card: placement and Start

**Context.** `startPanel` renders below the start screen's title, hint and Start button, and `PanelContext` has no
`start()`, so the card can't own a Start control of its own.

**Options.** A: add `start()` to `PanelContext` (a `contract:` PR) and put Start inside the card. B: leave the card
where slots render, under the controls. C: the card's own CSS moves its slot first in the overlay (`order: -1`), and
the page's Start stays the one Start.

**Choice.** C: smallest, no contract change, and the card leads the screen. The page's own `<h1>` title then repeats
under the card; a `fix(core-loop)` drops it.

**How to undo.** Delete the `:global([data-testid="slot-stage-card"])` rule in `stage-card.module.css`.
