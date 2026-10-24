# judging-tiers: small choices the spec left open

- Date: 2026-10-24   Decided by: eric-agent-1   Feature: judging-tiers
- **Context:** Gaps found while building; each takes the smaller option (decision 000).
- **Choices:**
  - Colors: GOOD `#7ab8ff` (calm blue), WRONG `#ff3b4e` (strong red); MISS keeps its muted pink.
  - The WRONG exemption checks any same-pitch note within 150 ms, matched or not, so striking a key twice on one
    note isn't WRONG. Simpler than tracking which press "belongs" to a note; it's lenient by up to one re-strike.
  - The song's span for WRONG is the first note's time −100 ms to the last note's time +100 ms (the GOOD window), so
    a press in the count-in or after the last note is harmless.
  - The results screen keeps "Extra presses" (all unmatched presses) next to "Wrong notes": piano-sim's verify reads
    `count-extra`.
  - `piano-sim`'s test compared the exact counts object; #70 loosened it to the same four counts before this merged.
- **How to undo:** each is one line in `web/src/game/core/` or `web/src/app/play/page.tsx`.
