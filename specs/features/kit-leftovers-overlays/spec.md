---
name: "Kit leftovers over a take: the wait hint upright, the L / R legend square, the toasts square"
depends_on: ["duo-tokens", "wait-hint", "hand-colors", "notice-toast"]
owns: ["specs/features/kit-leftovers-overlays/", "changes/kit-leftovers-overlays.md", "specs/decisions/kit-leftovers-overlays-"]
assignee: "eric"
---

# Kit leftovers over a take

Issues #1132, #1135 and #1137, from the polish refill. Three things drawn over a take still carry the old look: an
italic, rounded corners and a system font. The kit is zero radius and upright (`duo-tokens/Kit.tsx`,
`specs/features/duo-tokens/spec.md`), and `specs/context/visual-direction.md:89-90` says "No italic". One PR, since
they're one thing a person sees: what floats over the highway. It's a normal game-lane change with the design pass,
and it has no flag.

## The changes
1. **The wait hint (#1132):** Learn mode's note name over the waiting keys is drawn `italic 900` (`wait-hint/index.ts:162`).
   Draw it upright, at the size it uses today (`0.089 * f.height`, `:159`). Italic isn't loaded
   (`app/layout.tsx:13-14`), so today's slant is synthesized. The bar numbers' italic (`bar-lines/index.ts:60`) is
   not this spec's: open PR #1122 (highway-field) is changing that file.
2. **The two-hand legend (#1135):** the L / R legend over every two-hand count-in (`hand-colors/index.ts:32`, only
   while `frame.nowMs < 0`):
   - the chips are square: today `roundRect(..., 6)` (`:45`);
   - the letters are in the kit's data face, `canvasFonts.data()` from `duo-tokens/canvas.ts`, not
     `700 16px system-ui` (`:38`);
   - they scale from 16 px at 720 to 24 px at 1080 high, the video rule `notice-toast/index.ts:67` and
     `crash-guard.module.css:2` already apply, with the chip scaling to match.
3. **The notice toast (#1137):** `.pa-toast` (`notice-toast/index.ts:72`) is `border-radius: 6px`. Make it 0, with
   its left accent bar and timing unchanged. These are the MIDI connected and reconnecting notices and the "plugin
   stopped" toast that show over a take.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/game/wait-hint/index.ts`, `wait-hint.test.ts` | wait-hint |
| `web/src/game/hand-colors/index.ts`, `hand-colors.test.ts` | hand-colors |
| `web/src/game/notice-toast/index.ts`, `notice-toast.test.ts` | notice-toast |

`web/src/game/bar-lines/index.ts` is held by #1122 (highway-field): don't touch it.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080:
  - a Learn take with a waiting note name, as `wait-hint/verify-wait-hint.mjs` opens it
    (`/play?song=twinkle&mode=wait&midi=sim&input=test`), plus the same under reduced motion;
  - a two-hand song's count-in with the L / R legend;
  - a toast over a take (`verify-toast.mjs` raises one with `/play?song=fur-elise&bot=nobody&input=test`).
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
- **(a) The wait hint:** a unit test on the drawn font string: it has no `italic`, and its px size is still
  `0.089 * height` at 720 and 1080.
- **(b) The legend:**
  - a test with a mocked context shows no `roundRect` with a radius above 0 (or a plain `rect`) for the chips;
  - the letters' font string comes from `canvasFonts.data()`;
  - its px size is 16 at a 720-high frame and 24 at 1080, and the chip grows with it.
- **(c) The toast:** a test on the injected CSS finds `border-radius: 0` (or none) on `.pa-toast`, and the accent bar
  and timings unchanged; `notice-toast`'s existing tests stay green. `verify-toast.mjs` runs in CI's browser suite.
- **Unit tests:** `pnpm -C web exec vitest run src/game/wait-hint src/game/hand-colors src/game/notice-toast`.
- **(d) Shots and taste v2 scores** in the PR (Design pass above).
- The done note says "not verified locally; covered by main's scheduled full run" for the browser checks.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/kit-leftovers-overlays-*.md`.
- No new dependency, no new token, and nothing else in these files restyled.
