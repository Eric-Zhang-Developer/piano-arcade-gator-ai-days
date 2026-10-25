## What shipped
/paint's tab reads "Wet Paint · Étude". Framing turns off the LED keys still held and clears the on-screen ones; Again, leaving the page and closing it send `CLEAR` to a connected strip. The framed painting is a modal: Save PNG takes focus, the page behind it is inert, Again hands focus back, and a polite status region announces the frame (auto-frame included) and the piano status. The look doesn't change.
## Where it lives
`web/src/app/paint/layout.tsx`, `web/src/game/x/wet-paint/framing.tsx` (new), `WetPaint.tsx`, `wet-paint.module.css`, `wet-paint.test.ts`; decision `specs/decisions/wet-paint-polish-modal.md`; shots `specs/features/wet-paint-polish/shots/`.
## How to check it
`pnpm -C web exec vitest run src/game/x/wet-paint src/game/x/x.test.tsx`: 36 pass (5 new). On the dev server: the title, the held key going out on frame, focus on Save PNG, the announcement, and focus back on the page after Again, read from the DOM. The browser suite's checks: not verified locally; covered by main's scheduled full run.
## Gaps
The LED strip itself wasn't connected: the messages are tested through `stripLights`, and `send()` drops them unless the strip is ready. The nav bar outside /paint still takes Tab while framed. The focus ring on Save PNG isn't in the shots: the browser pane was hidden, so the page had no focus.
