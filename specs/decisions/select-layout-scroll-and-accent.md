# select-layout: the focused card stays centered, and magenta means only "here"

**Context:** the spec says moving the focus keeps the focused card in view; it doesn't say where, or what color the
wordmark is.

**Options:** scroll `nearest` (the card hugs the list's edge) or `center` (the list moves under a steady cursor);
a magenta wordmark or an ink one.

**Choice:** `center`, like an arcade music wheel: the songs around the focused one stay visible both ways. The list's
edges fade so a cut card reads as "more". The wordmark is ink, because a magenta wordmark competed with the focused
card's magenta frame (visual-direction: one loud thing at a time).

**How to undo:** `block: "nearest"` in `index.tsx`; `color: var(--pa-magenta)` on `.wordmark`.
