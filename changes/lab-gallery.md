## What shipped
/lab's On trial is a wall of 14 plates: each a poster still from the experiment's own page, its issue and flag, title,
line, a kind chip and a chip per real need, with a solid DGX tag on the plates that need the piano. Under each,
Keep / Cut / Keep + note (pressed-state buttons, stamped KEPT, CUT or KEPT* on the poster, kept in localStorage), and
"Copy verdicts" puts the dated plain-text block on the clipboard, or selects it in a box when the clipboard is refused.
## Where it lives
`web/src/game/x/Gallery.tsx`, `gallery.module.css`, `web/src/game/x/gallery/{labels,verdicts}.ts`,
`gallery.test.tsx`, `web/public/lab/*.webp`; `specs/decisions/lab-gallery-labels.md`; shots in `specs/features/lab-gallery/shots/`.
## How to check it
`pnpm -C web exec vitest run src/game/x` (225 pass, 2 skipped). Scan test: 3 of 3 named exactly the DGX set. Browser
checks: not verified locally; covered by main's scheduled full run. Not seen by Eric.
## Gaps
No clips (the stretch): posters only, so the one-clip and below-the-fold checks have nothing to check. The labels sit
in `x/gallery/labels.ts`, not on `Experiment`: #1255 holds `x/index.ts`. The clipboard path was refused in the in-app
browser, so only the fallback was seen working there. The real-keys poster is a dark camera-off frame. Reduced motion
was checked by applying its CSS block by hand (the pane can't emulate it).
