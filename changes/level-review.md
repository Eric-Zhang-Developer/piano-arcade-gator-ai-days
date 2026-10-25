## What shipped
Every select song's level now comes from a published grade: 40 rows: 32 Henle, 1 RCM, 2 ABRSM, 5 with none (formula kept). `difficulty()` returns `{ level, formula, inputs }`; level = formula + (row.level - row.old).
## Where it lives
`web/src/game/difficulty/reviewed.ts` (table), `difficulty.ts` (the shift), `reviewed.test.ts`; mapping in `specs/decisions/level-review-mapping.md`.
## How to check it
`pnpm -C web exec vitest run src/game/difficulty` passes. `/play?song=moonlight-3` WARNING at 15: not verified locally; covered by CI. Spot checks: Fantaisie-Impromptu 14 > Rachmaninoff 10; Clair de lune 8 > Ode to Joy 3; Entertainer and Maple Leaf Rag both 8 (Henle 4).
## Gaps
No grade found (formula kept, note says where we looked): twinkle, ode-to-joy, mozart-331-theme, pathetique-3, moonlight-3 (the last three have only whole-sonata or diploma listings). More than 3 from old: maple-leaf-rag -6, clair-de-lune +5, musette-d -5, entertainer -4, liszt-consolation-3 +4, minute-waltz +4, mountain-king +4. Henle quotes came through WebFetch's page summarizer, not raw HTML.
