# video-cards: the title's motif, its rhythm and the cut point

Context: the spec plays the title as Étude's cipher motif and leaves the rhythm, register, accent and cut to the worker.
Every value is in `titleSettings` (`web/src/game/video-shots/motif.ts`); undoing one is changing it there.

| Choice | Taken | Why, and the alternative |
|---|---|---|
| Pitches | E F G D E from the 1909 French cipher (name-theme's `FRENCH`), the accent stripped by `fold` | The spec's; a unit test pins it to the cipher. |
| Register | E4 first, each next note the nearest pitch of its class: E4 F4 G4 D4 E4 (64 65 67 62 64) | Mid-keyboard on the DGX and the laptop voice; the alternative (all up from E4) puts the D a seventh above and the line stops reading as one gesture. |
| Rhythm | 100 bpm; beats 0, ½, 1, 1½, 2½: four quavers to the D, the last E a crotchet later | The held gap before the last E makes it the resolution, which is where the accent belongs. |
| Start | 450 ms of black before the first note | Room for the cut in; under 0.5 s so the card isn't dead air. |
| Accent | The É's acute and the burst land on the last note, 1950 ms | The name is only spelled right once the motif resolves. |
| Tagline | The next downbeat, beat 4 (2850 ms), rising over 400 ms | On the beat, not on a note, so it reads as the answer to the motif. |
| Cut point | Still from 3550 ms (300 ms after the tagline lands) | Under the spec's 4 s; a unit test checks it. |
| Reduced motion | Every part shown at once; the motif still plays on its schedule | The sound carries the timing; only the travel is dropped. |
