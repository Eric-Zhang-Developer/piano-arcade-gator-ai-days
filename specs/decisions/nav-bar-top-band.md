# nav-bar: one top band

**Context.** Eric, 2026-10-25: "The nav bar is so ugly. It needs a work pass." At about 2000 px the links floated in
the 4vh band above `/`'s wordmark (no shared baseline), GitHub was a sixth link, and the build stamp, the Lights
button (fixed at right 160, top 38) and Controls stacked in the top-right corner, Lights over Controls' "?".

**Options.** (A) Drop the links into `/`'s wordmark row: they would jump between pages, and on `/lab` or `/simon` they
would land on the page's own title row. (B) Raise `/`'s header into the band, at the links' size. (C) Leave the rows
and only respace the corner.

**Choice: B.** The band is the same on every page (`max(min(4vh, 2.25vw), 24px)`), so the bar never moves. On `/` the
select's header is that band: the wordmark at the links' size and on their baseline, the build stamp and Controls in
its right end (the stamp passed in from `page.tsx`, in flow, so the gap is set), and room for the Lights button,
which the nav bar's CSS pins to the band's far right at a fixed width on every page. The select gains the old
header's height for the list. GitHub became a corner mark (spec).

**Why Lights is placed from nav-bar.module.css.** #1364 is open on `web/src/game/leds/everywhere.tsx`, so this pass
doesn't edit it: a `.bar ~ [data-testid="lights-everywhere"]` rule overrides its inline top and right with
`!important`. When that file is next free, its inline `top`/`right` can go and this rule can move there.

**How to undo.** Revert the PR: the select's header, the stamp's fixed corner and the inline Lights position come back.
