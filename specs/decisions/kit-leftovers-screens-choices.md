# Kit leftovers on whole screens: what the spec didn't settle

Feature: `kit-leftovers-screens` (#1133, #1134, #1136). Each undoes in one file.

## Cleared pips are dim ink, not cyan
- **Context:** the spec makes the current pip `--pa-primary`. `--pa-cyan` is now primary's alias
  (`app/globals.css:16`), so cleared pips (cyan) and the current one were the same blue, told apart only by width.
- **Choice:** cleared pips `--pa-ink-dim`; current primary and wider; the rest stay faint (shots `chunk-pips-*`).
- **Undo:** `.pips li.done` in `chunk-practice.module.css`.

## The chunk panel sizes from the results' `--read`
- **Context:** `kitButton` sets 14 px inline. The results action row below the panel reads at `--read` (13 px at
  1280, 24 at 1920, results-layout), so at 1920 Next was the smallest button on the screen. results-layout is held
  by #600.
- **Choice:** the panel's links, verdict, CLEAR and meter scale from `--read` in chunk-practice's own CSS
  (`!important` over the inline 14 px), with fallbacks for any page without it.
- **Undo:** the `.after a` rule and the three `calc(var(--read …))` values.

## The way on keeps a `:focus` ring
- **Context:** Next takes focus from code after a take and Enter follows it. The old `.next:focus` glow showed that;
  the kit's ring is `:focus-visible` only, which code focus after a mouse click doesn't trigger.
- **Choice:** `.after a:focus` draws the kit's ring (2 px ink, offset 2).
- **Not seen in the shots:** the in-app browser pane was hidden, so the document had no focus and `:focus` couldn't
  match.

## Play anyway is the kit's secondary button
- **Context:** the spec names the card and the wordmark; the round-1 shot left a system-font outline box as the one
  button off the kit, and Validation (a) needed its 999 px radius gone anyway.
- **Choice:** `kitButton("secondary")`, kept 44 px tall for a thumb. Same words; the kit sets them in caps.
- **Undo:** the button's className and style in `phone-guard/index.tsx`.
