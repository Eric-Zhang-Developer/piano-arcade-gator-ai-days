## What shipped
`/lab`: 16 experimental and hidden features in six groups (Play differently, Watch, Score, Experiments, Behind the scenes, Learn). Each has its name, a line copied from its done note, and one real link. Esc goes back to `/`. The way in from `/` is a quiet "Lab" link in the select's footer, and X.
## Where it lives
`web/src/app/lab/page.tsx`, `web/src/game/lab/` (`entries.ts`, `Lab.tsx`, `LabLink.tsx`, `lab.test.ts`, `verify-lab.mjs`), the mount in `web/src/app/page.tsx` (#631), decision `specs/decisions/lab-key.md`.
## How to check it
`verify: node web/src/game/lab/verify-lab.mjs --out … pass at dd13aae`: the link and X open `/lab`, all 16 entries answer 200 with no page error, and 1280×720 and 1920×1080 fit with no scroll (`specs/features/lab/lab-1280.png`, `lab-1920.png`). `pnpm -C web exec vitest run src/game/lab`: 34 pass, each line a substring of its note.
## Gaps
Eric hasn't looked at it yet (Validation 3). The tab title still says "Lab · Piano Arcade" until the Étude `APP_NAME` (#671) lands; then it's a one-line `fix(lab)`. The link shows "Lab" alone; X is in its title (#634).
