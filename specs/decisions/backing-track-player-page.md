# backing-track: the band player page's two calls the spec doesn't make

## 1. `between()` takes `untilMs`
**Context.** The spec's `between(events, fromMs, toMs, { tempo, seekMs, passMs, passes })` plays file time from
`seekMs` for a whole `passMs`. But a loop's pass includes the one-bar gap, and the segment ends at bar `to`'s end.
Without an end in file time, a pass would play the gap bar's band notes too.
**Options.** A: an optional `untilMs` (the segment's end in file time, default no end). B: the plugin filters the
result itself.
**Choice.** A. It's one bound in the same loop, so the page and the plugin can't disagree about where a segment stops.
**Undo.** Drop the option and filter in the plugin.

## 2. The page mutes channel 1 by default
**Context.** The spec says the page plays "every channel of the file". The plugin skips channel 1 entirely, and the
planner asked for the page to match by default.
**Options.** A: `?mute=` defaults to `1`, and `?mute=` alone plays every channel. B: every channel by default.
**Choice.** A. The page is how Eric hears what the game will play, so it should sound like the game. A Flower Dance
file with its piano on channel 1 then needs no minus-piano copy.
**Undo.** Default `MUTE` to empty in `spikes/band-player/player.mjs`.
