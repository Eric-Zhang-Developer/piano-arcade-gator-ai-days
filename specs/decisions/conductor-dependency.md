# Conductor: MediaPipe from a pinned CDN URL, nothing in package.json

**Context:** the spec (conductor, "The dependency decision") loads `@mediapipe/tasks-vision` at run time instead of
adding it to the frozen `web/package.json`. The worker confirms the URLs and logs how the bundler is kept out.

**Checked 2026-10-25 (HEAD requests):**
- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs`: 200, 156,139 bytes. The package's
  own `package.json` there says version 1.1.1, Apache-2.0.
- `…@1.1.1/wasm/`: 200. It holds `vision_wasm_internal.{js,wasm}` (the .wasm is 13,519,922 bytes), plus the module and
  no-SIMD builds.
- The model, `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`:
  200, 7,819,105 bytes.
  - MediaPipe's Hand Landmarker overview gives the same path with `latest` in place of `1`. Both answer with the same
    md5 (`FTGEMOo4UWcP6ZFBFqnPrQ==`).
  - The page pins `1`, so a new model can't change the spike under it.
  - The guide's web example uses a relative `"hand_landmarker.task"`, and `forVisionTasks` at `@latest/wasm`. The page
    pins 1.1.1 for both instead.

**The import:** `import(/* webpackIgnore: true */ /* turbopackIgnore: true */ \`${base}/vision_bundle.mjs\`)` in
`web/src/game/x/conductor/tracker.ts`. Next 16 builds with Turbopack, which honours `turbopackIgnore`; webpack honours
`webpackIgnore`. With either, the browser fetches the URL itself.

**Options:**
- `numHands: 1`, `runningMode: "VIDEO"` and `delegate: "GPU"`.
- The confidences are left at the defaults (0.5).

**How to undo:** promotion vendors the bundle, the WASM and the model through a `contract:` PR. Pruning deletes the
folder.
