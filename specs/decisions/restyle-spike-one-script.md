# restyle-spike: the four runs as one script

Context: the spec's plan runs the restyles one at a time from a worker's session, writing each chart.
Options: the session writes each chart by hand / the session writes a script, one function per style.
Choice: one script, `spikes/restyle/restyle.py`. It makes a run repeatable, and its rules (the warp per style, the
chord picker) are readable, so a reviewer can check them where a hand-typed chart would hide them. The runs still went
in order, each checked by the restyle and library tests.
How to undo: delete the script; a hand-written chart under `web/public/songs/local/<id>/` passes the same tests.
