# note-pills: dim by alpha over black, linear ramp, head dims too

**Context:** the spec sets brightness's ends (35% at the top of the lookahead, 100% at the line) but not the curve,
how to dim a color, or whether the flare head dims.

**Options:** a linear or eased ramp; mixing a darker color or alpha over a black underlay; a head always at full
white or dimmed with its note.

**Choice:** linear (the smaller option; one line). Alpha over a black underlay, so fills stay the hand's exact token
(hand-colors' tests hold) and the stage behind never tints a far note. The head dims with its note, so far notes
don't carry bright white caps and the head turns white-hot only at the line, as visual-direction describes.

**How to undo:** change `brightness` in `web/src/game/note-pills/index.ts` for the curve; in core's `drawHighway`,
reset `globalAlpha` before the head to keep it full white.
