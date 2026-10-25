---
name: "Nav bar: the top-level pages, reachable from / and from each other"
depends_on: ["duo-tokens", "song-select", "lab"]
owns: ["specs/features/nav-bar/", "changes/nav-bar.md", "web/src/game/nav-bar/", "specs/decisions/nav-bar-"]
assignee: "eric"
---

# Nav bar

Issue #706. Eric, 2026-10-25: "We don't have a proper nav bar? There's the whole learning page. There's the 'How It's
Built' page. There's a lot of random crap that's not here on our core main route. which is /"

Then, on the plan in #706: "lab Into navbar for now, we can remove it later cause yeah rn our nav is really fucked",
and "Raise this. Send it to the planner."

Today `/` links to songs, options and `/calibrate`, first run, `/progress`, login and a quiet Lab link (#631). `/learn`,
and soon `/how`, have no way in from `/`. The bar carries the few top-level pages. Everything else (`/simon`,
`/veritas`, `/sheet`, `/sim`, `/cabinet`, `/operator`) stays reachable through Lab, which is a slot in the bar.

## Owner
**`eric`'s lane (the game lane).** The bar's code lives in `web/src/game/nav-bar/`. It links to `sharan`'s `/progress`
and `/auth/login` and to the learning lane's `/learn` **by URL only**, and nothing in those folders changes. If one of
those pages needs a tweak to sit under the bar, file a `needs-human` issue for its person. When the learning lane gets
a person, the Learn slot's label and path are still the game lane's to change.

## Plan
**Lab first:** `depends_on` includes `lab`, so this isn't ready until `changes/lab.md` is on main (#683, part 3).
A nav link to a half-done Lab looks worse than none.
1. **`feat(nav-bar)`:** one PR with the bar, its slot list and test, `verify-nav.mjs` and the done note.
2. **`fix(core-loop)`:** the one-line mount of `<NavBar />` in `web/src/app/layout.tsx`, the same way help-overlay was
   mounted (#652). It's a separate PR only because `layout.tsx` is core-loop's file and CI checks ownership. Open it
   right after the feature PR, and land them back to back.

## Requirements
- **A thin bar, with the slots in this order.** A slot shows only when its feature has a `changes/<slug>.md` on main,
  the same rule Lab uses:

  | Label | Path | Feature (done note) |
  |---|---|---|
  | Play | `/` | `song-select` |
  | Learn | `/learn` | `learning-ui` |
  | Lab | `/lab` | `lab` |
  | How it's built | `/how` | `how-it-works` |
  | Progress | `/progress` | `take-store` |

  How it's built appears once #443 and #460 merge and `changes/how-it-works.md` lands. That needs no change to the bar:
  the test reads the folder.
- **Login at the right.** Move the login link that `/` already shows into the bar. Reuse its component and its
  signed-in behavior; don't write a second copy. If it can't move without changing another lane's folder, leave it
  where it is and log why in `specs/decisions/nav-bar-login.md`.
- **The current page is marked** with the primary blue (`--pa-primary`) and `aria-current="page"`.
- **The Duo look, with the kit.** Use `MonoLabel` (and `Panel` if the bar needs a ground) from
  `web/src/game/duo-tokens/`. Zero radius. Saira condensed for labels. No hype pink.
- **It stays off** `/play`, `/cabinet`, `/attract` and `/operator`, and off every page while capture mode is on
  (`isCapture` from `web/src/game/capture-mode/`), so it never shows up in the video.
- **It doesn't break the select.** `/` keeps its layout, and every existing check on `/` (select-layout, select-stage,
  song-options, first-run) passes unchanged. If the bar needs room, it takes the top edge; log how in
  `specs/decisions/nav-bar-layout.md`. The quiet footer Lab link from #631 can stay. No new key on `/`, because its
  keys are taken. Every slot is a real link (Tab, Enter, open in a new tab).
- **Not in scope:** menus, dropdowns, search, account UI beyond the existing login link, and any change to the pages
  the bar links to.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/nav-bar`:
   - every slot's slug has a `changes/<slug>.md` (the test reads the folder), and no done slot is missing;
   - every slot's path is a page under `web/src/app/`;
   - the hide rule returns true for `/play`, `/cabinet`, `/attract`, `/operator` and capture mode, and false for `/`,
     `/learn`, `/lab` and `/progress`.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug nav-bar --worktree . --cmd "node {worktree}/web/src/game/nav-bar/verify-nav.mjs --out {out}"`.
   It prints `verify-nav: pass` or names each failed step:
   1. `/` shows the bar, with Play marked current.
   2. Each slot's link loads with a 200 status and no page error, and that page marks its own slot current.
   3. `/play?song=twinkle`, `/cabinet` and `/?capture=1` show no bar.
   4. Screenshots `nav-1280.png` and `nav-1920.png` of `/`.
3. Eric looks at it once on `/`. Mark that in the done note.

## How it's built and checked
Follow `specs/context/visual-direction.md`, build it with the `frontend-design` skill, and review it with taste v2's
step 8, "Look", at 1280×720 and 1920×1080. Before and after screenshots of `/` go in the PR.

## Defaults
- **In `extras`, after lab.**
- Log any choice this spec doesn't make in `specs/decisions/nav-bar-*.md`.
