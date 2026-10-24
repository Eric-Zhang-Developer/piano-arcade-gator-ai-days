# song-options: where Hands and Speed fit, and how big

**Context.** The spec puts `<SongOptions />` in the preview panel under its row. At LevelToggle's size the two button
rows, plus the practice line wrapping to a third, pushed the preview's source and status lines into the first-run
link and Options at 1280×720. Moonlight (a two-line title, both hands) is the tightest song.

**Options.** (A) Hide the source or status line while options show: drops song-sources' proof or the device line.
(B) One row for Hands and Speed: needs ~540px, the left column is ~510px at 1280. (C) Smaller option buttons, and the
jacket and two margins give back the rest.

**Choice.** C. Option buttons are a size smaller than the level toggle (13–20px type), so the practice line stays on
the Speed row. The jacket goes 38vh → 28vh; the title and stats margins 3vh → 2vh. verify-options measures every
song: 12px clear at 1280×720 (Moonlight), 74px at 1920×1080.

Also not in the spec: H and ← → show as small key caps beside the labels, like the select's hint line keys; the
hint line itself is unchanged.

**How to undo.** Revert the select-layout CSS commit and set the option buttons' `fontSize` back to the level
toggle's; then the panel overlaps the footer again unless something else gives way.
