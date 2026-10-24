## What shipped
visual-direction.md's 21 color tokens, the same values as CSS variables (`globals.css`, from #168) and as one TypeScript module for canvas code; `fontDisplay` for Saira; `whenDisplayFontReady()`, which waits for the display face, or for at most 1 s.
## Where it lives
`web/src/game/ui-tokens/index.ts` and its test; `web/src/app/globals.css` and `layout.tsx` (#168); `specs/decisions/ui-tokens-names.md`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` at c19c9fb. `pnpm -C web test` checks each CSS variable against the module and the helper's 1 s cap. Screenshots of `/` and `/play` at 1280×720 and 1920×1080, with and without reduced motion, match main 37ae272 exactly (same hashes).
## Gaps
Nothing uses the tokens or the helper yet; the frontend features that follow do. The helper was tested with stubs in node, not in a real browser.
