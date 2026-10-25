---
name: "Menu test: a coverflow music select at /mt, beside the real menu"
depends_on: ["song-select", "song-jacket", "records"]
owns: ["web/src/app/mt/"]
assignee: "sharan"
---

# Menu test

A second music select to try a coverflow carousel: one card per song, the centred card large and flat, its
neighbours tilted and receding, drag or arrow keys to move, Enter to play. It lives at `/mt` and replaces nothing: `/`
stays the music select (`select-layout`, Eric's). If it plays better, moving it to `/` is a later decision for Eric.

Based on a coverflow component Sharan found (React, written for shadcn, Tailwind and `lucide-react`). None of those are
in this project, and `web/package.json` is frozen (`specs/tech-stack.md`), so the component is rebuilt here as one
client component plus a CSS module. What carries over is how it moves, not its code's dependencies.

## Plan
1. `web/src/app/mt/page.tsx`: a server page that reads the songs the way `/` does (`loadSongs` from
   `web/src/game/song-select/load.ts`) and hands them to the carousel.
2. `web/src/app/mt/Coverflow.tsx` + `coverflow.module.css`: the carousel, with a `SongJacket` as each card.
3. A caption under the centred card, and Enter or a click on it to play.

## Requirements
- **Cards:** one per song `loadSongs` returns, in the same order as `/`. Each card is that song's `SongJacket`
  (`web/src/game/song-jacket/`): no photos, no stock images, no image URLs (`visual-direction.md`; the jacket spec
  says no images).
- **Caption** for the centred song, only fields that exist: title, composer, catalog (if the chart has one), notes
  (`noteCount`), level (`level`), and the player's best rank and accuracy from `useBestGrades()`
  (`web/src/game/records/best.ts`), or empty when there's no take yet. No years, producers, lengths or any field
  the charts don't have.
- **Motion** (from the component): the card at fractional position `pos`; each card's offset folded the short way
  round the ring when looping; tilt `min(rotate * |offset|^falloff, 82)` degrees and depth
  `-depth * cardWidth * |offset|^falloff`; opacity `1 - fade * |offset|`, and a card is fully faded by half a ring
  away so the wrap never shows. Defaults: `rotate` 44, `depth` 0.6, `perspective` 3 card widths, `falloff` 0.56,
  `fade` 0.1, `gap` 0.05, card width `clamp(148px, 22vw, 260px)`. Positions are painted straight to the DOM in
  `requestAnimationFrame` (game state in refs, never React state, `tech-stack.md`); React re-renders only when the
  centred song changes.
- **Input:** drag (pointer capture, a flick carries at most two cards, then it settles with an ease-out),
  Left/Right arrows step one card, Enter or a click on the centred card opens `/play?song=<id>` (use `goToStage`
  from `web/src/game/select-layout/go-to-stage.ts`, imported, not changed). Previous and next buttons draw their
  chevrons as inline SVG. Vertical scrolling still works on touch (`touch-action: pan-y`).
- **Look:** `--pa-*` tokens and the display face from `visual-direction.md`, plain CSS module, no new dependency.
  Phone width with no horizontal page scroll. With `prefers-reduced-motion`, cards jump to place without the settle.
- **Accessibility:** the carousel is a labelled region, each card a slide labelled "n of N", the frame focusable
  with a visible focus ring.
- Nothing under `web/src/game/` or `web/src/app/page.tsx` changes.

## Validation
- `pnpm -C web build` -> `/mt` builds; `/` is unchanged (same file on `main`).
- Open `/mt` -> one card per song in `web/public/songs/` (count them), the centred one flat and the rest tilted.
  Screenshot at 1440 px and 375 px (no horizontal scroll).
- Right arrow three times -> the fourth song is centred and its caption shows its title, composer, notes and
  level. Drag left past the last song -> it wraps to the first with no visible jump.
- Enter on the centred card -> `/play?song=<that id>` opens and the song plays. Play it to the results, go back
  to `/mt` -> that song's caption shows the best rank.
- Vitest: the pure motion math (offset folding, tilt cap, fade-out at half a ring) as a function of `pos`.

## Defaults
- Deviations from the component's numbers go in `specs/decisions/menu-test-*.md`.
- A link to `/mt` from `/` is Eric's lane: don't add one. Reach it by URL, or from `/about` once `landing` lands.
