# select-motion: the bar, the panel, the header settle, Find, and which moves sound

**Context.** The spec names the moves (the bar, the panel's crossfade, a chip's header settle, Find's reflow) but not
their numbers, nor which causes play the move sound.

**Choices.**
- **The bar** is drawn over the rows (`pointer-events: none`), not under them, because the rows' kit panels are
  opaque. It repeats the old focused-row look: a primary hairline, a 7% primary wash and a 4 px primary edge. So
  `SongRow` drops its own, and the still look is unchanged.
- **The panel** stays mounted (no `key`) and plays a fade from 40% with 6 px of travel the way focus went: ↓ comes in
  from above, ↑ from below. It runs 220 ms on the spring's curve. A true crossfade needs two copies of the panel. A
  held key doesn't animate it; key-up plays it once. The preview and the level toggle are still keyed per song, so
  song-preview's 400 ms wait is unchanged.
- **The header settle:** the chip's section header rises 6 px from 50% opacity over 320 ms as the list lands on it.
- **Find:** rows that stay glide over 180 ms on the spring's curve, as a CSS `linear()` easing at ω 40, so under 1% is
  left at 180 ms. Rows that arrive fade in over 120 ms, and rows that leave cut. The glide animates `translate`, so it
  composes with the bar's transform. The bar glides from its row's old place, so the highlight never sits empty
  mid-reflow; round 1 of the look loop caught that. Each keystroke starts the glide again from where the rows are.
- **Sound:** keys, held keys and chips play the move note, as they did. Hover and Find stay silent, as they did.
- **Reduced motion:** the bar and the scroll cut, the panel and the header don't animate, and Find doesn't reflow.

**How to undo.** `panelFrames` and `headerFrames` in `motion.ts`, and `flipSettings` in `flip.ts`. Putting the
focused look back on `SongRow` and removing `<FocusBar>` returns the old highlight.
