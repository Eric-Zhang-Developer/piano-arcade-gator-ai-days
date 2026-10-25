## What shipped
Three of the four full-run reds fixed, one diagnosed. #1270: verify-landing's step 3 stops reading `window.__pianoArcade` (test-only). #1284: the pause and preview spies hear AudioBuffer sources (#1169), and `uiSound` now anchors every sound asked for in one run to one `currentTime`, so the resume ticks land 600 ms apart, not 605. #1285: verify-duo checks the /learn exemption with a probe button, since #1120/#1265 made /learn square on purpose. #1177 is not fixed: the clock's zero is fixed before the first frame is requested (`app/play/page.tsx:183` vs `:435`), and the first frame's hud and juice-visual draws delay count-in's stamp by about 40 ms. Both files are held by #600 and #713.
## Where it lives
`web/src/game/ui-sounds/index.ts` (+ test), `results-landing/verify-landing.mjs`, `pause-skin/verify-pause.mjs`, `song-preview/verify-preview.mjs`, `duo-tokens/verify-duo.mjs`.
## How to check it
verify-landing, verify-preview, verify-pause and verify-duo pass on the branch under `verify.py` (evidence in `.git/agent-evidence/full-run-reds/`). Not verified on a full run yet.
## Gaps
#1177 is still red. Its fix belongs in `page.tsx` (fix the zero at the first frame) once #600 frees the file. Count-in's own code is correct; the bars are unchanged.
