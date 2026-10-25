---
name: "Learn kit: /learn practice and play-through upright and square, 12 px floor, underlined links, no old name or cyan"
depends_on: ["learning-ui", "duo-tokens", "learn-titles"]
owns: ["specs/features/learn-kit/", "changes/learn-kit.md", "specs/decisions/learn-kit-", "web/src/learn/frontend/learning.module.css", "web/src/learn/frontend/playing/playing.module.css", "web/src/learn/frontend/playing/Passage.tsx", "web/src/learn/frontend/playing/Score.tsx", "web/src/learn/frontend/playing/Score.test.tsx", "web/src/learn/frontend/brand-preview/BrandPreview.tsx", "web/src/learn/frontend/encoding/encoding.module.css"]
assignee: "eric"
---

# Learn kit

Issues #947, #1279, #1280 and #1281, from the learning lane (gray area: no person set, so `assignee: "eric"`, as
learn-titles did). The pages a judge reaches from the game's Learn link still carry pieces the Duo look retired:
italic, pill radii, 10–11 px text, the old cyan, the old name, and links that read as plain text. One PR, since
it's one thing a person sees: /learn's practice and play-through screens in the game's kit. CSS and two copy lines
only; no layout or behavior changes.

## The changes
1. **Upright and square (#1279).** `playing/playing.module.css`: drop `italic` at lines 7, 19, 26 and 33, and set
   `border-radius` to 0 at 15, 26, 34, 35, 42, 43, 46 and 70. The 50% dots at :36 and :67 stay. Diagnostic, review
   and understand already look like this; match them.
2. **12 px floor (#947).** No text on /learn under 12 px:
   - `playing/playing.module.css:56` (`.beatLabel`, 11 px);
   - `playing/Passage.tsx:34` (`label = Math.min(rowH - 3, 11)`, in a 1000-wide viewBox, so smaller still on
     screen: measure the rendered size at 1280×720 and 1920×1080);
   - `learning.module.css:51` (`.source`) and `:58` (`.referenceNote`).
   #947's other half, the hype-pink focus ring, is already gone: focus rings use `--pa-primary`
   (`learning.module.css:4`, `graph/graph.module.css:45`). Say so on #947.
3. **Underlined links (#1280).** `.details a` (`playing.module.css:24`) and `.guide .note a` (`:74`) get
   `text-decoration: underline`, as `encoding/encoding.module.css:61` already does. Buttons styled as links don't.
4. **Old name, old cyan, dead CSS (#1281).**
   - `playing/Score.tsx:38` and `brand-preview/BrandPreview.tsx:70` use `APP_NAME` (`web/src/game/app-name/index.ts`)
     for "Piano Arcade". No other copy changes; the rest of the rename is #670.
   - `learning.module.css:20` and `:99`: `rgb(39 225 255 …)` becomes a Duo token's colour at the same alpha.
   - Delete the unused rules at `learning.module.css:12` (`.preview`) and `:106-125` (`.landing` … `.landingNote`).
     Check again with `grep -rn` across `web/src/` that no file uses them before deleting.
   - `encoding/encoding.module.css:2`'s comment matches the code.

## Files
These files belong to learning-ui (done, no lane), so this spec owns them, as learn-titles did. Check again before
each edit (`gh pr list --state open`, then each PR's files), and avoid every file in seeko-codes' open PRs
(`gh pr list --state open --author seeko-codes`). When this spec was written seeko-codes had no open PR, but merged
five learning-ui fixes today: if one opens on any file above, switch once it frees it.

| File | Owner |
|---|---|
| `web/src/learn/frontend/playing/playing.module.css`, `Passage.tsx`, `Score.tsx`, `Score.test.tsx` | learning-ui (done; no lane), owned here |
| `web/src/learn/frontend/learning.module.css`, `encoding/encoding.module.css` | same |
| `web/src/learn/frontend/brand-preview/BrandPreview.tsx` | same |

learn-a11y (#1273–#1278) edits other files on the same pages; the two PRs don't share a file.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080: /learn/practice (open Score source), /learn/play-through, and
  /learn/brand-preview.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
- **(a) #1279:** `grep -nE "italic|border-radius: *[1-9]" web/src/learn/frontend/playing/playing.module.css`
  prints only the two 50% dots.
- **(b) #947:** in the browser at 1280×720 and 1920×1080, no text node on /learn/practice and /learn/play-through
  computes under 12 px (list the smallest of each in the PR); `grep -nE "font-size: *(1[01]|[0-9])px"` over the four
  CSS files above prints nothing.
- **(c) #1280:** the Mutopia link's computed `text-decoration-line` is `underline`.
- **(d) #1281:** `grep -rn "Piano Arcade" web/src/learn/frontend/playing web/src/learn/frontend/brand-preview`
  and `grep -rn "39 225 255" web/src/learn/` print nothing; none of the deleted class names appear in
  `learning.module.css`.
- **Unit tests:** `pnpm -C web exec vitest run src/learn/frontend/playing src/learn/frontend/brand-preview`
  (Score.test.tsx may pin the copy line: update it to `APP_NAME`, not around it).
- **(e) Shots and taste v2 scores** in the PR (Design pass above).

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/learn-kit-*.md`.
- No new dependency or token; colours come from the tokens `/learn` already loads.
