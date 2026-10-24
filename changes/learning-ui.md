## What shipped
A scoped Next.js desktop learning frontend with Understand, Practice, Theory review and Play-through; preview takes are visibly illustrative.
## Where it lives
`web/src/app/learn/`, `web/src/learn/frontend/`; requirements: `specs/features/learning-ui/spec.md`.
## How to check it
`pnpm -C web lint`, `typecheck`, `test` (119 tests) and `build`; visible Chrome at `http://localhost:3041/learn`, 1440x900 and 1280x800, all four actions visible with no horizontal overflow.
## Gaps
No account sync, student model, MIDI capture, AI grading, adaptive curriculum or mobile verification. Repository `verify.py` is not run because its configured game verifier hardcodes headless Playwright; task policy requires visible Chrome AXI. Learning routes were verified there instead.
