## What shipped
Four direct links grouped as Learn (Theory, Practice) and Review (Theory, Practice), with stable URLs. Theory adopts current Spark's flat 40/60 workspace, persistent focus, scrolling answer history, pinned response and resizable independent material pane.
## Where it lives
`web/src/learn/frontend/`, `web/src/app/learn/`; requirements and source mapping: `specs/features/learning-ui/{spec.md,DESIGN.md}`.
## How to check it
not verified by `verify.py`: its game command hardcodes headless Playwright, prohibited by the visible-Chrome task policy. Lint, typecheck, 508 tests (one existing skip) and build pass. Visible Chrome AXI at `http://localhost:3042/learn`, 1440x900 and 1280x800: grouped navigation, answer/feedback progression, fixed answer/focus, keyboard pane bounds, independent material selection and Review reference gates; `offline.browser.mjs` passes all four activity recovery flows.
## Gaps
Desktop only; pointer dragging is implemented but no native pointer gesture was driven under the DOM-only browser policy. No account sync, student model, MIDI capture, AI grading, adaptive curriculum or mobile verification. Supplemental material reading-position evidence is pending; no failure in product behavior is established.
