## What shipped
Eric's shared Saira hierarchy, dark notation panels and two-link top navigation; overall home plus Learn/Review hubs explicitly enter four sessions. Resume retains actual local answers, history, material and practice settings; completed sessions can explicitly restart.
## Where it lives
`web/src/learn/frontend/`, `web/src/app/learn/`; route and source authority: `specs/features/learning-ui/{spec.md,DESIGN.md}`.
## How to check it
not verified by `verify.py`: its headless game command conflicts with the visible-Chrome policy. Lint/typecheck, 508 tests (one existing skip), build and repository checks pass. Visible Chrome AXI on `http://localhost:3043/learn`: Home/Start/progress/Resume preserves real theory state; practice tempo survives hub navigation; audio/count-ins cancel; completed Review resets explicitly; all-four offline recovery passes. Desktop metrics at 1440x900/1280x800 show no overflow, bounded actions and white SVG notation text.
## Gaps
Desktop/local preview only. No native pointer gesture or independent reading-position restoration test. Background full-viewport captures intermittently omit text; an element-only capture confirms actual glyph rendering. No student model, account sync, piano capture, AI grading or mobile verification. Current simple overall home is an intermediate checkpoint before the separately authorized demo mastery graph.
