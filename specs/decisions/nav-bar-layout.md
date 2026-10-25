# nav-bar: where the bar sits on /

**Context.** The spec: "/ keeps its layout … If the bar needs room, it takes the top edge." The select is one screen
with no scroll. Its top padding is 4vh (28.8 px at 720), song-options' fit check leaves 14 px at 1280, and two things
already reach into that band: the wordmark's É, which rises about 11 px above its box on the left, and the build stamp
(`top: 12px; right: 12px`).

**Options.** A: fixed in the band, centered. B: in flow above the page, which pushes the select down 4vh and fails
its fit checks. C: fixed and left-aligned, which runs into the É. D: fixed and right-aligned, which runs into the
build stamp.

**Choice.** A. The bar is `position: fixed` at the top, 4vh tall and centered, so the wordmark and the build stamp
stay clear. It has no ground: the bar is text over the page's own band. The labels are `MonoLabel` at
`clamp(11px, 1.5vh, 16px)`. The bar is hidden under capture, so the video's 16 px floor doesn't bind it.
`verify-nav.mjs` fails if the bar's box overlaps the wordmark as drawn or the build stamp, at 1280 and 1920.

**How to undo.** Change `.bar` in `web/src/game/nav-bar/nav-bar.module.css`.
