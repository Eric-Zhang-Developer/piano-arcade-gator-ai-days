# flow-mode: how the clock learns the player's tempo

**Context.** The spec says `rate` updates after each played onset from `chartΔ / wallΔ`, smoothed over the last 4
onsets "(a mean, or an EMA the worker picks and logs)", then clamped to 0.5–1.3.

**Options.** (A) Mean of the last 4 samples. (B) An EMA with α = 0.4, about 4 onsets of memory. (C) Either, with
each sample clamped to 0.5–1.3 before it's smoothed.

**Choice.** A with C's per-sample clamp. The mean forgets a sample completely after 4 onsets, so one fermata or a
stumble stops counting at a known point; an EMA never quite lets go. Clamping each sample too means two onsets struck
almost together (a wallΔ near 0, a sample in the hundreds) count as 1.3, not as a spike that drags the mean for 4 notes.
A sample's wallΔ leaves out hold time past the 2 free beats, so a stop isn't read as a slow tempo.

**Also.** Until the first sample exists there's no tempo to judge steadiness by, so the first two onsets are PERFECT
(unless `?tempo=` gave the starting tempo, which is then the reference from the second onset on). `seek` (a rewind)
starts the tempo over from the next played onset.

**How to undo.** `flowSettings.tempoOnsets` and the `samples` mean in `web/src/game/flow-mode/clock.ts`'s `played()`;
drop `clampRate` around each sample to smooth raw samples.

**The readout's percent** is of the song's own tempo: with `?tempo=70` bar-loop has already slowed the chart to 70%,
so the readout shows `tempo × rate` (rate 1.0 there reads 70%), while the bpm is the slowed chart's bpm × rate, the
tempo you're actually playing. Undo: `tempo` in `flowMode()`'s draw in `web/src/game/flow-mode/index.tsx`.
