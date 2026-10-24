## What shipped
Four links grouped Learn (Theory, Practice) and Review (Theory, Practice); Spark question/material workspace; shared arcade palette, Saira titles, cyan actions and magenta focus, preserving existing activity behavior.
## Where it lives
`web/src/learn/frontend/`, `web/src/app/learn/`; source authority and design mapping in `specs/features/learning-ui/DESIGN.md`.
## How to check it
not verified by `verify.py`: its game command hardcodes headless Playwright, prohibited by the visible-Chrome policy. Lint, typecheck, 508 tests (one existing skip), build and repository checks pass. Visible Chrome AXI at `http://localhost:3043/learn`, 1440x900 and 1280x800: navigation DOM, pane bounds/focus, answer/history/reference state and all four `offline.browser.mjs` recovery flows pass.
## Gaps
Desktop only; no native pointer gesture or independent reading-position restoration check. Two bounded background screenshot batches omit some rail text on Practice/Review despite visible in-bounds DOM; full visual pass remains unresolved in the private task report. No account sync, student model, MIDI capture, AI grading, adaptive curriculum or mobile verification.
