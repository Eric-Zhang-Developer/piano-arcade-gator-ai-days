# Wet paint polish: the framed painting as a modal, and the strip

Feature: `wet-paint-polish` (#1195, #1196, #1197). What the spec left open; each undoes in one file.

## The page behind the painting is inert
- **Context:** the spec puts `aria-modal="true"` on the dialog. Without more, Tab still left Save PNG and Again for
  Frame it and Connect lights behind the painting, so the dialog said "modal" and wasn't.
- **Choice:** while framed, the rail and the status line get `inert`; Again lifts it. Checked on the dev server: framed,
  the page's only focusable controls are Save PNG and Again.
- **Not covered:** the site's nav bar sits outside `/paint` (`app/layout.tsx`, another feature's mount), so Tab can
  still reach it. Escape doesn't close the dialog: the spec doesn't ask, and Again is one Tab away.
- **Undo:** the two `inert` props in `WetPaint.tsx`.

## Framing turns off the held keys one by one
- **Context:** the spec allows a key-off for each held key or `CLEAR`.
- **Choice:** key-offs for the keys this page lit (`stripLights` in `framing.tsx`), so framing never clears a key
  something else drew; Again, unmount and `pagehide` send `CLEAR`, since by then the page is done with the strip.
- **Undo:** `frame()` in `framing.tsx` can send `CLEAR` instead.

## Again focuses the page itself
- **Context:** "Again puts focus back on the page" names no element.
- **Choice:** `<main>` with `tabIndex={-1}` and no ring (it's a canvas, not a control). The laptop keys listen on
  `window`, so playing works wherever focus sits.
- **Undo:** the `page` branch of the focus effect in `WetPaint.tsx`.

## The pieces the tests call live in `framing.tsx`
- `WetPaint.tsx` needs WebGL and MIDI, which a node test can't load. The dialog, the live region, `caption`,
  `stripLights` and `focusAfter` moved to `framing.tsx`, which renders with `renderToStaticMarkup`.
