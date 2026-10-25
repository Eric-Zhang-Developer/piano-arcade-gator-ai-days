# jam-mode-spike: only a struck key renames the chord

**Context.** The spec names the chord from the held pitches but doesn't say when to rename. Renaming on every MIDI
message would rename on releases too: lifting a hand off C E G passes through E G, which `nameChord` names Em, and
the band would follow that false chord whenever it landed on a beat. eric-agent-3, 2026-10-25.

**Options.**
- (A) Rename on every change to the held set.
- (B) Rename only on a struck key; releases and pedal-up keep the last chord.
- (C) Rename after a settle window on any change.

**Choice: B.** It's the smaller rule and matches how a band hears a player: a new chord starts when keys go down. C
also covers rolled chords (E before C), which B doesn't; the findings name it for phase 2 rather than building it here.

**How to undo.** In `spikes/jam-mode/index.html`, rename whenever `held.message()` returns anything truthy.
