## What shipped
- /learn's practice and play-through screens are on the game's kit: upright display type, square corners (the two 50% dots stay), and underlined links.
- **Text size:** no text under 12 px at 1280 or 1920. The roll's labels went from 9.7 px to 12.4 px at 1280.
- **Name:** the app's name (Étude) replaces "Piano Arcade" in the score source and the brand preview.
- **Colour:** the old cyan becomes the primary token at the same alpha.
- **Dead CSS:** the unused `.preview` and landing rules are deleted.

## Where it lives
- `web/src/learn/frontend/playing/playing.module.css`, `Passage.tsx`, `Score.tsx`
- `web/src/learn/frontend/learning.module.css`, `encoding/encoding.module.css`
- `web/src/learn/frontend/brand-preview/BrandPreview.tsx`
- `specs/decisions/learn-kit-choices.md`
- Shots: `specs/features/learn-kit/shots/`

## How to check it
- `pnpm -C web exec vitest run src/learn/frontend/playing src/learn/frontend/brand-preview`
- The spec's greps (a)–(d) print only the two 50% dots.
- In the in-app browser:
  - the Mutopia link computes `underline`;
  - the smallest text is 12.4 px at 1280 (the roll) and 13 px at 1920.

## Gaps
- **Cyan the spec didn't name:** `.app ::selection` (`--pa-cyan`) and `.app .primary:hover` (`#85edff`) still use it.
- **Narrow windows:** the roll's labels still render under 12 px below 1280 wide.
