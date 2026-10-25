# harmony-map: reading chords

Context: the spec leaves the window and the confidence threshold to the worker (`web/src/game/x/harmony-map/chords.ts`).

| Choice | Taken | Why, and the alternative | How to undo |
|---|---|---|---|
| The namer | jam-mode's `nameChord` ported into `chords.ts`, its score (matches − missing − extra) the confidence | The spec's. It's outside `web/`, so a port, credited in the file. | — |
| A triangle | Only when the namer picks a major or minor triad with score ≥ 2 and it's the only full triad present | Score 2 lets one extra note through (C E G D), not two. Two full triads (a major seventh) or a seventh the namer names as such light nodes only: guessing the triad inside would draw harmony the music doesn't commit to. | `chordSettings.minScore` |
| A chart's sounding set | At each strike: notes still sounding, plus notes struck in the beat up to it; a note released while the pedal is down sounds until the pedal's up | The beat back adds up an arpeggio (Moonlight's triplets); counting notes that merely *ended* in the window would merge each block chord with the one before (I–IV–V–I read as two triads at every change). | `chordSettings.windowBeats` |
| Live window | 350 ms of recently struck keys, plus keys down and pedal-held | 600 ms merged chords played two a second; 350 ms still gathers a rolled chord. | `chordSettings.liveWindowMs` |
| Renaming | Only a struck key renames (decision `jam-mode-spike-rename`) | A hand lifting off C E G passes through E G (Em). | — |
