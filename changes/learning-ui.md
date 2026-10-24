## What shipped
Reference-led mastery-map home: full-width unselected overview, six organic hubs/domain, meaningful descendant fans, curved backbone, deeper previews, camera controls and selection-only details. Contextual actions preserve the Learn/Review hubs, real local Resume, shared Eric fonts and dark notation.
## Where it lives
`web/src/learn/frontend/graph/{data,layout,projection,MasteryGraphHome,graph.module.css}`; learning routes/session state and source/design/validation remain in the existing learning-ui feature.
## How to check it
not verified by `verify.py` (headless game command conflicts with visible-Chrome policy). Current scoped lint/typecheck and6graph tests pass. Visible CFT on `http://localhost:3043/learn`: both domains at1440x900/1280x800 inspected against the reference; corrected Procedure captions have zero satellite overlaps; pan/zoom/detail reveal/Fit/close, keyboard and all5 contextual actions pass, console clear. The prior full suite/build passed before this renderer replacement and were not rerun for this preview checkpoint.
## Gaps
No publication/CI claim. Native pointer dragging remains untested under the background DOM-only policy; keyboard pan is verified. Data/learner/goal are illustrative; world z=0 is model separation, not a3D renderer. No account sync, piano capture, live inference, mobile testing or universal-curriculum claim. Some background viewport captures omit text; focused captures establish actual glyph rendering.
