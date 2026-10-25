## What shipped
`/name`: type a name, and each letter falls to its note under the 1909 French table (German letter names on a
switch). It makes a 20 s theme and its inversion, harmonized, as a chart. **Listen** has the DGX play it; **Play your
name** opens it in Learn. On `/play` with `?x=name-theme`, the name's letters light as their notes are hit. The name
lives only in memory and clears on leaving `/name` and `/play`. Off by default; a Lab entry.

## Where it lives
- `web/src/game/x/name-theme/`: `cipher.ts`, `compose.ts`, `memory.ts`, `swap.ts`, `Guard.tsx`, `index.tsx`,
  `Name.tsx`.
- `web/src/app/name/page.tsx` and the placeholder `web/public/songs/x/name-theme/chart.json`.
- Mounts in `layers.ts` and `app/layout.tsx`; `holdPedal` in `web/src/game/pedal/index.ts`; `/name` in
  `nav-bar/slots.ts`.
- Decisions: `specs/decisions/name-theme-cipher.md` and `name-theme-composition.md`.

## How to check it
`pnpm -C web exec vitest run src/game/x/name-theme src/game/pedal src/game/songs` (all pass). Browser checks: not
verified locally; covered by main's scheduled full run. Tried in the dev server: a typed name reached `/play` by client
navigation, the bot played its chart (75 PERFECT, no MISS), and the letters lit. Not heard by Eric.

## Gaps
- Not heard on the DGX: the Listen link wasn't pressed here, because it would sound the piano.
- Reduced motion only drops the letters' 240 ms scale-in. It wasn't shot, since a still frame looks the same.
- A reload falls back to HAYDN, with a start-panel line to `/name`.
- The letters stay lit through the variation rather than lighting again.
- Parallel fifths and octaves are counted, not avoided: 10.3% of melody moves.
- The 1910 *Revue S.I.M.* itself wasn't read, so B's accidental follows Chailley's B♭ over WMU's B.
- The Guard's clear-on-leave is unit-tested on its page rule, not seen in the browser.
