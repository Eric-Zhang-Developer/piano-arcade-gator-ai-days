# Pinned: fit mode doesn't ship

Feature: `pinned` (#1171). The spec allows a fit mode that folds the take onto a real movement's teeth, but only with a
cited tooth list (the movement, its maker's or a published list, with the URL), and says it never invents one.

- **Context:** no cited tooth list was found for a named movement in this build. Writing one from memory would be
  inventing data.
- **Choice:** fit mode doesn't ship. `fit()` in `cylinder.ts` takes a `Movement` with its `source` and throws
  "fit mode needs a movement with a cited tooth list" without one (tested). The page has no fit control; the comb is
  the virtual one, one tooth per pitch in the take.
- **To add it:** put a `Movement { name, source, teeth }` with its URL here, and wire a control to `fit()`. It
  already reports each moved note (by semitones, up to `maxShift`) and each dropped one.
