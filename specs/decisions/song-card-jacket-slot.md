# song-card: how the jacket gets into the card

**Context:** the spec reserves a square on the left for `song-jacket` but doesn't say how it gets there.

**Options:** A) an optional `jacket?: ReactNode` prop that fills the slot; B) song-card imports song-jacket itself.

**Choice:** A. song-card stays independent of song-jacket (neither depends on the other in `milestones.toml`), and
select-layout, which uses both, passes the jacket in. Empty, the slot is a faint square so the layout doesn't jump.

**How to undo:** drop the prop and import the jacket inside `SongCard`.
