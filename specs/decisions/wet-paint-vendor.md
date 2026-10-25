# wet-paint: what changed in the vendored fluid

- **Context:** the spec vendors Pavel Dobryakov's WebGL Fluid Simulation (`script.js` at
  `a2d292931f19d9b3b9f564e23e6c32729d2121c3`, MIT) into `web/src/game/x/wet-paint/vendor/fluid.js` and asks for every
  removal to be listed. The page must make no analytics requests.
- **Choice:** keep the solver and its shaders (splat, advection, divergence, curl, vorticity, pressure, gradient
  subtract, copy, clear, the display shader's shading) as they are, wrapped in `createFluid(canvas, overrides)`, which
  returns `{config, splat, step, fix, clear, render, resize, reinit, simSize, gl}`.
- **Removed:**
  - the mobile promo popup and its app-store links (original lines 27-52), and `isMobile`;
  - every `ga(...)` call, including the one inside `getWebGLContext`;
  - `startGUI` and the `dat.gui` panel;
  - `captureScreenshot`, `framebufferToTexture`, `normalizeTexture`, `clamp01`, `textureToCanvas`, `downloadURI`
    (framing uses the page's own canvas);
  - the blur, checkerboard, bloom and sunrays shaders, programs and framebuffers;
  - the dithering texture (`LDR_LLL1_0.png`) and `createTextureAsync`, the file's only network fetch;
  - the random splats at start, the `requestAnimationFrame` loop (`update`), `updateColors` and `applyInputs`;
  - the pointer, touch and keyboard listeners, `generateColor`, `HSVtoRGB`, `wrap`, `getTextureScale`;
  - the `'use strict'` line (an ES module is strict already, and the directive is illegal in a function with default
    parameters).
- **Added:**
  - a first line naming the repo and commit, then the MIT header as it was, `/* eslint-disable */` and `// @ts-nocheck`;
  - a `dried` double framebuffer, and `fixShader`: `dried = live + dried × (1 − a)`, with `a = clamp(max(live.rgb))`;
  - the display shader composites the dried texture under the live dye by the same "over";
  - `splat(x, y, dx, dy, color, radius)`: the radius is a parameter, where the original read `config.SPLAT_RADIUS`;
  - `fix()` (live over dried, then the live dye cleared), `clear()` (both), and a plain `render()` (background then
    display);
  - `fluid.d.ts`, the types the page uses.
- **How to undo:** replace `fluid.js` with the original `script.js`; nothing outside `wet-paint/` imports it.
