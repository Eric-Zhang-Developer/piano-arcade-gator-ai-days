# laptop-octaves: how the highlight is drawn

Context: the spec asks for a `--pa-cyan` bar along the mapped keys, with Z and X at its ends, and leaves where it
sits and how it reads to the build.

Options: (A) a thin bar at the keyboard's bottom edge; (B) A plus a faint cyan wash rising over the mapped keys;
(C) a bar along the judgment line.

Choice: B. In the first Look round, A alone read as a page edge, not as "these keys". C sits where hits flare. The
wash is at 22% opacity over the lower 45% of the keyboard, under note-labels' letters, so they stay readable. Z and X
are chips just outside the bar's ends, clamped on screen, in the display face at 16 px at 1280 and 24 px at 1920.

How to undo: delete the wash block in `drawBar` (`web/src/game/laptop-octaves/index.tsx`).
