# Rank stamp: when it starts, what lands on it

**Context.** The spec starts the stamp 1.2 s after the results show. juice-visual's FULL COMBO banner stays up for
2 s from the same moment, and juice-sound hit the rank at a fixed 900 ms, before either reveal.

**Choices.**
- After a full combo the stamp waits for the banner (2 s); otherwise it starts when the tally ends (1.2 s).
  "One loud thing at a time" rules out stamping under the banner. clear-card (#255) removes the banner, after
  which `afterBannerMs` can go.
- The rank hit sounds at impact, where the letter first reaches 1× (`impactT` ≈ 0.37 of the 300 ms), not at the
  end of the settle. The gold ring starts at the same instant. A full combo's fanfare still follows the hit by 150 ms.
- rank-stamp holds its two upstream numbers (the tally's 1.2 s, the banner's 2 s) instead of importing them, so
  juice-sound doesn't pull React or juice-visual into its imports; `rank-stamp.test.ts` pins both to their sources.
- The ring is a `::after` on the rank element, styled by juice-visual like the old reveal, so results-layout's
  markup doesn't change.

**How to undo.** Revert juice-visual's and juice-sound's PRs to get the old scale-in and the 900 ms hit back.
