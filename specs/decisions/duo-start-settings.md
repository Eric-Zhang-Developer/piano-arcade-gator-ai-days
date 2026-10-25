# duo-start: the start screen's settings and key hints

**Context.** Eric looked at the start screen on 2026-10-25 (relayed on #763): "so many random sliders there that don't
need to be there. They could be like options or a settings gear". The spec also gained "no key hints on the screen"
(#772, plan #776) after this PR was built.

**Options.** (A) A second settings drawer for /play. (B) The select's Options drawer (`options-panel`), reused. (C)
Delete the hint and labels start panels from their plugins.

**Choice.** B. The start screen keeps Start, the four modes, the hands and an Options button. Latency, effects, piano
volume, Mute, Miss sound and labels are the drawer's own rows. Connect lights (leds' start panel) and the MIDI status
go in as children. On /play the drawer takes `keys={false}`, because O is a laptop piano key there; this also removes
its O badge. It also takes /play's `onLatency`, so the next take uses the new offset. note-labels re-reads the stored
setting at `songStart`, so a label picked in the drawer applies when Start is pressed.

The `note-labels`, `laptop-octaves` and `rewind` start panels aren't shown: `StartScreen` lists them as hidden. Their
code stays, because their own specs (rewind, laptop-octaves) still describe the hints. Deleting them (C) is that
feature's change, through mouse-first or a plan PR.

**How to undo.** Move an id from `groups.hidden` back to a shown group in `StartScreen.tsx`, or render the old
`controls` in place of the drawer.
