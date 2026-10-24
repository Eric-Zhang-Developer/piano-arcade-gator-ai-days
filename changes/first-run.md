## What shipped
A guided first Twinkle: `/play?song=twinkle&firstrun=1&labels=keys` says what to do on the start screen, puts laptop letters on the keys, and shows one short cue at a time (notes fall, press A, how the first note went, 5 in a row). On `/`, "First time? 30-second first song" beside Options, or F, opens it. The take is recorded like any Twinkle take.
## Where it lives
`web/src/game/first-run/` (`cues.ts`, the plugin, `<FirstRunLink />`, `verify-first-run.mjs`), one line each in `web/src/game/layers.ts` and `web/src/app/page.tsx`
## How to check it
`node web/src/game/first-run/verify-first-run.mjs --out <dir>` -> `verify-first-run: pass` at 1280×720 and 1920×1080 (cues fall, press, perfect, combo5; the link leaves Twinkle focused and ↓ working; F opens it, not with Options open). `verify.py --slug first-run` pass at 07f085f (42/42 PERFECT, test input and the MIDI path on /sim).
## Gaps
Not run: the stranger's run (Eric): does someone who has never played finish Twinkle unhelped, and which cue did they miss? Cue wording and timing are starting values for that run. At 1080p the press cue sits over the count-in's big digit; it stays legible on its panel. No reduced-motion screenshot: cues show at once under it (unit-tested), no fade.
