---
name: "Key preview: a key glows faintly in its hand color for 500 ms before its note reaches the line"
depends_on: ["key-skin", "hand-colors", "core-loop"]
owns: ["web/src/game/key-preview/"]
assignee: "eric"
---

# Key preview

Laptop players and learners watch the keys, not the lanes. Synthesia's "show next notes on keyboard" lights the key
that's about to be needed. Here a key starts to glow faintly about 500 ms before its note reaches the line, brightens
as it nears, and stays calmer than a pressed key.

Issue: #359

## Plan
One PR: a plugin in `web/src/game/key-preview/` and one line in `web/src/game/layers.ts` right after `ghost()`, so it
sees the final chart (after bar-loop and hand-mode). It also draws under laptop-octaves' wash and note-labels' letters.
key-skin paints the keyboard on the highway canvas. This plugin paints on its own layer above it, so no other
feature's files change. Geometry comes from the `Frame`: `keyX(pitch)`, `judgmentLineY` (the keys' top edge),
`height - judgmentLineY` (the keyboard's height), and black keys at 0.62 of that, matching `drawHighway`
(`web/src/game/core/highway.ts`). Hand colors are ui-tokens' `handR` / `handL`.

## Requirements
- **Which keys:** every chart note from `keyPreviewSettings.leadMs` (500) before its time until it's hit (`noteHit`
  with its `noteId`) or its time passes. In wait mode the clock holds at the note's time, so a held note keeps its
  key at peak until it's pressed. A chord lights each of its keys. When one key has two notes in the window, the
  nearer note wins.
- **How bright:** a fill of the key's face in its note's hand color, with alpha rising linearly from 0 at 500 ms to
  `peakAlpha` (0.35) at the line. No blur and nothing past the key's edges, so it never reads as a press: a pressed
  key is a solid fill with a 24 px glow (key-skin).
- **Shape:** a white key's fill never covers a black key: the black neighbours' rects are clipped out. Black keys
  fill their own 0.62-high rect.
- **Off switch:** `?keypreview=0` draws nothing. It's on otherwise, on every input.
- **Pure core:** `previewAlpha(msToHit)` and `previewKeys(notes, nowMs, hitIds)` (pitch, hand, alpha) with tests.
  Test hook: `window.__pianoArcadeKeyPreview = { lit: [{ pitch, alpha, x, y, w, h }] }`, updated each frame.

## Validation
- `pnpm -C web test`: alpha is 0 at 500 ms and beyond, `peakAlpha` at 0, rising in between, and 0 once the time has
  passed. A hit note drops out at once. A chord lights all its pitches, and a repeated pitch takes the nearer note.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/key-preview/verify-key-preview.mjs --out <dir>`. It starts its own dev server, prints
  `verify-key-preview: pass` and exits 0, or names each failed step and exits 1. With reduced motion emulated (the hit
  line holds still):
  1. `/play?song=twinkle&mode=wait&input=test` with no presses: the clock holds at the first note (C4). `lit` has
     pitch 60 at `peakAlpha`, and no pitch 67 (G4 is 1.2 s away).
  2. The same URL with `&keypreview=0`: `lit` is empty.
  3. A screenshot of each. In the bottom quarter of C4's rect, the pixel differs from run 2's by at least 20 in some
     channel. G4's pixel differs by at most 6. So the check fails if nothing is drawn, or if every key is.
  4. Screenshots of the keyboard mid-take on Ode to Joy (both hands) at 1280×720 and 1920×1080, kept in `<dir>`.
- `verify.py --slug key-preview` passes.
- Eric (mark it in the done note): Twinkle on laptop keys and Für Elise on the piano. Does the preview help? Is a
  previewed key ever mistaken for a pressed one?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots
go in the PR.

## Defaults
- **500 ms and 0.35 are starting values,** not findings: Eric tunes `keyPreviewSettings` on the piano.
- On for MIDI too. If it clutters on the piano, follow note-labels' `auto` rule (off after the first MIDI note-on).
- Linear ramp, no pulse: wait-hint owns pulsing a key after 3 s. Reduced motion changes nothing, since the ramp is the
  notes' own motion.
- If key-skin changes the 0.62 black-key height, export it from core in a `fix(core-loop)` instead of copying it.
- Log choices the spec doesn't make in `specs/decisions/key-preview-*.md`.
