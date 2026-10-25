## What shipped
Each /learn tab names its page as `<page> · Learn · Étude`, from `APP_NAME`; /learn itself reads `Learn · Étude` (#1141).
## Where it lives
`web/src/app/learn/layout.tsx` (the default and the template), the `metadata` of `brand-preview`, `play-through`, `review/theory` and `understand`, and `web/src/app/learn/learn-titles.test.ts`.
## How to check it
`pnpm -C web exec vitest run src/app/learn/learn-titles.test.ts` (2 pass). `grep -rn "Piano Arcade" web/src/app/learn/` prints nothing. On a dev server, the titles were `Learn · Étude`, `Theory · Learn · Étude`, `Theory review · Learn · Étude`, `Play-through · Learn · Étude` and `Brand direction · Learn · Étude`.
## Gaps
`practice/page.tsx` (and #1147's new `check/page.tsx`) are held by #1147, so practice shows the default `Learn · Étude` until a follow-up adds `metadata = { title: 'Practice' }`.
