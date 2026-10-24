## What shipped
Demo mastery-map home with Theory/Procedure views and contextual skill actions; Learn/Review hubs explicitly enter four resumable local sessions. Shared Eric typography, dark notation and restrained top navigation preserve the session workflows.
## Where it lives
`web/src/learn/frontend/` (including `graph/`), `web/src/app/learn/`; route/source mapping: `specs/features/learning-ui/{spec.md,DESIGN.md}`.
## How to check it
not verified by `verify.py`: its headless game command conflicts with the visible-Chrome policy. Lint/typecheck, 616 tests (one existing skip), build and repository checks pass. Visible Chrome on `http://localhost:3043/learn`: all five supported graph actions reach the correct contextual hub; unsupported skills do not launch, keyboard selection/tabs work, actions fit both desktop sizes, reload console is clear. Real Resume, explicit repeat and all-four offline flows pass. Final duplicate copy removal passed targeted lint.
## Gaps
Desktop/local demo only; graph colors/goal are fictional inputs, not measured mastery or a universal validated curriculum. No native pointer gesture or independent reading-position restoration test. Some background full-viewport captures omit glyphs; focused captures confirm actual header/inspector rendering. No account sync, piano capture, live inference, AI grading or mobile verification.
