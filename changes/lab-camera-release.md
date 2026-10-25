## What shipped
The camera, the mic and media let go on every exit:
- /conduct on Stop, a song change, a failed load, unmount and a second Start (#1315, #1316);
- /real-keys' camera and its WebGL sparks (#1317, #1318);
- Speak's mic when released while opening (#1319);
- /highlight's encode and reel URLs on leaving (#1320);
- the hum spike's Record on a double-click and a failed start (#1322).

/shots' index cards now open in capture mode (#1321). The pages share one `mediaRun()`.
## Where it lives
- `web/src/game/x/media-run/`, `x/conductor/Conduct.tsx`, `x/real-keys/RealKeys.tsx`, `hit-particles/gl.ts`
- `x/speaking-piano/mic.ts`, `x/highlight-reel/{encode.ts,Highlight.tsx}`
- `capture-mode/{index.tsx,verify-capture.mjs}`, `spikes/hum-level/index.html`
- `specs/decisions/lab-camera-release-choices.md`
## How to check it
- `pnpm -C web exec vitest run src/game/x/conductor src/game/x/real-keys src/game/hit-particles src/game/x/speaking-piano src/game/x/highlight-reel src/game/video-shots src/game/capture-mode src/game/x/media-run`
- The new `verify-capture.mjs` step (index link → `html[data-capture]`, no nav bar): not verified locally; covered by main's scheduled full run.
## Gaps
- Not tried with a real camera or mic.
- The pages' wiring isn't rendered in tests (no DOM test environment): `mediaRun` is tested in their start shape.
- #1322 was checked by hand with a stubbed `getUserMedia`.
