# song-options: where Hands and Speed fit, and how big

**Context.** The spec puts `<SongOptions />` in the preview panel under its row. Since #492 the left column ends in an
in-flow footer (Options, first-run's link), so the panel can't run under it. Instead a column too tall for the screen
shrinks the focused song: the title, which clips its overflow, was cut in half. Hands and Speed add two rows, and
Moonlight (a two-line title, both hands) was squeezed by 50px at 1280×720 and 31px at 1920×1080.

**Options.** (A) Hide the source or status line while options show: drops song-sources' proof or the device line.
(B) One row for Hands and Speed: needs ~540px, the left column is ~510px at 1280. (C) Smaller option buttons, and the
jacket and two margins give back the rest.

**Choice.** C. Option buttons are a size smaller than the level toggle (13–20px type), so the practice line stays on
the Speed row. The jacket goes 38vh → 30vh; the title and stats margins 3vh → 2vh. verify-options checks every song at
both sizes: nothing squeezed (flex-shrink off changes no height), the preview above the footer, the footer on screen,
no page scroll.

Also not in the spec: H and ← → show as small key caps beside the labels, like the select's hint line keys; the
hint line itself is unchanged.

**How to undo.** Revert the select-layout CSS commit and set the option buttons' `fontSize` back to the level
toggle's; then the focused song's title is squeezed again unless something else gives way.
