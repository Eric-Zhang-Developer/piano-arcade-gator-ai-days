# build-stamp: top-right, not bottom-right

**Context.** The spec puts the stamp bottom-right unless it overlaps a song card there. It does: the music select's
list runs off the bottom edge, and its last visible card (Für Elise) sits under the stamp at 1280×720 and 1920×1080
(`verify-stamp.mjs` flagged `song-fur-elise` at both).

**Options.** A: top-right, 12 px from both edges, above the `↑ ↓ choose` hint. B: bottom-right with a backing panel.
C: shrink the list.

**Choice.** A, the spec's default. No panel (the spec wants none), and the list is song-select's.

**How to undo.** Swap `top` back to `bottom` in `build-stamp.module.css`.
