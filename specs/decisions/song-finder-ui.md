# song-finder: small choices the spec doesn't make

**Context.** The spec fixes the three sorts, the filter rule, the storage keys and the focus rule. These are the
smaller calls made while building the finder row, each the smaller reversible option.

- **A count beside the box** ("20 songs", "3 of 20"): the filter's effect reads at a glance, with no extra row.
- **No match keeps the panel:** the left panel keeps the last focused song instead of going empty (round 1 of the
  design pass: an empty panel left most of the screen blank). The no-match line sits in a row-sized hairline frame.
- **Hover doesn't take focus from the search box:** the list's P, L and W act on whatever has focus, so a hover
  mid-word would have turned the next typed letter into a shortcut.
- **↓ from the search box** goes to the first song shown, so the list is reachable without the mouse.
- **The finder wraps the list column** instead of joining the select's grid, so the layout and the list's own
  scrolling are unchanged. The list's first row now sits under the finder row, which lines up with the panel's top
  bracket; before, the first row lined up with the panel's top.

**How to undo.** Each one is a few lines in `web/src/game/song-finder/Finder.tsx`, `finder.module.css` or the finder
lines in `web/src/game/select-layout/index.tsx`.
