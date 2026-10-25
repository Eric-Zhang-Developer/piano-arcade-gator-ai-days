# led-game: colors and when the button shows

**Context.** The spec says hits use the HUD's judgment colors and misses flash red. The HUD's MISS color is a dusty
pink (`#c98a9a`). Hint colors aren't specified.

**Options.**
1. Miss in the HUD's MISS pink: matches the HUD, but at strip brightness it reads like a hint.
2. Miss in the HUD's wrong-note red (`#ff4d5e`): red, as the spec says, and still a HUD color.

For hints: the tester's fixed cyan, or the note's hand color.

**Choice.** 2, and hints in the note's hand color (the highway's) at half brightness, so a hit's full color reads
over them. "Connect lights" shows on every start screen, including without Web Serial, where it says so (the spec's
words). At 1280×720 its row pushes the start screen's last line (MIDI status) about 15 px below the fold. The fix
belongs to the start screen's layout (one row of small toggles), not to this feature.

**How to undo.** `judgedKey` in `web/src/game/leds/messages.ts` picks the miss color, and `ledSettings.hintLevel` plus
`hintsAt` pick the hint color.
