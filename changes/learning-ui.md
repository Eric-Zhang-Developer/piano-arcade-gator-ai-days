## What shipped
Clearer 2D graph captions with the same fonts/sizes and restrained paint, weight and spacing. Prepared Start/Resume keeps target captions anchored continuously while unrelated labels fade, eliminating reproduced side jumps/detail popping. Top-left guide, mastery styles, camera target/timing and four activities remain intact.
## Where it lives
`web/src/learn/frontend/graph/` caption projection, rendering/CSS and regression tests; existing learning-ui spec/design. No 3D changes.
## How to check it
not verified by `verify.py` (headless game command conflicts with visible-Chrome policy). Current scoped lint/typecheck, 15 graph cases, type scan and repository checks pass. Visible CFT at 1440x900/1280x800 confirms static fit and actual 44/43-frame traces with one constant target-caption offset, centered arrival and correct activity. Submitted answer/feedback survives Resume; focused offline entry interruption passes. Prior full 625-test/build checkpoint is d8794f5, not rerun for this bounded refinement.
## Gaps
Local preview 3043 only, no publication/CI claim. Reduced-motion branch, native drag and actual hidden-tab idle remain unverified. Fictional distribution/fixture state, no connected inference. Desktop only. An attempted flight still captured the post-route lesson and is labeled as such; actual motion evidence is the frame trace.
