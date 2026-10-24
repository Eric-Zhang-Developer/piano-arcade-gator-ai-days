## What shipped
Reference-led graph home and a compact gator companion: one existing-policy suggestion, goal-based reason and Try it action to the correct contextual hub. The guide quietly marks its node, collapses, and yields to selection/camera exploration; fonts, dark scores, hubs and real local Resume remain intact.
## Where it lives
`web/src/learn/frontend/graph/` (including `GraphCompanion.tsx`/`companion.module.css`), layout-owned UI state and `web/public/learning/companion-gator.svg`; requirements/source mapping in the existing learning-ui spec/design.
## How to check it
not verified by `verify.py` (headless game command conflicts with visible-Chrome policy). Current scoped lint/typecheck,6graph tests and repository checks pass. Helper visible CFT on `http://localhost:3043/learn`: both domains1440x900/1280x800 fit; targets, hide/reopen, selection/zoom/keyboard-pan suppression, Fit restoration and correct Try it hubs without implicit session start pass. Final copy-only correction passed targeted lint. No fresh full suite/build/CI claim for this preview increment.
## Gaps
No publication. Reduced-motion CSS/media listener is implemented but its branch was not emulated/tested; no OS preferences changed. Native pointer dragging and hidden-tab idle behavior were not driven. Companion uses fictional demo graph inputs, not autonomous AI or a new policy/backend. Desktop only; broader agent-led navigation remains a product decision.
