Read test truth, from each chart at the capture's chart time (window.__pianoArcade.now()), written before any reader saw a frame.
Visible: notes starting within the 2000 ms lookahead, plus notes being held. Chord: 2+ visible notes starting together.
Long: a visible note of 1 beat or more.
a before fur-elise   t=9002   chords 2  long 1
d after  fur-elise   t=9001   chords 2  long 1
e before maple       t=5251   chords 12 long 4
b after  maple       t=5254   chords 12 long 4
c before moonlight   t=18253  chords 3  long 7
f after  moonlight   t=18250  chords 3  long 7
Right: both counts within ±1.

Answers (fresh subagents, one frame each, told to glance for about 5 s; never shown the truth or the spec):
a before fur-elise   chords 1  long 1   right
d after  fur-elise   chords 1  long 1   right
e before maple       chords 9  long 11  wrong (chords -3, long +7)
b after  maple       chords 9  long 4   wrong (chords -3; long exact)
c before moonlight   chords 3  long 4   wrong (long -3)
f after  moonlight   chords 2  long 4   wrong (long -3)
Before 1/3, after 1/3: neither passes the 3/3 bar.
