## What shipped
- **The mic (#1201).** /speak lets go of the mic when it's left: the 3 s timer clears, the tracks stop and the context
  closes, and a take that was pending never plays on the DGX.
- **Type (#1202).** The stand's labels, the caps' names and the canvas's octave names are all 12 px or more at
  1280×720.
- **Notes (#1203).** The two errors are alerts and the hold hint a polite status. The way back reads "Back to the Lab"
  as a `Link`.

## Where it lives
`web/src/game/x/speaking-piano/mic.ts` (new: `micHold`), `Speak.tsx`, `speak.module.css`, `speaking-piano.test.ts`.

## How to check it
`pnpm -C web exec vitest run src/game/x/speaking-piano` (13 pass). Browser checks: not verified locally; covered by
main's scheduled full run. In the dev server at 1280×720, the labels and the caps' names measured 12px. The note
rendered as `role="alert"`, with MIDI access stubbed so nothing sounded.

## Gaps
- The mic itself needs a person: teardown mid-hold is checked with a stubbed mic and fake timers, not a real one.
- Like /conduct and /sonata, the page is `100vh` under the nav bar, so it scrolls about 65 px. That's shared, and not
  changed here.
