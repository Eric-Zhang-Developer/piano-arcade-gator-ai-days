## What shipped
A skip during results-landing's cut lands NEW RECORD and the initials on the next frame (#1334). Only a primary click's swallow eats Retry, so a right press no longer does (#1335). The out from T0 to the mount refuses Esc and hides the pause button (#1336).
## Where it lives
`web/src/game/results-landing/` (`index.ts`, `timeline.ts`, `timeline.test.ts`, `verify-landing.mjs` steps 8–9), `specs/decisions/landing-skip-seams-pause.md`.
## How to check it
`verify: node web/src/game/results-landing/verify-landing.mjs` FAILs its 3 new lines on origin/main's results-landing and passes on the branch, both run locally under verify.lock (lines in the PR).
## Gaps
After a skip, the drumroll and rank hit still sound at their planned time (`sound/index.ts`, accepted by the spec). No reduced-motion shot: the in-app pane can't emulate it. verify-landing's reduced-motion step covers it in CI.
