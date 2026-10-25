## What shipped
W on the music select plays the focused song with the perfect bot, audible and
hands-off. The DEMO badge sits on the HUD, nothing is saved to records, and 8 s after the results it returns to `/`.
With the DGX on USB the demo plays on the piano, otherwise a laptop tone.
## Where it lives
`web/src/game/watch-demo/` (plugin, `watchUrl`, `isWatchKey`, `verify-watch.mjs`; #528) · select-layout's W and hint
(#580) · song-preview's W stop (#581; its WATCH link came out in #599) · results-layout's `demoFeatured` (#582) · screens in
`specs/features/watch-demo/screens/`
## How to check it
`verify.py --slug watch-demo --cmd "node {worktree}/web/src/game/watch-demo/verify-watch.mjs --out {out}"`: pass at
343b17c (100.0%, records 67 bytes unchanged, back on `/` 8.1 s after the results). `verify.py --slug watch-demo`: pass
at 343b17c (42/42 PERFECT with test input and on /sim).
## Gaps
- **Not checked by Eric:** W on Für Elise with the DGX on USB: does it play on the piano, in time, with no hung notes
  after the return? Web MIDI doesn't run headless.
- The return lands on `/` with the first song focused, not the one demoed (spec: later, if wanted).
