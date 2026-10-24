# sheet-view: the page's Look (PR 1)

Context: the taste step-8 Look, done at 1280×720, 1920×1080 and a 560-wide popup.

- **Edges.** OSMD's own page margins put the brace 27 px right of the title. Choice: OSMD's left margin is 2 units,
  enough for the brace, and its right margin is 1 unit, since at 0 a system's last barline clips. The page's padding
  sets both edges. Undo: delete the two `EngravingRules.Page*Margin` lines in `SheetView.tsx`.
- **Default zoom.** At 1920 and 100%, Twinkle filled one thin system and left most of the screen empty, too small to
  read from the bench. Choice: with no zoom stored, the zoom is the window width ÷ 1280, at least 100% (150% on a
  1920 monitor). A zoom chosen with − or + is stored and wins. Options weighed: a fixed 150%, which is too big in a
  small popup. Undo: return `1` from `loadZoom`'s fallback.
- **Color.** Music in `--pa-ink` on `--pa-bg`. Magenta appears only in the header's hairline and the focus ring:
  the score is for reading, not cabinet chrome.
