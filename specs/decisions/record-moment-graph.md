# record-moment: the take graph on a NEW RECORD take

**Context:** the spec puts the moment above the take graph in the results' first view, and says that if the graph no
longer fits beside the moment, a NEW RECORD take moves the graph to the details for that take only. With both
featured, verify-moment at 1280×720 found Retry's bottom edge past the fold; 1920×1080 had room for both.

**Options:** (A) a NEW RECORD take features the moment alone at every size; (B) only below some window height, by
media query or measuring; (C) shrink the graph on NEW RECORD takes.

**Choice:** A. One rule, testable without a window size, and the graph is one scroll away in the details. B makes the
first view depend on the window in a way no check pins; C changes take-graph, another feature's panel.

**How to undo:** drop `newRecordFeatured` in `web/src/game/results-layout/index.tsx`, so `featured` applies to every
take.
